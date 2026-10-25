// Build-time metrics from the actual bundled fonts and resvg outlines. No runtime font parser.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {Resvg} from "@resvg/resvg-js";
const filenames=["STIXTwoText-Regular.otf","STIXTwoMath-Regular.otf"];
function font(filename){
  const data=readFileSync(resolve("assets/graph-fonts",filename)),u16=o=>data.readUInt16BE(o),u32=o=>data.readUInt32BE(o),tables={};
  for(let i=0;i<u16(4);i++){const at=12+i*16;tables[data.subarray(at,at+4).toString()]=u32(at+8);}
  const cmap=tables.cmap,candidates=Array.from({length:u16(cmap+2)},(_,i)=>cmap+u32(cmap+8+i*8));
  const sub=candidates.find(o=>u16(o)===4);if(sub===undefined)throw Error("Font lacks the reviewed BMP cmap.");
  const count=u16(sub+6)/2,end=sub+14,start=end+count*2+2,delta=start+count*2,ranges=delta+count*2;
  function glyph(code){for(let i=0;i<count;i++){if(u16(start+i*2)<=code&&code<=u16(end+i*2)){const shift=u16(delta+i*2),step=u16(ranges+i*2);if(!step)return(code+shift)&65535;const result=u16(ranges+i*2+step+2*(code-u16(start+i*2)));return result?(result+shift)&65535:0;}}return 0;}
  const units=u16(tables.head+18),metrics=u16(tables.hhea+34);
  return {filename,sha256:createHash("sha256").update(data).digest("hex"),advance(code){const index=glyph(code);return index?u16(tables.hmtx+Math.min(index,metrics-1)*4)/units:null;}};
}
const fonts=filenames.map(font),entries={};
const supported=[...Array.from({length:95},(_,i)=>i+32),...Array.from({length:432},(_,i)=>i+160),...Array.from({length:144},(_,i)=>i+0x370),...Array.from({length:1024},(_,i)=>i+0x2000)];
const options={loadSystemFonts:false,fontFiles:filenames.map(f=>resolve("assets/graph-fonts",f)),defaultFontFamily:"STIX Two Text"};
for(const code of supported){
  if(code>=0x200b&&code<=0x200f||code>=0x2028&&code<=0x202f||code>=0x2060&&code<=0x206f)continue;
  const owner=fonts.find(f=>f.advance(code)!==null);if(!owner)continue;
  const char=String.fromCodePoint(code),escaped=char.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const box=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><text x="200" y="200" font-family="STIX Two Text,STIX Two Math" font-size="100">${escaped}</text></svg>`,{font:options}).getBBox();
  entries[char]=[owner.advance(code),...box?[(box.x-200)/100,(200-box.y-box.height)/100,(box.x+box.width-200)/100,(200-box.y)/100]:[0,0,0,0]].map(n=>Math.round(n*100000)/100000);
}
const output={fonts:fonts.map(({filename,sha256})=>({filename,sha256})),units:"em; advance,xMin,yMin,xMax,yMax",entries};
writeFileSync("packages/bar-model-core/src/v2-font-metrics.json",JSON.stringify(output)+"\n");console.log(JSON.stringify({glyphs:Object.keys(entries).length,fonts:output.fonts}));
