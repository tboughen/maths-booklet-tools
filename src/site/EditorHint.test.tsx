import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorHint, HINT_STORAGE_PREFIX } from "./EditorHint";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("EditorHint (U22)", () => {
  it("shows the tip until it is hidden, and remembers that per tool", () => {
    const { unmount } = render(
      <>
        <div className="preview-bar">
          <select aria-label="Preview zoom" />
        </div>
        <EditorHint tool="venn">Click a region.</EditorHint>
      </>,
    );
    expect(screen.getByText("Click a region.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide this tip" }));
    expect(screen.queryByText("Click a region.")).toBeNull();
    // Focus moves to the nearest real control above, the preview zoom.
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Preview zoom" }));
    expect(localStorage.getItem(HINT_STORAGE_PREFIX + "venn")).toBe("1");
    unmount();
    render(
      <>
        <EditorHint tool="venn">Click a region.</EditorHint>
        <EditorHint tool="charts">Click a bar.</EditorHint>
      </>,
    );
    expect(screen.queryByText("Click a region.")).toBeNull();
    expect(screen.getByText("Click a bar.")).toBeTruthy();
  });

  it("always shows a mode prompt in the same place, with no way to hide it", () => {
    localStorage.setItem(HINT_STORAGE_PREFIX + "number-line", "1");
    render(
      <EditorHint tool="number-line" prompt="Choose the first endpoint.">
        Click a circle.
      </EditorHint>,
    );
    expect(screen.getByRole("status").textContent).toBe("Choose the first endpoint.");
    expect(screen.queryByText("Click a circle.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide this tip" })).toBeNull();
  });

  it("keeps the status region mounted between prompts, so each new prompt is announced", () => {
    const { rerender } = render(<EditorHint tool="venn">Click a region.</EditorHint>);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    rerender(<EditorHint tool="venn" prompt="Click a region to shade it.">Click a region.</EditorHint>);
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe("Click a region to shade it.");
  });

  it("hides a tip hidden in another tab", () => {
    render(<EditorHint tool="charts">Click a bar.</EditorHint>);
    localStorage.setItem(HINT_STORAGE_PREFIX + "charts", "1");
    fireEvent(window, new StorageEvent("storage", { key: HINT_STORAGE_PREFIX + "charts" }));
    expect(screen.queryByText("Click a bar.")).toBeNull();
  });

  it("still works when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<EditorHint tool="graph">Choose a tool.</EditorHint>);
    fireEvent.click(screen.getByRole("button", { name: "Hide this tip" }));
    expect(screen.queryByText("Choose a tool.")).toBeNull();
  });
});
