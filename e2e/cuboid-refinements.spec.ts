import { switchTool } from "./tool-switcher";
import { showExamples } from "./example-gallery";
import { clickResourceAction } from "./resource-actions";
import { test, expect, type Page } from "./release-fixtures";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { create } from "../packages/cuboid-core/src";
import { examples } from "../packages/cuboid-core/src/examples";
// The settings column folds its rarer cards; these tests use them, so they start open.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    for (const t of ["Labels", "Shading", "Print settings"]) localStorage.setItem(`mathsdock:fold:cuboids:${t}`, "open");
  });
});
test.use({ permissions: ["clipboard-read", "clipboard-write"] });
const report = join(
  process.cwd(),
  process.env.CUBOID_REFINEMENT_REPORT_DIR ?? "test-results/cuboid-refinements",
);
mkdirSync(join(report, "exports"), { recursive: true });
const resource = (p: Page) => p.getByTestId("cuboid-resource");
async function input(p: Page, name: string, value: string) {
  const f = p.getByRole("textbox", { name, exact: true });
  await f.fill(value);
  await f.press("Enter");
}
async function load(p: Page, e: ReturnType<typeof create>) {
  await p
    .getByRole("button", { name: "File", exact: true })
    .click();
  await clickResourceAction(p, "Open editable file");
  await p.getByLabel("Open cuboids file", { exact: true }).setInputFiles({
    name: "fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(e)),
  });
  await p
    .getByRole("button", { name: "Use these cuboids", exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/tools/cuboids");
  await expect(resource(page)).toBeVisible();
});
test("the options box is live: Enter commits the width, Undo restores it, Escape closes the box", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Edit width label on cuboid-1", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
  await input(page, "Edit width", "9");
  await expect(resource(page)).toContainText("9 cm");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(resource(page)).toContainText("4 cm");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Width", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeEnabled();
  // A valid value typed and left with a press elsewhere applies and closes the box in one press.
  await page.getByRole("button", { name: "Edit width label on cuboid-1", exact: true }).click();
  await page.getByRole("textbox", { name: "Edit width", exact: true }).fill("6");
  await page.locator(".cb-scroll").click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole("dialog", { name: "Width", exact: true })).toHaveCount(0);
  await expect(resource(page)).toContainText("6 cm");
});
test("double-click a label for a pupil space and again to show it; Leave out keeps the box", async ({ page }) => {
  const width = page.getByRole("button", { name: "Edit width label on cuboid-1", exact: true });
  await width.dblclick();
  await expect(resource(page)).not.toContainText("4 cm");
  await expect(resource(page)).toContainText("…");
  await width.dblclick();
  await expect(resource(page)).toContainText("4 cm");
  await width.click();
  const box = page.getByRole("dialog", { name: "Width", exact: true });
  await box.getByRole("button", { name: "Leave out", exact: true }).click();
  await expect(resource(page).locator(".cb-art")).not.toContainText("4 cm");
  await expect(box).toBeVisible();
  await box.getByRole("button", { name: "Show", exact: true }).click();
  await expect(resource(page)).toContainText("4 cm");
  // The card's switch sets every edge at once, and Clear pupil spaces shows them again.
  await page.getByRole("group", { name: "Edge labels", exact: true }).getByRole("button", { name: "Pupil space", exact: true }).click();
  await expect(page.getByText("3 so far.")).toBeVisible();
  await page.getByRole("button", { name: "Clear pupil spaces", exact: true }).click();
  await expect(resource(page)).toContainText("4 cm");
});
test("invalid floating drafts survive navigation while inactive overlays stay hidden", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Edit width label on cuboid-1", exact: true })
    .click();
  await input(page, "Edit width", "bad");
  await switchTool(page, "Graph tool");
  await expect(
    page.getByRole("heading", { name: "Graph tool", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Width", exact: true }),
  ).not.toBeVisible();
  await switchTool(page, "Cuboids");
  await expect(
    page.getByRole("textbox", { name: "Edit width", exact: true }),
  ).toHaveValue("bad");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await page.getByRole("textbox", { name: "Edit width", exact: true }).press("Escape");
});
test("opening an example closes the options box first", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Edit width label on cuboid-1", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Width", exact: true })).toBeVisible();
  await showExamples(page);
  await expect(page.getByRole("dialog", { name: "Width", exact: true })).toHaveCount(0);
});
test("starting afresh after protected recovery clears an invalid draft deliberately", async ({
  page,
  context,
}) => {
  await page
    .getByRole("button", { name: "Edit width label on cuboid-1", exact: true })
    .click();
  await input(page, "Edit width", "bad");
  const other = await context.newPage();
  await other.goto("/tools/cuboids");
  await input(other, "Width", "7");
  await expect(
    page.getByRole("button", { name: "Download recovery data", exact: true }),
  ).toBeVisible();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download recovery data", exact: true })
    .click();
  await (await dl).saveAs(join(report, "exports/newer-tab-recovery.json"));
  await page.getByRole("button", { name: "Start afresh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("4");
  await other.close();
});
test("settings are one folding column; a clicked label opens its box and the cards stay put", async ({
  page,
}) => {
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByLabel("Selected cuboid", { exact: true })).toHaveCount(
    0,
  );
  const headings = page.locator(".cb-inspector h2");
  await expect(headings).toHaveText(["What pupils see", "Shape", "Labels", "Shading", "Print settings"]);
  await expect(page.getByLabel("Width", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Edit height label/ }).click();
  await expect(page.getByRole("dialog", { name: "Height", exact: true })).toBeVisible();
  await expect(headings.first()).toHaveText("What pupils see");
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: join(report, "compact-desktop.png"),
    fullPage: true,
  });
});
test("floating label editors escape the white resource at every viewport and zoom", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const zoom of ["0.75", "1", "1.5"]) {
      await page.getByLabel("Preview zoom", { exact: true }).selectOption(zoom);
      await page
        .getByRole("button", {
          name: "Edit height label on cuboid-1",
          exact: true,
        })
        .click();
      const editor = page.getByRole("dialog", {
        name: "Height",
        exact: true,
      });
      await expect(editor).toBeVisible();
      const box = await editor.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(900);
      expect(await resource(page).locator(".md-options-box").count()).toBe(0);
      await page.keyboard.press("Escape");
    }
  }
});
test("invalid input stays in the box, Escape puts the value back and Escape again closes it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page
    .getByRole("button", { name: "Edit height label on cuboid-1", exact: true })
    .click();
  await input(page, "Edit height", "0");
  const field = page.getByRole("textbox", { name: "Edit height", exact: true });
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 375, height: 300 });
  const dialog = page.getByRole("dialog", { name: "Height", exact: true });
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return box ? box.y + box.height : Infinity;
    })
    .toBeLessThanOrEqual(300);
  await page.screenshot({
    path: join(report, "mobile-editor.png"),
    fullPage: true,
  });
  // Escape puts the saved value back and closes the box; focus goes back to the label.
  await field.focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit height label on cuboid-1", exact: true })).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Edit height label on cuboid-1", exact: true }).click();
  await expect(field).toHaveValue("2");
});
test("a scrolled-away label keeps its box in the window with its invalid draft", async ({
  page,
}) => {
  const e = create();
  e.document.widthCm = 16;
  e.document.shapes[0].view = "layers";
  e.document.shapes[0].dimensions = { width: "20", depth: "20", height: "20" };
  await load(page, e);
  await page
    .getByRole("combobox", { name: "Preview zoom", exact: true })
    .selectOption("1");
  await page
    .getByRole("button", { name: "Edit height label on cuboid-1", exact: true })
    .click();
  await input(page, "Edit height", "bad");
  await page.locator(".cb-scroll").evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(page.getByRole("dialog", { name: "Height", exact: true })).toBeInViewport();
  await expect(
    page.getByRole("textbox", { name: "Edit height", exact: true }),
  ).toHaveValue("bad");
});
test("greyscale faces retain black grids, stay neutral and mirror correctly", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Grey faces", exact: true }).click();
  await expect(resource(page).locator('polygon[fill="#f2f2f2"]')).toHaveCount(
    1,
  );
  await expect(resource(page)).not.toContainText("area =");
  await page
    .getByRole("button", { name: "Show 1 cm³ cubes", exact: true })
    .click();
  await expect(resource(page).locator('[data-cube-count="24"]')).toHaveCount(1);
  await page.getByText("More shape options", { exact: true }).click();
  await page
    .getByLabel("Receding direction", { exact: true })
    .selectOption("left");
  await expect(
    resource(page).locator('polygon[data-face="left"][fill="#bfbfbf"]'),
  ).toHaveCount(1);
  await page.screenshot({
    path: join(report, "grey-cubes-left.png"),
    fullPage: true,
  });
});
test("base and cross-section face labels have exact area and squared unit conversions", async ({
  page,
}) => {
  await page.getByRole("button", { name: "One face", exact: true }).click();
  await expect(resource(page).locator("polygon")).toHaveCount(1);
  await expect(resource(page)).not.toContainText("Base area");
  await page.getByLabel("Area label", { exact: true }).selectOption("value");
  await expect(resource(page)).toContainText("Base area = 12 cm²");
  await page.getByLabel("Shaded face", { exact: true }).selectOption("front");
  await page
    .getByLabel("Area heading", { exact: true })
    .selectOption("Cross-sectional area");
  await expect(resource(page)).toContainText("Cross-sectional area = 8 cm²");
  await page.getByLabel("Units", { exact: true }).selectOption("mm");
  await expect(resource(page)).toContainText("Cross-sectional area = 800 mm²");
  await page.getByLabel("Area label", { exact: true }).selectOption("blank");
  await expect(resource(page)).not.toContainText("800 mm²");
  await page.getByLabel("Area label", { exact: true }).selectOption("value");
  await page
    .getByRole("button", { name: "Edit area label on cuboid-1", exact: true })
    .click();
  await input(page, "Edit face area", "A mm²");
  await expect(resource(page)).toContainText("A mm²");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(resource(page)).toContainText("800 mm²");
});
test("hidden faces are visible in the outline and one-face mode handles layer switching explicitly", async ({
  page,
}) => {
  await page.getByLabel("View", { exact: true }).selectOption("layers");
  await page.getByRole("button", { name: "One face", exact: true }).click();
  await expect(page.getByLabel("View", { exact: true })).toHaveValue("plain");
  await expect(resource(page).locator("[stroke-dasharray]")).toHaveCount(3);
  await page.getByLabel("Shaded face", { exact: true }).selectOption("back");
  await expect(resource(page).locator('polygon[data-face="back"]')).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Grey faces", exact: true }).click();
  await page.getByLabel("View", { exact: true }).selectOption("layers");
  await expect(resource(page).locator("[data-layer]")).toHaveCount(2);
});
test("exam examples draw the current exam arrow layout", async ({ page }) => {
  await load(page, examples.find((e) => e.id.includes("06"))!.create(false));
  await expect(resource(page).locator('[data-dimension="height"]')).toHaveCount(
    2,
  );
  await page.screenshot({
    path: join(report, "corrected-exam-arrows.png"),
    fullPage: true,
  });
});
test("shading and area save through editable exports and real greyscale image downloads", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Grey faces", exact: true }).click();
  await page
    .getByRole("button", { name: "File", exact: true })
    .click();
  for (const [name, file] of [
    ["Download PNG (600 ppi)", "grey-faces.png"],
    ["Download SVG", "grey-faces.svg"],
    ["Save editable file", "grey-faces.json"],
  ]) {
    const dl = page.waitForEvent("download");
    await clickResourceAction(page, name);
    await (await dl).saveAs(join(report, "exports", file));
  }
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Grey faces", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "One face", exact: true }).click();
  await page.getByLabel("Area label", { exact: true }).selectOption("value");
  await page
    .getByRole("button", { name: "Copy image", exact: true })
    .click();
  await expect(page.locator(".resource-feedback")).toContainText(
    /Image copied\. Paste with Ctrl\+V\./,
  );
  await page
    .getByRole("button", { name: "File", exact: true })
    .click();
  for (const [name, file] of [
    ["Download PNG (600 ppi)", "base-area.png"],
    ["Download SVG", "base-area.svg"],
    ["Save editable file", "base-area.json"],
  ]) {
    const dl = page.waitForEvent("download");
    await clickResourceAction(page, name);
    await (await dl).saveAs(join(report, "exports", file));
  }
  await page.screenshot({
    path: join(report, "base-area.png"),
    fullPage: true,
  });
});
