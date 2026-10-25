import {build} from "esbuild";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {createHash} from "node:crypto";
import {Resvg} from "@resvg/resvg-js";
import {execFileSync} from "node:child_process";
const output=resolve(process.argv[2]??"../reports/bar-model-refinement-implementation-2026-10-25/native-review");
await mkdir(output,{recursive:true});
async function module(path){const r=await build({entryPoints:[path],bundle:true,write:false,platform:"node",format:"esm",target:"node24"});return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);}
const [old,v,examples,png,stress]=await Promise.all([module("packages/bar-model-core/src/index.ts"),module("packages/bar-model-core/src/v2.ts"),module("packages/bar-model-core/src/lesson-examples.ts"),module("packages/graph-core/src/png-bytes.ts"),module("packages/bar-model-core/src/stress-fixture.ts")]);
const sha=b=>createHash("sha256").update(b).digest("hex");
const fonts={loadSystemFonts:false,fontFiles:["STIXTwoText-Regular.otf","STIXTwoText-Italic.otf","STIXTwoMath-Regular.otf"].map(f=>resolve("assets/graph-fonts",f)),defaultFontFamily:"STIX Two Text"};
const records=[];
async function save(name,e,core,group){const json=core.canonical(e),raw=core.renderSvg(e),g=core.layout(e);let outlined=new Resvg(raw,{font:fonts}).toString();outlined=outlined.replace(/\bwidth="[^"]+"/,`width="${g.width}mm"`).replace(/\bheight="[^"]+"/,`height="${g.height}mm"`);
  const size=png.printRasterSize(g.width/10,g.height/10),raster=new Resvg(raw.replace(/\bwidth="[^"]+"/,`width="${size.width}px"`).replace(/\bheight="[^"]+"/,`height="${size.height}px"`),{font:fonts}).render();
  const bytes=png.setDensityBytes(raster.asPng());png.verifyPrintBytes(bytes,size.width,size.height);
  for(const [ext,data] of [["json",json],["raw.svg",raw],["svg",outlined],["png",bytes]])await writeFile(join(output,`${name}.${ext}`),data);
  const inkSvg=raw.replace(/<rect width="[^"]+" height="[^"]+" fill="#fff"\/>/,"").replace(/\bwidth="[^"]+"/,`width="${g.width}px"`).replace(/\bheight="[^"]+"/,`height="${g.height}px"`);
  const ink=new Resvg(inkSvg,{font:fonts}).getBBox();
  records.push({name,group,schemaVersion:e.schemaVersion,widthMm:g.width,heightMm:g.height,bodyHeightMm:g.bodyHeight??g.height,captionHeightMm:g.captionHeight??0,pixels:size,issues:g.issues,ink:ink?{x:ink.x,y:ink.y,width:ink.width,height:ink.height}:null,sourceSha256:sha(json),rawSvgSha256:sha(raw),svgSha256:sha(outlined),pngSha256:sha(bytes)});
}
for(const name of old.exampleNames)for(const worked of [false,true])await save(`legacy-${name}-${worked?"worked":"pupil"}`,old.example(name,worked),old,"legacy");
for(const name of examples.lessonExampleNames)for(const worked of [false,true])for(const colour of [false,true]){const e=examples.lessonExample(name,worked);e.document.presentation.output=colour?"colour":"grey";await save(`${name}-${worked?"worked":"pupil"}-${colour?"colour":"grey"}`,e,v,"lesson-v2");}
await save("dense-v2",stress.denseFixture(),v,"lesson-v2-dense");
const controls={head:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),legacySourceUnchanged:execFileSync("git",["diff","e7113bf5e9ee4df878fc9e51ff644b5c1357c611","--","packages/bar-model-core/src/index.ts","packages/bar-model-core/src/interchange.ts"],{encoding:"utf8"})==="",records};
await writeFile(join(output,"measurements.json"),JSON.stringify(controls,null,2));
const html=`<!doctype html><meta charset="utf-8"><title>Bar model native review</title><style>body{font:16px system-ui;margin:24px;background:#eef2f6}article{background:white;margin:24px 0;padding:20px;break-inside:avoid}img{display:block;max-width:100%;height:auto}p{color:#334}</style><h1>Bar model native review</h1><p>Print at 100%. SVG glyphs are outlined; PNG files carry 600 ppi. Legacy controls and v2 lesson examples are separate.</p>${records.map(r=>`<article><h2>${r.name}</h2><p>${r.widthMm.toFixed(2)} × ${r.heightMm.toFixed(2)} mm; body ${r.bodyHeightMm.toFixed(2)} mm; captions ${r.captionHeightMm.toFixed(2)} mm</p><img src="${r.name}.svg" style="width:${r.widthMm}mm" alt="${r.name}"><p><a href="${r.name}.json">Editable JSON</a> · <a href="${r.name}.png">600 ppi PNG</a></p></article>`).join("")}`;
await writeFile(join(output,"REVIEW.html"),html);
console.log(JSON.stringify({output,records:records.length,legacySourceUnchanged:controls.legacySourceUnchanged,issues:records.filter(r=>r.issues.length).map(r=>({name:r.name,issues:r.issues})),lessonHeights:records.filter(r=>r.group==="lesson-v2"&&r.name.endsWith("worked-grey")).map(r=>({name:r.name,height:r.heightMm,ink:r.ink}))}));
