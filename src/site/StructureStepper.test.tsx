import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StructureStepper } from "./StructureStepper";

describe("StructureStepper (U6)", () => {
  it("is a named group: − then + horizontally, + above − vertically", () => {
    const add = vi.fn();
    const remove = vi.fn();
    const { rerender } = render(
      <StructureStepper
        name="Rows"
        add={{ label: "Add row", onClick: add }}
        remove={{ label: "Remove row", title: "Remove row 3", onClick: remove }}
      />,
    );
    const group = screen.getByRole("group", { name: "Rows" });
    expect(within(group).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Remove row", "Add row"]);
    expect(screen.getByRole("button", { name: "Remove row" }).title).toBe("Remove row 3");
    expect(screen.getByRole("button", { name: "Add row" }).title).toBe("Add row");
    expect(group.textContent).toBe("Rows");
    fireEvent.click(screen.getByRole("button", { name: "Add row" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove row" }));
    expect(add).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    rerender(
      <StructureStepper
        vertical
        name="Stages"
        caption=""
        add={{ label: "Add stage", onClick: add }}
        remove={{ label: "Remove stage", disabled: true, onClick: remove }}
      />,
    );
    const stages = screen.getByRole("group", { name: "Stages" });
    expect(within(stages).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Add stage", "Remove stage"]);
    expect(stages.textContent).toBe("");
    expect((screen.getByRole("button", { name: "Remove stage" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
