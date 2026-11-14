import { afterEach, describe, expect, it } from "vitest";
import { objectKeyCommand } from "./shortcuts";

const key = (k: string, extra: Partial<KeyboardEvent> = {}, target: EventTarget | null = document.body) =>
  objectKeyCommand({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, defaultPrevented: false, target, ...extra });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("objectKeyCommand (U9)", () => {
  it("maps Delete, Backspace, Escape and arrows (1 mm, Shift 5 mm, down positive)", () => {
    expect(key("Delete")).toEqual({ kind: "delete" });
    expect(key("Backspace")).toEqual({ kind: "delete" });
    expect(key("Escape")).toEqual({ kind: "deselect" });
    expect(key("ArrowLeft")).toEqual({ kind: "nudge", dx: -1, dy: 0 });
    expect(key("ArrowDown", { shiftKey: true })).toEqual({ kind: "nudge", dx: 0, dy: 5 });
    expect(key("a")).toBeNull();
  });
  it("ignores typing, dialogs, modifiers and handled keys", () => {
    const input = document.body.appendChild(document.createElement("input"));
    expect(key("Delete", {}, input)).toBeNull();
    expect(key("Delete", { ctrlKey: true })).toBeNull();
    expect(key("ArrowUp", { defaultPrevented: true })).toBeNull();
    const dialog = document.body.appendChild(document.createElement("div"));
    dialog.setAttribute("aria-modal", "true");
    expect(key("Escape")).toBeNull();
  });
});
