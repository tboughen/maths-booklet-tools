import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EditorDownloadMenu,
  SAVED_NOTE_MS,
  type DownloadAction,
} from "./EditorDownloadMenu";

function setup(actions: DownloadAction[]) {
  const onMessage = vi.fn();
  const onClose = vi.fn();
  const props = { id: "file-menu", onClose, actions, onMessage };
  const view = render(
    <>
      <button aria-controls="file-menu">File</button>
      <EditorDownloadMenu {...props} open />
    </>,
  );
  // The tool closes the menu when onClose runs; mirror that.
  onClose.mockImplementation(() =>
    view.rerender(
      <>
        <button aria-controls="file-menu">File</button>
        <EditorDownloadMenu {...props} open={false} />
      </>,
    ),
  );
  return { onMessage, onClose };
}

afterEach(() => vi.useRealTimers());

describe("Saved to file check (U42)", () => {
  it("shows a short visible check after Save editable file, then removes it", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { onMessage } = setup([
      {
        label: "Save editable file",
        action: save,
        success: "Editable file download started.",
      },
    ]);
    expect(screen.queryByTestId("saved-note")).toBeNull();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Save editable file" }),
      );
    });
    expect(save).toHaveBeenCalledOnce();
    // The menu has closed, but the check stays beside the File button.
    expect(screen.queryByRole("menu")).toBeNull();
    const note = screen.getByTestId("saved-note");
    expect(note).toHaveTextContent("✓ Saved to file");
    // The tool's own status message is the announcement, so the check is not announced twice.
    expect(note).toHaveAttribute("aria-hidden", "true");
    expect(onMessage).toHaveBeenCalledWith("Editable file download started.");
    expect(onMessage).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(SAVED_NOTE_MS));
    expect(screen.queryByTestId("saved-note")).toBeNull();
  });

  it("announces Saved to file when the tool gives no success text", async () => {
    const { onMessage } = setup([
      { label: "Save editable file", action: vi.fn() },
    ]);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Save editable file" }),
      );
    });
    expect(onMessage).toHaveBeenCalledWith("Saved to file.");
    expect(screen.getByTestId("saved-note")).toBeInTheDocument();
  });

  it("shows no check when a save is cancelled", async () => {
    const { onMessage } = setup([
      {
        label: "Save editable file",
        action: () =>
          Promise.reject(new DOMException("Cancelled", "AbortError")),
      },
    ]);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Save editable file" }),
      );
    });
    expect(screen.queryByTestId("saved-note")).toBeNull();
    expect(onMessage).not.toHaveBeenCalledWith("Saved to file.");
  });

  it("shows no check when the save fails or for other menu items", async () => {
    const { onMessage } = setup([
      {
        label: "Download PNG",
        action: vi.fn(),
        success: "PNG download started.",
      },
      {
        label: "Save editable file",
        action: () => {
          throw new Error("The file could not be saved.");
        },
      },
    ]);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("menuitem", { name: "Save editable file" }),
      );
    });
    expect(onMessage).toHaveBeenCalledWith(
      "The file could not be saved.",
      true,
    );
    expect(screen.queryByTestId("saved-note")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Download PNG" }));
    });
    expect(onMessage).toHaveBeenCalledWith("PNG download started.");
    expect(screen.queryByTestId("saved-note")).toBeNull();
  });
});
