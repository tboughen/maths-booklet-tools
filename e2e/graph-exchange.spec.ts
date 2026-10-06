import { test, expect } from "@playwright/test";
import {
  createGraph,
  editorLink,
} from "../packages/graph-core/src/interchange";
import { verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
import { getExportMetrics } from "../packages/graph-core/src/svg";
import { readFile } from "node:fs/promises";
const key = "maths-booklet-tools:graph-envelope:v1";
const original = createGraph({
  schemaVersion: 1,
  objects: [{ kind: "point", id: "old-point", position: { x: 2, y: 3 } }],
});
const incoming = createGraph({
  schemaVersion: 1,
  objects: [
    {
      kind: "line",
      id: "fraction",
      equation: { kind: "slope", slope: "1/2", intercept: -1 },
      equationVisible: true,
    },
    {
      kind: "line",
      id: "vertical",
      equation: { kind: "vertical", x: -2 },
      strokeStyle: "dashed",
    },
    { kind: "point", id: "new-point", position: { x: 1, y: 2 } },
  ],
});
async function seed(
  page: import("@playwright/test").Page,
  raw = JSON.stringify(original),
) {
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), {
    key,
    raw,
  });
}
test("link preview protects existing draft; open and undo are one history step", async ({
  page,
}) => {
  await seed(page);
  await page.goto(editorLink(incoming, "http://127.0.0.1:5179/"));
  const dialog = page.getByRole("dialog", { name: "Open this graph?" });
  await expect(dialog).toBeVisible();
  expect(
    JSON.parse(await page.evaluate((key) => localStorage.getItem(key)!, key))
      .document.objects,
  ).toEqual(original.document.objects);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(
    JSON.parse(await page.evaluate((key) => localStorage.getItem(key)!, key))
      .document.objects,
  ).toEqual(original.document.objects);
  await page.evaluate(
    (hash) => {
      location.hash = hash;
    },
    new URL(editorLink(incoming, "http://127.0.0.1:5179/")).hash,
  );
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Open this graph", exact: true })
    .click();
  await expect(page.locator(".graph-canvas")).toHaveAttribute(
    "data-style-profile",
    "portable-v1",
  );
  await expect
    .poll(
      async () =>
        JSON.parse(
          await page.evaluate((key) => localStorage.getItem(key)!, key),
        ).document.objects.length,
    )
    .toBe(3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(
          await page.evaluate((key) => localStorage.getItem(key)!, key),
        ).document.objects,
    )
    .toEqual(original.document.objects);
});
test("file import, self-contained SVG and 600ppi PNG work in a real browser", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Download options" }).click();
  await page.getByLabel("Open editable graph file").setInputFiles({
    name: "graph.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(incoming)),
  });
  await page
    .getByRole("button", { name: "Open this graph", exact: true })
    .click();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      document.fonts.check("12px 'STIX Two Math'", "𝑥𝑦"),
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("portable-editor.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Download options" }).click();
  const svgDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /SVG/ }).click();
  const svgFile = await svgDownload,
    svg = await readFile((await svgFile.path())!, "utf8");
  expect(svg).toContain("data:font/otf;base64,");
  expect(svg).toContain("𝑥");
  // Verify the downloaded embedded-font SVG also renders independently.
  const check = await page.context().newPage();
  await check.route("http://graph-preview.test/portable.svg", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await check.goto("http://graph-preview.test/portable.svg");
  await expect(check.locator("parsererror")).toHaveCount(0);
  await check.screenshot({ path: testInfo.outputPath("portable-svg.png") });
  await check.close();
  await page.getByRole("button", { name: "Download options" }).click();
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: /PNG/ }).click();
  const png = await readFile((await (await pngDownload).path())!);
  await (await pngDownload).saveAs(testInfo.outputPath("browser-print.png"));
  const metrics = getExportMetrics(incoming.document);
  verifyPrintBytes(
    png,
    Math.round((metrics.widthCm / 2.54) * 600),
    Math.round((metrics.heightCm / 2.54) * 600),
  );
});
test("human creation works without a service and the bank ignores graph fragments", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Line by equation", exact: true })
    .click();
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await expect(page.locator(".graph-straight")).toHaveCount(1);
  await expect(page.locator(".graph-canvas")).toHaveAttribute(
    "data-style-profile",
    "legacy",
  );
  const bank = new URL(editorLink(incoming, "http://127.0.0.1:5179/"));
  bank.search = "?tool=question-bank";
  await page.goto(bank.href);
  await expect(page.locator(".qb-brand")).toContainText("Question bank");
  await expect(
    page.getByRole("dialog", { name: "Open this graph?" }),
  ).toHaveCount(0);
  expect(requests.every((url) => new URL(url).hostname === "127.0.0.1")).toBe(
    true,
  );
});
test("unreadable saved data is retained and requires recovery before linked import", async ({
  page,
}) => {
  await seed(page, "{broken");
  await page.goto(editorLink(incoming, "http://127.0.0.1:5179/"));
  await expect(
    page.getByRole("dialog", { name: "Review local graph recovery" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Open this graph?" }),
  ).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    "{broken",
  );
  await page
    .getByRole("button", { name: "Keep recovery copy and continue" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Open this graph?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith(key + ":recovery:"))
          .map((k) => localStorage.getItem(k)),
      key,
    ),
  ).toEqual(["{broken"]);
});
test("invalid files and mobile import never replace the current graph", async ({
  page,
}, testInfo) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Download options" }).click();
  await page.getByLabel("Open editable graph file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"schemaVersion":99,"html":"<script>alert(1)</script>"}',
    ),
  });
  await expect(page.getByRole("status")).toContainText(
    "Graph could not be opened",
  );
  expect(
    JSON.parse(await page.evaluate((key) => localStorage.getItem(key)!, key))
      .document.objects,
  ).toEqual(original.document.objects);
  await page.getByLabel("Open editable graph file").setInputFiles({
    name: "good.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(incoming)),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("mobile-import.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});
