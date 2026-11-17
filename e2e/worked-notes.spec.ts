import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFileSync } from "node:fs";
import { clickResourceAction } from "./resource-actions";

// U116: a worked note added from the File menu prints on the answers copy only.
for (const tool of ["ratio-table", "venn", "charts", "probability-tree", "frequency-tree", "two-way-table", "factor-tree", "written-method", "function-machine", "bubble-method", "probability-objects", "algebra-tiles", "nets", "sample-space", "construction", "elevations", "angles", "area", "figures", "solids"]) {
  test(`${tool}: a worked note prints in dark pink on the answers copy only`, async ({ page }, info) => {
    await page.goto(`/tools/${tool}`);
    await clickResourceAction(page, "Worked notes…");
    const dialog = page.getByRole("dialog", { name: "Worked notes" });
    await dialog.getByRole("button", { name: "Add a worked note" }).click();
    await dialog.getByRole("textbox", { name: "Guidance" }).fill("Add 3");
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

// Editors whose answers show only in worksheets, booklets and the connector: the note is saved in the file.
for (const route of ["graph", "number-line", "expanding-factorising", "triangle", "bar-model"]) {
  test(`${route}: a worked note is saved in the editable file`, async ({ page }, info) => {
    await page.goto(`/tools/${route}`);
    await clickResourceAction(page, "Worked notes…");
    const dialog = page.getByRole("dialog", { name: "Worked notes" });
    await dialog.getByRole("button", { name: "Add a worked note" }).click();
    await dialog.getByRole("textbox", { name: "Guidance" }).fill("Add 3");
    await dialog.getByRole("button", { name: "Save worked notes" }).click();
    await expect(dialog).toHaveCount(0);
    const pending = page.waitForEvent("download");
    await clickResourceAction(page, "Save editable file");
    const path = info.outputPath(`${route}.json`);
    await (await pending).saveAs(path);
    expect(JSON.parse(readFileSync(path, "utf8")).worked).toEqual([{ text: "Add 3", x: 2, y: 2 }]);
  });
}

// Tim (14 Nov): on a small diagram a note may sit in a margin beside it. The answers copy's page grows
// to hold it; the artwork and the pupil copy keep their printed size.
test("ratio-table: a note in the margin widens only the answers copy", async ({ page }, info) => {
  await page.goto("/tools/ratio-table");
  await clickResourceAction(page, "Worked notes…");
  const dialog = page.getByRole("dialog", { name: "Worked notes" });
  await dialog.getByRole("button", { name: "Add a worked note" }).click();
  await dialog.getByRole("textbox", { name: "Guidance" }).fill("Multiply by 3");
  await dialog.getByRole("spinbutton", { name: "Across (mm)" }).fill("-30");
  await dialog.getByRole("button", { name: "Save worked notes" }).click();
  await expect(dialog).toHaveCount(0);
  const pending = page.waitForEvent("download");
  await clickResourceAction(page, "Download pupil and answers (ZIP)");
  const path = info.outputPath("ratio-margin.zip");
  await (await pending).saveAs(path);
  const files = unzipSync(new Uint8Array(readFileSync(path)));
  const svg = (answers: boolean) =>
    Buffer.from(Object.entries(files).find(([n]) => n.endsWith(".svg") && n.includes("-answers-") === answers)![1]).toString();
  const size = (s: string) => {
    const tag = s.match(/<svg\b[^>]*>/)![0];
    const mm = (name: string) => {
      const [, v, unit] = tag.match(new RegExp(`\\s${name}="([\\d.]+)(mm|cm)"`))!;
      return Number(v) * (unit === "cm" ? 10 : 1);
    };
    return { width: mm("width"), height: mm("height") };
  };
  const pupil = size(svg(false)),
    answers = size(svg(true));
  expect(answers.width).toBeCloseTo(pupil.width + 31, 1);
  expect(answers.height).toBeCloseTo(pupil.height, 1);
  expect(svg(true)).toContain(">Multiply by 3</text>");
  expect(svg(false)).not.toContain('data-layer="worked"');
  // The 600 ppi PNGs follow each copy's own page, so the answers artwork stays at actual size.
  const png = (answers: boolean) => {
    const bytes = Object.entries(files).find(([n]) => n.endsWith(".png") && n.includes("-answers-") === answers)![1];
    return new DataView(bytes.buffer, bytes.byteOffset).getUint32(16);
  };
  expect(png(true) - png(false)).toBeGreaterThan(Math.round((30 * 600) / 25.4));
  expect(Math.abs(png(true) - Math.round((answers.width * 600) / 25.4))).toBeLessThanOrEqual(1);
});
