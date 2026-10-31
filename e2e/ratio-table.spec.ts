import { editorBase, test, expect } from "./release-fixtures";
import type { Page } from "./release-fixtures";
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
  await page.goto(ratioEditorLink(scaffold, editorBase()));
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
    new URL(ratioEditorLink(scaffold, editorBase())).hash,
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
  await page.goto("/tools/ratio-table");
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
  await page.goto("/tools/ratio-table");
  await expect(blank).toHaveAttribute("data-kind", "answer-line");
  await expect(
    page.getByLabel("Show arrows", { exact: true }),
  ).not.toBeChecked();
});
test("invalid input cannot export or overwrite the saved value; Escape recovers cleanly", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/tools/ratio-table");
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
  await page.goto("/tools/ratio-table");
  await page
    .getByRole("button", { name: "Edit headings", exact: true })
    .click();
  const heading = page.getByLabel("Column 1 heading", { exact: true });
  await heading.fill("Temperature");
  await heading.press("Enter");
  await expect(heading).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "File", exact: true }),
  ).toBeDisabled();
  await heading.press("Escape");
  await expect(heading).toHaveValue("x →");
  await expect(
    page.getByRole("button", { name: "File", exact: true }),
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
  await page.goto("/tools/ratio-table");
  await page.getByLabel("Editing guides", { exact: true }).check();
  await page.getByLabel("Preview zoom", { exact: true }).selectOption("3");
  const metrics = ratioMetrics(scaffold.document);
  for (const [name, format] of [
    ["Download PNG", "png"],
    ["Download SVG", "svg"],
    ["Save editable file", "json"],
  ]) {
    await page
      .getByRole("button", { name: "File", exact: true })
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
  await page.goto("/tools/ratio-table");
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
  await page.goto("/tools/ratio-table");
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
  await page.getByRole("button", { name: "Remove row", exact: true }).click();
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
  for (const name of ["Rows", "Columns"]) {
    const pair = page.getByRole("group", { name, exact: true });
    const bounds = await pair.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    await expect(pair.getByRole("button")).toHaveCount(2);
  }
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
  await page.goto("/tools/ratio-table");
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
  await expect(page.getByText(/Copied for Word at/)).toBeVisible();
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
  await page.goto("/tools/ratio-table");
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
  await structure
    .getByRole("button", { name: "Remove column", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
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
  const stage = page.getByRole("region", {
    name: "Ratio table workspace",
    exact: true,
  });
  const stageBounds = await stage.boundingBox();
  for (const scrollLeft of [0, 1000]) {
    await stage.evaluate((element, left) => {
      element.scrollLeft = left;
    }, scrollLeft);
    for (const name of ["Rows", "Columns"]) {
      const bounds = await structure
        .getByRole("group", { name, exact: true })
        .boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(stageBounds!.x);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
        stageBounds!.x + stageBounds!.width,
      );
    }
  }
  await stage.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await page.screenshot({
    path: testInfo.outputPath("three-columns-mobile.png"),
    fullPage: true,
  });
});

test("GUI row selection adds one shared operation and keyboard entry preserves invalid drafts", async ({
  page,
}) => {
  await seed(page, JSON.stringify(simple));
  await page.goto("/tools/ratio-table");
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
  await expect
    .poll(async () => (await stored(page)).document.transitions[0]?.operation)
    .toBe("divide");
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
  await page.goto("/tools/ratio-table");
  await page
    .getByRole("group", { name: "Table structure" })
    .getByRole("button", { name: "Add column", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Edit column 3 heading", exact: true })).toBeFocused();
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
    ["Save editable file", "json"],
  ]) {
    await page
      .getByRole("button", { name: "File", exact: true })
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

test("arrow factors edit directly, synchronize every copy and retain invalid drafts without filling values", async ({
  page,
}, testInfo) => {
  await seed(page, JSON.stringify(simple));
  await page.goto("/tools/ratio-table");
  await page.getByRole("button", { name: "Add arrow", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose row 1 for arrow", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose row 2 for arrow", exact: true })
    .click();
  const left = page.getByLabel("Row 1 left arrow factor", { exact: true });
  const right = page.getByLabel("Row 1 column 2 arrow factor", { exact: true });
  // Click the actual printed number, so overlay placement is tested too.
  const clickPrintedFactor = async (column: number) => {
    await page
      .locator(".ratio-inline-factor input")
      .nth(column)
      .scrollIntoViewIfNeeded();
    const bounds = await page
      .locator(".ratio-operation")
      .nth(column)
      .locator("text")
      .last()
      .boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.click(
      bounds!.x + bounds!.width / 2,
      bounds!.y + bounds!.height / 2,
    );
  };
  await clickPrintedFactor(0);
  await expect(left).toBeFocused();
  await left.fill("4");
  await page.screenshot({
    path: testInfo.outputPath("inline-factor-left-editing.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await left.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .getByRole("group", { name: "Columns", exact: true })
        .evaluate((group) => {
          const bounds = group.getBoundingClientRect(),
            stage = group.closest(".ratio-stage")!.getBoundingClientRect();
          return bounds.bottom <= stage.bottom;
        }),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator(".ratio-inline-factor.is-left .ratio-factor-operation")
        .evaluate((symbol) => {
          const label = symbol.getBoundingClientRect(),
            stage = symbol.closest(".ratio-stage")!.getBoundingClientRect();
          return label.x >= stage.x && label.right <= stage.right;
        }),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("inline-factor-left-mobile-editing.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await left.press("Enter");
  await expect(right).toHaveValue("4");
  await expect(
    page.getByLabel("Row 1 scaling factor", { exact: true }),
  ).toHaveValue("4");
  expect((await stored(page)).document.rows).toEqual(simple.document.rows);
  await page.getByRole("button", { name: /Edit scaling arrow.*left/ }).click();
  await expect(
    page.getByLabel("Row 1 scaling factor", { exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(left).toHaveValue("2");
  await expect(right).toHaveValue("2");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await clickPrintedFactor(1);
  await expect(right).toBeFocused();
  await page
    .getByLabel("Row 1 scaling operation", { exact: true })
    .selectOption("divide");
  await expect
    .poll(async () => (await stored(page)).document.transitions[0]?.operation)
    .toBe("divide");
  await right.click();
  await right.fill("0");
  await right.press("Enter");
  await expect(right).toHaveAttribute("aria-invalid", "true");
  await expect(left).toBeDisabled();
  await expect(
    page.getByLabel("Row 1 scaling factor", { exact: true }),
  ).toBeDisabled();
  expect((await stored(page)).document.transitions[0].factor).toBe("4");
  await page
    .getByRole("heading", { name: "Ratio tables", exact: true })
    .click();
  await expect(
    page.locator(".ratio-step-highlight, .ratio-arrow-target.is-selected"),
  ).toHaveCount(0);
  await expect(right).toHaveValue("0");
  await right.press("Escape");
  await right.fill("1/2");
  await right.press("Enter");
  await expect(left).toHaveValue("1/2");
  await page.getByRole("button", { name: "Add column", exact: true }).click();
  const middle = page.getByLabel("Row 1 column 2 arrow factor", {
    exact: true,
  });
  const first = page.getByLabel("Row 1 column 1 arrow factor", { exact: true });
  const third = page.getByLabel("Row 1 column 3 arrow factor", { exact: true });
  await clickPrintedFactor(1);
  await expect(middle).toBeFocused();
  await middle.fill("6");
  await page.screenshot({
    path: testInfo.outputPath("inline-factor-editing.png"),
    fullPage: true,
  });
  await page
    .getByRole("heading", { name: "Ratio tables", exact: true })
    .click();
  await expect(first).toHaveValue("6");
  await expect(third).toHaveValue("6");
  await expect(page.locator(".ratio-operation")).toHaveText(["÷6", "÷6", "÷6"]);
  expect(
    (await stored(page)).document.rows.map((row) => row.cells.slice(0, 2)),
  ).toEqual(simple.document.rows.map((row) => row.cells));
  await expect
    .poll(async () => (await stored(page)).document.transitions[0]?.factor)
    .toBe("6");
  await page.reload();
  await expect(middle).toHaveValue("6");
  await clickPrintedFactor(1);
  await middle.fill("1/0");
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Graph tool", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Booklet tools", exact: true })
    .getByRole("link", { name: "Ratio tables", exact: true })
    .click();
  await expect(middle).toHaveValue("1/0");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await middle.press("Escape");
  await page
    .getByRole("heading", { name: "Ratio tables", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("inline-factor-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  const columns = page.getByRole("group", { name: "Columns", exact: true });
  const [add, remove] = await columns.evaluate((element) =>
    Array.from(element.querySelectorAll("button")).map((button) => {
      const { x, y, width, height } = button.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
  expect(remove.x).toBe(add.x);
  expect(remove.y).toBeGreaterThan(add.y + add.height);
  await clickPrintedFactor(1);
  await expect(middle).toBeFocused();
  await middle.fill("3/2");
  await middle.press("Enter");
  await expect(first).toHaveValue("3/2");
  await expect(third).toHaveValue("3/2");
  await page
    .getByRole("heading", { name: "Ratio tables", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("inline-factor-mobile.png"),
    fullPage: true,
  });
});

test("visible remove controls shrink to one row/column, retain values and restore through undo", async ({
  page,
}) => {
  await seed(page, JSON.stringify(simple));
  await page.goto("/tools/ratio-table");
  const structure = page.getByRole("group", { name: "Table structure" });
  for (const name of ["Add row", "Remove row", "Add column", "Remove column"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      1,
    );
    await expect(
      page
        .locator(".editor-toolbar")
        .getByRole("button", { name, exact: true }),
    ).toHaveCount(0);
  }
  for (const [group, add, remove] of [
    ["Rows", "Add row", "Remove row"],
    ["Columns", "Add column", "Remove column"],
  ]) {
    const pair = structure.getByRole("group", { name: group, exact: true });
    await expect(
      pair.getByRole("button", { name: add, exact: true }),
    ).toBeVisible();
    await expect(
      pair.getByRole("button", { name: remove, exact: true }),
    ).toBeVisible();
    const [addBounds, removeBounds] = await pair.evaluate((element) =>
      Array.from(element.querySelectorAll("button")).map((button) => {
        const { x, y, width, height } = button.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
    expect(addBounds).not.toBeNull();
    expect(removeBounds).not.toBeNull();
    if (group === "Columns") {
      expect(removeBounds!.x).toBe(addBounds!.x);
      expect(removeBounds!.y).toBeGreaterThan(addBounds!.y + addBounds!.height);
    } else {
      expect(removeBounds!.y).toBe(addBounds!.y);
      expect(removeBounds!.x).toBeGreaterThan(addBounds!.x + addBounds!.width);
    }
  }
  await page.getByLabel("Row 1 x value", { exact: true }).click();
  await structure
    .getByRole("button", { name: "Remove row", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page)).document.rows)
    .toEqual([simple.document.rows[1]]);
  await expect(
    structure.getByRole("button", { name: "Remove row", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("group", { name: "Ratio editing tools" })
      .getByRole("button", { name: "Add arrow", exact: true }),
  ).toBeDisabled();
  await structure
    .getByRole("button", { name: "Remove column", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(async () => (await stored(page)).document.rows[0].cells)
    .toEqual([{ kind: "number", value: "1" }]);
  await expect(
    structure.getByRole("button", { name: "Remove column", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Row 1 x value", { exact: true })).toHaveValue(
    "1",
  );
  const single = await stored(page),
    singleMetrics = ratioMetrics(single.document);
  await page
    .getByRole("button", { name: "File", exact: true })
    .click();
  const singleDownloading = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /Download PNG/ }).click();
  const singleBytes = await readFile((await (await singleDownloading).path())!);
  verifyPrintBytes(
    singleBytes,
    Math.round((singleMetrics.widthCm / 2.54) * 600),
    Math.round((singleMetrics.heightCm / 2.54) * 600),
  );
  await structure
    .getByRole("button", { name: "Add column", exact: true })
    .click();
  await expect(
    page.getByLabel("Edit column 2 heading", { exact: true }),
  ).toBeFocused();
  await expect(
    page.getByLabel("Edit column 2 heading", { exact: true }),
  ).toHaveValue("y ↑");
  await structure.getByRole("button", { name: "Add row", exact: true }).click();
  await expect.poll(async () => (await stored(page)).schemaVersion).toBe(1);
  await expect
    .poll(async () => (await stored(page)).document.rows[1].cells)
    .toEqual([{ kind: "empty" }, { kind: "empty" }]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).document.headings.length)
    .toBe(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).document.headings.length)
    .toBe(2);
});

test("default heading arrows are editable Unicode and can be deleted, restored and saved", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/tools/ratio-table");
  const first = page.getByLabel("Edit column 1 heading", { exact: true });
  const second = page.getByLabel("Edit column 2 heading", { exact: true });
  await expect(first).toHaveValue("x →");
  await expect(second).toHaveValue("y ↑");
  for (const field of [first, second]) {
    await field.click();
    await field.press("End");
    await field.press("Backspace");
    await field.press("Enter");
  }
  await expect
    .poll(async () =>
      (await stored(page)).document.headings.map(
        (heading: { direction: string }) => heading.direction,
      ),
    )
    .toEqual(["none", "none"]);
  await page.reload();
  await expect(first).toHaveValue("x");
  await expect(second).toHaveValue("y");
  await page
    .getByRole("button", { name: "Edit headings", exact: true })
    .click();
  const panel = page.getByLabel("Column 1 heading", { exact: true });
  await panel.fill("x →");
  await panel.press("Enter");
  await expect
    .poll(async () => (await stored(page)).document.headings[0].direction)
    .toBe("right");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(first).toHaveValue("x");
});

test("clicking away clears cell, heading, scaling and arrow-creation highlights without discarding invalid drafts", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/tools/ratio-table");
  const title = page.getByRole("heading", {
    name: "Ratio tables",
    exact: true,
  });
  const highlighted = page.locator(
    ".ratio-edit-layer .is-selected, .ratio-step-highlight",
  );
  await page.getByLabel("Row 1 x value", { exact: true }).click();
  await expect(highlighted).toHaveCount(1);
  await title.click();
  await expect(highlighted).toHaveCount(0);
  await page.getByLabel("Edit column 1 heading", { exact: true }).click();
  await expect(highlighted).toHaveCount(1);
  await page
    .getByRole("region", { name: "Ratio table workspace" })
    .click({ position: { x: 5, y: 5 } });
  await expect(highlighted).toHaveCount(0);
  await page
    .getByRole("button", { name: /Edit scaling arrow/ })
    .first()
    .click();
  await expect(page.locator(".ratio-step-highlight")).toHaveCount(2);
  await title.click();
  await expect(highlighted).toHaveCount(0);
  await page
    .getByRole("button", { name: /Edit scaling arrow/ })
    .first()
    .click();
  const factor = page.getByLabel("Row 1 scaling factor", { exact: true });
  await factor.fill("0");
  await factor.press("Enter");
  await title.click();
  await expect(highlighted).toHaveCount(0);
  await expect(factor).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Copy for Word", exact: true }),
  ).toBeDisabled();
  await factor.focus();
  await factor.press("Escape");
  await page
    .getByRole("group", { name: "Ratio editing tools" })
    .getByRole("button", { name: "Add arrow", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose row 1 for arrow", exact: true })
    .click();
  await expect(page.locator(".ratio-row-target.is-selected")).toHaveCount(1);
  await title.click();
  await expect(highlighted).toHaveCount(0);
  await expect(page.locator(".ratio-row-target")).toHaveCount(0);
});
