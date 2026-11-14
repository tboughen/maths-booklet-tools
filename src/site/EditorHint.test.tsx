import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorHint, HINT_STORAGE_PREFIX } from "./EditorHint";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("EditorHint (U22)", () => {
  it("shows the tip until it is hidden, and remembers that per tool", () => {
    const { unmount } = render(<EditorHint tool="venn">Click a region.</EditorHint>);
    expect(screen.getByText("Click a region.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide this tip" }));
    expect(screen.queryByText("Click a region.")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("editor-hint"));
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
