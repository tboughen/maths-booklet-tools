import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cleanAbout, withAbout } from "./titleNoteData";
import { useTitleNote } from "./TitleNote";
import { graphDocument, graphEnvelope } from "../domain/graphAbout";
import { newBrowserGraph } from "../domain/browserGraph";
import { parseGraphFile } from "../../packages/graph-core/src/interchange";

describe("title and note (U34)", () => {
  it("replaces, trims and drops blank values", () => {
    const e = { schemaVersion: 1, document: {}, title: "Old", note: "Old note" };
    expect(withAbout(e, { title: "  New  ", note: "   " })).toEqual({ schemaVersion: 1, document: {}, title: "New" });
    expect(withAbout(e, {})).toEqual({ schemaVersion: 1, document: {} });
    expect(cleanAbout({ title: "", note: " n " })).toEqual({ note: "n" });
  });

  it("graph: a file's title and note survive opening and saving again", () => {
    const saved = JSON.stringify({ ...graphEnvelope(newBrowserGraph()), title: "Linear graphs", note: "For 9X2" });
    const opened = graphDocument(parseGraphFile(saved));
    expect(opened.about).toEqual({ title: "Linear graphs", note: "For 9X2" });
    const again = graphEnvelope(opened);
    expect(again.title).toBe("Linear graphs");
    expect(again.note).toBe("For 9X2");
    expect("about" in again.document).toBe(false);
    expect(graphDocument(graphEnvelope(newBrowserGraph())).about).toBeUndefined();
  });

  it("saves one change, and nothing on Cancel or when unchanged", () => {
    const onSave = vi.fn();
    function Harness() {
      const t = useTitleNote({ about: { title: "A" }, onSave });
      return (
        <>
          <button onClick={() => void t.item.action()}>open</button>
          {t.dialog}
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(screen.getByRole("button", { name: "Save title and note" }));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("open"));
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "Homework" } });
    fireEvent.click(screen.getByRole("button", { name: "Save title and note" }));
    expect(onSave).toHaveBeenCalledWith({ title: "A", note: "Homework" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
