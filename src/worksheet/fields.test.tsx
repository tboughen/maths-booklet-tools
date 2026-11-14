import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./fields";

describe("worksheet fields keep a refused draft visible (W12)", () => {
  it("leaves the typed text in place, marked invalid, until it is fixed or Escape restores", () => {
    let accept = false;
    render(<Field label="Title" value="Saved" max={80} onCommit={() => accept} />);
    const box = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "Bad {draft" } });
    fireEvent.blur(box);
    expect(box.value).toBe("Bad {draft");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box.value).toBe("Saved");
    expect(box.getAttribute("aria-invalid")).toBeNull();
    accept = true;
    fireEvent.change(box, { target: { value: "Fine" } });
    fireEvent.blur(box);
    expect(box.getAttribute("aria-invalid")).toBeNull();
  });

  it("gives way to a new saved value, such as after Undo", () => {
    const { rerender } = render(<Field label="Title" value="Saved" max={80} onCommit={() => false} />);
    const box = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "Bad {draft" } });
    fireEvent.blur(box);
    expect(screen.getByText(/Not applied/)).toBeTruthy();
    rerender(<Field label="Title" value="Earlier" max={80} onCommit={() => false} />);
    expect(box.value).toBe("Earlier");
    expect(box.getAttribute("aria-invalid")).toBeNull();
  });
});
