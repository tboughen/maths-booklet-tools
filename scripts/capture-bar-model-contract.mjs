import {createServer} from "node:net";
import {build} from "esbuild";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {compareCatalogues} from "./cloudflare/mcp-evidence.mjs";
const out=resolve(process.argv[2]??"../reports/bar-model-refinement-implementation-2026-10-25/discovery");await mkdir(out,{recursive:true});await mkdir("cloudflare-release/refinement-operators",{recursive:true});
const catalogues=[];
for(const [name,entry] of [["before","../.mock-set-04/services/graph-mcp/server.ts"],["after","./services/graph-mcp/server.ts"]]){
  const target=resolve(`cloudflare-release/refinement-operators/${name}-server.mjs`);
  await build({stdin:{contents:`export {graphService} from ${JSON.stringify(entry)};`,resolveDir:process.cwd()},bundle:true,platform:"node",format:"esm",packages:"external",outfile:target});
  const reservation=createServer();await new Promise(r=>reservation.listen(0,"127.0.0.1",r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  const {graphService}=await import(`file:///${target.replaceAll("\\","/")}`),server=graphService({publicUrl:`http://127.0.0.1:${port}`,editorUrl:"https://mathsdock.co.uk/",keys:{test:"catalogue-synthetic-test-key-only-long"},activeKey:"test"});
  await new Promise(r=>server.listen(port,"127.0.0.1",r));const client=new Client({name:"bar-refinement-contract-review",version:"2"});
  try{await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.address().port}/mcp`)));const data={tools:(await client.listTools()).tools};if(name==="after"){const cap=await client.callTool({name:"bar_model_capabilities",arguments:{}});const text=cap.content.find(c=>c.type==="text")?.text;const value=JSON.parse(text);if(JSON.stringify(value.schemaVersions)!=="[1,2]")throw Error("Wrong actual capability versions");await writeFile(resolve(out,"bar-capabilities-after.json"),JSON.stringify(value,null,2));}catalogues.push(data);await writeFile(resolve(out,`catalogue-${name}.json`),JSON.stringify(data,null,2)+"\n");await writeFile(resolve(out,`instructions-${name}.json`),JSON.stringify({instructions:client.getInstructions()},null,2)+"\n");if(name==="after")await writeFile("docs/BAR-MODEL-EMITTED-SCHEMAS.json",JSON.stringify({tools:data.tools.filter(t=>t.name.includes("bar_model"))},null,2)+"\n");}
  finally{await client.close();await new Promise(r=>server.close(r));}
}
const expected={added:["bar_model_capabilities","create_bar_model","revise_bar_model"],removed:[],changed:["check_diagram_placement","download_diagram_bundle","get_diagram_svg"]};
const comparison=compareCatalogues(...catalogues,expected);await writeFile(resolve(out,"expected-catalogue-delta.json"),JSON.stringify(expected,null,2));await writeFile(resolve(out,"catalogue-comparison.json"),JSON.stringify(comparison,null,2));
const previous=JSON.parse(await readFile("../reports/mathsdock-bar-model-implementation-2026-10-24/release-ready/catalogue-after.json","utf8"));const barDelta={added:[],removed:[],changed:["create_bar_model","revise_bar_model"]};
const refinement=compareCatalogues(previous,catalogues[1],barDelta);await writeFile(resolve(out,"refinement-catalogue-comparison.json"),JSON.stringify(refinement,null,2));
console.log(JSON.stringify({tools:catalogues[1].tools.length,mainComparison:comparison,refinementComparison:refinement}));
