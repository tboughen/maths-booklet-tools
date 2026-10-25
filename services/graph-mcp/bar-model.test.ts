// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import type { Server } from "node:http";
import { unzipSync } from "fflate";
import { graphService } from "./server";
import { receiveSvg } from "./svg-consumer";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import * as c from "../../packages/bar-model-core/src";
import { parseLink } from "../../packages/bar-model-core/src/interchange";
const clients: Client[] = [],
  servers: Server[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))),
  );
});
async function start() {
  const reserve = createServer();
  await new Promise<void>((r) => reserve.listen(0, "127.0.0.1", r));
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>((r) => reserve.close(() => r()));
  const base = `http://127.0.0.1:${port}`;
  const server = graphService({
    publicUrl: base,
    editorUrl: "https://mathsdock.co.uk/",
    keys: { test: "bar-model-synthetic-qualification-key" },
    activeKey: "test",
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const client = new Client({ name: "bar-qualification", version: "1" });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(base + "/mcp")),
  );
  return client;
}
type Result = {
  envelope: c.Envelope;
  contentHash: string;
  downloads: Record<string, { url: string }>;
  physicalSizeCm: { width: number; height: number };
  printRaster: { width: number; height: number };
  editorUrl: string;
};
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<Result> {
  const r = await client.callTool({ name, arguments: args });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  return r.structuredContent as Result;
}
it("advertises complete bar schemas with homogeneous arrays and preserves named old families", async () => {
  const client = await start(),
    tools = (await client.listTools()).tools;
  const names = tools.map((t) => t.name);
  const instructions = client.getInstructions();
  expect(instructions).toContain("bar models");
  expect(instructions).toContain("one shared unit width");
  expect(instructions).toContain("Do not fill pupil answers");
  expect(instructions).toContain("Do not silently redraw");
  for (const family of [
    "graph",
    "ratio_table",
    "value_graph",
    "cuboid",
    "number_line",
    "venn",
    "algebra_grid",
    "bar_model",
  ])
    for (const name of [
      `${family}_capabilities`,
      `create_${family}`,
      `revise_${family}`,
    ])
      expect(names).toContain(name);
  expect(names.filter((n) => n.includes("bar_model")).sort()).toEqual([
    "bar_model_capabilities",
    "create_bar_model",
    "revise_bar_model",
  ]);
  function check(v: unknown) {
    if (!v || typeof v !== "object") return;
    const s = v as Record<string, unknown>;
    if (s.type === "array") {
      expect(s.items).toBeTypeOf("object");
      expect(Array.isArray(s.items)).toBe(false);
    }
    expect(s).not.toHaveProperty("prefixItems");
    for (const child of Object.values(s))
      if (Array.isArray(child)) child.forEach(check);
      else check(child);
  }
  tools.forEach((t) => {
    check(t.inputSchema);
    check(t.outputSchema);
  });
  const cap = await client.callTool({
    name: "bar_model_capabilities",
    arguments: {},
  });
  expect(JSON.stringify(cap.content)).toContain("discardSpans");
});
it("creates, downloads and revises exact saved resources with native print facts", async () => {
  const client = await start(),
    r = await call(client, "create_bar_model", { spec: { example: "BM08" } });
  expect(parseLink(r.editorUrl)).toEqual(r.envelope);
  expect(r.contentHash).toBe(await c.hash(r.envelope));
  for (const format of ["json", "svg", "png"]) {
    const response = await fetch(r.downloads[format].url);
    expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (format === "json")
      expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual(r.envelope);
    if (format === "png")
      verifyPrintBytes(bytes, r.printRaster.width, r.printRaster.height);
    if (format === "svg") {
      const svg = new TextDecoder().decode(bytes);
      expect(svg).not.toMatch(/<text\b|<image\b/);
      expect(svg).toContain(`width="${r.physicalSizeCm.width * 10}mm"`);
    }
  }
  const n = await call(client, "revise_bar_model", {
    envelope: r.envelope,
    baseHash: r.contentHash,
    operations: [{ op: "set_part", barId: "b1", partId: "b1p1", shade: true }],
  });
  expect(n.envelope.document.bars[0].parts[3].label).toEqual(
    c.label("18", "hidden"),
  );
  expect(n.physicalSizeCm).toEqual(r.physicalSizeCm);
  expect(n.envelope.document.spans).toEqual(r.envelope.document.spans);
  const old = await client.callTool({
    name: "revise_bar_model",
    arguments: {
      envelope: r.envelope,
      baseHash: n.contentHash,
      operations: [],
    },
  });
  expect(old.isError).toBe(true);
  const advice = await client.callTool({
    name: "check_diagram_placement",
    arguments: {
      kind: "bar-model",
      envelope: n.envelope,
      widthMm: n.physicalSizeCm.width * 10,
    },
  });
  expect(advice.isError).not.toBe(true);
  expect(advice.structuredContent).toMatchObject({ uniformScale: 1 });
  const bundle = await client.callTool({
    name: "download_diagram_bundle",
    arguments: { kind: "bar-model", envelope: n.envelope },
  });
  expect(bundle.isError).not.toBe(true);
  const url = (bundle.structuredContent as { download: { url: string } })
    .download.url;
  const members = unzipSync(
    new Uint8Array(await (await fetch(url)).arrayBuffer()),
  );
  expect(Object.keys(members).sort()).toEqual([
    "README.txt",
    "diagram.png",
    "diagram.svg",
    "print-info.json",
    "source.json",
  ]);
  expect(JSON.parse(new TextDecoder().decode(members["source.json"]))).toEqual(
    n.envelope,
  );
  const direct = await receiveSvg(
    async (args) => {
      const reply = await client.callTool({
        name: "get_diagram_svg",
        arguments: args,
      });
      expect(reply.isError).not.toBe(true);
      return reply.structuredContent;
    },
    // Keep the complete test below the unchanged per-socket request allowance.
    { kind: "bar-model", envelope: n.envelope, maxChunkBytes: 4096 },
    {
      expectedSourceContentHash: n.contentHash,
      expectedPhysicalSizeCm: n.physicalSizeCm,
    },
  );
  const control = await fetch(n.downloads.svg.url);
  expect(control.status).toBe(200);
  expect(direct.body).toEqual(Buffer.from(await control.arrayBuffer()));
}, 30000);
it("creates explicit v2, revises secondary labels and captions, and saves original SVG and bundle bytes",async()=>{
  const v=await import("../../packages/bar-model-core/src/v2"),api=await import("../../packages/bar-model-core/src/versioned-interchange"),core=await import("../../packages/bar-model-core/src/versioned");
  const client=await start();
  const made=await client.callTool({name:"create_bar_model",arguments:{spec:{schemaVersion:2,starter:"equal-sections",count:5}}});
  expect(made.isError,JSON.stringify(made.content)).not.toBe(true);
  const initial=made.structuredContent as unknown as Result;
  const envelope=v.validate(initial.envelope),b=envelope.document.bars[0];
  expect(api.parseLink(initial.editorUrl)).toEqual(envelope);
  const changed=await client.callTool({name:"revise_bar_model",arguments:{envelope,baseHash:initial.contentHash,operations:[{op:"set_section_labels",barId:b.id,partIds:b.parts.map(p=>p.id),slot:"above",label:v.label("9")},{op:"add_caption",caption:{id:"calculation",label:v.label("4/5 × 45 = 36"),alignment:"centre"}}]}});
  expect(changed.isError,JSON.stringify(changed.content)).not.toBe(true);
  const r=changed.structuredContent as unknown as Result,n=v.validate(r.envelope);
  expect(n.document.bars[0].parts.every(p=>p.labels.above?.text==="9")).toBe(true);
  expect(n.document.bars[0].parts.every(p=>p.labels.inside.state==="blank")).toBe(true);
  expect(r.contentHash).toBe(await core.hash(n));
  const direct=await receiveSvg(async args=>{const result=await client.callTool({name:"get_diagram_svg",arguments:args});expect(result.isError).not.toBe(true);return result.structuredContent;},{kind:"bar-model",envelope:n},{expectedSourceContentHash:r.contentHash,expectedPhysicalSizeCm:r.physicalSizeCm});
  const svg=Buffer.from(await(await fetch(r.downloads.svg.url)).arrayBuffer());expect(direct.body).toEqual(svg);expect(svg.toString()).not.toMatch(/<text\b|<image\b/);
  const print=new Uint8Array(await(await fetch(r.downloads.png.url)).arrayBuffer());verifyPrintBytes(print,r.printRaster.width,r.printRaster.height);
  const bundle=await client.callTool({name:"download_diagram_bundle",arguments:{kind:"bar-model",envelope:n}});expect(bundle.isError).not.toBe(true);
  const members=unzipSync(new Uint8Array(await(await fetch((bundle.structuredContent as {download:{url:string}}).download.url)).arrayBuffer()));
  expect(Buffer.from(members["diagram.svg"])).toEqual(svg);expect(Buffer.from(members["diagram.png"])).toEqual(Buffer.from(print));expect(JSON.parse(new TextDecoder().decode(members["source.json"]))).toEqual(n);
},30000);
it("keeps the legacy base hash atomic when an upgrade batch fails",async()=>{
  const client=await start(),r=await call(client,"create_bar_model",{}),before=c.canonical(r.envelope);
  const failed=await client.callTool({name:"revise_bar_model",arguments:{envelope:r.envelope,baseHash:r.contentHash,operations:[{op:"upgrade_document"},{op:"set_section_label",barId:"missing",partId:"p",slot:"above",label:c.label("9")}]}});expect(failed.isError).toBe(true);expect(c.canonical(r.envelope)).toBe(before);
  const upgraded=await client.callTool({name:"revise_bar_model",arguments:{envelope:r.envelope,baseHash:r.contentHash,operations:[{op:"upgrade_document"}]}});expect(upgraded.isError,JSON.stringify(upgraded.content)).not.toBe(true);expect((upgraded.structuredContent as {envelope:{schemaVersion:number}}).envelope.schemaVersion).toBe(2);
},30000);
it("creates v3 horizontal working and handwriting spaces through actual SDK discovery and original SVG delivery",async()=>{
  const v=await import("../../packages/bar-model-core/src/v3"),core=await import("../../packages/bar-model-core/src/versioned"),examples=await import("../../packages/bar-model-core/src/lesson-examples-v3");
  const client=await start();
  const caps=await client.callTool({name:"bar_model_capabilities",arguments:{}});
  const cap=JSON.parse((caps.content as {type:string;text:string}[]).find(c=>c.type==="text")!.text);
  expect(cap.schemaVersions).toEqual([1,2,3]);expect(cap.rendererVersions).toContain("bar-model-3");
  const initial=await call(client,"create_bar_model",{envelope:examples.lessonExample("R4",true)});
  const changed=await client.callTool({name:"revise_bar_model",arguments:{envelope:initial.envelope,baseHash:initial.contentHash,operations:[{op:"set_section_label",barId:"b1",partId:"b1p1",slot:"inside",label:v.label("1/5","line")},{op:"update_caption",caption:{id:"caption1",label:v.label("n/5 of 45 = 36"),alignment:"left",format:"maths"}}]}});
  expect(changed.isError,JSON.stringify(changed.content)).not.toBe(true);
  const r=changed.structuredContent as unknown as Result,n=v.validate(r.envelope);
  expect(v.layout(n).writingBoxes).toHaveLength(1);expect(v.layout(n).barHeightMm).toBe(20);
  expect(r.contentHash).toBe(await core.hash(n));
  const direct=await receiveSvg(async args=>{const result=await client.callTool({name:"get_diagram_svg",arguments:args});expect(result.isError).not.toBe(true);return result.structuredContent;},{kind:"bar-model",envelope:n},{expectedSourceContentHash:r.contentHash,expectedPhysicalSizeCm:r.physicalSizeCm});
  expect(direct.body).toEqual(Buffer.from(await(await fetch(r.downloads.svg.url)).arrayBuffer()));
  expect(direct.body.toString()).not.toMatch(/<text\b|<image\b/);
  verifyPrintBytes(new Uint8Array(await(await fetch(r.downloads.png.url)).arrayBuffer()),r.printRaster.width,r.printRaster.height);
  const bad=await client.callTool({name:"revise_bar_model",arguments:{envelope:n,baseHash:r.contentHash,operations:[{op:"update_caption",caption:{id:"caption1",label:v.label("9/10/2026"),alignment:"left",format:"maths"}}]}});expect(bad.isError).toBe(true);expect(n.document.captions[0].label.text).toBe("n/5 of 45 = 36");
},30000);
it("exports maximum structure, rejects impossible layout and keeps source atomic", async () => {
  const client = await start(),
    max = await call(client, "create_bar_model", { spec: { example: "BM09" } });
  expect(max.envelope.document.bars.flatMap((b) => b.parts)).toHaveLength(96);
  const before = c.canonical(max.envelope);
  const bad = await client.callTool({
    name: "revise_bar_model",
    arguments: {
      envelope: max.envelope,
      baseHash: max.contentHash,
      operations: [{ op: "set_print", presentation: { unitMm: 16 } }],
    },
  });
  expect(bad.isError).toBe(true);
  expect(c.canonical(max.envelope)).toBe(before);
  const updated = await call(client, "revise_bar_model", {
    envelope: max.envelope,
    baseHash: max.contentHash,
    operations: [],
  });
  expect(updated.contentHash).toBe(max.contentHash);
}, 30000);
