import {build} from "esbuild";
import {mkdir,writeFile} from "node:fs/promises";
const dir="cloudflare-release/v3-operators";await mkdir(dir,{recursive:true});
const code=await build({stdin:{contents:'export * as v from "./packages/bar-model-core/src/v3";export {denseFixture} from "./packages/bar-model-core/src/stress-fixture-v3";',resolveDir:process.cwd()},bundle:true,write:false,format:"esm",platform:"node"});
const {v,denseFixture}=await import(`data:text/javascript;base64,${Buffer.from(code.outputFiles[0].text).toString("base64")}`);
const e=denseFixture(),g=v.layout(e);await writeFile(`${dir}/dense-v3.json`,v.canonical(e));console.log(JSON.stringify({width:g.width,height:g.height,issues:g.issues,parts:e.document.bars.flatMap(b=>b.parts).length,annotations:e.document.annotations.length,bytes:Buffer.byteLength(v.canonical(e))}));
