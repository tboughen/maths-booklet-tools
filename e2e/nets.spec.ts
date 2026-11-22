import { test, expect, type Page } from "@playwright/test";
import { canonical, create, type Envelope } from "../packages/net-core/src";
import { examples } from "../packages/net-core/src/examples";

const key = "maths-booklet-tools:nets:v1";

async function boot(page: Page, e?: Envelope) {
  if (e) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, canonical(e)]);
  await page.goto("/tools/nets");
  await expect(art(page)).toBeVisible();
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
const art = (page: Page) => page.getByTestId("nets-resource").locator(".pt-art svg");
const box = (page: Page) => page.locator(".md-options-box");
const faces = (page: Page) => art(page).locator('path[d$="Z"][stroke-linejoin="round"]');

test("labels a face, marks the opposite face only when asked, hides it from pupils and undoes", async ({ page }) => {
  await boot(page, create({ type: "cube", net: 5, side: 2 }));
  await page.getByRole("button", { name: "Edit face 1", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Face label" });
  await expect(field).toBeFocused();
  await field.fill("A");
  await field.press("Enter");
  await page.getByRole("combobox", { name: "Face mark" }).selectOption("dot");
  expect((await saved(page)).document.nets[0].faces[0]).toMatchObject({ label: { text: "A", show: "show" }, mark: { kind: "dot", show: "show" } });
  await expect(art(page).locator("text", { hasText: /^A$/ })).toHaveCount(1);
  expect((await saved(page)).document.nets[0].faces[5].mark.kind).toBe("none");
  await page.getByRole("button", { name: "Mark the opposite face" }).click();
  expect((await saved(page)).document.nets[0].faces[5].mark).toEqual({ kind: "dot", show: "hidden" });
  await expect(art(page).locator("circle")).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator('circle[fill="#b0125b"]')).toHaveCount(1);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.nets[0].faces[0].label.text).toBe("");
});

test("hides a face for pupils, builds a net square by square and says when it does not fold", async ({ page }) => {
  await boot(page, create({ type: "cube", net: 1, side: 1 }));
  await expect(faces(page)).toHaveCount(6);
  await page.getByRole("button", { name: "Edit face 6", exact: true }).click();
  await box(page).getByRole("group", { name: "The face" }).getByRole("button", { name: "Pupil space" }).click();
  await expect(faces(page)).toHaveCount(5);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit face 6, pupil space" }).click();
  await box(page).getByRole("button", { name: "Remove this face" }).click();
  await expect(box(page)).toHaveCount(0);
  await expect(page.getByText("Teacher note: The net does not fold into a cube: it has 5 faces, not 6.")).toBeVisible();
  await page.getByLabel(/Add squares to the net by clicking the grid/).check();
  await page.getByRole("button", { name: "Add a square at column 3, row 4" }).click();
  expect((await saved(page)).document.nets[0].faces).toHaveLength(6);
  await expect(page.getByText(/^Teacher note: .*does not fold/)).toHaveCount(0);
});

test("opens the which-are-nets example with captions and a teacher note for the one that does not fold", async ({ page }) => {
  await boot(page, examples.find((x) => x.id === "which-are-nets")!.make(false));
  for (const c of ["A", "B", "C"]) await expect(art(page).locator("text", { hasText: new RegExp(`^${c}$`) })).toHaveCount(1);
  await expect(page.getByText(/Net C does not fold into a cube/)).toBeVisible();
});

test("double-click a face for a pupil space, leave the letters out in one step, and keep the options box off the artwork", async ({ page }) => {
  const e = create({ type: "cube", net: 1, side: 1 });
  e.document.nets[0].faces[0].label.text = "A";
  e.document.nets[0].faces[1].label.text = "B";
  await boot(page, e);
  await page.getByRole("button", { name: "Edit face 2", exact: true }).dblclick();
  expect((await saved(page)).document.nets[0].faces[1].show).toBe("hidden");
  await expect(faces(page)).toHaveCount(5);
  await page.keyboard.press("Escape");
  const see = page.getByRole("region", { name: "What pupils see" });
  await see.getByRole("group", { name: "Letters on faces" }).getByRole("button", { name: "Leave out" }).click();
  const doc = (await saved(page)).document.nets[0];
  expect([doc.faces[0].label, doc.faces[1].label]).toEqual([
    { text: "A", show: "omit" },
    { text: "B", show: "omit" },
  ]);
  // A left-out letter prints on neither copy; the hidden face still draws on the answers copy.
  await expect(art(page).locator("text", { hasText: /^[AB]$/ })).toHaveCount(0);
  await page.getByLabel("Teacher copy: show answers").check();
  await expect(art(page).locator("text", { hasText: /^[AB]$/ })).toHaveCount(0);
  await expect(faces(page)).toHaveCount(6);
  await page.getByLabel("Teacher copy: show answers").uncheck();
  await see.getByRole("button", { name: "Clear pupil spaces" }).click();
  expect((await saved(page)).document.nets[0].faces[1].show).toBe("show");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.nets[0].faces[0].label.show).toBe("show");
  await page.getByRole("button", { name: "Edit face 1", exact: true }).click();
  await expect(box(page)).toContainText("Face 1 (A)");
  expect(await page.getByTestId("nets-resource").locator(".pt-art .md-options-box").count()).toBe(0);
});
