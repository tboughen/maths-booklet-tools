import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFileSync } from "node:fs";
import { clickResourceAction } from "./resource-actions";

// U28: every tool with a teacher copy downloads both copies in one ZIP from the File menu.
for (const tool of ["venn", "probability-tree", "frequency-tree", "two-way-table", "factor-tree", "written-method", "function-machine", "algebra-tiles", "sample-space", "construction", "elevations", "angles", "area"]) {
  test(`${tool}: Download pupil and answers (ZIP) holds both copies' SVG and PNG`, async ({ page }, info) => {
    await page.goto(`/tools/${tool}`);
    const pending = page.waitForEvent("download");
    await clickResourceAction(page, "Download pupil and answers (ZIP)");
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(new RegExp(`^mathsdock-${tool}-.*\\.zip$`));
    const path = info.outputPath(`${tool}.zip`);
    await download.saveAs(path);
    const names = Object.keys(unzipSync(new Uint8Array(readFileSync(path)))).sort();
    expect(names.map((n) => `${n.includes("-answers-") ? "answers" : "pupil"}.${n.split(".").pop()}`).sort()).toEqual([
      "answers.png",
      "answers.svg",
      "pupil.png",
      "pupil.svg",
    ]);
  });
}
