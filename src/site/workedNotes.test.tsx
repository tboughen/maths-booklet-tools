import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkedNote } from "../../packages/envelope-core/src/worked";
import { useWorkedNotes, withWorkedNotes } from "./WorkedNotes";
import { diagramFileMenu } from "./fileMenu";

function Harness(props: { notes?: WorkedNote[]; onSave: (n: WorkedNote[]) => void }) {
  const w = useWorkedNotes({ notes: props.notes ?? [], size: { width: 80, height: 40 }, onSave: props.onSave });
  return (
    <>
      <button onClick={() => void w.item.action()}>open</button>
      {w.dialog}
    </>
  );
}

describe("the Worked notes dialog (U116)", () => {
  it("adds a note and saves it as one change", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByRole("dialog", { name: "Worked notes" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add a worked note" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Guidance" }), { target: { value: "Multiply by 3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save worked notes" }));
    expect(onSave).toHaveBeenCalledWith([{ text: "Multiply by 3", x: 2, y: 2 }]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names a note that runs off the diagram and will not save it", () => {
    const onSave = vi.fn();
    render(<Harness notes={[{ text: "Add 3", x: 2, y: 2 }]} onSave={onSave} />);
    fireEvent.click(screen.getByText("open"));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Across (mm)" }), { target: { value: "78" } });
    expect(screen.getByRole("alert").textContent).toMatch(/Worked note 1 runs [\d.]+ mm past the right edge/);
    expect((screen.getByRole("button", { name: "Save worked notes" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove note 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Save worked notes" }));
    expect(onSave).toHaveBeenCalledWith([]);
  });

  it("an empty list leaves the field out of the file, and the File menu lists the item after Title and note", () => {
    expect(withWorkedNotes({ document: {}, worked: [{ text: "A", x: 0, y: 0 }] }, [])).toEqual({ document: {} });
    const item = { action: () => undefined };
    const labels = diagramFileMenu({ svg: item, png: item, about: item, worked: item, save: item, open: item, link: item }).map((a) => a.label);
    expect(labels.indexOf("Worked notes…")).toBe(labels.indexOf("Title and note…") + 1);
  });
});
