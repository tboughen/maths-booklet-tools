import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { graphHash } from "../../packages/graph-core/src/interchange";
import type { GraphEnvelope } from "../../packages/graph-core/src/interchange";
import { ratioHash } from "../../packages/ratio-table-core/src/interchange";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
const base = process.argv[2];
if (!base)
  throw Error("Supply the service origin, e.g. http://127.0.0.1:8787.");
let healthy = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    healthy = (await fetch(new URL("/healthz", base))).ok;
    if (healthy) break;
  } catch {
    /* Wait for container startup. */
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!healthy) throw Error("The service health check failed.");
const client = new Client({ name: "maths-graph-release-smoke", version: "1" });
try {
  await client.connect(
    new StreamableHTTPClientTransport(new URL("/mcp", base)),
  );
  const tools = await client.listTools();
  const expected = ["graph_capabilities", "create_graph", "revise_graph", "ratio_table_capabilities", "create_ratio_table", "revise_ratio_table"];
  if (JSON.stringify(tools.tools.map(tool => tool.name)) !== JSON.stringify(expected)) throw Error("Expected the graph and ratio-table tool trios.");
  const reply = await client.callTool({
    name: "create_graph",
    arguments: {
      schemaVersion: 1,
      objects: [
        {
          kind: "line",
          id: "line",
          equation: { kind: "slope", slope: "1/2", intercept: -1 },
        },
      ],
    },
  });
  if (reply.isError) throw Error("Graph creation failed.");
  const data = reply.structuredContent as {
    envelope: GraphEnvelope;
    contentHash: string;
    printVerified: boolean;
    downloads: Record<string, { url: string }>;
    printRaster: { width: number; height: number };
  };
  if (!data.printVerified) throw Error("Print verification is missing.");
  if (
    data.envelope.document.objects.some(
      (object) => object.kind === "straight" && object.equationVisible,
    )
  )
    throw Error(
      "A newly plotted equation should have no printed label by default.",
    );
  for (const format of ["png", "svg", "json"]) {
    const response = await fetch(data.downloads[format].url);
    if (!response.ok) throw Error(format + " download failed.");
    if (format === "png")
      verifyPrintBytes(
        new Uint8Array(await response.arrayBuffer()),
        data.printRaster.width,
        data.printRaster.height,
      );
    else if (format === "svg") {
      if ((await response.text()).includes("<text"))
        throw Error("SVG fonts were not outlined.");
    } else if (
      (await graphHash((await response.json()) as GraphEnvelope)) !==
      data.contentHash
    )
      throw Error("Editable JSON changed.");
  }
  const revised = await client.callTool({
    name: "revise_graph",
    arguments: {
      envelope: data.envelope,
      baseHash: data.contentHash,
      operations: [{ op: "set_label", id: "line", visible: true }],
    },
  });
  if (revised.isError) throw Error("Revision failed.");
  const labelled = revised.structuredContent as typeof data;
  const labelledLine = labelled.envelope.document.objects[0];
  if (labelledLine.kind !== "straight" || !labelledLine.equationVisible)
    throw Error("Explicit equation labels should remain available.");
  const hidden = await client.callTool({
    name: "revise_graph",
    arguments: {
      envelope: labelled.envelope,
      baseHash: labelled.contentHash,
      operations: [{ op: "set_label", id: "line", visible: false }],
    },
  });
  if (
    hidden.isError ||
    (hidden.structuredContent as typeof data).contentHash !== data.contentHash
  )
    throw Error(
      "Hiding the equation label changed the graph's mathematical content.",
    );
  const maximum = await client.callTool({
    name: "create_graph",
    arguments: {
      schemaVersion: 1,
      axes: {
        x: { negativeSquares: 9, positiveSquares: 9, unitsPerSquare: 0.5 },
        y: { negativeSquares: 13, positiveSquares: 13, unitsPerSquare: 2 },
      },
      objects: [
        {
          kind: "line",
          equation: { kind: "slope", slope: -2, intercept: 3 },
          equationVisible: true,
        },
      ],
    },
  });
  if (maximum.isError) throw Error("Maximum-grid render failed.");
  const largest = maximum.structuredContent as typeof data;
  const maximumPng = await fetch(largest.downloads.png.url);
  if (!maximumPng.ok) throw Error("Maximum-grid download failed.");
  verifyPrintBytes(
    new Uint8Array(await maximumPng.arrayBuffer()),
    largest.printRaster.width,
    largest.printRaster.height,
  );
  const ratio = await client.callTool({ name: "create_ratio_table", arguments: {
    schemaVersion: 1, mode: "annotated", rows: [
      { id: "start", cells: [{ kind: "number", value: "3" }, { kind: "number", value: "2" }] },
      { id: "target", cells: [{ kind: "number", value: "1" }, { kind: "answer-line" }] },
    ], transitions: [{ from: "start", to: "target", operation: "divide", factor: "3" }],
  } });
  if (ratio.isError) throw Error("Ratio-table creation failed.");
  const table = ratio.structuredContent as Omit<typeof data, "envelope"> & { envelope: RatioEnvelope };
  if (!table.printVerified || table.envelope.document.rows[1].cells[1].kind !== "answer-line")
    throw Error("The ratio scaffold or verified print artifact was lost.");
  if (await ratioHash(table.envelope) !== table.contentHash) throw Error("Ratio hash mismatch.");
  for (const format of ["png", "svg", "json"]) {
    const response = await fetch(table.downloads[format].url);
    if (!response.ok) throw Error("Ratio " + format + " download failed.");
    if (format === "png") verifyPrintBytes(new Uint8Array(await response.arrayBuffer()), table.printRaster.width, table.printRaster.height);
    if (format === "svg") {
      const svg = await response.text();
      if (svg.includes("<text") || !svg.includes("<title>Ratio table</title>")) throw Error("The ratio SVG is not correctly outlined.");
    }
    if (format === "json" && await ratioHash(await response.json() as RatioEnvelope) !== table.contentHash) throw Error("Ratio JSON changed.");
  }
  const ratioRevision = await client.callTool({ name: "revise_ratio_table", arguments: {
    envelope: table.envelope, baseHash: table.contentHash, operations: [{ op: "fill_next_row", from: "start", overwrite: true }],
  } });
  if (ratioRevision.isError) throw Error("Ratio revision failed.");
  const target = (ratioRevision.structuredContent as typeof table).envelope.document.rows[1].cells[1];
  if (target.kind !== "number" || target.value !== "2/3") throw Error("The explicit ratio fill is not exact.");
  const health = (await (await fetch(new URL("/healthz", base))).json()) as {
    buildId: string;
  };
  process.stdout.write(
    JSON.stringify({
      ok: true,
      tools: tools.tools.map((t) => t.name),
      printVerified: true,
      buildId: health.buildId,
    }) + "\n",
  );
} finally {
  await client.close();
}
