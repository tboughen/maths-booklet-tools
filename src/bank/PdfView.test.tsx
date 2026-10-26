import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfView } from "./PdfView";
import type { BankView } from "./model";

const mocks=vi.hoisted(()=>({render:vi.fn(),load:vi.fn()}));
vi.mock("./pdf",()=>({renderPage:mocks.render,loadPdf:mocks.load,assetUrl:(path:string)=>path}));
const view:BankView={id:"v",label:"Page",page:1,width:100,height:200,preview:"a.png",description:"Target worked solution",sourcePages:[8]};

describe("PDF resource identity",()=>{
  it("removes the prior canvas immediately and ignores late results after an identity change",async()=>{
    const pending:{resolve:(canvas:HTMLCanvasElement)=>void;signal:AbortSignal}[]=[];
    mocks.render.mockImplementation((_path,_page,_scale,signal)=>new Promise<HTMLCanvasElement>(resolve=>pending.push({resolve,signal})));
    const ui=render(<PdfView path="old.pdf" view={view} scale={1} retryKey={0}/>);
    const old=document.createElement("canvas");old.dataset.resource="old";
    await act(async()=>pending[0].resolve(old));expect(ui.container.querySelector("canvas")).toBe(old);
    ui.rerender(<PdfView path="new.pdf" view={view} scale={1} retryKey={0}/>);
    expect(ui.container.querySelector("canvas")).toBeNull();expect(pending[0].signal.aborted).toBe(true);
    ui.rerender(<PdfView path="question.pdf" view={{...view,description:"Question"}} scale={1} retryKey={0}/>);
    const late=document.createElement("canvas");late.dataset.resource="late-answer";
    await act(async()=>pending[1].resolve(late));expect(ui.container.querySelector("canvas")).toBeNull();
    const current=document.createElement("canvas");
    await act(async()=>pending[2].resolve(current));expect(screen.getByRole("img",{name:"Question"})).toBe(current);
  });
  it("shows a resource-specific error and PDF fallback without an obsolete canvas",async()=>{
    mocks.render.mockRejectedValueOnce(new Error("missing"));
    const ui=render(<PdfView path="worked.pdf" view={view} scale={1} retryKey={0} label="Worked solution"/>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Worked solution could not load.");
    expect(screen.getByRole("link",{name:"Open PDF"})).toHaveAttribute("href","worked.pdf");
    expect(ui.container.querySelector("canvas")).toBeNull();
  });
});
