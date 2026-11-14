import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFileSync } from "node:fs";
import { clickResourceAction } from "./resource-actions";

// U116: a worked note added from the File menu prints on the answers copy only.
for (const tool of ["venn", "charts", "probability-tree", "frequency-tree", "two-way-table", "construction", "elevations"]) {
  test(`${tool}: a worked note prints in dark pink on the answers copy only`, async ({ page }, info) => {
    await page.goto(`/tools/${tool}`);
    await clickResourceAction(page, "Worked notes…");
    const dialog = page.getByRole("dialog", { name: "Worked notes" });
    await dialog.getByRole("button", { name: "Add a worked note" }).click();
    await dialog.getByRole("textbox", { name: "Guidance" }).fill("Look at the totals first");
    await dialog.getByRole("button", { name: "Save worked notes" }).click();
    await expect(dialog).toHaveCount(0);
    const pending = page.waitForEvent("download");
    await clickResourceAction(page, "Download pupil and answers (ZIP)");
    const path = info.outputPath(`${tool}.zip`);
    await (await pending).saveAs(path);
    const files = unzipSync(new Uint8Array(readFileSync(path)));
    const svg = (answers: boolean) =>
      Buffer.from(Object.entries(files).find(([n]) => n.endsWith(".svg") && n.includes("-answers-") === answers)![1]).toString();
    expect(svg(true)).toContain('data-layer="worked"');
    expect(svg(true)).toContain("#b0125b");
    expect(svg(false)).not.toContain('data-layer="worked"');
  });
}
