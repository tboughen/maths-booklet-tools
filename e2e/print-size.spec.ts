import { test, expect } from "@playwright/test";

// W31: pages at their intended print size, with a per-device calibration that never changes printing.
const NOMINAL = 96 / 25.4;
for (const [route, pages, mm] of [["/worksheets", "worksheet-pages", 420], ["/booklets", "booklet-pages", 210]] as const) {
  test(`${route}: Actual size shows a page as wide as it prints, and calibration adjusts it`, async ({ page }) => {
    await page.goto(route);
    const art = page.getByTestId(pages).locator(".ws-art").first();
    const width = async () => (await art.boundingBox())!.width;
    const fitted = await width();
    await page.getByRole("button", { name: "Actual size" }).click();
    await expect(page.getByRole("button", { name: "Actual size" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Not calibrated on this device")).toBeVisible();
    expect(Math.abs((await width()) - mm * NOMINAL)).toBeLessThan(1);
    // Drawn in full: the page's figure is as wide as its art, and the list scrolls to show it.
    const figure = page.getByTestId(pages).locator("figure").first();
    expect(Math.abs((await figure.boundingBox())!.width - (await width()))).toBeLessThan(2);
    const list = page.getByTestId(pages);
    expect(await list.evaluate((el) => el.scrollWidth >= el.firstElementChild!.getBoundingClientRect().width - 1)).toBe(true);
    expect(await figure.evaluate((el) => getComputedStyle(el).contentVisibility)).not.toBe("auto");

    await page.getByRole("button", { name: "Calibrate…" }).click();
    const dialog = page.getByRole("dialog", { name: "Calibrate actual size" });
    const bar = dialog.getByTestId("calibrate-bar");
    expect(Math.abs((await bar.boundingBox())!.width - 85.6 * NOMINAL)).toBeLessThan(1);
    for (let i = 0; i < 4; i++) await dialog.getByRole("button", { name: "Longer" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Calibrated for this device.")).toBeVisible();
    expect(Math.abs((await width()) - mm * NOMINAL * 1.005 ** 4)).toBeLessThan(1);

    // Kept on this device, and Reset forgets it.
    await page.reload();
    await page.getByRole("button", { name: "Actual size" }).click();
    expect(Math.abs((await width()) - mm * NOMINAL * 1.005 ** 4)).toBeLessThan(1);
    await page.getByRole("button", { name: "Calibrate…" }).click();
    await page.getByRole("dialog", { name: "Calibrate actual size" }).getByRole("button", { name: "Reset" }).click();
    expect(Math.abs((await width()) - mm * NOMINAL)).toBeLessThan(1);
    await page.getByRole("button", { name: "Actual size" }).click();
    expect(Math.abs((await width()) - fitted)).toBeLessThan(1);
  });
}
