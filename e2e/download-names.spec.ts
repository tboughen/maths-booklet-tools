import { test, expect } from "./release-fixtures";
import { toolIds } from "../src/site/routes";

/** U33: every download is mathsdock-<tool>-<content>-<date>.<ext>, built by one helper. */
for (const tool of toolIds) {
  test(`${tool}: downloads say which tool, what and when`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    for (const [label, ext] of [["Download SVG", "svg"], ["Download PDF (actual size)", "pdf"], ["Save editable file", "json"]] as const) {
      await page.getByRole("button", { name: "File", exact: true }).click();
      const download = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      const name = (await download).suggestedFilename();
      expect(name).toMatch(new RegExp(`^mathsdock-${tool}-([a-z0-9-]+-)?\\d{4}-\\d{2}-\\d{2}\\.${ext}$`));
    }
  });
}

for (const tool of ["venn", "charts", "probability-tree", "frequency-tree"]) {
  test(`${tool}: the teacher copy's download says "answers"`, async ({ page }) => {
    await page.goto(`/tools/${tool}`);
    await page.getByRole("checkbox", { name: /answers/i }).filter({ visible: true }).first().check();
    await page.getByRole("button", { name: "File", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Download SVG", exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(new RegExp(`^mathsdock-${tool}-([a-z0-9-]+-)?answers-\\d{4}-\\d{2}-\\d{2}\\.svg$`));
  });
}
