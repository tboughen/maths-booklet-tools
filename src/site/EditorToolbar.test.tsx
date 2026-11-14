// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorToolbar } from "./EditorToolbar";
import { isResetStep, stepName } from "../editor-kit/labels";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("isResetStep (U25)", () => {
  it("knows every page's reset step name", () => {
    for (const question of ["Reset diagram", "Reset this table?", "Reset this resource?", "Start a new model?", "Start a fresh triangle diagram?"])
      expect(isResetStep(stepName(question))).toBe(true);
    for (const name of ["", "add row", "use worked version", "restart numbering"]) expect(isResetStep(name)).toBe(false);
  });
});

describe("reset notice (U25)", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });
  const render = (props: { undoLabel: string; canRedo: boolean; redoLabel?: string; onUndo?: () => void }) =>
    act(() =>
      root!.render(
        <EditorToolbar
          canUndo
          canRedo={props.canRedo}
          onUndo={props.onUndo ?? (() => {})}
          onRedo={() => {}}
          undoLabel={props.undoLabel}
          redoLabel={props.redoLabel}
          onReset={() => {}}
          onCopy={() => {}}
          onCopyClipboard={() => {}}
          menuOpen={false}
          onToggleMenu={() => {}}
        />,
      ),
    );
  const notice = () => host!.querySelector(".editor-reset-notice");
  const start = () => {
    host = document.body.appendChild(document.createElement("div"));
    root = createRoot(host);
  };

  it("opens on a new reset step, keeps its live region mounted and closes on the next step", () => {
    start();
    render({ undoLabel: "add row", canRedo: false });
    expect(host!.querySelector('[role="status"]')).not.toBeNull();
    expect(notice()).toBeNull();
    render({ undoLabel: "reset this table", canRedo: false });
    expect(notice()?.textContent).toContain("Resource reset.");
    render({ undoLabel: "add row", canRedo: false });
    expect(notice()).toBeNull();
  });

  it("stays closed when undo or redo lands on an earlier reset", () => {
    start();
    render({ undoLabel: "add row", canRedo: true });
    render({ undoLabel: "reset this table", canRedo: true });
    expect(notice()).toBeNull();
    // Redo of the reset as the last step.
    render({ undoLabel: "add row", canRedo: true, redoLabel: "reset this table" });
    render({ undoLabel: "reset this table", canRedo: false });
    expect(notice()).toBeNull();
  });

  it("opens again for a later reset after an earlier one was dismissed", () => {
    start();
    render({ undoLabel: "reset this table", canRedo: false });
    render({ undoLabel: "add row", canRedo: false });
    render({ undoLabel: "reset this table", canRedo: false });
    act(() => (host!.querySelector(".editor-reset-close") as HTMLButtonElement).click());
    expect(notice()).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Undo");
    render({ undoLabel: "add row", canRedo: false });
    render({ undoLabel: "reset this table", canRedo: false });
    expect(notice()).not.toBeNull();
  });

  it("Undo reset undoes once and keeps focus in the toolbar", () => {
    start();
    const onUndo = vi.fn();
    render({ undoLabel: "add row", canRedo: false, onUndo });
    render({ undoLabel: "reset this table", canRedo: false, onUndo });
    act(() => (host!.querySelector(".editor-reset-undo") as HTMLButtonElement).click());
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(notice()).toBeNull();
    expect(host!.contains(document.activeElement)).toBe(true);
  });
});
