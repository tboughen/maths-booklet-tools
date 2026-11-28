// Present a booklet from the Resource library (docs/tools/PRESENT-BOOKLETS.md). The library list and files are served
// behind staff sign-in, so these checks stand in the fixture list and small made-up PDFs: three A4 sides for each copy.
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "./release-fixtures";

const fixture = readFileSync(new URL("./fixtures/library.json", import.meta.url), "utf8");

/**
 * A plain A4 PDF of `sides` pages, each with one line of text, with a correct cross-reference table. The answers copy's
 * side 1 also has an NCETM-style link at the top right and a Watch for / Ask band in the footer, as booklets print them.
 */
function pdf(label: string, sides = 3) {
  const answers = label === "Answers";
  const objects: string[] = ["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const kids: number[] = [];
  for (let i = 0; i < sides; i++) {
    const notes = answers && i === 0;
    const text = `BT /F1 28 Tf 72 760 Td (${label} side ${i + 1}) Tj ET` + (notes ? " 0.85 0.47 0.02 rg 34 20 250 25 re f 0 g BT /F1 8 Tf 42 28 Td (Watch for change in x over change in y) Tj ET BT /F1 8 Tf 340 28 Td (Ask: which way is the line going?) Tj ET 0.86 0.99 0.9 rg 450 780 110 15 re f 0 g BT /F1 7 Tf 456 785 Td (NCETM Explain Gradient 4.2) Tj ET" : "");
    const page = objects.length + 1, content = page + 1;
    kids.push(page);
    const annots = notes ? ` /Annots [${content + 1} 0 R]` : "";
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R${annots} >>`, `<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
    if (notes) objects.push("<< /Type /Annot /Subtype /Link /Rect [450 780 560 795] /Border [0 0 0] /A << /S /URI /URI (https://www.ncetm.org.uk/test-gradient) >> >>");

  }
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${sides} >>`;
  let body = "%PDF-1.4\n";
  const offsets = objects.map((o, i) => { const at = body.length; body += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

async function open(page: Page, address: string) {
  await page.route("**/library-data/library.json", (route) => route.fulfill({ contentType: "application/json", body: fixture }));
  await page.route("**/library-data/files/**", (route) => route.fulfill({ contentType: "application/pdf", body: pdf(route.request().url().includes("answers") ? "Answers" : "Pupil") }));
  const sent: Record<string, unknown>[] = [];
  await page.route("**/api/library/feedback", (route) => {
    if (route.request().method() === "POST") { sent.push(route.request().postDataJSON()); return route.fulfill({ contentType: "application/json", body: '{"ok":true}' }); }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ threads: [], checks: {}, canAct: false, me: "Tim Boughen" }) });
  });
  await page.goto(address);
  return sent;
}

const drawOn = async (page: Page, side: ReturnType<Page["locator"]>) => {
  const box = (await side.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 200);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 100 + i * 20, box.y + 200 + i * 6);
  await page.mouse.up();
};

test("a library lesson opens in Present with its sides, Pupil | Answers, ink, overlays and Display", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, "/library?year=9&unit=A7");
  const a704 = page.locator(".library-rows > li").filter({ hasText: "A7.04" });
  await a704.getByRole("link", { name: "Present" }).click();
  await expect(page).toHaveURL(/present=y9-a7-04-lesson-booklet/);
  const present = page.getByRole("region", { name: /^Present A7\.04/ });
  await expect(present.locator(".present-side")).toHaveCount(3);
  await expect(present.locator(".present-side").first().locator(".qb-canvas-host canvas")).toBeVisible();
  await expect(present.getByText("Side 1 of 3")).toBeVisible();
  // The version list holds the current build and the earlier one from the history.
  await expect(present.locator(".present-version select option")).toHaveCount(2);

  // Fit width: a side fills the stage width less its gutters, and it really is A4 in shape.
  const first = present.locator(".present-side").first();
  const box = (await first.boundingBox())!;
  expect(box.height / box.width).toBeCloseTo(842 / 595, 2);
  const stage = (await present.locator(".present-stage").boundingBox())!;
  expect(box.width).toBeGreaterThan(stage.width - 120);

  // Pen: one stroke on side 1 stays when the answers copy is swapped in underneath.
  await present.getByRole("button", { name: "Annotate" }).click();
  await expect(present.getByRole("toolbar", { name: "Annotation tools (screen only)" })).toBeVisible();
  await drawOn(page, first);
  await expect(first.locator("svg.qb-annotations")).toHaveAttribute("data-strokes", "1");
  await expect(present.getByRole("button", { name: "Side 1, has ink" })).toBeVisible();
  await present.getByRole("button", { name: "Answers" }).click();
  await expect(first.locator(".qb-canvas-host canvas")).toHaveAttribute("aria-label", "Side 1 (answers)");
  await expect(first.locator("svg.qb-annotations")).toHaveAttribute("data-strokes", "1");
  await page.keyboard.press("Control+z");
  await expect(first.locator("svg.qb-annotations")).toHaveCount(1);
  await expect(first.locator("svg.qb-annotations")).toHaveAttribute("data-strokes", "0");
  await page.keyboard.press("Control+Shift+z");
  await expect(first.locator("svg.qb-annotations")).toHaveAttribute("data-strokes", "1");
  await page.keyboard.press("Escape");
  await expect(present.getByRole("toolbar", { name: "Annotation tools (screen only)" })).toBeHidden();

  // A coloured overlay tints the sides, as in the Question Bank.
  await present.getByRole("group", { name: "Coloured overlay" }).getByRole("button", { name: "Yellow" }).click();
  await expect(first.locator(".qb-coloured-overlay")).toHaveCSS("background-color", "rgb(255, 248, 207)");

  // Zoom keeps a side's shape; Next steps a side.
  await present.getByRole("button", { name: "Zoom in" }).click();
  await expect(present.locator(".present-zoom-level")).toHaveText("125%");
  await present.getByRole("button", { name: "Fit side" }).click();
  const fitted = (await first.boundingBox())!;
  expect(fitted.height).toBeLessThanOrEqual(stage.height);
  await present.getByRole("button", { name: "Next" }).click();
  await expect(present.getByText("Side 2 of 3")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  await page.screenshot({ path: test.info().outputPath("present.png") });

  // Display keeps only the sides and a small dock; Escape leaves it.
  await present.getByRole("button", { name: "Display" }).click();
  await expect(present.getByRole("complementary", { name: "Present settings" })).toBeHidden();
  await expect(present.getByRole("button", { name: /Exit Display/ })).toBeVisible();
  await expect(present.locator(".present-dock")).toContainText("Side 2 of 3");
  await page.screenshot({ path: test.info().outputPath("present-display.png") });
  await present.getByRole("button", { name: /Exit Display/ }).click();
  await expect(present.getByRole("complementary", { name: "Present settings" })).toBeVisible();

  // Back to the library, and the browser's Back opens Present again.
  await present.getByRole("button", { name: "Library" }).click();
  await expect(present).toBeHidden();
  await expect(page).toHaveURL(/\/library\?year=9&unit=A7$/);
  await page.goBack();
  await expect(page.getByRole("region", { name: /^Present A7\.04/ })).toBeVisible();
});

test("an earlier build opens from the history, and a missing booklet says so", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, "/library?year=9&unit=A7");
  const a704 = page.locator(".library-rows > li").filter({ hasText: "A7.04" });
  await a704.getByRole("button", { name: "1 earlier version" }).click();
  await a704.locator(".library-history-row").nth(1).getByRole("link", { name: "Present" }).click();
  await expect(page).toHaveURL(/present=y9-a7-04-lesson-booklet&at=/);
  await expect(page.locator(".present-version select option:checked")).toContainText("(earlier)");
  await page.goto("/library?year=9&present=gone");
  await expect(page.getByRole("alert")).toHaveText(/no longer in the library/);
});

test("a class keeps its ink and where it stopped, and another class starts clean", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, "/library?year=9&unit=A7&present=y9-a7-04-lesson-booklet");
  const present = page.getByRole("region", { name: /^Present A7\.04/ });
  const card = present.locator(".present-class");
  await expect(card).toContainText("Teaching which class?");
  await card.getByPlaceholder("For example 9X").fill("9 x");
  await card.getByRole("button", { name: "Teach" }).click();
  await expect(present.getByRole("button", { name: "Teaching 9X" })).toBeVisible();

  const side = (n: number) => present.locator(`.present-side[data-side="${n}"]`);
  await present.getByRole("button", { name: "Next" }).click();
  await present.getByRole("button", { name: "Annotate" }).click();
  await drawOn(page, side(2));
  await expect(side(2).locator("svg.qb-annotations")).toHaveAttribute("data-strokes", "1");
  await card.getByRole("button", { name: "⚑ We stopped here" }).click();
  await expect(present.getByRole("button", { name: /^Side 2, has ink/ }).locator(".present-flag")).toHaveCount(1);
  await expect(card.locator("summary")).toContainText("stopped at side 2");
  await page.waitForTimeout(600);

  // Next lesson: the class is offered, its ink is back and it can go to where it stopped.
  await page.reload();
  const again = page.getByRole("region", { name: /^Present A7\.04/ });
  await again.locator(".present-recent").getByRole("button", { name: "9X" }).click();
  await expect(again.locator(".present-resume")).toContainText("You stopped at side 2");
  await page.screenshot({ path: test.info().outputPath("present-class.png") });
  await again.getByRole("button", { name: "Go to where we stopped" }).click();
  await expect(again.getByText("Side 2 of 3", { exact: true })).toBeVisible();
  await expect(again.locator('.present-side[data-side="2"] svg.qb-annotations')).toHaveAttribute("data-strokes", "1");

  // Another class has its own (empty) ink.
  await again.getByRole("button", { name: "Change class" }).click();
  await again.getByPlaceholder("For example 9X").fill("9Y");
  await again.getByRole("button", { name: "Teach" }).click();
  await expect(again.locator('.present-side[data-side="2"] svg.qb-annotations')).toHaveCount(0);
  await expect(again.locator(".present-resume")).toHaveCount(0);
});

test("teacher notes from the answers copy show on the pupil copy on screen only, and T hides them", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, "/library?year=9&unit=A7&present=y9-a7-04-lesson-booklet");
  const present = page.getByRole("region", { name: /^Present A7\.04/ });
  const card = present.locator(".present-notes");
  await expect(card.locator(".present-note-watch")).toHaveText("Watch for change in x over change in y");
  await expect(card.locator(".present-note-ask")).toHaveText("Ask which way is the line going?");
  await expect(card.getByRole("link", { name: "NCETM Explain Gradient 4.2 ↗" })).toHaveAttribute("href", "https://www.ncetm.org.uk/test-gradient");
  const side1 = present.locator('.present-side[data-side="1"]');
  await expect(side1.locator(".present-notes-crop")).toHaveCount(1);
  await expect(side1.getByRole("link", { name: "NCETM link" })).toHaveAttribute("href", "https://www.ncetm.org.uk/test-gradient");
  await expect(present.locator('.present-side[data-side="2"] .present-notes-crop')).toHaveCount(0);
  // The band really is drawn from the answers page: amber shows in the footer of the pupil side.
  await expect.poll(() => side1.locator(".present-notes-crop").evaluate((c: HTMLCanvasElement) => { const x = c.getContext("2d")!; const k = c.width / 595; const d = x.getImageData(60 * k, (842 - 30) * k, 1, 1).data; return [d[0] > 180, d[1] < 160, d[2] < 60].every(Boolean); })).toBe(true);
  await page.screenshot({ path: test.info().outputPath("present-notes.png") });
  await page.keyboard.press("t");
  await expect(side1.locator(".present-notes-crop")).toHaveCount(0);
  await expect(card.getByRole("checkbox")).not.toBeChecked();
  await page.keyboard.press("t");
  await present.getByRole("button", { name: "Answers" }).click();
  await expect(side1.locator(".present-notes-crop")).toHaveCount(0);
  await expect(side1.getByRole("link", { name: "NCETM link" })).toBeVisible();
});

test("a pinned comment and a quick note from Display go to the lesson's library feedback", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const sent = await open(page, "/library?year=9&unit=A7&present=y9-a7-04-lesson-booklet");
  const present = page.getByRole("region", { name: /^Present A7\.04/ });
  const card = present.locator(".present-feedback");
  await card.locator("summary").click();
  await card.getByRole("button", { name: "Pin a comment" }).click();
  const side1 = present.locator('.present-side[data-side="1"]');
  await expect(side1.locator(".qb-canvas-host canvas")).toBeVisible();
  const box = (await side1.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.2);
  await expect(side1.locator(".present-pin")).toHaveCount(1);
  await card.getByPlaceholder("What should change here?").fill("Q3 too hard straight after Q2");
  await card.getByRole("button", { name: "Send 1 comment" }).click();
  await expect(card.getByRole("status")).toHaveText("Sent 1 comment to the library feedback.");
  expect(sent[0]).toMatchObject({ action: "comment", year: 9, unit: "A7", version: "Main", lesson: "A7.04", booklet: null });
  expect(sent[0].text).toMatch(/^From Present \(Main · 22 Nov 2026\):\nSide 1 \(40% across, 20% down\): Q3 too hard straight after Q2$/);
  await expect(side1.locator(".present-pin")).toHaveCount(0);

  // In Display, N drops a quick note and nothing is asked until Display ends.
  await present.getByRole("button", { name: "Display" }).click();
  await page.keyboard.press("n");
  await expect(side1.locator(".present-pin.is-quick")).toHaveCount(1);
  await expect(present.locator(".present-ask-send")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const ask = present.locator(".present-ask-send");
  await expect(ask).toContainText("Send 1 note as feedback?");
  await ask.getByRole("button", { name: "Send" }).click();
  await expect(ask).toHaveCount(0);
  expect(sent[1].text).toMatch(/Side 1 .*flagged during a lesson, no words added$/);
});
