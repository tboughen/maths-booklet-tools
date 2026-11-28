import { test, expect, type Page } from "@playwright/test";
import { canonical as cCanonical, create as cCreate, layout as cLayout } from "../packages/construction-core/src";
import { canonical as eCanonical, create as eCreate, layout as eLayout } from "../packages/elevation-core/src";
import { printRasterSize, verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
import { clickResourceAction } from "./resource-actions";

const saved = (page: Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const cKey = "maths-booklet-tools:construction:v1",
  eKey = "maths-booklet-tools:elevations:v1";

test("constructions: adds a hidden perpendicular bisector, shows it only on the teacher copy and undoes", async ({ page }) => {
  await page.goto("/tools/construction");
  const art = page.getByTestId("construction-resource").locator("svg");
  await expect(art).toBeVisible();
  const before = await saved(page, cKey);
  await page.getByRole("button", { name: "Add point" }).click();
  await page.getByRole("button", { name: "Add point" }).click();
  const doc = (await saved(page, cKey)).document;
  const [a, b] = doc.points.slice(-2).map((p: { id: string }) => p.id);
  const section = page.getByRole("region", { name: "Ruler and compass constructions" });
  await section.getByRole("combobox", { name: "Construction to add" }).selectOption("perpendicular-bisector");
  await section.getByRole("combobox", { name: "Perpendicular bisector of a line: From" }).selectOption(a);
  await section.getByRole("combobox", { name: "Perpendicular bisector of a line: To" }).selectOption(b);
  await section.getByRole("button", { name: /^Add/ }).click();
  const after = (await saved(page, cKey)).document;
  expect(after.objects.filter((o: { group?: string; role: string }) => o.group).every((o: { role: string }) => o.role === "answer")).toBe(true);
  const pupil = await art.innerHTML();
  await page.getByLabel("Teacher copy: show answers").check();
  expect(await art.innerHTML()).not.toBe(pupil);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect(await saved(page, cKey)).toEqual(before);
});

test("constructions: a shape, the locus round its edge and the not-to-scale note, each one undo step", async ({ page }) => {
  await page.goto("/tools/construction");
  const art = page.getByTestId("construction-resource").locator("svg");
  await expect(art).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Add point" }).click();
  const ids: string[] = (await saved(page, cKey)).document.points.filter((p: { group?: string }) => !p.group).map((p: { id: string }) => p.id).slice(-3);
  const before = await saved(page, cKey);
  await page.getByRole("combobox", { name: "Line or mark to add" }).selectOption("polygon");
  await page.getByRole("textbox", { name: "Corners of the shape in order" }).fill(ids.join(" "));
  await page.getByRole("button", { name: /^Add shape/ }).click();
  const shape = (await saved(page, cKey)).document.objects.find((o: { type: string }) => o.type === "polygon");
  expect(shape.points).toEqual(ids);
  const section = page.getByRole("region", { name: "Ruler and compass constructions" });
  await section.getByRole("combobox", { name: "Construction to add" }).selectOption("locus-polygon");
  await section.getByRole("combobox", { name: "Shape whose edge the locus follows" }).selectOption(shape.id);
  await section.getByRole("textbox", { name: "Distance in centimetres on the drawing" }).fill("0.5");
  await section.getByRole("button", { name: /^Add/ }).click();
  const locus = (await saved(page, cKey)).document.objects.filter((o: { group?: string }) => o.group?.startsWith("lg"));
  expect(locus.length).toBeGreaterThanOrEqual(6);
  expect(locus.every((o: { role: string }) => o.role === "answer")).toBe(true);
  const drawing = page.getByRole("region", { name: "Drawing" });
  await drawing.getByRole("button", { name: "Drawing", exact: true }).click();
  await drawing.getByLabel("Print “Diagram NOT accurately drawn”").check();
  await expect(art).toContainText("Diagram NOT accurately drawn");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect(await saved(page, cKey)).toEqual(before);
});

test("constructions: the printed PNG keeps the drawing's true size", async ({ page }) => {
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [cKey, cCanonical(cCreate())]);
  await page.goto("/tools/construction");
  const g = cLayout(cCreate());
  const download = page.waitForEvent("download");
  await clickResourceAction(page, "Download PNG (600 ppi)");
  const path = await (await download).path();
  const bytes = new Uint8Array(await import("node:fs").then((fs) => fs.readFileSync(path!)));
  const size = printRasterSize(g.width / 10, g.height / 10);
  verifyPrintBytes(bytes, size.width, size.height);
});

test("plans and elevations: edits the solid, adds a panel and undoes", async ({ page }) => {
  await page.goto("/tools/elevations");
  const art = page.getByTestId("elevations-resource").locator("svg");
  await expect(art).toBeVisible();
  await expect(art).toHaveAttribute("aria-label", /Solid of 7 cubes/);
  await page.getByRole("combobox", { name: "Cubes in row 2 from the front, column 2 from the left" }).selectOption("2");
  await expect(art).toHaveAttribute("aria-label", /Solid of 9 cubes/);
  expect((await saved(page, eKey)).document.heights[1][1]).toBe(2);
  await page.getByRole("button", { name: "Add a row at the back" }).click();
  expect((await saved(page, eKey)).document.heights).toHaveLength(3);
  await page.getByRole("button", { name: "Add plan", exact: true }).click();
  const panels = (await saved(page, eKey)).document.panels;
  expect(panels.at(-1)).toMatchObject({ view: "plan", state: "answer" });
  // The pupil copy leaves answer views as empty grids; the teacher copy draws them.
  const pupil = await art.innerHTML();
  await page.getByLabel("Teacher copy: show answers").check();
  expect(await art.innerHTML()).not.toBe(pupil);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect(await saved(page, eKey)).toEqual(JSON.parse(eCanonical(eCreate())));
});

test("plans and elevations: click a panel for its options, double-click for a pupil space, and leave every panel out in one step", async ({ page }) => {
  await page.goto("/tools/elevations");
  const state = async (i: number) => (await saved(page, eKey)).document.panels[i].state;
  const first = page.getByRole("button", { name: /^Edit panel 1 / });
  await first.click();
  const box = page.locator(".md-options-box");
  await expect(box).toContainText("Panel 1");
  await box.getByRole("group", { name: "What pupils see" }).getByRole("button", { name: "Show" }).click();
  expect(await state(0)).toBe("drawn");
  await page.keyboard.press("Escape");
  await first.dblclick();
  expect(await state(0)).toBe("answer");
  await page.getByRole("group", { name: "Panels", exact: true }).getByRole("button", { name: "Leave out" }).click();
  expect((await saved(page, eKey)).document.panels.every((p: { state: string }) => p.state === "blank")).toBe(true);
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await state(0)).toBe("answer");
  // The click targets are never part of the printed artwork.
  expect(await page.getByTestId("elevations-resource").locator("svg button, svg .ev-hit").count()).toBe(0);
});

test("plans and elevations: refuses to remove the last cube and keeps one size on both copies", async ({ page }) => {
  await page.goto("/tools/elevations");
  await page.getByRole("button", { name: "Remove the back row" }).click();
  await page.getByRole("button", { name: "Remove the right column" }).click();
  await page.getByRole("button", { name: "Remove the right column" }).click();
  await page.getByRole("combobox", { name: "Cubes in row 1 from the front, column 1 from the left" }).selectOption("0");
  await expect(page.getByText("The solid needs at least one cube.")).toBeVisible();
  const e = eCreate();
  const size = page.locator(".resource-size").first();
  const pupilSize = await size.textContent();
  await page.getByLabel("Teacher copy: show answers").check();
  expect(await size.textContent()).toBe(pupilSize);
  expect(eLayout(e, "pupil").width).toBe(eLayout(e, "answer").width);
});

test("constructions: click a point for its options, double-click for a pupil space, and leave every point label out in one step", async ({ page }) => {
  await page.goto("/tools/construction");
  const art = page.getByTestId("construction-resource").locator(".pt-art svg");
  const label = (i: number) => saved(page, cKey).then((s) => s.document.points[i].label.show);
  const hit = page.getByRole("button", { name: /^Select point A / });
  await hit.click();
  const box = page.locator(".md-options-box");
  await expect(box).toContainText("Point A");
  await expect(box.getByRole("textbox", { name: "Point label" })).toBeFocused();
  await box.getByRole("group", { name: "Its label" }).getByRole("button", { name: "Pupil space" }).click();
  expect(await label(0)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
  await page.getByRole("button", { name: /^Select point A / }).dblclick();
  expect(await label(0)).toBe("show");
  await page.keyboard.press("Escape");
  const see = page.getByRole("region", { name: "What pupils see" });
  await see.getByRole("group", { name: "Point labels" }).getByRole("button", { name: "Leave out" }).click();
  expect([await label(0), await label(1)]).toEqual(["omit", "omit"]);
  // A left-out label prints on neither copy.
  await expect(art.locator("text", { hasText: /^[AB]$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art.locator("text", { hasText: /^[AB]$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(art.locator("text", { hasText: /^[AB]$/ })).toHaveCount(2);
  // The click targets and the box are never part of the printed artwork.
  expect(await page.getByTestId("construction-resource").locator(".pt-art .md-options-box, .pt-art button").count()).toBe(0);
});

test("plans and elevations: the options box follows its panel when it moves earlier", async ({ page }) => {
  await page.goto("/tools/elevations");
  const panels = async () => (await saved(page, eKey))?.document.panels ?? JSON.parse(eCanonical(eCreate())).document.panels;
  const second = (await panels())[1];
  await page.getByRole("button", { name: /^Edit panel 2 / }).click();
  const box = page.locator(".md-options-box");
  await box.getByRole("button", { name: "Move panel 2 earlier" }).click();
  expect((await panels())[0]).toEqual(second);
  await expect(box).toContainText("Panel 1");
});

test("constructions: typing in one point's box is kept for that point when another point is pressed", async ({ page }) => {
  await page.goto("/tools/construction");
  await page.getByRole("button", { name: /^Select point A / }).click();
  const box = page.locator(".md-options-box");
  await box.getByRole("textbox", { name: "Point label" }).fill("P");
  await page.getByRole("button", { name: /^Select point B / }).click();
  await expect(box).toContainText("Point B");
  const points = (await saved(page, cKey)).document.points;
  expect(points.map((p: { label: { text: string } }) => p.label.text).slice(0, 2)).toEqual(["P", "B"]);
  await expect(box.getByRole("textbox", { name: "Point label" })).toHaveValue("B");
});

test("plans and elevations: a solid made of shapes, each change one undo step, with hidden lengths on the answers copy only", async ({ page }) => {
  await page.goto("/tools/elevations");
  const art = page.getByTestId("elevations-resource").locator("svg");
  await expect(art).toHaveAttribute("aria-label", /Solid of 7 cubes/);
  await page.getByLabel("Solid made of").selectOption("shapes");
  await expect(art).toHaveAttribute("aria-label", /Solid made of a prism/);
  let doc = (await saved(page, eKey)).document;
  expect(doc.heights).toBeUndefined();
  expect(doc.shapes).toHaveLength(1);
  // Corners typed as pairs make an L-shaped cross-section.
  const corners = page.getByLabel("Shape 1 cross-section corners");
  await corners.fill("(0, 0) (5, 0) (5, 2) (2, 2) (2, 4) (0, 4)");
  await corners.press("Enter");
  expect((await saved(page, eKey)).document.shapes[0].section).toHaveLength(6);
  // A cone on top, then a radius that is not a whole or half square is refused with a reason and changes nothing.
  await page.getByLabel("Add a shape on top").selectOption("cone");
  await expect(art).toHaveAttribute("aria-label", /a prism and a cone/);
  doc = (await saved(page, eKey)).document;
  expect(doc.shapes[1]).toMatchObject({ type: "cone", at: { z: 4 } });
  const radius = page.getByLabel("Shape 2 radius");
  await radius.fill("2.3");
  await radius.press("Enter");
  await expect(page.getByText(/Shape 2 radius: Use whole or half squares/)).toBeVisible();
  expect((await saved(page, eKey)).document.shapes[1].r).toBe(2);
  // A hidden length prints on the answers copy only.
  await page.getByRole("button", { name: "Add a length" }).click();
  const text = page.getByLabel("Length 1 text");
  await text.fill("5 cm");
  await text.press("Enter");
  await page.getByLabel("Hide for pupils (shown on the answers copy)").check();
  expect((await saved(page, eKey)).document.lengths[0]).toMatchObject({ text: "5 cm", show: "hidden" });
  const pupil = await art.innerHTML();
  await page.getByLabel("Teacher copy: show answers").check();
  expect(await art.innerHTML()).not.toBe(pupil);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  // Dashed hidden edges are saved only when asked.
  await page.getByLabel(/Dash hidden edges/).check();
  expect((await saved(page, eKey)).document.hiddenLines).toBe("dashed");
  // Every change undoes one at a time, back to the cube solid.
  for (let i = 0; i < 7; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect(await saved(page, eKey)).toEqual(JSON.parse(eCanonical(eCreate())));
});
