import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { verifyPrintBytes, printRasterSize } from "../packages/graph-core/src/png-bytes";
const resource=(page:Page)=>page.getByTestId("number-line-resource");
const endpoint=(page:Page,value:string)=>page.getByRole("button",{name:new RegExp(`^Endpoint ${value},`)});
const circle=(page:Page,value:string)=>resource(page).locator(`circle[data-value="${value}"]`);
const settings=(page:Page,name:string)=>page.locator("summary").filter({hasText:new RegExp(`^${name}$`)});
async function interval(page:Page){await page.getByRole("button",{name:"Interval",exact:true}).click();await page.getByRole("button",{name:"Tick -2",exact:true}).click();await page.getByRole("button",{name:"Tick 3",exact:true}).click();}
test.beforeEach(async({page})=>{await page.goto("/?tool=number-line");await page.evaluate(()=>localStorage.removeItem("maths-booklet-tools:number-line:v1"));await page.reload();});
test("default settings fit a compact panel with optional sections closed",async({page})=>{
 await expect(page.getByRole("region",{name:"Selected item"})).toHaveCount(0);
 await expect(page.getByLabel("First tick",{exact:true})).toBeVisible();
 await expect(page.getByLabel("Label every",{exact:true})).not.toBeVisible();
 await expect(page.getByLabel("Past-paper example",{exact:true})).not.toBeVisible();
 const box=await page.getByRole("complementary",{name:"Number line settings"}).boundingBox();expect(box!.height).toBeLessThan(450);
 await page.screenshot({path:test.info().outputPath("compact-default.png"),fullPage:true});
});
test("interval endpoints toggle on click and keyboard, focus alone preserves type, Undo restores",async({page})=>{
 await interval(page);await endpoint(page,"-2").focus();await expect(circle(page,"-2")).toHaveAttribute("fill","#111");
 await endpoint(page,"-2").press("Space");await expect(circle(page,"-2")).toHaveAttribute("fill","white");await expect(endpoint(page,"-2")).toBeFocused();
 await endpoint(page,"-2").press("Enter");await expect(circle(page,"-2")).toHaveAttribute("fill","#111");
 await endpoint(page,"3").click();await expect(circle(page,"3")).toHaveAttribute("fill","#111");
 await expect(page.getByLabel("Upper endpoint",{exact:true})).toBeVisible();await expect(page.getByLabel("Lower endpoint",{exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Undo",exact:true}).click();await expect(circle(page,"3")).toHaveAttribute("fill","white");
});
test("drag moves only, tiny movement toggles, cancellation preserves the drawing",async({page})=>{
 await interval(page);const start=(await endpoint(page,"-2").boundingBox())!;const target=(await page.getByRole("button",{name:"Tick -1",exact:true}).boundingBox())!;
 await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,start.y+start.height/2,{steps:6});await page.mouse.up();
 await expect(circle(page,"-1")).toHaveAttribute("fill","#111");await expect(circle(page,"-2")).toHaveCount(0);
 await endpoint(page,"-1").press("Enter");await expect(circle(page,"-1")).toHaveAttribute("fill","white");
 const next=(await endpoint(page,"-1").boundingBox())!;await page.mouse.move(next.x+next.width/2,next.y+next.height/2);await page.mouse.down();await page.mouse.move(next.x+next.width/2+2,next.y+next.height/2);await page.mouse.up();await expect(circle(page,"-1")).toHaveAttribute("fill","#111");
 const cancel=(await endpoint(page,"-1").boundingBox())!;await page.mouse.move(cancel.x+cancel.width/2,cancel.y+cancel.height/2);await page.mouse.down();await page.mouse.move(cancel.x+cancel.width/2+12,cancel.y+cancel.height/2,{steps:3});await endpoint(page,"-1").dispatchEvent("pointercancel",{pointerId:1});await page.mouse.up();await expect(circle(page,"-1")).toHaveAttribute("fill","#111");await expect(resource(page).locator(".nl-drag")).toHaveCount(0);
 await endpoint(page,"-1").press("ArrowRight");await expect(circle(page,"0")).toHaveAttribute("fill","#111");
});
test("dense endpoint targets remain distinct at all zooms on a phone",async({page})=>{
 await page.evaluate(()=>{const key="maths-booklet-tools:number-line:v1",e=JSON.parse(localStorage.getItem(key)!);e.document.axis={...e.document.axis,minimum:"-16",maximum:"16",labelEvery:4};e.document.solution={kind:"points",id:"points",points:Array.from({length:33},(_,i)=>({id:`p${i}`,value:String(i-16)})),intervals:Array.from({length:32},(_,i)=>({id:`i${i}`,from:`p${i}`,to:`p${i+1}`}))};localStorage.setItem(key,JSON.stringify(e));});await page.reload();await page.setViewportSize({width:320,height:1000});
 for(const zoom of ["0.75","1","1.25","1.5"]){await page.getByLabel("Preview zoom").selectOption(zoom);await endpoint(page,"0").click();await expect(circle(page,"0")).toHaveAttribute("fill",zoom==="0.75"||zoom==="1.25"?"white":"#111");await expect(circle(page,"1")).toHaveAttribute("fill","#111");await expect(circle(page,"-1")).toHaveAttribute("fill","#111");}
 await page.screenshot({path:test.info().outputPath("dense-mobile.png"),fullPage:true});
});
test("toggled endpoints agree in actual SVG, print PNG, clipboard, Word HTML and reopened file",async({page,context},info)=>{
 await context.grantPermissions(["clipboard-read","clipboard-write"]);await interval(page);await endpoint(page,"-2").click();
 await page.getByRole("button",{name:"Download options",exact:true}).click();
 const outputs:Record<string,string>={};
 for(const [label,filename] of [["Download SVG","toggled.svg"],["Download PNG (600 ppi)","toggled.png"],["Save editable file","toggled.json"]]){const event=page.waitForEvent("download");await page.getByRole("button",{name:label,exact:true}).click();const path=info.outputPath(filename);await(await event).saveAs(path);outputs[filename]=path;}
 const svg=await readFile(outputs["toggled.svg"],"utf8");expect(svg).toMatch(/<circle[^>]*data-value="-2"[^>]*fill="white"/);expect(svg).toMatch(/<circle[^>]*data-value="3"[^>]*fill="white"/);
 const saved=JSON.parse(await readFile(outputs["toggled.json"],"utf8"));expect(saved.document.solution).toMatchObject({kind:"interval",lowerIncluded:false,upperIncluded:false});
 const size=printRasterSize(14,2.3);verifyPrintBytes(new Uint8Array(await readFile(outputs["toggled.png"])),size.width,size.height);
 await page.getByRole("button",{name:"Download options",exact:true}).click();await page.getByRole("button",{name:"Copy to clipboard",exact:true}).click();await expect(page.getByRole("button",{name:"Copy to clipboard",exact:true})).toBeEnabled();await expect(page.getByText("Resource ready.",{exact:true})).toBeVisible();
 const copied=await page.evaluate(async()=>{const items=await navigator.clipboard.read();return Array.from(new Uint8Array(await(await items[0].getType("image/png")).arrayBuffer()));});await writeFile(info.outputPath("clipboard.png"),Buffer.from(copied));
 const samePixels=await page.evaluate(async([original,clipboard])=>{async function pixels(bytes:number[]){const img=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:"image/png"})),c=document.createElement("canvas");c.width=img.width;c.height=img.height;const ctx=c.getContext("2d")!;ctx.drawImage(img,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}const [a,b]=await Promise.all([pixels(original),pixels(clipboard)]);return a.length===b.length&&a.every((v,i)=>v===b[i]);},[Array.from(await readFile(outputs["toggled.png"])),copied]);expect(samePixels).toBe(true);
 await page.getByRole("button",{name:"Copy for Word",exact:true}).click();await expect(page.getByRole("button",{name:"Copy for Word",exact:true})).toBeEnabled();await expect(page.getByText("Resource ready.",{exact:true})).toBeVisible();
 const html=await page.evaluate(async()=>{const items=await navigator.clipboard.read();return (await items[0].getType("text/html")).text();});const wordSize=await page.evaluate(markup=>{const img=new DOMParser().parseFromString(markup,"text/html").querySelector("img")!;return {width:img.style.width,height:img.style.height,widthAttribute:img.getAttribute("width"),heightAttribute:img.getAttribute("height"),embeddedPng:img.src.startsWith("data:image/png;base64,")};},html);expect(wordSize).toEqual({width:"14cm",height:"2.3cm",widthAttribute:"14cm",heightAttribute:"2.3cm",embeddedPng:true});await writeFile(info.outputPath("word.html"),html);
 await page.getByRole("button",{name:"Reset",exact:true}).click();await page.getByRole("button",{name:"Open resource",exact:true}).click();await expect(resource(page).locator("circle")).toHaveCount(0);
 await page.locator('.nl-editor input[type="file"]').setInputFiles(outputs["toggled.json"]);await page.getByRole("button",{name:"Open resource",exact:true}).click();await expect(circle(page,"-2")).toHaveAttribute("fill","white");await expect(circle(page,"3")).toHaveAttribute("fill","white");
 await endpoint(page,"-2").focus();await page.screenshot({path:test.info().outputPath("selected-endpoint.png"),fullPage:true});
});
test("Point mode toggles existing points; Interval mode joins them without changing type",async({page})=>{
 await page.getByRole("button",{name:"Point",exact:true}).click();for(const v of ["-2","3","4"])await page.getByRole("button",{name:`Tick ${v}`,exact:true}).click();
 await endpoint(page,"-2").click();await expect(circle(page,"-2")).toHaveAttribute("fill","white");
 await page.getByRole("button",{name:"Interval",exact:true}).click();await endpoint(page,"-2").click();await endpoint(page,"3").click();
 await expect(circle(page,"-2")).toHaveAttribute("fill","white");await expect(circle(page,"3")).toHaveAttribute("fill","#111");await expect(resource(page).locator("circle")).toHaveCount(3);
 await page.getByRole("button",{name:"Select interval from -2 to 3",exact:true}).click();await page.getByRole("button",{name:"Remove interval",exact:true}).click();await expect(resource(page).locator("path[data-interval]")).toHaveCount(0);await expect(resource(page).locator("circle")).toHaveCount(3);
 await page.getByRole("button",{name:"Undo",exact:true}).click();await expect(resource(page).locator("path[data-interval]")).toHaveCount(1);
});
test("removing a simple interval leaves both original endpoint types and can be undone",async({page})=>{
 await interval(page);await page.getByRole("button",{name:"Select interval from -2 to 3",exact:true}).click();await page.getByRole("button",{name:"Remove interval",exact:true}).click();
 await expect(resource(page).locator("circle")).toHaveCount(2);await expect(circle(page,"-2")).toHaveAttribute("fill","#111");await expect(circle(page,"3")).toHaveAttribute("fill","white");await expect(page.getByRole("button",{name:"Select interval from -2 to 3",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Undo",exact:true}).click();await expect(page.getByRole("button",{name:"Select interval from -2 to 3",exact:true})).toBeVisible();
});
test("ray direction is contextual and its endpoint toggles with keyboard and click",async({page})=>{
 await expect(page.getByLabel("New ray direction",{exact:true})).toHaveCount(0);await page.getByRole("button",{name:"Ray",exact:true}).click();await page.getByLabel("New ray direction",{exact:true}).selectOption("left");await page.getByRole("button",{name:"Tick 0",exact:true}).click();
 await endpoint(page,"0").click();await expect(circle(page,"0")).toHaveAttribute("fill","#111");await expect(page.getByLabel("Ray direction",{exact:true})).toHaveValue("left");await endpoint(page,"0").press("Space");await expect(circle(page,"0")).toHaveAttribute("fill","white");
 await page.getByLabel("Ray direction",{exact:true}).selectOption("right");await expect(page.getByLabel("Ray direction",{exact:true})).toHaveValue("right");
});
test("invalid collapsed draft stays visible and blocks drawing and exports until cancelled",async({page})=>{
 await interval(page);await settings(page,"More settings").click();await settings(page,"Print size").click();await page.getByLabel("Width (cm)",{exact:true}).fill("0");await page.getByLabel("Width (cm)",{exact:true}).press("Enter");
 await settings(page,"Print size").click();await expect(page.getByLabel("Width (cm)",{exact:true})).toBeVisible();await settings(page,"More settings").click();await expect(page.getByLabel("Width (cm)",{exact:true})).toBeVisible();
 await endpoint(page,"-2").click();await expect(circle(page,"-2")).toHaveAttribute("fill","#111");await expect(page.getByRole("button",{name:"Copy to clipboard",exact:true})).toBeDisabled();await page.getByLabel("Width (cm)",{exact:true}).press("Escape");await expect(page.getByRole("button",{name:"Copy to clipboard",exact:true})).toBeEnabled();
});
test("collapsed question settings preserve zero, hidden answers and pupil blanks through save and reload",async({page})=>{
 await page.getByRole("button",{name:"Tick 0",exact:true}).click();await page.getByLabel("Tick label state").selectOption("answer-line");await settings(page,"More settings").click();await settings(page,"Question and answer").click();await page.getByLabel("Answer text",{exact:true}).fill("0");await page.getByLabel("Answer text",{exact:true}).press("Enter");await page.getByLabel("Show answer text",{exact:true}).uncheck();await settings(page,"Question and answer").click();await settings(page,"More settings").click();
 await page.reload();await settings(page,"More settings").click();await settings(page,"Question and answer").click();await expect(page.getByLabel("Answer text",{exact:true})).toHaveValue("0");await expect(page.getByLabel("Show answer text",{exact:true})).not.toBeChecked();await page.getByRole("button",{name:"Tick 0",exact:true}).click();await expect(page.getByLabel("Tick label state")).toHaveValue("answer-line");
});
