// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "./EditorToolbar";
import { isResetStep, stepName } from "../editor-kit/labels";
import { createHistory, pushHistory, redoHistory, undoHistory } from "../editor-kit/history";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("isResetStep (U25)", () => {
  it("knows every page's reset step name", () => {
    for (const question of ["Reset diagram", "Reset this table?", "Reset this resource?", "Start a new model?"])
      expect(isResetStep(stepName(question))).toBe(true);
    for (const name of ["", "add row", "use worked version", "restart numbering", "start afresh"]) expect(isResetStep(name)).toBe(false);
  });
});

describe("history marks reset steps (U25)", () => {
  it("numbers each new reset and clears the mark on undo, redo and other changes", () => {
    let h = pushHistory(createHistory(0), 1, { label: "add row" });
    expect(h.resetStep).toBeUndefined();
    h = pushHistory(h, 2, { label: "reset this table" });
    const first = h.resetStep;
    expect(first).toBeDefined();
    expect(undoHistory(h).resetStep).toBeUndefined();
    expect(redoHistory(undoHistory(h)).resetStep).toBeUndefined();
    // A reset made again after undoing one is a new event with a new number.
    const again = pushHistory(undoHistory(h), 3, { label: "reset this table" });
    expect(again.resetStep).toBeDefined();
    expect(again.resetStep).not.toBe(first);
    expect(pushHistory(h, 4, { label: "add row" }).resetStep).toBeUndefined();
    expect(pushHistory(h, 5, { label: "clear", reset: true }).resetStep).toBeDefined();
  });
});

describe("reset notice (U25)", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });
  const render = (resetStep: number | undefined, onUndo: () => void = () => {}) =>
    act(() =>
      root!.render(
        <EditorToolbar
          canUndo
          canRedo={false}
          onUndo={onUndo}
          onRedo={() => {}}
          undoLabel="reset this table"
          resetStep={resetStep}
          onReset={() => {}}
          onCopy={() => {}}
          onCopyClipboard={() => {}}
          menuOpen={false}
          onToggleMenu={() => {}}
        />,
      ),
    );
  const notice = () => host!.querySelector(".editor-reset-notice");
  const start = (page?: HTMLElement) => {
    host = (page ?? document.body).appendChild(document.createElement("div"));
    root = createRoot(host);
  };

  it("opens for a new reset, keeps its live region mounted and closes on the next event", () => {
    start();
    render(undefined);
    expect(host!.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(notice()).toBeNull();
    render(2);
    expect(notice()?.textContent).toContain("Resource reset.");
    render(undefined);
    expect(notice()).toBeNull();
  });

  it("opens again for a later reset after an earlier one was dismissed", () => {
    start();
    render(undefined);
    render(2);
    act(() => {
      const close = host!.querySelector(".editor-reset-close") as HTMLButtonElement;
      close.focus();
      close.click();
    });
    expect(notice()).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Undo");
    render(3);
    expect(notice()).not.toBeNull();
  });

  it("Undo reset undoes once and keeps focus in the toolbar", () => {
    start();
    const onUndo = vi.fn();
    render(undefined, onUndo);
    render(2, onUndo);
    act(() => {
      const undo = host!.querySelector(".editor-reset-undo") as HTMLButtonElement;
      undo.focus();
      undo.click();
    });
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(notice()).toBeNull();
    expect(host!.contains(document.activeElement)).toBe(true);
  });

  it("closes when its page is switched away from", () => {
    start();
    render(undefined);
    render(2);
    expect(notice()).not.toBeNull();
    act(() =>
      root!.render(
        <EditorToolbar canUndo canRedo={false} onUndo={() => {}} onRedo={() => {}} resetStep={2} active={false}
          onReset={() => {}} onCopy={() => {}} onCopyClipboard={() => {}} menuOpen={false} onToggleMenu={() => {}} />,
      ),
    );
    expect(notice()).toBeNull();
  });

  it("shows a reset that happened just before the toolbar mounted", () => {
    start();
    render(4);
    expect(notice()).not.toBeNull();
  });

  it("keeps focus in the toolbar when the notice closes by Ctrl+Z while focused", () => {
    start();
    render(undefined);
    render(2);
    (host!.querySelector(".editor-reset-close") as HTMLButtonElement).focus();
    render(undefined);
    expect(notice()).toBeNull();
    expect(host!.contains(document.activeElement)).toBe(true);
  });
});
