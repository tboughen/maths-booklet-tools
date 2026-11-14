import { test, expect } from "./release-fixtures";
import { toolIds } from "../src/site/routes";

/** U33: every download is mathsdock-<tool>-<content>-<date>.<ext>, built by one helper. */
for (const tool of toolIds) {
  test(`${tool}: downloads say which tool, what and when`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    for (const [label, ext] of [["Download SVG", "svg"], ["Save editable file", "json"]] as const) {
      await page.getByRole("button", { name: "File", exact: true }).click();
      const download = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      const name = (await download).suggestedFilename();
      expect(name).toMatch(new RegExp(`^mathsdock-${tool}-([a-z0-9-]+-)?\\d{4}-\\d{2}-\\d{2}\\.${ext}$`));
    }
  });
}
