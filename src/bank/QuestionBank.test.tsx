// The bank shows a link's invalid view as its notice once the catalogue has loaded (A94), keeps the
// reconciled-paper warning beside it, and does not repeat the report on later route changes.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { BankIndex } from "./catalogueLoader";
import { PAPER_STORAGE_KEY } from "./paper-storage";

const mocks = vi.hoisted(() => ({index: undefined as unknown}));
vi.mock("./catalogueLoader", () => ({
  fetchCatalogueIndex: () => Promise.resolve(mocks.index),
  createDetailLoader: () => ({load: () => new Promise(() => undefined)}),
}));
vi.mock("./PdfView", () => ({PdfView: () => null}));
vi.mock("./pdf", () => ({assetUrl: (p: string) => p, downloadBlob: vi.fn(), preloadQuestion: vi.fn(), questionImage: vi.fn()}));

import QuestionBank from "./QuestionBank";

const question = {id: "q1", order: 1, paperId: "p1", codes: ["U1"], tier: "F", calculator: false, collection: "Past papers", marks: 2, parts: [{label: "1", marks: 2, codes: ["U1"]}], source: "Test paper Q1", description: "Test", review: "reviewed", questionViewCount: 3, hasWorkedSolution: false};
const index = (version = "v1") => ({schemaVersion: 1, title: "Test bank", reviewedAt: "2026-11-11", pilotCodes: [], scope: {sets: 1, papers: 1, sourceQuestions: 1, publishedQuestions: 1}, version, aliases: {}, papers: {p1: "bank/catalogue-papers/p1.0123456789abcdef.json"}, questions: [question], topics: [{code: "U1", title: "Test topic", strand: "Test", bankCount: 1, pilotCount: 0}]}) as unknown as BankIndex;

async function open(search: string) {
  history.replaceState({}, "", `/question-bank${search}`);
  render(<QuestionBank/>);
  // The catalogue has loaded once the bank writes back the corrected address (without the bad view).
  await waitFor(() => expect(location.search).not.toMatch(/view=/));
  const notice = document.querySelector(".qb-notice");
  expect(notice, "the bank shows a notice").not.toBeNull();
  return notice as HTMLElement;
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
});
afterEach(() => { localStorage.clear(); });

describe("question bank: a link's invalid view", () => {
  it("reports a badly written view after the catalogue loads and writes back the corrected address", async () => {
    mocks.index = index();
    const notice = await open("?code=U1&question=q1&view=abc");
    expect(notice).toHaveTextContent("The link asked for view abc, but views are numbered from 1. Showing view 1.");
    expect(location.search).toBe("?code=U1&question=q1");
  });

  it("reports a view past the question's last view and does not repeat it on the next route change", async () => {
    mocks.index = index();
    const notice = await open("?code=U1&question=q1&view=4");
    expect(notice).toHaveTextContent("The link asked for view 4, but this question has 3 views. Showing view 1.");
    await act(async () => fireEvent.click(screen.getByRole("button", {name: "Clear filters"})));
    await waitFor(() => expect(screen.queryByText(/The link asked for view/)).not.toBeInTheDocument());
  });

  it("keeps the reconciled-paper warning beside the view report", async () => {
    localStorage.setItem(PAPER_STORAGE_KEY, JSON.stringify({schema: 1, codes: ["U1"], manual: {}, excluded: [], order: [], version: "old"}));
    mocks.index = index("v2");
    const notice = await open("?code=U1&question=q1&view=0");
    expect(notice).toHaveTextContent("The link asked for view 0, but views are numbered from 1. Showing view 1.");
    expect(notice).toHaveTextContent("The question bank was updated. Your paper has been reconciled with the current catalogue; review it before exporting.");
  });
});
