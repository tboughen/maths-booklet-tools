import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import * as c from "../packages/bar-model-core/src";
import { editorLink } from "../packages/bar-model-core/src/interchange";
const visible = (page: Page) => page.locator(".site-page:not([hidden])");
const resource = (page: Page) => visible(page).locator(".bm-resource");
async function saved(page: Page) {
  await visible(page)
    .getByRole("button", { name: "File", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "Save editable file", exact: true })
    .click();
  return c.parseFile(await readFile((await (await download).path())!, "utf8"));
}
async function preset(page: Page, id: string, worked = false) {
  await visible(page)
    .getByRole("button", { name: "Start from an example", exact: true })
    .click();
  const card = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: new RegExp("^" + id + " ") }),
    });
  await card
    .getByRole("button", {
      name: worked ? "Use worked version" : "Open scaffold",
      exact: true,
    })
    .click();
  if (!worked)
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Open bar model", exact: true })
      .click();
}
test("card includes genuine artwork and opens the registered editor", async ({
  page,
}) => {
  await page.goto("/?tool=booklet-tools");
  const card = visible(page).getByRole("link", { name: /Open Bar modelling/ });
  await expect(card.getByRole("img")).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/tool=bar-model/);
  await expect(resource(page)).toBeVisible();
  expect((await saved(page)).document.spans[1].label.state).toBe("hidden");
});
test("direct labels preserve invalid drafts, Apply/Cancel and native input undo", async ({
  page,
}) => {
  await page.goto("/?tool=bar-model");
  await page
    .getByRole("button", { name: "Edit label b1p1", exact: true })
    .click();
  await page.getByLabel("Saved label", { exact: true }).fill("0");
  await page.getByLabel("Label state", { exact: true }).selectOption("value");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect((await saved(page)).document.bars[0].parts[0].label.text).toBe("0");
  await visible(page)
    .getByRole("button", { name: "Weight / shade", exact: true })
    .first()
    .click();
  await page.getByLabel("Geometric weight").fill("x");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByLabel("Geometric weight")).toHaveValue("x");
  await expect(page.getByRole("alert")).toContainText("exact");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await saved(page)).document.bars[0].parts[0].weight).toBe("1");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await saved(page)).document.bars[0].parts[0].label.state).toBe(
    "blank",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await saved(page)).document.bars[0].parts[0].label.text).toBe("0");
});
test("worked replacement retains earlier history and exact source states", async ({
  page,
}) => {
  await page.goto("/?tool=bar-model");
  const original = await saved(page);
  await page.getByRole("button", { name: "+ Part", exact: true }).click();
  const changed = await saved(page);
  await preset(page, "BM04", true);
  expect(
    (await saved(page)).document.spans.every((s) => s.label.state === "value"),
  ).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await saved(page)).toEqual(changed);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await saved(page)).toEqual(original);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await saved(page)).toEqual(changed);
});
test("referenced removal asks explicitly and one Undo restores attached braces", async ({
  page,
}) => {
  await page.goto("/?tool=bar-model");
  const original = await saved(page);
  await page.getByRole("button", { name: "Remove b1p1", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(await saved(page)).toEqual(original);
  await page.getByRole("button", { name: "Remove b1p1", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Remove structure and its braces",
      exact: true,
    })
    .click();
  expect((await saved(page)).document.spans.map((s) => s.id)).toEqual([
    "second",
  ]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await saved(page)).toEqual(original);
});
test("draft/navigation/recovery and editable-link cancellation preserve work", async ({
  page,
}) => {
  await page.goto("/?tool=bar-model");
  const original = await saved(page);
  await page
    .getByRole("button", { name: "Edit label b1p1", exact: true })
    .click();
  await page.getByLabel("Saved label", { exact: true }).fill("draft");
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Ratio tables", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Bar modelling", exact: true })
    .click();
  await expect(page.getByLabel("Saved label", { exact: true })).toHaveValue(
    "draft",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto(editorLink(c.example("BM08"), page.url()));
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(await saved(page)).toEqual(original);
  await page.reload();
  expect(await saved(page)).toEqual(original);
});
for (const width of [320, 375, 768, 1440])
  test(`maximum structures and focused edits remain usable at${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?tool=bar-model");
    await preset(page, "BM09");
    expect(
      (await saved(page)).document.bars.flatMap((b) => b.parts),
    ).toHaveLength(96);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Edit quantity name", exact: true })
      .click();
    await page
      .getByLabel("Saved label", { exact: true })
      .fill("Long quantity name with fractions and unknowns");
    await expect(
      page.getByRole("button", { name: "Apply", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`focused-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.screenshot({
      path: info.outputPath(`maximum-${width}.png`),
      fullPage: true,
    });
  });
test("original JSON, portable SVG and verified600ppi PNG have native dimensions", async ({
  page,
}, info) => {
  await page.goto("/?tool=bar-model");
  await preset(page, "BM08");
  const e = await saved(page),
    g = c.layout(e);
  for (const format of ["SVG", "PNG (600 ppi)"]) {
    await page.getByRole("button", { name: "File", exact: true }).click();
    const event = page.waitForEvent("download");
    await page
      .getByRole("menuitem", { name: `Download ${format}`, exact: true })
      .click();
    const file = await event;
    await file.saveAs(info.outputPath(file.suggestedFilename()));
    const bytes = await readFile((await file.path())!);
    if (format === "SVG") {
      const svg = bytes.toString();
      expect(svg).toContain(`width="${g.width}mm"`);
      expect(svg).toContain("data:font/otf;base64,");
      expect(svg).not.toContain(">18</text>");
    } else {
      const { verifyPrintBytes, printRasterSize } =
        await import("../packages/graph-core/src/png-bytes");
      const size = printRasterSize(g.width / 10, g.height / 10);
      verifyPrintBytes(bytes, size.width, size.height);
    }
  }
});
test("corrupt recovery never overwrites original saved bytes", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("maths-booklet-tools:bar-model:v1", "broken-original"),
  );
  await page.goto("/?tool=bar-model");
  await expect(page.getByRole("region", { name: "Recovery" })).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("maths-booklet-tools:bar-model:v1"),
    ),
  ).toBe("broken-original");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
});
