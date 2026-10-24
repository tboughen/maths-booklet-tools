// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { graphService } from "./server";
import type { Server } from "node:http";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { receiveSvg } from "./svg-consumer";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import * as ti from "../../packages/triangle-core/src/interchange";
import * as core from "../../packages/triangle-core/src/index";
import { parseTriangleLink } from "../../packages/triangle-core/src/links";
const clients: Client[] = [], servers: Server[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map(c => c.close()));
  await Promise.all(servers.splice(0).map(s => new Promise<void>(r => s.close(() => r()))));
});
async function start() {
  const reserve = createServer();
  await new Promise<void>(r => reserve.listen(0, "127.0.0.1", r));
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>(r => reserve.close(() => r()));
  const base = `http://127.0.0.1:${port}`;
  const server = graphService({ publicUrl: base, editorUrl: "https://mathsdock.co.uk/", keys: { test: "triangle-test-only-synthetic-key-1234567890" }, activeKey: "test" });
  servers.push(server);
  await new Promise<void>(r => server.listen(port, "127.0.0.1", r));
  const c = new Client({ name: "triangle-acceptance", version: "1" }); clients.push(c);
  await c.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
  return c;
}
type Result = { envelope: core.Envelope; contentHash: string; downloads: Partial<Record<string, {url:string}>>; editorUrl: string | null; physicalSizeCm: {width:number;height:number}; printRaster: {width:number;height:number}; printVerified:boolean };
async function call(c: Client, name: string, args: Record<string,unknown>) {
  const r = await c.callTool({ name, arguments: args });
  expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
  return { raw: r, data: r.structuredContent as Result };
}
async function artifact(r: Awaited<ReturnType<typeof call>>, format: string): Promise<Buffer> {
  const url = r.data.downloads[format]?.url;
  if (url) { const response = await fetch(url); expect(response.status).toBe(200); return Buffer.from(await response.arrayBuffer()); }
  for (const block of r.raw.content as Array<{type:string;resource?:{uri:string;text?:string;blob?:string}}>) {
    if (block.resource?.uri.endsWith("source." + format)) return block.resource.blob ? Buffer.from(block.resource.blob,"base64") : Buffer.from(block.resource.text!,"utf8");
  }
  throw Error("Missing artifact: " + format);
}
function homogeneous(v: unknown): void {
  if (!v || typeof v !== "object") return;
  const obj = v as Record<string,unknown>;
  expect(Array.isArray(obj.items)).toBe(false);
  expect("prefixItems" in obj || "additionalItems" in obj).toBe(false);
  Object.values(obj).forEach(homogeneous);
}
it("advertises all 27 tools with compatible input AND output schemas and complete Triangle metadata", async () => {
  const c = await start(), tools = (await c.listTools()).tools;
  expect(tools).toHaveLength(27);
  for (const name of ["triangle_capabilities","create_triangle","revise_triangle"]) expect(tools.some(t => t.name === name)).toBe(true);
  for (const t of tools) { homogeneous(t.inputSchema); homogeneous(t.outputSchema); }
  expect(() => homogeneous({ type:"array",items:[{type:"string"}] })).toThrow();
  for (const name of ["check_diagram_placement","get_diagram_svg","download_diagram_bundle"]) expect(JSON.stringify(tools.find(t => t.name === name)!.inputSchema)).toContain('"triangle"');
  const cap = await c.callTool({name:"triangle_capabilities",arguments:{}});
  expect(cap.isError).not.toBe(true);
  const text = JSON.stringify(cap.content);
  for (const required of ["calculate_and_store","maximumSourceBytes","64000","triangle-2","operationPayloads"]) expect(text).toContain(required);
});
it.each([undefined,"external-height","ssa","fractions","joined-rules","bisector"])("creates %s with complete exact source and actual print artifacts", async example => {
  const c = await start(), r = await call(c,"create_triangle",example ? {spec:{example}} : {}), e = ti.create(example ? {spec:{example}} : {});
  expect(r.data.envelope).toEqual(e);
  expect(r.data.contentHash).toBe(await ti.hash(e));
  const json = await artifact(r,"json"), svg = await artifact(r,"svg"), png = await artifact(r,"png");
  expect(JSON.parse(json.toString("utf8"))).toEqual(e);
  expect(svg.toString()).not.toMatch(/<(?:text|image|script|foreignObject)\b/);
  expect(svg.toString()).toContain("Triangle diagram");
  verifyPrintBytes(png,r.data.printRaster.width,r.data.printRaster.height);
  const g = core.layout(e);
  expect(r.data.physicalSizeCm).toEqual({width:g.width/10,height:g.height/10});
  expect(r.data.printVerified).toBe(true);
  if (r.data.editorUrl) expect(parseTriangleLink(r.data.editorUrl)).toEqual(e);
  const refreshed = await call(c,"revise_triangle",{envelope:e,baseHash:r.data.contentHash,operations:[]});
  expect(refreshed.data.contentHash).toBe(r.data.contentHash);
  expect(refreshed.data.envelope).toEqual(e);
},30000);
it("revises a scaffold, saves only explicit answers and rejects stale hash", async () => {
  const c = await start(), r = await call(c,"create_triangle",{spec:{example:"missing-side"}});
  const edited = await call(c,"revise_triangle",{envelope:r.data.envelope,baseHash:r.data.contentHash,operations:[{op:"set_label",ref:"e:BC",patch:{state:"answer-line"}}]});
  expect(core.getLabel(edited.data.envelope,"e:BC")).toMatchObject({state:"answer-line",answer:"10",answerVisible:false});
  const wrong = await c.callTool({name:"revise_triangle",arguments:{envelope:r.data.envelope,baseHash:"0".repeat(64),operations:[]}});
  expect(wrong.isError).toBe(true);
  expect(JSON.stringify(wrong.content)).toContain("base_hash_mismatch");
  const before = core.canonical(r.data.envelope);
  const invalid = await c.callTool({name:"revise_triangle",arguments:{envelope:r.data.envelope,baseHash:r.data.contentHash,operations:[{op:"set_print",widthCm:14},{op:"move_vertex",id:"missing",x:0,y:0}]}});
  expect(invalid.isError).toBe(true); expect(core.canonical(r.data.envelope)).toBe(before);
});
it("supports placement,bundles and original multi-chunk SVG without editing source", async () => {
  const c = await start(), r = await call(c,"create_triangle",{}), source = {kind:"triangle" as const,envelope:r.data.envelope};
  const placement = await c.callTool({name:"check_diagram_placement",arguments:{...source,widthMm:60}});
  expect(placement.isError).not.toBe(true);
  expect(placement.structuredContent).toMatchObject({uniformScale:0.5,wouldDistort:false});
  const bundle = await c.callTool({name:"download_diagram_bundle",arguments:source}); expect(bundle.isError).not.toBe(true);
  const data = bundle.structuredContent as {download?:{url:string};inline:boolean};
  let zip: Buffer;
  if (data.download) zip = Buffer.from(await (await fetch(data.download.url)).arrayBuffer());
  else { const block = (bundle.content as Array<{type:string;resource?:{blob:string}}>).find(v=>v.resource?.blob)!;zip=Buffer.from(block.resource!.blob,"base64"); }
  const members = unzipSync(zip);
  expect(Object.keys(members).sort()).toEqual(["README.txt","diagram.png","diagram.svg","print-info.json","source.json"]);
  expect(JSON.parse(Buffer.from(members["source.json"]).toString("utf8"))).toEqual(source.envelope);
  const control = await artifact(r,"svg");
  const received = await receiveSvg(async input => {
    const reply = await c.callTool({name:"get_diagram_svg",arguments:{...input,maxChunkBytes:1024}});
    expect(reply.isError).not.toBe(true);return reply.structuredContent;
  },source,{expectedSourceContentHash:r.data.contentHash,expectedPhysicalSizeCm:r.data.physicalSizeCm});
  expect(received.chunks).toBeGreaterThan(1);
  expect(received.body.equals(control)).toBe(true);
  expect(createHash("sha256").update(control).digest("hex")).toBe(received.svgSha256);
  expect(Buffer.from(members["diagram.svg"]).equals(control)).toBe(true);
},30000);
it("does not accept Venn outputView for Triangle and preserves version validation", async () => {
  const c = await start(), r = await call(c,"create_triangle",{});
  const invalid = await c.callTool({name:"get_diagram_svg",arguments:{kind:"triangle",envelope:r.data.envelope,outputView:"answer"}});
  expect(invalid.isError).toBe(true);
  const v2 = await call(c,"revise_triangle",{envelope:r.data.envelope,baseHash:r.data.contentHash,operations:[{op:"set_area",triangleId:"T1",label:{prefix:"Area = ",state:"answer-line"}}]});
  expect(v2.data.envelope.rendererVersion).toBe("triangle-2");
  const invalidV1 = await c.callTool({name:"create_triangle",arguments:{envelope:{...v2.data.envelope,schemaVersion:1}}});
  expect(invalidV1.isError).toBe(true);
});
