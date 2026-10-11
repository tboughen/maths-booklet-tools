import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { BankQuestion } from "./model";
import type { ExportResult } from "./export";
import { PaperReviewDialog } from "./PaperReviewDialog";
const mocks=vi.hoisted(()=>({makePapers:vi.fn(),downloadBlob:vi.fn()}));
vi.mock("./export",()=>({makePapers:mocks.makePapers}));
vi.mock("./pdf",()=>({assetUrl:(p:string)=>p,downloadBlob:mocks.downloadBlob}));
const question={id:"test",source:"Test source",marks:4,tier:"F",calculator:false,parts:[],questionViews:[],schemeViews:[]} as unknown as BankQuestion;
const entries=[{key:"test",question,matchingCodes:["U1"],matchedParts:[],otherParts:[]}];
const pair={questions:new Blob(["question"]),schemes:new Blob(["scheme"])} as ExportResult;
const props={open:true,active:true,entries,version:"v1",excluded:0,onClose:vi.fn(),onRemove:vi.fn(),onMove:vi.fn(),onRestore:vi.fn()};
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};});
describe("paper export lifecycle",()=>{
  it("ignores a late completion after cancellation and allows a clean retry",async()=>{
    let resolve:(pair:ExportResult)=>void=()=>undefined;
    mocks.makePapers.mockImplementationOnce(()=>new Promise<ExportResult>(r=>{resolve=r;})).mockResolvedValueOnce(pair);
    render(<PaperReviewDialog {...props}/>);
    fireEvent.click(screen.getByRole("button",{name:"Prepare both PDFs"}));
    fireEvent.click(screen.getByRole("button",{name:"Cancel export"}));
    await act(async()=>resolve(pair));
    expect(screen.queryByRole("button",{name:"Questions PDF"})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Prepare both PDFs"}));
    await waitFor(()=>expect(screen.getByText("Both PDFs are ready")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button",{name:"Questions PDF"}));
    expect(mocks.downloadBlob).toHaveBeenCalledWith(pair.questions,"practice-questions.pdf");
  });
  it("invalidates ready downloads on draft or layout changes",async()=>{
    mocks.makePapers.mockResolvedValue(pair);const view=render(<PaperReviewDialog {...props}/>);
    fireEvent.click(screen.getByRole("button",{name:"Prepare both PDFs"}));
    await waitFor(()=>expect(screen.getByText("Both PDFs are ready")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Writing space"));
    expect(screen.queryByText("Both PDFs are ready")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Prepare both PDFs"}));
    await waitFor(()=>expect(screen.getByText("Both PDFs are ready")).toBeInTheDocument());
    view.rerender(<PaperReviewDialog {...props} entries={[]}/>);
    expect(screen.queryByText("Both PDFs are ready")).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Prepare both PDFs"})).toBeDisabled();
  });
  it("shows no partial pair on failure and preserves the review",async()=>{
    mocks.makePapers.mockRejectedValueOnce(new Error("Scheme asset unavailable"));
    render(<PaperReviewDialog {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Prepare both PDFs"}));
    await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("Scheme asset unavailable"));
    expect(screen.getByText("1. Test source")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Questions PDF"})).not.toBeInTheDocument();
  });
});
