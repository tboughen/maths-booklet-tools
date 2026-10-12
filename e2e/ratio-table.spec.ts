import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  createRatioTable,
  ratioEditorLink,
  ratioMetrics,
} from "../packages/ratio-table-core/src/interchange";
import { createGraph } from "../packages/graph-core/src/interchange";
import { verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
import { readFileSync } from "node:fs";
import type { RatioEnvelope } from "../packages/ratio-table-core/src/interchange";
const legacyFixtures = JSON.parse(
  readFileSync(
    new URL(
      "../packages/ratio-table-core/fixtures/legacy-v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Array<{ envelope: RatioEnvelope }>;
const key = "maths-booklet-tools:ratio-table-envelope:v1";
const graphKey = "maths-booklet-tools:graph-envelope:v1";
const simple = createRatioTable({
  schemaVersion: 1,
  rows: [
    {
      cells: [
        { kind: "number", value: "4" },
        { kind: "number", value: "8" },
      ],
    },
    { cells: [{ kind: "number", value: "1" }, { kind: "answer-line" }] },
  ],
});
const scaffold = createRatioTable({
  schemaVersion: 1,
  mode: "annotated",
  rows: [
    {
      id: "start",
      cells: [
        { kind: "number", value: "3" },
        { kind: "number", value: "2" },
      ],
    },
    {
      id: "target",
      cells: [{ kind: "number", value: "1" }, { kind: "answer-line" }],
    },
  ],
  transitions: [
    { from: "start", to: "target", operation: "divide", factor: "3" },
  ],
});
async function seed(page: Page, raw = JSON.stringify(scaffold)) {
  await page.addInitScript(
    ({ key, raw, graphKey, graph }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
      if (!localStorage.getItem(graphKey))
        localStorage.setItem(graphKey, graph);
    },
    {
      key,
      raw,
      graphKey,
      graph: JSON.stringify(createGraph({ schemaVersion: 1, objects: [] })),
    },
  );
}
async function stored(page: Page) {
  return JSON.parse(
    await page.evaluate((key) => localStorage.getItem(key)!, key),
  );
}
test("ratio link protects a draft; confirming opens once and undo restores it", async ({
  page,
}) => {
  await seed(page, JSON.stringify(simple));
  await page.goto(ratioEditorLink(scaffold, "http://127.0.0.1:5179/"));
  const dialog = page.getByRole("dialog", { name: "Open this ratio table?" });
  await expect(dialog).toBeVisible();
  expect(await stored(page)).toEqual(simple);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await stored(page)).toEqual(simple);
  await page.evaluate(
    (hash) => {
      location.hash = hash;
    },
    new URL(ratioEditorLink(scaffold, "http://127.0.0.1:5179/")).hash,
  );
  await dialog
    .getByRole("button", { name: "Open this table", exact: true })
    .click();
  await expect.poll(() => stored(page)).toEqual(scaffold);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => stored(page)).toEqual(simple);
});
test("pupil blank stays blank; explicit fill confirms existing values and undo restores the scaffold", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/?tool=ratio-table");
  const blank = page.locator(
    '.ratio-preview [data-row="target"][data-column="1"]',
  );
  await expect(blank).toHaveAttribute("data-kind", "answer-line");
  await expect(page.locator(".ratio-preview .ratio-scaling-arrow")).toHaveCount(
    2,
  );
  await page
    .getByRole("button", { name: /Edit scaling arrow/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Fill next row", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fill next row", exact: true })
    .click();
  await expect(page.getByLabel("Row 2 y value", { exact: true })).toHaveValue(
    "2/3",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(blank).toHaveAttribute("data-kind", "answer-line");
  await page.getByLabel("Show arrows", { exact: true }).uncheck();
  await expect(page.locator(".ratio-preview .ratio-scaling-arrow")).toHaveCount(
    0,
  );
  await expect(page.locator(".ratio-preview .ratio-operation")).toHaveCount(2);
  await page
    .getByLabel("Annotation display", { exact: true })
    .selectOption("simple");
  await expect(page.locator(".ratio-preview .ratio-operation")).toHaveCount(0);
  const graphRaw = await page.evaluate(
    (key) => localStorage.getItem(key),
    graphKey,
  );
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Graph tool", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Graph tool", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), graphKey),
  ).toBe(graphRaw);
  await page.goto("/?tool=ratio-table");
  await expect(blank).toHaveAttribute("data-kind", "answer-line");
  await expect(
    page.getByLabel("Show arrows", { exact: true }),
  ).not.toBeChecked();
});
test("invalid input cannot export or overwrite the saved value; Escape recovers cleanly", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/?tool=ratio-table");
  const value = page.getByLabel("Row 1 x value", { exact: true });
  await value.fill("1/0");
  await value.press("Enter");
  await expect(value).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  expect((await stored(page)).document.rows[0].cells[0].value).toBe("3");
  await value.press("Escape");
  await expect(value).toHaveValue("3");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeEnabled();
  await value.fill("0.125");
  await value.press("Enter");
  await expect
    .poll(async () => (await stored(page)).document.rows[0].cells[0].value)
    .toBe("0.125");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(value).toHaveValue("3");
});
test("long headings cannot leave a stale export enabled", async ({ page }) => {
  await seed(page);
  await page.goto("/?tool=ratio-table");
  await page
    .getByRole("button", { name: "Edit headings", exact: true })
    .click();
  const heading = page.getByLabel("Column 1 heading", { exact: true });
  await heading.fill("Temperature");
  await heading.press("Enter");
  await expect(heading).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Download options", exact: true }),
  ).toBeDisabled();
  await heading.press("Escape");
  await expect(heading).toHaveValue("x");
  await expect(
    page.getByRole("button", { name: "Download options", exact: true }),
  ).toBeEnabled();
});
test("actual PNG, embedded-font SVG and editable JSON export preserve print size and exclude guides", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:", "ws:", "wss:"].includes(url.protocol))
      requests.push(url.hostname);
  });
  await seed(page);
  await page.goto("/?tool=ratio-table");
  await page.getByLabel("Editing guides", { exact: true }).check();
  await page.getByLabel("Preview zoom", { exact: true }).selectOption("3");
  const metrics = ratioMetrics(scaffold.document);
  for (const [name, format] of [
    ["Download PNG", "png"],
    ["Download SVG", "svg"],
    ["Save editable table", "json"],
  ]) {
    await page
      .getByRole("button", { name: "Download options", exact: true })
      .click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: new RegExp(name) }).click();
    const result = await download;
    expect(result.suggestedFilename()).toBe(`maths-ratio-table.${format}`);
    const bytes = await readFile((await result.path())!);
    if (format === "png")
      verifyPrintBytes(
        bytes,
        Math.round((metrics.widthCm / 2.54) * 600),
        Math.round((metrics.heightCm / 2.54) * 600),
      );
    if (format === "svg") {
      const svg = bytes.toString();
      expect(svg.includes("data:font/otf;base64,")).toBe(true);
      expect(svg.includes("ratio-guides")).toBe(false);
      expect(svg.includes(`width="${metrics.widthCm}cm"`)).toBe(true);
      const pupilCell = svg.match(
        /<g class="ratio-cell" data-row="target" data-column="1"[^]*?<\/g>/,
      )![0];
      expect(pupilCell).toContain('data-kind="answer-line"');
      expect(pupilCell).not.toContain("<text");
    }
    if (format === "json")
      expect(JSON.parse(bytes.toString())).toEqual(scaffold);
  }
  expect(requests.every((host) => host === "127.0.0.1")).toBe(true);
});
test("corrupt storage is retained until recovery is saved; foreign imports are rejected", async ({
  page,
}) => {
  const raw = '{"kind":"future-format","keep":"original evidence"}';
  await seed(page, raw);
  await page.goto("/?tool=ratio-table");
  await expect(
    page.getByText("Recover your saved table", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    raw,
  );
  await expect(
    page.getByRole("button", {
      name: "I've saved the copy — start fresh",
      exact: true,
    }),
  ).toBeDisabled();
  const recovery = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download recovery copy", exact: true })
    .click();
  expect(await readFile((await (await recovery).path())!, "utf8")).toBe(raw);
  await page
    .getByRole("button", {
      name: "I've saved the copy — start fresh",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Recover your saved table", { exact: true }),
  ).toHaveCount(0);
  const before = await stored(page);
  await page
    .getByLabel("Open editable ratio-table file", { exact: true })
    .setInputFiles({
      name: "graph.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify(createGraph({ schemaVersion: 1, objects: [] })),
      ),
    });
  await expect(
    page.getByText(/Open graph files in the Graph builder/),
  ).toBeVisible();
  expect(await stored(page)).toEqual(before);
});
test("row removal, undo, mobile layout and lesson preview are usable", async ({
  page,
}, testInfo) => {
  await seed(page);
  await page.goto("/?tool=ratio-table");
  await page
    .getByRole("group", { name: "Table structure" })
    .getByRole("button", { name: "Add row", exact: true })
    .click();
  await page.getByText("Scaling steps", { exact: true }).click();
  await page
    .getByRole("button", { name: "Row 2 → Row 3 · Add arrow", exact: true })
    .click();
  await page
    .getByLabel("Row 2 scaling operation", { exact: true })
    .selectOption("multiply");
  await page.getByLabel("Row 2 x value", { exact: true }).click();
  await page.getByRole("button", { name: "Remove row 2", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).document.transitions)
    .toEqual([]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).document.transitions[1]?.operation)
    .toBe("multiply");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("ratio-page-desktop.png"),
    fullPage: true,
  });
  await page
    .locator(".ratio-paper")
    .screenshot({ path: testInfo.outputPath("ratio-fraction-scaffold.png") });
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: testInfo.outputPath("ratio-page-mobile.png"),
    fullPage: true,
  });
});
test("clipboard includes the verified PNG and centimetre dimensions; blocked copying gives a fallback", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/?tool=ratio-table");
  await page.evaluate(() => {
    const state = window as typeof window & { copiedRatio?: string };
    document.execCommand = () => {
      state.copiedRatio = window
        .getSelection()
        ?.getRangeAt(0)
        .cloneContents().firstElementChild?.outerHTML;
      return true;
    };
  });
  await page
    .getByRole("button", { name: "Copy for Word", exact: true })
    .click();
  await expect(page.getByText(/Copied at its print size/)).toBeVisible();
  const html = await page.evaluate(
    () => (window as typeof window & { copiedRatio?: string }).copiedRatio!,
  );
  const metrics = ratioMetrics(scaffold.document);
  expect(html).toContain(`width:${metrics.widthCm}cm`);
  expect(html).toContain(`height:${metrics.heightCm}cm`);
  const base64 = html.match(/src="data:image\/png;base64,([^"]+)"/)![1];
  verifyPrintBytes(
    Buffer.from(base64, "base64"),
    Math.round((metrics.widthCm / 2.54) * 600),
    Math.round((metrics.heightCm / 2.54) * 600),
  );
  await page.evaluate(() => {
    document.execCommand = () => false;
  });
  await page
    .getByRole("button", { name: "Copy for Word", exact: true })
    .click();
  await expect(
    page.getByText(/Download PNG \(600 ppi\) and insert it into Word instead/),
  ).toBeVisible();
});

test("direct editing, three clear scaling arrows, explicit fill and legacy undo work together", async ({
  page,
}, testInfo) => {
  await seed(page, JSON.stringify(legacyFixtures[1].envelope));
  await page.goto("/?tool=ratio-table");
  const structure = page.getByRole("group", { name: "Table structure" });
  await structure
    .getByRole("button", { name: "Add column", exact: true })
    .click();
  const heading = page.getByLabel("Edit column 3 heading", { exact: true });
  await expect(heading).toBeFocused();
  await heading.fill("Mass");
  await heading.press("Enter");
  const third = page.getByLabel("Row 1 Mass value", { exact: true });
  await third.click();
  await third.fill("6");
  await third.press("Enter");
  await page.getByLabel("Row 2 Mass value", { exact: true }).click();
  await expect(page.locator(".ratio-preview .ratio-scaling-arrow")).toHaveCount(
    3,
  );
  await expect(page.locator(".ratio-preview .ratio-operation")).toHaveCount(3);
  await expect.poll(async () => (await stored(page)).schemaVersion).toBe(2);
  expect((await stored(page)).document.rows[1].cells).toEqual([
    { kind: "number", value: "1" },
    { kind: "answer-line" },
    { kind: "empty" },
  ]);
  await page
    .getByRole("button", { name: /Edit scaling arrow.*column 2/ })
    .click();
  const factor = page.getByLabel("Row 1 scaling factor", { exact: true });
  await expect(factor).toBeFocused();
  await factor.fill("6");
  await factor.press("Enter");
  expect((await stored(page)).document.rows[1].cells[1]).toEqual({
    kind: "answer-line",
  });
  await page
    .getByRole("button", { name: "Fill next row", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fill next row", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page)).document.rows[1].cells)
    .toEqual([
      { kind: "number", value: "1/2" },
      { kind: "number", value: "1/3" },
      { kind: "number", value: "1" },
    ]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).document.rows[1].cells[1].kind)
    .toBe("answer-line");
  await page
    .getByRole("button", { name: /Edit scaling arrow.*column 2/ })
    .click();
  await factor.fill("3");
  await factor.press("Enter");
  await page
    .getByRole("heading", { name: "Scaling arrow", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("three-columns-desktop.png"),
    fullPage: true,
  });
  await page
    .locator(".ratio-preview")
    .screenshot({ path: testInfo.outputPath("three-columns-diagram.png") });
  await structure.getByRole("button", { name: "Add row", exact: true }).click();
  await expect(page.getByLabel("Row 3 x value", { exact: true })).toBeFocused();
  expect((await stored(page)).document.rows[0].cells[0]).toEqual({
    kind: "number",
    value: "3",
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit headings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove column 3", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove column", exact: true })
    .click();
  await expect.poll(async () => (await stored(page)).schemaVersion).toBe(1);
  await expect
    .poll(async () => (await stored(page)).document)
    .toEqual(legacyFixtures[1].envelope.document);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).document.headings[2]?.text)
    .toBe("Mass");
  await page.reload();
  await expect(page.locator(".ratio-preview .ratio-scaling-arrow")).toHaveCount(
    3,
  );
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await expect(
    structure.getByRole("button", { name: "Add row", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("three-columns-mobile.png"),
    fullPage: true,
  });
});

test("GUI row selection adds one shared operation and keyboard entry preserves invalid drafts", async ({
  page,
}) => {
  await seed(page, JSON.stringify(simple));
  await page.goto("/?tool=ratio-table");
  const cell = page.getByLabel("Row 1 x value", { exact: true });
  await cell.click();
  await cell.fill("1/0");
  await cell.press("Tab");
  await expect(page.getByLabel("Row 1 y value", { exact: true })).toBeFocused();
  await expect(cell).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Add arrow", exact: true }),
  ).toBeDisabled();
  await cell.focus();
  await cell.press("Escape");
  await expect(cell).toHaveValue("4");
  await page.getByRole("button", { name: "Add arrow", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose row 1 for arrow", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose row 2 for arrow", exact: true })
    .click();
  await expect(page.locator(".ratio-preview .ratio-scaling-arrow")).toHaveCount(
    2,
  );
  await page
    .getByLabel("Row 1 scaling operation", { exact: true })
    .selectOption("divide");
  const factor = page.getByLabel("Row 1 scaling factor", { exact: true });
  await factor.fill("0");
  await factor.press("Enter");
  await expect(factor).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Row 1 y value", { exact: true }).click();
  await expect(factor).toBeVisible();
  await expect(factor).toHaveAttribute("aria-invalid", "true");
  await factor.focus();
  await factor.press("Escape");
  await factor.fill("4");
  await factor.press("Enter");
  await expect
    .poll(async () => (await stored(page)).document.transitions[0])
    .toMatchObject({ operation: "divide", factor: "4" });
  expect((await stored(page)).document.rows).toEqual(simple.document.rows);
});

test("three-column image and editable exports survive reopening without editor decorations", async ({
  page,
}, testInfo) => {
  await seed(page);
  await page.goto("/?tool=ratio-table");
  await page
    .getByRole("group", { name: "Table structure" })
    .getByRole("button", { name: "Add column", exact: true })
    .click();
  await page.getByLabel("Row 1 z value", { exact: true }).fill("6");
  await page.getByLabel("Row 1 z value", { exact: true }).press("Enter");
  await page.getByLabel("Editing guides", { exact: true }).check();
  await expect
    .poll(async () => (await stored(page)).document.rows[0].cells[2]?.value)
    .toBe("6");
  const envelope = await stored(page),
    metrics = ratioMetrics(envelope.document);
  for (const [name, format] of [
    ["Download PNG", "png"],
    ["Download SVG", "svg"],
    ["Save editable table", "json"],
  ]) {
    await page
      .getByRole("button", { name: "Download options", exact: true })
      .click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: new RegExp(name) }).click();
    const download = await downloading;
    await download.saveAs(testInfo.outputPath(`three-columns.${format}`));
    const bytes = await readFile((await download.path())!);
    if (format === "png")
      verifyPrintBytes(
        bytes,
        Math.round((metrics.widthCm / 2.54) * 600),
        Math.round((metrics.heightCm / 2.54) * 600),
      );
    if (format === "svg") {
      expect(
        bytes.toString().match(/class="ratio-scaling-arrow"/g),
      ).toHaveLength(3);
      expect(bytes.toString()).not.toMatch(
        /ratio-guides|ratio-edit-layer|ratio-step-highlight|Add column/,
      );
      expect(bytes.toString()).toContain("data:font/otf;base64,");
    }
    if (format === "json") {
      expect(JSON.parse(bytes.toString())).toEqual(envelope);
      await page
        .getByLabel("Open editable ratio-table file", { exact: true })
        .setInputFiles({
          name: "three-columns.json",
          mimeType: "application/json",
          buffer: bytes,
        });
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Open this table", exact: true })
        .click();
      await expect.poll(() => stored(page)).toEqual(envelope);
    }
  }
});
