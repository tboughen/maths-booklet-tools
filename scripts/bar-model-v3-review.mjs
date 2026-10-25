import {build} from "esbuild";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {createHash} from "node:crypto";
import {Resvg} from "@resvg/resvg-js";
import {execFileSync} from "node:child_process";
const output=resolve(process.argv[2]??"../reports/bar-model-fractions-writing-space-implementation-2026-10-25/native-review");
await mkdir(output,{recursive:true});
async function module(path){const r=await build({entryPoints:[path],bundle:true,write:false,platform:"node",format:"esm",target:"node24"});return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);}
const [v,examples,png,stress]=await Promise.all([module("packages/bar-model-core/src/v3.ts"),module("packages/bar-model-core/src/lesson-examples-v3.ts"),module("packages/graph-core/src/png-bytes.ts"),module("packages/bar-model-core/src/stress-fixture-v3.ts")]);
const sha=b=>createHash("sha256").update(b).digest("hex");
const fonts={loadSystemFonts:false,fontFiles:["STIXTwoText-Regular.otf","STIXTwoText-Italic.otf","STIXTwoMath-Regular.otf"].map(f=>resolve("assets/graph-fonts",f)),defaultFontFamily:"STIX Two Text"};
const records=[];
async function save(name,e){
 const json=v.canonical(e),raw=v.renderSvg(e),g=v.layout(e);if(g.issues.length)throw Error(`${name}: ${g.issues}`);
 let outlined=new Resvg(raw,{font:fonts}).toString();outlined=outlined.replace(/\bwidth="[^"]+"/,`width="${g.width}mm"`).replace(/\bheight="[^"]+"/,`height="${g.height}mm"`);
 const size=png.printRasterSize(g.width/10,g.height/10),raster=new Resvg(raw.replace(/\bwidth="[^"]+"/,`width="${size.width}px"`).replace(/\bheight="[^"]+"/,`height="${size.height}px"`),{font:fonts}).render();
 const bytes=png.setDensityBytes(raster.asPng());png.verifyPrintBytes(bytes,size.width,size.height);
 for(const [ext,data]of[["json",json],["raw.svg",raw],["svg",outlined],["png",bytes]])await writeFile(join(output,`${name}.${ext}`),data);
 const inkSvg=raw.replace(/<rect width="[^"]+" height="[^"]+" fill="#fff"\/>/,"").replace(/\bwidth="[^"]+"/,`width="${g.width}px"`).replace(/\bheight="[^"]+"/,`height="${g.height}px"`),ink=new Resvg(inkSvg,{font:fonts}).getBBox();
 records.push({name,schemaVersion:3,widthMm:g.width,heightMm:g.height,bodyHeightMm:g.bodyHeight,captionHeightMm:g.captionHeight,effectiveBarHeightMm:g.barHeightMm,requestedMinimumBarHeightMm:e.document.presentation.barHeightMm,writingBoxes:g.writingBoxes,printFacts:v.printFacts(e),pixels:size,issues:g.issues,ink:ink?{x:ink.x,y:ink.y,width:ink.width,height:ink.height}:null,sourceSha256:sha(json),rawSvgSha256:sha(raw),svgSha256:sha(outlined),pngSha256:sha(bytes)});
}
for(const name of examples.lessonExampleNames)for(const worked of[false,true])for(const output of["grey","colour"]){const e=examples.lessonExample(name,worked);e.document.presentation.output=output;await save(`${name}-${worked?"worked":"pupil"}-${output}`,e);}
await save("dense-v3",stress.denseFixture());
for(const worked of[false,true]){
 const e=v.fresh("equal-sections",2),b=e.document.bars[0];for(const p of b.parts)p.weight="2";
 b.parts[0].labels.inside=v.label("18",worked?"value":"line");b.parts[1].labels.inside=v.label("3/4",worked?"value":"line");
 e.document.title=v.label("Numbers and fractions");e.document.captions=[{id:"working",label:v.label("1/2 + 1/4 = 3/4"),alignment:"centre",format:"maths"}];
 await save(`handwriting-${worked?"worked":"pupil"}`,e);
}
const proof={head:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),dirtySource:execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim()!=="",records};
await writeFile(join(output,"measurements.json"),JSON.stringify(proof,null,2)+"\n");
await writeFile(join(output,"REVIEW.html"),`<!doctype html><meta charset="utf-8"><title>Horizontal fractions and writing spaces</title><style>body{font:16px system-ui;background:#eef2f6;margin:24px}article{background:white;padding:20px;margin:20px 0}img{max-width:100%;height:auto}</style><h1>Bar models v3</h1><p>Actual vector SVG and 600ppi PNG at native size; print at 100%.</p>${records.map(r=>`<article><h2>${r.name}</h2><p>${r.widthMm.toFixed(2)} × ${r.heightMm.toFixed(2)} mm; actual bars ${r.effectiveBarHeightMm} mm; ${r.writingBoxes.length} writing spaces</p><img src="${r.name}.svg" style="width:${r.widthMm}mm"><p><a href="${r.name}.json">Editable source</a> · <a href="${r.name}.png">600ppi PNG</a></p></article>`).join("")}`);
if(process.argv.includes("--write-examples")){
 const doc="docs/bar-model-examples/lesson-v3";await mkdir(doc,{recursive:true});
 for(const name of examples.lessonExampleNames){
  for(const worked of[false,true])await writeFile(`${doc}/${name}-${worked?"worked":"pupil"}.json`,v.canonical(examples.lessonExample(name,worked))+"\n");
  await writeFile(`src/assets/example-previews/bar-lesson-v3-${name}.svg`,await readFile(join(output,`${name}-pupil-grey.svg`)));
 }
 await writeFile("src/assets/tool-previews/bar-model.svg",await readFile(join(output,"R1-worked-grey.svg")));
 await writeFile(`${doc}/tool-card.json`,v.canonical(examples.lessonExample("R1",true))+"\n");
}
console.log(JSON.stringify({output,records:records.length,dense:records.find(r=>r.name==="dense-v3"),heights:records.filter(r=>r.name.endsWith("pupil-grey")).map(r=>({name:r.name,heightMm:r.heightMm}))}));
