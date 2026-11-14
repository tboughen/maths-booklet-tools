import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { historyActionText, operationLabel, stepName } from "./labels";
import { EditorToolbar } from "../site/EditorToolbar";

describe("undo step names", () => {
  it("turns questions and operations into short step names", () => {
    expect(stepName("Reset this table?")).toBe("reset this table");
    expect(stepName("SVG import?")).toBe("SVG import");
    expect(stepName("")).toBe("");
    expect(operationLabel([{ op: "add_column" }, { op: "set_cell" }])).toBe("add column");
    expect(operationLabel({ op: "set_cell" })).toBe("change cell");
    expect(operationLabel([])).toBe("");
    expect(historyActionText("Undo", "add row")).toBe("Undo add row");
    expect(historyActionText("Redo")).toBe("Redo");
  });

  it("names the step on the toolbar without changing the buttons' accessible names", () => {
    const noop = vi.fn();
    render(
      <EditorToolbar canUndo canRedo={false} undoLabel="add row" redoLabel="remove row" onUndo={noop} onRedo={noop} onReset={noop} onCopy={noop} onCopyClipboard={noop} menuOpen={false} onToggleMenu={noop} />,
    );
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo).toHaveAttribute("title", "Undo add row (Ctrl+Z)");
    expect(undo).toHaveAccessibleDescription("Undo add row");
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(redo).toHaveAttribute("title", "Redo (Ctrl+Y)");
  });
});
