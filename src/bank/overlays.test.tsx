import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverlayControls } from "./OverlayControls";
import { overlayPreference, type Overlay } from "./overlays";
import { PdfView } from "./PdfView";
import { renderPage } from "./pdf";

vi.mock("./pdf", () => ({
  renderPage: vi.fn(async () => document.createElement("canvas")),
  assetUrl: (path: string) => path,
  loadPdf: vi.fn(),
}));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("defaults to Off, restores a valid choice, and handles invalid or blocked storage", () => {
  expect(overlayPreference()).toBe("off");
  localStorage.setItem("qb-overlay", "lilac");
  expect(overlayPreference()).toBe("lilac");
  localStorage.setItem("qb-overlay", "invalid");
  expect(overlayPreference()).toBe("off");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(overlayPreference()).toBe("off");
});

it("supports keyboard colour selection without firing question navigation, and Escape closes the picker", async () => {
  const user = userEvent.setup();
  const navigate = vi.fn();
  function Harness() {
    const [value, setValue] = useState<Overlay>("off");
    return <div onKeyDown={navigate}><OverlayControls value={value} onChange={setValue} room="auto" onRoomChange={() => undefined}/></div>;
  }
  const { container } = render(<Harness/>);
  const summary = container.querySelector("summary")!;
  await user.click(summary);
  expect(container.querySelector("details")).toHaveAttribute("open");
  const yellow = container.querySelector<HTMLLabelElement>('.qb-overlay-panel label[title="Yellow"]')!;
  await user.click(yellow);
  expect(summary).toHaveAttribute("aria-label", "View options: overlay Yellow");
  await user.keyboard("{ArrowRight}");
  expect(summary).toHaveAttribute("aria-label", "View options: overlay Blue");
  expect(navigate).not.toHaveBeenCalled();
  expect(container.querySelector("details")).toHaveAttribute("open");
  await user.keyboard("{Escape}");
  expect(container.querySelector("details")).not.toHaveAttribute("open");
  expect(summary).toHaveFocus();
});

it("changes the screen tint without rerendering or altering the exportable canvas", async () => {
  const view = { id: "test", page: 1, width: 200, height: 100, label: "Question", description: "A question", preview: "question.png", sourcePages: [1] };
  const { container, rerender } = render(<PdfView path="question.pdf" view={view} scale={1} retryKey={0}/>);
  await waitFor(() => expect(screen.getByRole("img", {name: "A question"})).toBeInTheDocument());
  const canvas = container.querySelector("canvas");
  expect(container.querySelector(".qb-coloured-overlay")).toBeNull();
  rerender(<PdfView path="question.pdf" view={view} scale={1} retryKey={0} overlay="yellow"/>);
  expect(container.querySelector(".qb-coloured-overlay")).toHaveStyle({backgroundColor: "#FFF8CF"});
  expect(container.querySelector("canvas")).toBe(canvas);
  expect(renderPage).toHaveBeenCalledTimes(1);
  rerender(<PdfView path="question.pdf" view={view} scale={1} retryKey={0} overlay="off"/>);
  expect(container.querySelector(".qb-coloured-overlay")).toBeNull();
});
