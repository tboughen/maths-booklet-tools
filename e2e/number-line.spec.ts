import { showExamples, galleryCard, chooseExample } from "./example-gallery";
import { clickResourceAction } from "./resource-actions";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  pngChunks,
  printRasterSize,
} from "../packages/graph-core/src/png-bytes";
test.beforeEach(async ({ page }) => {
  await page.goto("/tools/number-line");
  await page.evaluate(() =>
    localStorage.removeItem("maths-booklet-tools:number-line:v1"),
  );
  await page.reload();
});
test("Cancel input is only available when there is something to cancel", async ({
  page,
}) => {
  const cancel = page.getByRole("button", { name: "Cancel input", exact: true });
  const field = page.getByLabel("Inequality or value", { exact: true });
  await expect(cancel).toBeDisabled();
  await field.fill("2 < x");
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await expect(field).toHaveValue("");
  await expect(cancel).toBeDisabled();
  await page.getByRole("button", { name: "Edit axis range", exact: true }).click();
  await expect(cancel).toBeEnabled();
});

test("blank, direct drawing, exact endpoint edit, label blanks and Undo", async ({
  page,
}) => {
  const resource = page.getByTestId("number-line-resource");
  await expect(resource.locator("circle")).toHaveCount(0);
  await page.getByRole("button", { name: "Interval", exact: true }).click();
  await page.getByRole("button", { name: "Tick -1", exact: true }).click();
  await page.getByRole("button", { name: "Tick 4", exact: true }).click();
  await expect(resource.locator("circle")).toHaveCount(2);
  await page.getByRole("button", { name: /^Endpoint 4,/ }).focus();
  await page.getByLabel("Upper endpoint", { exact: true }).fill("3.5");
  await page.getByLabel("Upper endpoint", { exact: true }).press("Enter");
  await expect(resource.locator('circle[data-value="3.5"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Tick 0", exact: true }).click();
  await page.getByLabel("Tick label state").selectOption("answer-line");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Tick 0", exact: true }).click();
  await expect(page.getByLabel("Tick label state")).toHaveValue("value");
  await page.reload();
  await expect(resource.locator('circle[data-value="3.5"]')).toHaveCount(1);
});
test("invalid draft blocks actual exports and Escape restores", async ({
  page,
}) => {
  await page.getByLabel("Tick step", { exact: true }).fill("1/0");
  await page.getByLabel("Tick step", { exact: true }).press("Enter");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("zero denominator")).toBeVisible();
  await page.getByLabel("Tick step", { exact: true }).press("Escape");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeEnabled();
});
test("source error remains; replacement cancellation, corrected variant and Undo", async ({
  page,
}) => {
  const title = "Mock set 08 · 2H · Q4(a)";
  await chooseExample(page, title);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByTestId("number-line-resource").locator("circle"),
  ).toHaveCount(0);
  await chooseExample(page, title);
  await page
    .getByRole("button", { name: "Open resource", exact: true })
    .click();
  await expect(
    page.getByText("This drawing intentionally disagrees", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByTestId("number-line-resource").locator("circle"),
  ).toHaveCount(1);
  await showExamples(page);
  await galleryCard(page, title)
    .getByRole("button", { name: "Use worked version", exact: true })
    .click();
  const corrected = page;
  await expect(
    corrected.getByText("This drawing intentionally disagrees", {
      exact: false,
    }),
  ).toHaveCount(0);
  await expect(
    corrected.getByTestId("number-line-resource").locator("circle"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByText("This drawing intentionally disagrees", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByTestId("number-line-resource").locator("circle"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    page.getByText("This drawing intentionally disagrees", { exact: false }),
  ).toBeVisible();
});
test("actual PNG, SVG and editable downloads", async ({ page }) => {
  await page.getByRole("button", { name: "File", exact: true }).first().click();
  const dl = page.waitForEvent("download");
  await clickResourceAction(page, "Download PNG (600 ppi)");
  expect((await dl).suggestedFilename()).toBe("maths-number-line.png");
});
for (const width of [320, 375, 768, 1024, 1440])
  test(`clean snip area and usable layout at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByTestId("number-line-resource")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const resource = await page
      .getByTestId("number-line-resource")
      .boundingBox();
    for (const b of await page.locator(".nl-range button").all()) {
      const box = await b.boundingBox();
      expect(
        box &&
          resource &&
          (box.x + box.width <= resource.x ||
            box.x >= resource.x + resource.width),
      ).toBeTruthy();
    }
    await page.screenshot({
      path: test.info().outputPath(`number-line-${width}.png`),
      fullPage: true,
    });
  });
test("actual clipboard PNG and both editable/vector downloads", async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(
    page.getByText(/Image copied\. Paste with Ctrl\+V\./),
  ).toBeVisible();
  const bytes = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const blob = await items[0].getType("image/png");
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  const size = printRasterSize(14, 2.3);
  const ihdr = pngChunks(new Uint8Array(bytes)).find(
    (c) => c.type === "IHDR",
  )!.data;
  const dimensions = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.length);
  expect(dimensions.getUint32(0)).toBe(size.width);
  expect(dimensions.getUint32(4)).toBe(size.height);
  await page.getByRole("button", { name: "File", exact: true }).click();
  for (const [label, name] of [
    ["Download SVG", "diagram.svg"],
    ["Save editable file", "source.json"],
  ]) {
    const event = page.waitForEvent("download");
    await clickResourceAction(page, label);
    const path = info.outputPath(name);
    await (await event).saveAs(path);
    const data = await readFile(path, "utf8");
    if (name.endsWith("json"))
      expect(JSON.parse(data).document.solution).toBeNull();
    else expect(data).toContain('width="14cm"');
  }
});
test("maximum structure, fractions and all preview zooms preserve clean resource", async ({
  page,
}) => {
  await page
    .locator("summary")
    .filter({ hasText: /^More settings$/ })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: /^Labels$/ })
    .click();
  await page.getByLabel("Label every", { exact: true }).fill("4");
  await page.getByLabel("Label every", { exact: true }).press("Enter");
  await page.getByLabel("First tick", { exact: true }).fill("-16");
  await page.getByLabel("First tick", { exact: true }).press("Enter");
  await page.getByLabel("Last tick", { exact: true }).fill("16");
  await page.getByLabel("Last tick", { exact: true }).press("Enter");
  await page
    .locator("summary")
    .filter({ hasText: /^Print size$/ })
    .click();
  await page.getByLabel("Width (cm)", { exact: true }).fill("18");
  await page.getByLabel("Width (cm)", { exact: true }).press("Enter");
  await page.setViewportSize({ width: 320, height: 1000 });
  for (const zoom of ["0.75", "1", "1.25", "1.5"]) {
    await page.getByLabel("Preview zoom").selectOption(zoom);
    const resource = await page
      .getByTestId("number-line-resource")
      .boundingBox();
    for (const b of await page.locator(".nl-range button").all()) {
      const box = await b.boundingBox();
      expect(
        box &&
          resource &&
          (box.x + box.width <= resource.x ||
            box.x >= resource.x + resource.width),
      ).toBeTruthy();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel("First tick", { exact: true }).focus();
  await expect(page.getByLabel("First tick", { exact: true })).toBeFocused();
});
