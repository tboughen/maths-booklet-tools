import { test, expect, type Page } from "./release-fixtures";

/** U9: Delete removes the selected object as one undo step, arrows nudge 1 mm (Shift 5 mm), Escape deselects. */
const saved = (page: Page, part: string) =>
  page.evaluate((part) => {
    const key = Object.keys(localStorage).find((k) => k.includes(part) && !/worked|pref|hint|recovery/i.test(k));
    return key ? JSON.parse(localStorage.getItem(key)!) : null;
  }, part);
async function settle(page: Page, part: string) {
  let last = "";
  await expect
    .poll(async () => {
      const now = JSON.stringify(await saved(page, part));
      const same = now === last;
      last = now;
      return same;
    }, { intervals: [500] })
    .toBe(true);
  return JSON.parse(last);
}
const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

test("Venn: Delete clears the selected region's shading; one undo restores it", async ({ page }) => {
  await page.goto("/tools/venn");
  await page.getByRole("button", { name: "Shade", exact: true }).click();
  await page.locator('[data-region-hit="0"]').click();
  const shaded = await settle(page, ":venn:");
  expect(shaded.document.regions[0].shade).not.toBe("none");
  await blur(page);
  await page.keyboard.press("Delete");
  const cleared = await settle(page, ":venn:");
  expect(cleared.document.regions[0].shade).toBe("none");
  expect(cleared.document.sets).toBe(shaded.document.sets);
  await page.keyboard.press("Control+z");
  expect(await settle(page, ":venn:")).toEqual(shaded);
});

test("number line: Delete removes the selected line but keeps its endpoints", async ({ page }) => {
  await page.goto("/tools/number-line");
  await page.getByRole("button", { name: "Interval", exact: true }).click();
  await page.getByRole("button", { name: "Tick -1", exact: true }).click();
  await page.getByRole("button", { name: "Tick 4", exact: true }).click();
  const drawn = await settle(page, "number-line");
  expect(drawn.document.solution.kind).toBe("interval");
  await page.getByRole("button", { name: "Select interval from -1 to 4" }).click();
  await blur(page);
  await page.keyboard.press("Delete");
  const removed = await settle(page, "number-line");
  expect(removed.document.solution.kind).toBe("points");
  expect(removed.document.solution.points.map((p: { value: string }) => p.value)).toEqual(["-1", "4"]);
  await page.keyboard.press("Control+z");
  expect(await settle(page, "number-line")).toEqual(drawn);
});

test("triangle: arrows nudge the selected label 1 mm, Shift 5 mm; Escape deselects", async ({ page }) => {
  await page.goto("/tools/triangle");
  const picker = page.getByRole("combobox", { name: "Selected object", exact: true });
  const value = await picker.evaluate((el: HTMLSelectElement) =>
    [...el.options].map((o) => o.value).find((v) => v.startsWith("e:") || v.startsWith("a:"))!,
  );
  await picker.selectOption(value);
  const before = await settle(page, ":triangle:");
  await blur(page);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const after = await settle(page, ":triangle:");
  expect(after).not.toEqual(before);
  const changed = JSON.stringify(after).match(/"dx":(-?\d+(?:\.\d+)?),"dy":(-?\d+(?:\.\d+)?)/g)!;
  expect(changed.some((pair) => pair.includes('"dx":1,"dy":5'))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(picker).toHaveValue("");
});

test("ratio table: Delete removes the selected arrow, never a row; one undo restores it", async ({ page }) => {
  await page.goto("/tools/ratio-table");
  await page.getByRole("button", { name: "Start from an example", exact: true }).click();
  const card = page.getByRole("dialog").locator("article").filter({ hasText: "Worked scaling step" });
  await card.getByRole("button", { name: /^(Open diagram|Use this example)$/ }).click();
  const confirm = page.getByRole("dialog").getByRole("button", { name: /^(Open|Replace|Use)/ });
  if (await confirm.count()) await confirm.first().click();
  const withArrow = await settle(page, "ratio");
  expect(withArrow.document.transitions.length).toBe(1);
  await page.locator(".ratio-arrow-target").first().click();
  await blur(page);
  await page.keyboard.press("Delete");
  const removed = await settle(page, "ratio");
  expect(removed.document.transitions).toEqual([]);
  expect(removed.document.rows.length).toBe(withArrow.document.rows.length);
  await page.keyboard.press("Control+z");
  expect(await settle(page, "ratio")).toEqual(withArrow);
});
