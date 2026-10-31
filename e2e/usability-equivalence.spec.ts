import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import { clickResourceAction } from "./resource-actions";

async function download(page: Page, name: string) {
  const waiting = page.waitForEvent("download");
  await clickResourceAction(page, name);
  return readFile((await (await waiting).path())!);
}
test("typed and structured Graph inputs produce the same actual SVG and 600ppi pixels", async ({
  page,
}) => {
  await page.goto("/tools/graph");
  await page
    .getByRole("button", { name: "Line by equation", exact: true })
    .click();
  await page.getByRole("button", { name: "Use m and c", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Gradient m", exact: true })
    .fill("1/2");
  await page
    .getByRole("textbox", { name: "Intercept c", exact: true })
    .fill("-2");
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  const structured = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  );
  const svg = await download(page, "Download SVG");
  const png = await download(page, "Download PNG (600 ppi)");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .getByRole("button", { name: "Line by equation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Type equation", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Line equation", exact: true })
    .fill("y = 1/2x - 2");
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  const typed = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  );
  const omitIds = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(omitIds)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([key]) => key !== "id")
              .map(([key, value]) => [key, omitIds(value)]),
          )
        : value;
  expect(omitIds(typed)).toEqual(omitIds(structured));
  expect(await download(page, "Download SVG")).toEqual(svg);
  expect(await download(page, "Download PNG (600 ppi)")).toEqual(png);
});
test("notation and direct interval drawing produce equal real pupil exports", async ({
  page,
}) => {
  await page.goto("/tools/number-line");
  await page.getByRole("button", { name: "Interval", exact: true }).click();
  await page.getByRole("button", { name: "Tick -3", exact: true }).click();
  await page.getByRole("button", { name: "Tick 1", exact: true }).click();
  await page.getByRole("button", { name: /^Endpoint -3,/ }).press("Space");
  await page.getByRole("button", { name: /^Endpoint 1,/ }).press("Space");
  const drawing = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  );
  const svg = await download(page, "Download SVG"),
    png = await download(page, "Download PNG (600 ppi)");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Inequality or value", exact: true })
    .fill("-3 < x <= 1");
  await page
    .getByRole("button", { name: "Apply drawing", exact: true })
    .click();
  const typed = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  );
  expect(typed).toEqual(drawing);
  expect(await download(page, "Download SVG")).toEqual(svg);
  expect(await download(page, "Download PNG (600 ppi)")).toEqual(png);
});
test("legacy separate worked documents retain their storage and navigation context", async ({
  page,
}) => {
  await page.goto("/tools/graph");
  const key = "maths-booklet-tools:graph-envelope:v1",
    id = "11111111-1111-4111-8111-111111111111";
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), key))
    .not.toBeNull();
  const original = await page.evaluate((k) => localStorage.getItem(k), key);
  const copyKey = key + ":worked:" + id;
  await page.evaluate(
    ({ copyKey, original }) => localStorage.setItem(copyKey, original!),
    { copyKey, original },
  );
  await page.goto("/tools/graph?resourceCopy=" + id);
  await expect(
    page.getByText("Separate worked copy", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start from an example", exact: true })
    .click();
  await page
    .locator(".example-card")
    .first()
    .getByRole("button", { name: "Use worked version", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), copyKey))
    .not.toBe(original);
  const worked = await page.evaluate((k) => localStorage.getItem(k), copyKey);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    original,
  );
  await page.reload();
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), copyKey))
    .toBe(worked);
  await page.getByRole("link", { name: "Ratio tables", exact: true }).click();
  await page.reload();
  await page.getByRole("link", { name: "Graph tool", exact: true }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), copyKey)).toBe(
    worked,
  );
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    original,
  );
});
