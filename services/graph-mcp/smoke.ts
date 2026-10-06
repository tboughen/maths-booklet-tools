import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { graphHash } from "../../packages/graph-core/src/interchange";
import type { GraphEnvelope } from "../../packages/graph-core/src/interchange";
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
  if (tools.tools.length !== 3) throw Error("Expected three graph tools.");
  const reply = await client.callTool({
    name: "create_graph",
    arguments: {
      schemaVersion: 1,
      objects: [
        {
          kind: "line",
          id: "line",
          equation: { kind: "slope", slope: "1/2", intercept: -1 },
          equationVisible: true,
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
      operations: [{ op: "set_label", id: "line", visible: false }],
    },
  });
  if (revised.isError) throw Error("Revision failed.");
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
