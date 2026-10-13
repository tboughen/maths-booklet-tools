import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const origin="https://mathsdock.co.uk";
const response=await fetch(origin,{headers:{"Cache-Control":"no-cache"}});
if(!response.ok)throw new Error(`Homepage HTTP ${response.status}`);
const html=await response.text(), local=await readFile("dist-cloudflare/index.html","utf8");
if(html!==local)throw new Error("Production HTML does not match approved Cloudflare build");
const files=[...new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(p=>p.startsWith("/assets/")))];
files.push("/bank/catalogue.json","/brand/mathsdock-logo.svg");
const proof=[];
for(const path of files){
  const expected=await readFile(`dist-cloudflare${path}`),r=await fetch(new URL(path,origin),{headers:{"Cache-Control":"no-cache"}});
  const bytes=Buffer.from(await r.arrayBuffer());
  if(!r.ok||hash(bytes)!==hash(expected))throw new Error(`Live file differs: ${path}`);
  proof.push({path,sha256:hash(bytes),bytes:bytes.length});
}
await mkdir("../reports/mathsdock-accessibility-production-2026-10-12",{recursive:true});
await writeFile("../reports/mathsdock-accessibility-production-2026-10-12/live-bytes.json",JSON.stringify({origin,htmlMatches:true,files:proof},null,2));
console.log(`Production HTML and ${proof.length} served files match the approved build.`);
