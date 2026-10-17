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
  await page.goto("/?tool=graph");
  await page
    .getByRole("button", { name: "Line by equation", exact: true })
    .click();
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
  await page.goto("/?tool=number-line");
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
    .getByRole("button", { name: "Enter inequality or value", exact: true })
    .click();
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
test("blocked worked popup has a retry link; another worked tab remains independent after reload", async ({
  page,
  context,
}) => {
  await page.goto("/?tool=graph");
  const key = "maths-booklet-tools:graph-envelope:v1";
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), key))
    .not.toBeNull();
  const original = await page.evaluate((k) => localStorage.getItem(k), key);
  await page
    .getByRole("button", { name: "Start from an example", exact: true })
    .click();
  await page.evaluate(() => {
    window.open = () => null;
  });
  await page
    .locator(".example-card")
    .first()
    .getByRole("button", { name: "Open worked copy", exact: true })
    .click();
  const retry = page.getByRole("link", {
    name: "Open worked copy if it did not open",
    exact: true,
  });
  await expect(retry).toBeVisible();
  const opening = context.waitForEvent("page");
  await retry.click();
  const copy = await opening;
  await copy.waitForLoadState();
  await copy
    .getByRole("button", { name: "Start from an example", exact: true })
    .click();
  const nextOpening = context.waitForEvent("page");
  await copy
    .locator(".example-card")
    .last()
    .getByRole("button", { name: "Open worked copy", exact: true })
    .click();
  const next = await nextOpening;
  await next.waitForLoadState();
  expect(new URL(next.url()).searchParams.get("resourceCopy")).not.toBe(
    new URL(copy.url()).searchParams.get("resourceCopy"),
  );
  const copyKey =
    key + ":worked:" + new URL(next.url()).searchParams.get("resourceCopy");
  const saved = await next.evaluate((k) => localStorage.getItem(k), copyKey);
  expect(saved).not.toBeNull();
  await next.reload();
  await expect
    .poll(() => next.evaluate((k) => localStorage.getItem(k), copyKey))
    .toBe(saved);
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    original,
  );
  await copy
    .locator("dialog.example-gallery[open]")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const firstCopyId = new URL(copy.url()).searchParams.get("resourceCopy");
  const firstCopyKey = key + ":worked:" + firstCopyId;
  const firstSaved = await copy.evaluate(
    (k) => localStorage.getItem(k),
    firstCopyKey,
  );
  await copy.getByRole("link", { name: "Ratio tables", exact: true }).click();
  expect(new URL(copy.url()).searchParams.get("resourceCopy")).toBe(
    firstCopyId,
  );
  await expect(
    copy.locator(".site-page:not([hidden]) .worked-copy-badge"),
  ).toBeVisible();
  await copy.reload();
  await copy.getByRole("link", { name: "Graph tool", exact: true }).click();
  expect(
    await copy.evaluate((k) => localStorage.getItem(k), firstCopyKey),
  ).toBe(firstSaved);
  expect(await copy.evaluate((k) => localStorage.getItem(k), key)).toBe(
    original,
  );
  await next.close();
  await copy.close();
});
