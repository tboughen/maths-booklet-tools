import { it, expect } from "vitest";
import { create, apply, renderSvg, canonical, parseFile, encode, decode } from "./index";
const points=()=>create({solution:{kind:"points",id:"points",points:[{id:"a",value:"-2"},{id:"b",value:"3"},{id:"c",value:"4"}]}});
it("joins existing points and retains hollow endpoint and other points",()=>{
 const e=apply(points(),[{op:"set_point",id:"a",included:false},{op:"connect_points",interval:{id:"ab",from:"a",to:"b"}}]);
 expect(e.document.solution).toMatchObject({points:[{id:"a",value:"-2",included:false},{id:"b",value:"3"},{id:"c",value:"4"}],intervals:[{id:"ab",from:"a",to:"b"}]});
 expect(renderSvg(e)).toContain('data-value="-2"');expect(renderSvg(e)).toContain('fill="white"');expect(renderSvg(e)).toContain('data-interval="ab"');
 expect(parseFile(canonical(e))).toEqual(e);expect(decode(encode(e))).toEqual(e);
});
it("moves a joined endpoint by its stable ID and removes only the requested connection",()=>{
 const e=apply(points(),[{op:"connect_points",interval:{id:"ab",from:"a",to:"b"}},{op:"set_point",id:"b",value:"1/2",included:false}]);
 expect(e.document.solution).toMatchObject({intervals:[{id:"ab",from:"a",to:"b"}],points:[{id:"a"},{id:"b",value:"1/2",included:false},{id:"c"}]});
 const removed=apply(e,[{op:"remove_interval",id:"ab"}]);expect(removed.document.solution).toMatchObject({points:e.document.solution?.kind==="points"?e.document.solution.points:[],intervals:[]});
});
it("removing a point removes its attached connection but keeps other points",()=>{
 const e=apply(points(),[{op:"connect_points",interval:{id:"ab",from:"a",to:"b"}},{op:"remove_point",id:"a"}]);
 expect(e.document.solution).toMatchObject({points:[{id:"b"},{id:"c"}],intervals:[]});
});
it("rejects dangling, duplicate and same-point intervals atomically",()=>{
 const e=points();for(const to of ["missing","a"]) expect(()=>apply(e,[{op:"set_point",id:"a",included:false},{op:"connect_points",interval:{id:"bad",from:"a",to}}])).toThrow();
 expect(e).toEqual(points());
 expect(()=>apply(e,[{op:"connect_points",interval:{id:"ab",from:"a",to:"b"}},{op:"connect_points",interval:{id:"ba",from:"b",to:"a"}}])).toThrow("already joined");
});
it("retains legacy point envelope shape and filled rendering without a migration",()=>{
 const e=points(),text=canonical(e);expect(e.document.solution).not.toHaveProperty("intervals");expect(e.document.solution?.kind==="points"?e.document.solution.points[0]:null).not.toHaveProperty("included");
 expect(canonical(parseFile(text))).toBe(text);expect(renderSvg(e)).not.toContain('fill="white" stroke="#111"');
});
