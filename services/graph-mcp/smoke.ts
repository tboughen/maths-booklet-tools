import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Resvg } from "@resvg/resvg-js";
import { unzipSync } from "fflate";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { graphHash } from "../../packages/graph-core/src/interchange";
import type { GraphEnvelope } from "../../packages/graph-core/src/interchange";
import { ratioHash, ratioMetrics } from "../../packages/ratio-table-core/src/interchange";
import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import { contentHash as valueHash, type ValueEnvelope } from "../../packages/value-graph-core/src/interchange";
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
  const expected = ["graph_capabilities", "create_graph", "revise_graph", "ratio_table_capabilities", "create_ratio_table", "revise_ratio_table", "value_graph_capabilities", "create_value_graph", "revise_value_graph", "check_diagram_placement", "download_diagram_bundle"];
  if (JSON.stringify(tools.tools.map(tool => tool.name)) !== JSON.stringify(expected)) throw Error("Expected the graph, ratio-table and table-of-values tool trios.");
  // ChatGPT imports every advertised array schema, including nested unions.
  function checkArrays(value: unknown): void {
    if (!value || typeof value !== "object") return;
    const schema = value as Record<string, unknown>;
    if (schema.type === "array" && !schema.items)
      throw Error("An advertised array schema has no items.");
    for (const child of Object.values(schema)) {
      if (Array.isArray(child)) child.forEach(checkArrays);
      else checkArrays(child);
    }
  }
  tools.tools.forEach(tool => {
    checkArrays(tool.inputSchema);
    checkArrays(tool.outputSchema);
  });
  const capabilities = await client.callTool({ name: "ratio_table_capabilities", arguments: {} });
  const caps = capabilities.structuredContent as {
    supportedColumns: number[]; rendererVersions: string[];
    rows: { minimum: number; maximum: number }; revisionOperations: string[];
  };
  if (capabilities.isError || JSON.stringify(caps.supportedColumns) !== "[1,2,3]" ||
      JSON.stringify(caps.rendererVersions) !== '["ratio-1","ratio-2"]' ||
      caps.rows.minimum !== 1 || caps.rows.maximum !== 6 ||
      !caps.revisionOperations.includes("add_column") || !caps.revisionOperations.includes("remove_column"))
    throw Error("Extended ratio capabilities were not advertised.");
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
    physicalSizeCm: {width: number; height: number};
  };
  if (!data.printVerified) throw Error("Print verification is missing.");
  const advice = await client.callTool({name: "check_diagram_placement", arguments: {kind: "graph", envelope: data.envelope, widthMm: data.physicalSizeCm.width * 7.5}});
  if (advice.isError || Math.abs((advice.structuredContent as {uniformScale: number}).uniformScale - 0.75) > 1e-10) throw Error("Placement advice failed.");
  const bundleReply = await client.callTool({name: "download_diagram_bundle", arguments: {kind: "graph", envelope: data.envelope}});
  if (bundleReply.isError) throw Error("Bundle tool failed.");
  const bundleLink = (bundleReply.structuredContent as {download: {url: string}}).download;
  const bundleResponse = await fetch(bundleLink.url);
  if (!bundleResponse.ok) throw Error("Bundle retrieval failed.");
  const bundleFiles = unzipSync(new Uint8Array(await bundleResponse.arrayBuffer()));
  if (JSON.stringify(JSON.parse(Buffer.from(bundleFiles["source.json"]).toString())) !== JSON.stringify(data.envelope)) throw Error("Bundled source changed.");
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
  async function reviseTable(source: typeof table, operations: unknown[]) {
    const reply = await client.callTool({ name: "revise_ratio_table", arguments: {
      envelope: source.envelope, baseHash: source.contentHash, operations,
    } });
    if (reply.isError) throw Error("Extended ratio revision failed.");
    return reply.structuredContent as typeof table;
  }
  const extended = await reviseTable(table, [{ op: "add_column", heading: { text: "z", italic: true, direction: "none" } }]);
  if (extended.envelope.schemaVersion !== 2 || extended.envelope.rendererVersion !== "ratio-2" ||
      extended.envelope.document.rows.some(row => row.cells[2].kind !== "empty"))
    throw Error("Column addition did not preserve a blank third column.");
  const factorEdit = await reviseTable(extended, [{ op: "set_transition", transition: {
    from: "start", to: "target", operation: "multiply", factor: "2/3",
  } }]);
  if (JSON.stringify(factorEdit.envelope.document.rows) !== JSON.stringify(extended.envelope.document.rows) ||
      factorEdit.envelope.document.transitions.length !== 1 || factorEdit.envelope.document.transitions[0].factor !== "2/3")
    throw Error("Editing the shared factor altered table values.");
  for (const format of ["png", "svg", "json"]) {
    const response = await fetch(factorEdit.downloads[format].url);
    if (!response.ok) throw Error("Extended ratio download failed.");
    if (format === "png") verifyPrintBytes(new Uint8Array(await response.arrayBuffer()), factorEdit.printRaster.width, factorEdit.printRaster.height);
    if (format === "svg") {
      const svg = await response.text();
      if (svg.includes("<text")) throw Error("Extended SVG text was not outlined.");
      // Outlining removes CSS classes. Check actual exported ink in each lane.
      const metrics = ratioMetrics(factorEdit.envelope.document);
      const raster = new Resvg(svg.replace(/width="[^"]+"/, `width="${Math.ceil(metrics.width)}px"`)
        .replace(/height="[^"]+"/, `height="${metrics.height}px"`)).render();
      const pixels = raster.pixels;
      const ink = (x1: number, x2: number, y1: number, y2: number) => {
        let count = 0;
        for (let y = y1; y < y2; y++) for (let x = Math.round(x1); x < Math.round(x2); x++)
          if (pixels[(y * raster.width + x) * 4] < 100) count++;
        return count;
      };
      for (let column = 0; column < 3; column++) {
        const edge = metrics.tableLeft + column * metrics.columnWidth + 150;
        if (ink(edge + 9, edge + 41, 175, 256) < 50 ||
            ink(edge + 51, edge + metrics.gutter - 5, 198, 244) < 20)
          throw Error("A three-column arrow or factor lane is blank in the exported SVG.");
      }
    }
    if (format === "json" && await ratioHash(await response.json() as RatioEnvelope) !== factorEdit.contentHash)
      throw Error("Extended ratio JSON changed.");
  }
  const restored = await reviseTable(extended, [{ op: "remove_column", column: 2 }]);
  if (restored.contentHash !== table.contentHash || JSON.stringify(restored.envelope) !== JSON.stringify(table.envelope))
    throw Error("Removing the added column did not restore the exact legacy table.");
  const single = await reviseTable(extended, [
    { op: "remove_row", rowId: "target" }, { op: "remove_column", column: 2 }, { op: "remove_column", column: 1 },
  ]);
  if (single.envelope.document.rows.length !== 1 || single.envelope.document.headings.length !== 1 ||
      single.envelope.schemaVersion !== 2 || single.envelope.document.transitions.length !== 0)
    throw Error("Single-cell tables or transition cleanup failed.");
  for (const operation of [{ op: "remove_row", rowId: "start" }, { op: "remove_column", column: 0 }]) {
    const refused = await client.callTool({ name: "revise_ratio_table", arguments: {
      envelope: single.envelope, baseHash: single.contentHash, operations: [operation],
    } });
    if (!refused.isError) throw Error("Removing the final row/column should be refused.");
  }
  const maximumRatio = await client.callTool({ name: "create_ratio_table", arguments: {
    schemaVersion: 2, mode: "annotated", size: "large",
    rows: Array.from({ length: 6 }, (_, index) => ({ id: `r${index}`, cells: [
      { kind: "number", value: String(index + 1) }, { kind: "empty" }, { kind: "answer-line" },
    ] })),
    transitions: Array.from({ length: 5 }, (_, index) => ({ from: `r${index}`, to: `r${index + 1}`, operation: "multiply", factor: "2" })),
  } });
  if (maximumRatio.isError) throw Error("Maximum six-row/three-column render failed.");
  const maxRatio = maximumRatio.structuredContent as typeof table;
  const maxRatioPng = await fetch(maxRatio.downloads.png.url);
  if (!maxRatioPng.ok) throw Error("Maximum ratio PNG failed.");
  verifyPrintBytes(new Uint8Array(await maxRatioPng.arrayBuffer()), maxRatio.printRaster.width, maxRatio.printRaster.height);
  const valuesReply = await client.callTool({name:"create_value_graph",arguments:{}});
  if(valuesReply.isError)throw Error("Value-table scaffold creation failed.");
  const values=valuesReply.structuredContent as {envelope:ValueEnvelope;contentHash:string;downloads:Record<string,{url:string}>;printRaster:{width:number;height:number}};
  if(values.envelope.document.columns.filter(c=>c.y.kind==="blank").length!==5)throw Error("Value-table blanks changed.");
  for(const format of ["svg","png","json"]){const response=await fetch(values.downloads[format].url);if(!response.ok)throw Error("Value-graph download failed.");if(format==="png")verifyPrintBytes(new Uint8Array(await response.arrayBuffer()),values.printRaster.width,values.printRaster.height);if(format==="json"&&await valueHash(await response.json() as ValueEnvelope)!==values.contentHash)throw Error("Value-graph JSON changed.");}
  const health = (await (await fetch(new URL("/healthz", base))).json()) as {
    buildId: string;
  };
  process.stdout.write(
    JSON.stringify({
      ok: true,
      tools: tools.tools.map((t) => t.name),
      printVerified: true,
      extendedRatiosVerified: true,
      valueGraphVerified: true,
      placementVerified: true,
      bundleVerified: true,
      buildId: health.buildId,
    }) + "\n",
  );
} finally {
  await client.close();
}
