/** Collect actual local/live MCP artifacts. This is SDK evidence, not host import acceptance. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { graphService } from "./server";
import { receiveSvg } from "./svg-consumer";
import { verifyPrintBytes } from "../../packages/graph-core/src/png-bytes";
import { canonical, getLabel, type Envelope } from "../../packages/triangle-core/src/index";
import { hash } from "../../packages/triangle-core/src/interchange";
import { parseTriangleLink } from "../../packages/triangle-core/src/links";
const output = resolve(process.argv[2] ?? "test-results/triangle-mcp");
await mkdir(output,{recursive:true});
let base = process.argv[3], server: ReturnType<typeof graphService> | undefined;
if (!base) {
  const reservation = createServer(); await new Promise<void>(r=>reservation.listen(0,"127.0.0.1",r));
  const port = (reservation.address() as {port:number}).port; await new Promise<void>(r=>reservation.close(()=>r()));
  base=`http://127.0.0.1:${port}`;
  server=graphService({publicUrl:base,editorUrl:"https://mathsdock.co.uk/",keys:{test:"triangle-collector-only-synthetic-key-123456"},activeKey:"test"});
  await new Promise<void>(r=>server!.listen(port,"127.0.0.1",r));
}
let requests=0, window=Date.now();
const request: typeof fetch = async(input,init)=>{
  if (++requests>=32) { await new Promise(r=>setTimeout(r,Math.max(0,61000-(Date.now()-window))));requests=1;window=Date.now(); }
  return fetch(input,init);
};
const c = new Client({name:"triangle-output-verification",version:"1"});
type Data = {envelope:Envelope;contentHash:string;editorUrl:string|null;downloads:Partial<Record<string,{url:string}>>;physicalSizeCm:{width:number;height:number};printRaster:{width:number;height:number}};
const cases: Array<Record<string,unknown>> = [];
async function call(name:string,args:Record<string,unknown>) {
  const reply=await c.callTool({name,arguments:args});assert(!reply.isError,JSON.stringify(reply.content));
  return {raw:reply,data:reply.structuredContent as Data};
}
async function file(r:Awaited<ReturnType<typeof call>>,format:string) {
  const url=r.data.downloads[format]?.url;
  if(url) {const response=await request(url);assert.equal(response.status,200);return Buffer.from(await response.arrayBuffer());}
  for(const item of r.raw.content as Array<{resource?:{uri:string;text?:string;blob?:string}}>) {
    if(item.resource?.uri.endsWith("source."+format))return item.resource.blob ? Buffer.from(item.resource.blob,"base64") : Buffer.from(item.resource.text!,"utf8");
  }
  throw Error("Missing artifact "+format);
}
async function save(name:string,r:Awaited<ReturnType<typeof call>>) {
  const data=r.data;
  assert.equal(await hash(data.envelope),data.contentHash);
  await writeFile(resolve(output,name+".receipt.json"),JSON.stringify({...data,downloads:{}},null,2));
  const files:Record<string,{bytes:number;sha256:string}>={};
  for(const format of ["json","svg","png"]) {
    const bytes=await file(r,format);
    if(format==="json")assert.equal(canonical(JSON.parse(bytes.toString("utf8"))),canonical(data.envelope));
    if(format==="png")verifyPrintBytes(bytes,data.printRaster.width,data.printRaster.height);
    if(format==="svg")assert(!/<(?:text|image|script|foreignObject)\b/.test(bytes.toString()),"Outlined vector artwork required");
    await writeFile(resolve(output,name+"."+format),bytes);
    files[format]={bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
  }
  if(data.editorUrl)assert.equal(canonical(parseTriangleLink(data.editorUrl)),canonical(data.envelope));
  const source={kind:"triangle" as const,envelope:data.envelope};
  const direct=await receiveSvg(async input=>{
    const reply=await c.callTool({name:"get_diagram_svg",arguments:{...input,maxChunkBytes:8192}});
    assert(!reply.isError,JSON.stringify(reply.content));return reply.structuredContent;
  },source,{expectedSourceContentHash:data.contentHash,expectedPhysicalSizeCm:data.physicalSizeCm});
  assert.equal(direct.svgSha256,files.svg.sha256);
  await writeFile(resolve(output,name+".direct.svg"),direct.body);
  const placement=await c.callTool({name:"check_diagram_placement",arguments:{...source,widthMm:data.physicalSizeCm.width*10}});
  assert(!placement.isError);assert.equal((placement.structuredContent as {uniformScale:number}).uniformScale,1);
  cases.push({name,contentHash:data.contentHash,physicalSizeCm:data.physicalSizeCm,editorLinkVerified:!!data.editorUrl,files,directChunks:direct.chunks,directMatchesDownload:true,nativePlacementVerified:true});
  console.log("Verified "+name);
}
try {
  await c.connect(new StreamableHTTPClientTransport(new URL(base+"/mcp"),{fetch:request}));
  const catalogue=(await c.listTools()).tools;
  assert.equal(catalogue.length,27);
  await writeFile(resolve(output,"catalogue.json"),JSON.stringify(catalogue,null,2));
  const cap=await c.callTool({name:"triangle_capabilities",arguments:{}});assert(!cap.isError);
  await writeFile(resolve(output,"capabilities.json"),JSON.stringify(cap,null,2));
  const scaffold=await call("create_triangle",{spec:{labels:[{ref:"e:AB",label:{state:"value",text:"3"}},{ref:"e:AC",label:{state:"value",text:"4"}},{ref:"e:BC",label:{state:"symbol",text:"x"}}]}});
  await save("scaffold",scaffold);
  const hidden=await call("revise_triangle",{envelope:scaffold.data.envelope,baseHash:scaffold.data.contentHash,operations:[{op:"calculate_and_store",ref:"e:BC",triangleId:"T1",method:"pythagoras-hypotenuse",rounding:{kind:"exact",digits:0}}]});
  assert.equal(getLabel(hidden.data.envelope,"e:BC").answer,"5");assert(!getLabel(hidden.data.envelope,"e:BC").answerVisible);
  const hiddenSvg=await file(hidden,"svg");assert(hiddenSvg.equals(await file(scaffold,"svg")),"Hidden answer changed pupil ink");
  await save("hidden-answer",hidden);
  const worked=await call("revise_triangle",{envelope:hidden.data.envelope,baseHash:hidden.data.contentHash,operations:[{op:"worked_copy"}]});await save("worked",worked);
  const area=await call("create_triangle",{spec:{example:"base-height",operations:[{op:"set_area",triangleId:"T1",label:{prefix:"Area = ",state:"answer-line"}}]}});await save("area-v2",area);
  const split=await call("create_triangle",{spec:{operations:[{op:"add_triangle",layout:"split",edgeId:"AC"}]}});await save("split",split);
  const external=await call("create_triangle",{spec:{example:"external-height"}});await save("external-height",external);
  const bundle=await c.callTool({name:"download_diagram_bundle",arguments:{kind:"triangle",envelope:scaffold.data.envelope}});assert(!bundle.isError);
  const bundleData=bundle.structuredContent as {download:{url:string}};
  const response=await request(bundleData.download.url);assert(response.ok);const zip=Buffer.from(await response.arrayBuffer());
  const members=unzipSync(zip);assert.deepEqual(JSON.parse(Buffer.from(members["source.json"]).toString("utf8")),scaffold.data.envelope);
  assert(Buffer.from(members["diagram.svg"]).equals(await file(scaffold,"svg")));
  await writeFile(resolve(output,"scaffold-bundle.zip"),zip);
  const wrong=await c.callTool({name:"revise_triangle",arguments:{envelope:scaffold.data.envelope,baseHash:"0".repeat(64),operations:[]}});assert(wrong.isError);
  await writeFile(resolve(output,"proof.json"),JSON.stringify({passed:true,provenance:"Actual MCP SDK with HTTP downloads and exact SVG chunks",actualChatGPTAcceptance:false,actualCodexConnectorAcceptance:false,tools:catalogue.map(t=>t.name),cases,bundleVerified:true,wrongHashRefused:true,hiddenAnswerInkUnchanged:true},null,2));
  console.log(JSON.stringify({passed:true,output,cases:cases.length}));
} finally {await c.close();if(server)await new Promise<void>(r=>server!.close(()=>r()));}
