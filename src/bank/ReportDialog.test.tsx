import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ReportDialog } from "./ReportDialog";
const details={question:"q1",source:"June 2024 1F Q3",showing:"Question · view 1",code:"U123",version:"v1",link:"https://mathsdock.co.uk/question-bank?q=q1"};
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};});
afterEach(()=>vi.unstubAllGlobals());
describe("report a problem",()=>{
  it("asks for a description, then posts it with the question details",async()=>{
    const fetcher=vi.fn(async()=>new Response('{"ok":true}',{status:201}));vi.stubGlobal("fetch",fetcher);
    const onSent=vi.fn();
    render(<ReportDialog details={details} onClose={vi.fn()} onSent={onSent}/>);
    expect(screen.getByText("June 2024 1F Q3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Send report"}));
    expect(screen.getByRole("alert").textContent).toBe("Describe the problem before sending.");
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("What is wrong?"),{target:{value:"Part (b) is cut off."}});
    fireEvent.click(screen.getByRole("button",{name:"Send report"}));
    await waitFor(()=>expect(onSent).toHaveBeenCalled());
    const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toBe("/api/report");
    expect(JSON.parse(String(init.body))).toEqual({...details,message:"Part (b) is cut off."});
  });
  it("starts empty for another question and tells the page when the dialog closes natively",()=>{
    const onClose=vi.fn();
    const {rerender,container}=render(<ReportDialog details={details} onClose={onClose} onSent={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText("What is wrong?"),{target:{value:"Typed for Q3."}});
    rerender(<ReportDialog details={{...details,question:"q7"}} onClose={onClose} onSent={vi.fn()}/>);
    expect((screen.getByLabelText("What is wrong?") as HTMLTextAreaElement).value).toBe("");
    fireEvent(container.querySelector("dialog")!,new Event("close"));
    expect(onClose).toHaveBeenCalled();
  });
  it("keeps the text and shows the server's reason when sending fails",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response('{"error":"Problem reports are not set up yet."}',{status:503})));
    const onSent=vi.fn();
    render(<ReportDialog details={details} onClose={vi.fn()} onSent={onSent}/>);
    fireEvent.change(screen.getByLabelText("What is wrong?"),{target:{value:"Wrong answer."}});
    fireEvent.click(screen.getByRole("button",{name:"Send report"}));
    await waitFor(()=>expect(screen.getByRole("alert").textContent).toBe("Problem reports are not set up yet."));
    expect((screen.getByLabelText("What is wrong?") as HTMLTextAreaElement).value).toBe("Wrong answer.");
    expect(onSent).not.toHaveBeenCalled();
  });
});
