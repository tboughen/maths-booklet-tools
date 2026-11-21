import { switchTool } from "./tool-switcher";
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonical, layout, type Envelope } from "../packages/probability-tree-core/src";
import { examples } from "../packages/probability-tree-core/src/examples";
import { printRasterSize, verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
import { clickResourceAction } from "./resource-actions";

const report = resolve(process.env.TREE_REPORT_DIR ?? "test-results/probability-tree-artifacts");
mkdirSync(report, { recursive: true });
const key = "maths-booklet-tools:probability-tree:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/probability-tree");
  await expect(page.getByTestId("tree-resource").locator("svg")).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);

test("edits a probability from the tree, makes it a pupil space and undoes", async ({ page }) => {
  await boot(page);
  const target = page.getByRole("button", { name: "Edit probability for Red, Blue" });
  await target.click();
  // The click opens the options box beside the label and hides nothing; Enter moves to its text.
  const box = page.getByRole("dialog", { name: "Probability for Red, Blue" });
  await expect(box).toBeFocused();
  expect((await saved(page)).document.branches[2].probability.show).toBe("show");
  await page.keyboard.press("Enter");
  const field = box.getByRole("textbox", { name: "Text of probability for Red, Blue" });
  await expect(field).toBeFocused();
  await field.fill("4/7");
  await field.press("Enter");
  expect((await saved(page)).document.branches[2].probability).toEqual({ text: "4/7", show: "show" });
  await expect(page.getByRole("textbox", { name: "Probability for Red, Blue", exact: true })).toHaveValue("4/7");
  await target.dblclick();
  await expect(box.getByRole("button", { name: "Pupil space" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("tree-resource").locator("svg line[stroke-dasharray]")).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(page.getByTestId("tree-resource").locator("svg line[stroke-dasharray]")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("textbox", { name: "Probability for Red, Blue", exact: true })).toHaveValue("5/8");
});

test("what pupils see: double-click, H, leave out, the kind switches and clearing pupil spaces, each one undo step", async ({ page }) => {
  await boot(page);
  const art = page.getByTestId("tree-resource").locator(".pt-art svg");
  const shows = async () => (await saved(page)).document.branches.map((b: { probability: { show: string } }) => b.probability.show);
  const undoName = () => page.getByRole("button", { name: "Undo" }).getAttribute("title");
  // Double-click: a pupil space, the box stays open; again brings the value back.
  const target = page.getByRole("button", { name: "Edit probability for Red, Blue" });
  await target.dblclick();
  expect((await shows())[2]).toBe("hidden");
  await expect(page.getByRole("dialog", { name: "Probability for Red, Blue" })).toBeVisible();
  await expect(target).toHaveAccessibleName("Edit probability for Red, Blue, pupil space");
  expect(await undoName()).toContain("pupil space on 5/8");
  await target.dblclick();
  expect((await shows())[2]).toBe("show");
  // H with the box focused, never while typing in a field.
  await target.click();
  await page.keyboard.press("h");
  expect((await shows())[2]).toBe("hidden");
  await page.getByRole("button", { name: "Layout" }).click();
  await page.getByLabel("Stage 1 title").fill("H");
  expect((await shows())[2]).toBe("hidden");
  await page.getByLabel("Stage 1 title").press("Enter");
  // Leave out keeps the text and prints nothing; undo brings it back.
  await target.click();
  const box = page.getByRole("dialog", { name: "Probability for Red, Blue" });
  await box.getByRole("button", { name: "Leave out" }).click();
  expect((await saved(page)).document.branches[2].probability).toEqual({ text: "5/8", show: "omit" });
  await page.getByLabel("Teacher copy: show answers").check();
  expect((await art.innerHTML()).match(/>5</g)?.length ?? 0).toBe(2);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  // A press elsewhere closed the box; Escape closes it and hands focus back to the label.
  await expect(box).toHaveCount(0);
  await target.click();
  await expect(box).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
  await expect(target).toBeFocused();
  // H does nothing once the box is closed.
  await page.keyboard.press("h");
  expect((await saved(page)).document.branches[2].probability.show).toBe("omit");
  // The close button also hands focus back to the label.
  await target.click();
  await box.getByRole("button", { name: "Close options" }).click();
  await expect(box).toHaveCount(0);
  await expect(target).toBeFocused();
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await shows())[2]).toBe("hidden");
  // A kind switch sets them all as one step, and shows Mixed when they differ.
  const probabilities = page.getByRole("group", { name: "Probabilities" });
  await expect(probabilities).toContainText("Mixed");
  await probabilities.getByRole("button", { name: "Pupil space" }).click();
  expect(await shows()).toEqual(Array(6).fill("hidden"));
  expect(await undoName()).toContain("pupil space on all probabilities");
  await expect(page.locator(".pt-hint")).toContainText("6 so far");
  await page.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect(await shows()).toEqual(Array(6).fill("show"));
  expect(await undoName()).toContain("clear 6 pupil spaces");
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await shows()).toEqual(Array(6).fill("hidden"));
  // The folded Layout row says what is set, and its stepper takes a typed size.
  await expect(page.locator(".md-fold").filter({ hasText: "Layout" })).toContainText("32 mm branches · 14 mm spacing");
  const length = page.getByRole("textbox", { name: "Branch length (mm)" });
  await length.fill("30");
  await length.press("Enter");
  expect((await saved(page)).document.branchMm).toBe(30);
  await page.getByRole("button", { name: "More branch length" }).click();
  expect((await saved(page)).document.branchMm).toBe(32);
  // A size out of range is refused and named; the next press replaces it.
  await length.fill("99");
  await length.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Type a whole number from 12 to 50." })).toBeVisible();
  await page.getByRole("button", { name: "More branch length" }).click();
  await expect(length).toHaveValue("36 mm");
  await expect(page.getByRole("alert").filter({ hasText: "Type a whole number" })).toHaveCount(0);
  // No box, highlight or marker reaches an export.
  await target.click();
  const svgPromise = page.waitForEvent("download");
  await clickResourceAction(page, "Download SVG");
  const svg = readFileSync((await (await svgPromise).path())!, "utf8");
  expect(svg).not.toMatch(/md-options|pt-hit|pt-hidden-answer|pt-omitted|What pupils see/);
});

test("grows an unequal tree, fills from a bag and calculates a given-that answer only on request", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "Edit outcome for Red, Red" }).click();
  await page.getByRole("button", { name: "Add branches after this" }).click();
  expect((await saved(page)).document.branches).toHaveLength(8);
  // The rarer groups are folded into one row each; pressing the row opens it.
  await page.getByRole("button", { name: "Fill probabilities" }).click();
  await page.getByRole("button", { name: "Fill from bag" }).click();
  await page.getByRole("button", { name: "Use this tree" }).click();
  expect((await saved(page)).document.branches.map((b: { probability: { text: string } }) => b.probability.text)).toEqual([
    "5/8", "4/7", "3/6", "3/6", "3/7", "3/8", "5/7", "2/7",
  ]);
  await page.getByRole("button", { name: 'Questions and "given that"' }).click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByText("Paths for calculating").click();
  await page.getByLabel("Blue, Red is in the event").check();
  await page.getByLabel("Blue, Red is in the condition").check();
  await page.getByLabel("Blue, Blue is in the condition").check();
  expect((await saved(page)).document.questions[0].answer.text).toBe("");
  await page.getByRole("button", { name: "Calculate answer" }).click();
  expect((await saved(page)).document.questions[0].answer).toEqual({ text: "5/7", show: "hidden" });
});

test("exports a 600 ppi PNG and an SVG at the stated physical size", async ({ page }) => {
  const e = examples.find((x) => x.id === "without-replacement")!.make(false);
  await boot(page, e);
  const g = layout(e);
  const pngPromise = page.waitForEvent("download");
  await clickResourceAction(page, "Download PNG (600 ppi)");
  const path = resolve(report, "tree-600ppi.png");
  await (await pngPromise).saveAs(path);
  const size = printRasterSize(g.width / 10, g.height / 10);
  verifyPrintBytes(new Uint8Array(readFileSync(path)), size.width, size.height);
  const svgPromise = page.waitForEvent("download");
  await clickResourceAction(page, "Download SVG");
  const svgPath = resolve(report, "tree.svg");
  await (await svgPromise).saveAs(svgPath);
  const svg = readFileSync(svgPath, "utf8");
  expect(svg).toContain(`width="${g.width}mm"`);
  expect(svg).not.toMatch(/pt-hit|button|5\/14/);
});

test("work survives leaving the page and reloading", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "Layout" }).click();
  await page.getByLabel("Stage 1 title").fill("Bag A");
  await page.getByLabel("Stage 1 title").press("Enter");
  await switchTool(page, "Venn diagrams");
  await switchTool(page, "Probability trees");
  await expect(page.getByLabel("Stage 1 title")).toHaveValue("Bag A");
  await page.reload();
  await expect(page.getByLabel("Stage 1 title")).toHaveValue("Bag A");
});

test("bold lines are saved, printed and undoable; normal lines are not saved (U111)", async ({ page }) => {
  await boot(page);
  const art = page.getByTestId("tree-resource").locator("svg").first();
  const first = async () => Number((await art.innerHTML()).match(/stroke-width="([\d.]+)"/)![1]);
  const normal = await first();
  await page.getByRole("button", { name: "Layout" }).click();
  const lines = page.getByLabel("Lines", { exact: true });
  await lines.selectOption("bold");
  await expect.poll(async () => (await saved(page))?.document.lines).toBe("bold");
  // The preview is the printed SVG: every stroke is 1.5 times as heavy.
  await expect.poll(first).toBeCloseTo(normal * 1.5, 3);
  await lines.selectOption("normal");
  await expect.poll(async () => JSON.stringify(await saved(page))).not.toContain('"lines"');
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await saved(page))?.document.lines).toBe("bold");
});
