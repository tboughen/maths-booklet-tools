import { afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "./LessonBarModelPage";
import * as v from "../../packages/bar-model-core/src/v2";
import * as old from "../../packages/bar-model-core/src/index";
import type { History } from "./LessonBarModelPage";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
const open = (e = v.fresh(), history?: History) => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  return render(
    <Page
      storageKey="v2-test"
      startup={{ envelope: e, expected: null, legacyRaw: null, message: "" }}
      initialHistory={history}
    />,
  );
};
const saved = () =>
  JSON.parse(localStorage.getItem("v2-test")!).envelope as v.Envelope;
it("edits an independent label without losing focus or overwriting another slot", async () => {
  open();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Edit bar 1 section 1 inside label" }),
  );
  const input = screen.getByLabelText("Saved label");
  await user.type(input, "18");
  expect(input).toHaveFocus();
  expect(input).toHaveValue("18");
  expect(screen.getByRole("button", { name: "Copy image" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Apply" }));
  expect(saved().document.bars[0].parts[0].labels.inside.text).toBe("18");
  await user.selectOptions(screen.getByLabelText("Label position"), "above");
  await user.click(
    screen.getAllByRole("button", { name: "Edit above label" })[0],
  );
  expect(screen.getByLabelText("Saved label")).toHaveValue("");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(saved().document.bars[0].parts[0].labels.inside.text).toBe("18");
});
it("keeps an invalid relative-length draft and restores with Cancel", async () => {
  open();
  const user = userEvent.setup();
  await user.click(
    screen.getAllByRole("button", { name: "Relative length" })[0],
  );
  await user.clear(screen.getByLabelText("Relative length"));
  await user.type(screen.getByLabelText("Relative length"), "x");
  await user.click(screen.getByRole("button", { name: "Apply" }));
  expect(screen.getByRole("alert")).toHaveTextContent("exact");
  expect(screen.getByLabelText("Relative length")).toHaveValue("x");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(localStorage.getItem("v2-test")).toBeNull();
});
it("bulk labels commit once and one Undo restores every slot", async () => {
  open();
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Set inside labels for whole bar" }),
  );
  await user.type(screen.getByLabelText("Saved label"), "b");
  await user.click(screen.getByRole("button", { name: "Apply" }));
  expect(
    saved().document.bars[0].parts.every((p) => p.labels.inside.text === "b"),
  ).toBe(true);
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(
    saved().document.bars[0].parts.every((p) => !p.labels.inside.text),
  ).toBe(true);
  await user.click(screen.getByRole("button", { name: "Redo" }));
  expect(
    saved().document.bars[0].parts.every((p) => p.labels.inside.text === "b"),
  ).toBe(true);
});
it("worked replacement retains earlier history and restores v1 after explicit upgrade", async () => {
  const e = old.fresh(),
    upgraded = v.upgrade(e);
  open(upgraded, { past: [e], present: upgraded, future: [] });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Worked R4" }));
  expect(saved().document.sourceId).toBe("lesson-v2-R4");
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(saved().document.sourceId).toBeUndefined();
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(
    JSON.parse(localStorage.getItem("v2-test")!).envelope.schemaVersion,
  ).toBe(1);
  expect(screen.getByText(/Legacy layout and source/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Redo" }));
  expect(saved().schemaVersion).toBe(2);
});
it("preserves selection, draft and Undo against inactive keyboard shortcuts", async () => {
  const view = open();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Worked R1" }));
  const before = localStorage.getItem("v2-test");
  view.rerender(
    <Page
      active={false}
      storageKey="v2-test"
      startup={{
        envelope: v.fresh(),
        expected: null,
        legacyRaw: null,
        message: "",
      }}
    />,
  );
  fireEvent.keyDown(window, { key: "z", ctrlKey: true });
  expect(localStorage.getItem("v2-test")).toBe(before);
});
