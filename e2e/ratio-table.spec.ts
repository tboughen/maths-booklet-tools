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
  await page.getByRole("button", { name: "Simple", exact: true }).click();
  await expect(page.locator(".ratio-preview .ratio-operation")).toHaveCount(0);
  const graphRaw = await page.evaluate(
    (key) => localStorage.getItem(key),
    graphKey,
  );
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Graph builder/ }).click();
  await expect(
    page.getByRole("heading", { name: "Build a graph for Word" }),
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
  await page.getByText("Custom headings", { exact: true }).click();
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
  await page.getByRole("button", { name: "Add row", exact: true }).click();
  await page
    .getByLabel("Row 2 scaling operation", { exact: true })
    .selectOption("multiply");
  await page.getByRole("button", { name: "Remove row 2", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).document.transitions)
    .toEqual([]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByLabel("Row 2 scaling operation", { exact: true }),
  ).toHaveValue("multiply");
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
