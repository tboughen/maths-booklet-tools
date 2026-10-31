import { showExamples } from "./example-gallery";
import { clickResourceAction } from "./resource-actions";
import { test, expect, type Page } from "./release-fixtures";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { create, upgrade } from "../packages/cuboid-core/src";
import { examples } from "../packages/cuboid-core/src/examples";
test.use({ permissions: ["clipboard-read", "clipboard-write"] });
const report = join(
  process.cwd(),
  process.env.CUBOID_REFINEMENT_REPORT_DIR ?? "test-results/cuboid-refinements",
);
mkdirSync(join(report, "exports"), { recursive: true });
const resource = (p: Page) => p.getByTestId("cuboid-resource");
const tab = (p: Page, name: string) =>
  p.getByRole("tab", { name, exact: true }).click();
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
test("a valid floating draft can be cancelled without a blur committing it", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Edit width label on cuboid-1", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Edit width", exact: true })
    .fill("9");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(resource(page)).toContainText("4 cm");
  await expect(resource(page)).not.toContainText("9 cm");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeEnabled();
});
test("invalid floating drafts survive navigation while inactive overlays stay hidden", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Edit width label on cuboid-1", exact: true })
    .click();
  await input(page, "Edit width", "bad");
  const nav = page.getByRole("navigation", {
    name: "Booklet tools",
    exact: true,
  });
  await nav.getByRole("link", { name: "Graph tool", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Graph tool", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Edit width", exact: true }),
  ).not.toBeVisible();
  await nav.getByRole("link", { name: "Cuboids", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Edit width", exact: true }),
  ).toHaveValue("bad");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});
test("inspector tabs support arrow-key navigation", async ({ page }) => {
  await page.getByRole("tab", { name: "Shape", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Labels", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Shading", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("tab", { name: "Shape", exact: true }),
  ).toBeFocused();
});
test("replacement confirmation hides the non-modal editor and cancellation restores it", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Edit width label on cuboid-1", exact: true })
    .click();
  await showExamples(page);
  await page
    .locator(".example-card")
    .filter({
      has: page.getByRole("heading", { name: "Shaded base area", exact: true }),
    })
    .getByRole("button", { name: "Open scaffold", exact: true })
    .click();
  await expect(page.locator("[aria-modal=true]")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Edit width", exact: true }),
  ).not.toBeVisible();
  await page
    .locator("[aria-modal=true]")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Edit width", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
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
  await tab(page, "Shape");
  await expect(
    page.getByRole("textbox", { name: "Width", exact: true }),
  ).toHaveValue("4");
  await other.close();
});
test("compact inspector shows one panel and fits the ordinary workflow", async ({
  page,
}) => {
  await expect(page.getByRole("tab")).toHaveCount(3);
  await expect(page.getByLabel("Selected cuboid", { exact: true })).toHaveCount(
    0,
  );
  const inspector = (await page.locator(".cb-inspector").boundingBox())!;
  expect(inspector.y + inspector.height).toBeLessThanOrEqual(
    page.viewportSize()!.height - 16,
  );
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByLabel("Width", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Label appearance", { exact: true }),
  ).not.toBeVisible();
  await tab(page, "Labels");
  await expect(
    page.getByLabel("Label appearance", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Width", { exact: true })).not.toBeVisible();
  await tab(page, "Shape");
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
        name: "Edit height",
        exact: true,
      });
      await expect(editor).toBeVisible();
      const box = await editor.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(900);
      expect(await resource(page).locator(".cb-floating").count()).toBe(0);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  }
});
test("invalid floating input remains visible, cancels safely and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page
    .getByRole("button", { name: "Edit height label on cuboid-1", exact: true })
    .click();
  await input(page, "Edit height", "0");
  await expect(
    page.getByRole("textbox", { name: "Edit height", exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 375, height: 300 });
  const dialog = page.getByRole("dialog", { name: "Edit height", exact: true });
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
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Edit height label on cuboid-1",
      exact: true,
    }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeEnabled();
});
test("a scrolled-away full-height editor docks and retains its invalid draft", async ({
  page,
}) => {
  const e = upgrade(create());
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
  await expect(
    page.getByText("Editing the selected label; scroll back to see it.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Edit height", exact: true }),
  ).toHaveValue("bad");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});
test("greyscale faces retain black grids, stay neutral and mirror correctly", async ({
  page,
}) => {
  await tab(page, "Shading");
  await page.getByRole("button", { name: "Grey faces", exact: true }).click();
  await expect(resource(page).locator('polygon[fill="#f2f2f2"]')).toHaveCount(
    1,
  );
  await expect(resource(page)).not.toContainText("area =");
  await page
    .getByRole("button", { name: "Show 1 cm³ cubes", exact: true })
    .click();
  await expect(resource(page).locator('[data-cube-count="24"]')).toHaveCount(1);
  await tab(page, "Shape");
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
  await tab(page, "Shading");
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
  await tab(page, "Shape");
  await page.getByLabel("Units", { exact: true }).selectOption("mm");
  await expect(resource(page)).toContainText("Cross-sectional area = 800 mm²");
  await tab(page, "Shading");
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
  await tab(page, "Shading");
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
test("old arrow files retain their original artwork until the current exam layout is chosen", async ({
  page,
}) => {
  await load(page, examples.find((e) => e.id.includes("06"))!.create(false));
  await expect(resource(page).locator('[data-dimension="height"]')).toHaveCount(
    0,
  );
  await tab(page, "Shape");
  await page.getByText("More shape options", { exact: true }).click();
  await page
    .getByRole("button", { name: "Use current exam layout", exact: true })
    .click();
  await expect(resource(page).locator('[data-dimension="height"]')).toHaveCount(
    2,
  );
  await page.screenshot({
    path: join(report, "corrected-exam-arrows.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(resource(page).locator('[data-dimension="height"]')).toHaveCount(
    0,
  );
});
test("shading and area save through editable exports and real greyscale image downloads", async ({
  page,
}) => {
  await tab(page, "Shading");
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
  await tab(page, "Shading");
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
