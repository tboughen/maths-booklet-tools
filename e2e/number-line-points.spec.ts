import { clickResourceAction } from "./resource-actions";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("hollow existing points can be joined without losing other points; Undo and reopen retain them", async ({
  page,
}, info) => {
  await page.goto("/tools/number-line");
  await page.evaluate(() =>
    localStorage.removeItem("maths-booklet-tools:number-line:v1"),
  );
  await page.reload();
  const resource = page.getByTestId("number-line-resource");
  await page.getByRole("button", { name: "Point", exact: true }).click();
  for (const value of ["-2", "3", "4"])
    await page
      .getByRole("button", { name: `Tick ${value}`, exact: true })
      .click();
  await page
    .getByRole("button", { name: "Finish drawing", exact: true })
    .click();
  await page.getByRole("button", { name: /^Endpoint -2,/ }).click();
  await expect(page.getByLabel("Endpoint type", { exact: true })).toHaveValue(
    "excluded",
  );
  await expect(resource.locator('circle[data-value="-2"]')).toHaveAttribute(
    "fill",
    "white",
  );
  await page.getByRole("button", { name: "Interval", exact: true }).click();
  await page.getByRole("button", { name: /^Endpoint -2,/ }).click();
  await page.getByRole("button", { name: /^Endpoint 3,/ }).click();
  await expect(resource.locator("circle")).toHaveCount(3);
  await expect(resource.locator("path[data-interval]")).toHaveCount(1);
  await expect(resource.locator('circle[data-value="-2"]')).toHaveAttribute(
    "fill",
    "white",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(resource.locator("path[data-interval]")).toHaveCount(0);
  await expect(resource.locator("circle")).toHaveCount(3);
  await expect(resource.locator('circle[data-value="-2"]')).toHaveAttribute(
    "fill",
    "white",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.reload();
  await expect(resource.locator("path[data-interval]")).toHaveCount(1);
  await expect(resource.locator('circle[data-value="-2"]')).toHaveAttribute(
    "fill",
    "white",
  );
  await page
    .getByRole("button", { name: "File", exact: true })
    .click();
  const event = page.waitForEvent("download");
  await clickResourceAction(page, "Save editable file");
  const output = info.outputPath("joined-points.json");
  await (await event).saveAs(output);
  const saved = JSON.parse(await readFile(output, "utf8"));
  expect(saved.document.solution.intervals).toHaveLength(1);
  expect(saved.document.solution.points).toHaveLength(3);
  expect(saved.document.solution.points[0].included).toBe(false);
  await page
    .getByRole("button", { name: "File", exact: true })
    .click();
  await page.getByRole("button", { name: /^Endpoint -2,/ }).click();
  await page.screenshot({
    path: test.info().outputPath("joined-hollow-points.png"),
    fullPage: true,
  });
});
test("joining ticks to a point set adds only missing endpoints and preserves other points", async ({
  page,
}) => {
  await page.goto("/tools/number-line");
  await page.evaluate(() =>
    localStorage.removeItem("maths-booklet-tools:number-line:v1"),
  );
  await page.reload();
  await page.getByRole("button", { name: "Point", exact: true }).click();
  await page.getByRole("button", { name: "Tick -2", exact: true }).click();
  await page.getByRole("button", { name: "Tick 4", exact: true }).click();
  await page
    .getByRole("button", { name: "Finish drawing", exact: true })
    .click();
  await page.getByRole("button", { name: "Interval", exact: true }).click();
  await page.getByRole("button", { name: "Tick -2", exact: true }).click();
  await page.getByRole("button", { name: "Tick 3", exact: true }).click();
  await expect(
    page.getByTestId("number-line-resource").locator("circle"),
  ).toHaveCount(3);
  await expect(
    page.getByTestId("number-line-resource").locator("path[data-interval]"),
  ).toHaveCount(1);
});

test("arrow markers point at values between ticks with short minor ticks, and Undo removes them", async ({
  page,
}) => {
  await page.goto("/tools/number-line");
  await page.evaluate(() =>
    localStorage.removeItem("maths-booklet-tools:number-line:v1"),
  );
  await page.reload();
  const resource = page.getByTestId("number-line-resource");
  await page.getByText("More settings", { exact: true }).click();
  await page.getByText("Labels", { exact: true }).click();
  await page.getByLabel("Label every", { exact: true }).fill("5");
  await page.getByLabel("Label every", { exact: true }).press("Enter");
  await page.getByLabel("Short ticks between labels").check();
  await expect(resource.locator('path[d$="v1.2"]')).toHaveCount(8);
  await page.getByText("Arrow markers", { exact: true }).click();
  await page.getByRole("button", { name: "Add arrow", exact: true }).click();
  await page.getByRole("button", { name: "Add arrow", exact: true }).click();
  await expect(resource.locator("[data-marker]")).toHaveCount(2);
  await expect(resource.locator('[data-marker="m2"] text')).toHaveText("B");
  await page.getByLabel("Arrow 1 value", { exact: true }).fill("2.5");
  await page.getByLabel("Arrow 1 value", { exact: true }).press("Enter");
  await expect(resource).not.toContainText("2.5");
  await page.getByLabel("Arrow 1 value", { exact: true }).fill("9");
  await page.getByLabel("Arrow 1 value", { exact: true }).press("Enter");
  await expect(page.getByText(/visible range/)).toBeVisible();
  await page.getByLabel("Arrow 1 value", { exact: true }).press("Escape");
  await expect(page.getByLabel("Arrow 1 value", { exact: true })).toHaveValue("2.5");
  await page.getByRole("button", { name: "Remove arrow 2", exact: true }).click();
  await expect(resource.locator("[data-marker]")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(resource.locator("[data-marker]")).toHaveCount(2);
});
