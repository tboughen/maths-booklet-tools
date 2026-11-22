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
