/**
 * Undo coverage (improvement item L24). Every editor keeps its whole document in the shared history, so every
 * edit that goes through `commit` is undone exactly in one step. This check fails when:
 * - a page shows Undo but is missing from the registry below, or
 * - a registered page keeps its own history (a reducer with past/future arrays or a length limit), or
 * - a page changes the history other than through the shared kit.
 * The browser half (one Ctrl+Z restores the saved resource exactly in every tool) is e2e/undo-coverage.spec.ts.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(__dirname, "..");
/** Every editor with document Undo, and the page file that owns its history. */
const undoRegistry: Record<string, string> = {
  graph: "App.tsx",
  "ratio-table": "ratio-table/RatioTablePage.tsx",
  "value-table-graph": "value-graph/ValueGraphPage.tsx",
  cuboids: "cuboid/CuboidPage.tsx",
  "number-line": "number-line/NumberLinePage.tsx",
  venn: "venn/VennPage.tsx",
  triangle: "triangle/TrianglePage.tsx",
  "expanding-factorising": "algebra-grid/AlgebraGridPage.tsx",
  "bar-model": "bar-model/LessonBarModelPage.tsx",
  "bar-model (classic)": "bar-model/BarModelPage.tsx",
  charts: "charts/ChartsPage.tsx",
  "probability-tree": "probability-tree/ProbabilityTreePage.tsx",
  "frequency-tree": "frequency-tree/FrequencyTreePage.tsx",
  worksheets: "worksheet/WorksheetPage.tsx",
  booklets: "booklet/BookletPage.tsx",
};
/** Undo that is not a document history: the shared toolbar itself and the question viewer's ink layers. */
const notEditors = new Set(["site/EditorToolbar.tsx", "site/HistoryButtons.tsx", "bank/QuestionBank.tsx", "bank/AnnotationBar.tsx"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "editor-kit" ? [] : files(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}
const source = (file: string) => readFileSync(join(root, file), "utf8");

describe("undo coverage", () => {
  it("lists every page that shows Undo", () => {
    const withUndo = files(root)
      .map((path) => relative(root, path).replaceAll("\\", "/"))
      .filter((file) => /<EditorToolbar\b|<HistoryButtons\b|aria-label="Undo"/.test(source(file)) && !notEditors.has(file));
    expect(withUndo.sort()).toEqual(Object.values(undoRegistry).sort());
  });

  for (const [tool, file] of Object.entries(undoRegistry)) {
    it(`${tool} keeps its document in the shared history`, () => {
      const text = source(file);
      expect(text, "uses the shared history hook").toMatch(/\buseDocumentHistory\b/);
      expect(text, "uses the shared undo keys").toMatch(/\b(handleUndoKeys|useUndoKeys)\(/);
      // No page-local history: no past/future arrays built by hand and no private step limit.
      expect(text).not.toMatch(/\bpast:\s*\[/);
      expect(text).not.toMatch(/\bfuture:\s*\[/);
      expect(text).not.toMatch(/past\.slice\(|future\.slice\(/);
      // Direct history changes go through the kit, or only refresh it.
      for (const call of text.matchAll(/setHistory\(([^;]*?)\);/gs))
        expect(call[1], `${tool}: ${call[0].slice(0, 80)}`).toMatch(/pushHistory\(|createHistory\(|replacePresent\(|^\(h\) => \(\{ \.\.\.h \}\)$/);
      // Undo keys are never hand-written.
      expect(text).not.toMatch(/key(\.toLowerCase\(\))? === "z"/);
    });
  }
});
