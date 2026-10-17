import { showExamples, closeExamples } from "./example-gallery";
import { test, expect, editorBase, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import { cloneDefaultDocument } from "../packages/graph-core/src/diagram";
import { createEnvelope } from "../packages/graph-core/src/interchange";
import {
  verifyPrintBytes,
  printRasterSize,
} from "../packages/graph-core/src/png-bytes";
import {
  parseFile as parseVenn,
  canonical as canonicalVenn,
} from "../packages/venn-core/src";
import { parseVennLink } from "../src/venn/links";
import { quadraticSources } from "../src/value-graph/examples";

test("all five quadratic source links open the matching published question without replacing the resource", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto("/?tool=value-table-graph");
  const original = await download(page, "Save editable file");
  await showExamples(page);
  for (const example of quadraticSources) {
    const card = page.getByRole("article", {
      name: example.source,
      exact: true,
    });
    const event = page.context().waitForEvent("page");
    await card
      .getByRole("link", { name: "View source question", exact: true })
      .click();
    const source = await event;
    await source.waitForLoadState("domcontentloaded");
    await expect(source).toHaveURL(new RegExp(`question=${example.id}`));
    await expect(source.locator(".qb-source-heading strong")).toBeVisible();
    await expect(source.locator(".qb-canvas-host canvas")).toBeVisible();
    await source.screenshot({
      path: info.outputPath(example.id + ".png"),
      fullPage: true,
    });
    await source.close();
  }
  await closeExamples(page);
  expect(await download(page, "Save editable file")).toEqual(original);
});

test("touch controls and a reduced visual viewport retain usable Graph actions", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 375, height: 900 },
    }),
    page = await context.newPage();
  await page.goto(editorBase() + "?tool=graph");
  const button = page.getByRole("button", {
    name: "Add one square at the positive end of the y-axis",
    exact: true,
  });
  await button.scrollIntoViewIfNeeded();
  const b = await button.boundingBox();
  await page.touchscreen.tap(b!.x + b!.width / 2, b!.y + b!.height / 2);
  const saved = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  );
  expect(saved.document.axes.y.positiveSquares).toBe(6);
  await page.setViewportSize({ width: 375, height: 400 });
  await openMenu(page);
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
  await expect(page.getByRole("menu")).toBeVisible();
  const measure = () =>
    page.getByRole("menu").evaluate((menu) => {
      const b = menu.getBoundingClientRect(),
        v = visualViewport!;
      return {
        inside:
          b.x >= v.offsetLeft &&
          b.right <= v.offsetLeft + v.width &&
          b.y >= v.offsetTop &&
          b.bottom <= v.offsetTop + v.height,
        viewport: { width: v.width, height: v.height, scale: v.scale },
        rectangle: { x: b.x, y: b.y, right: b.right, bottom: b.bottom },
      };
    });
  await expect.poll(async () => (await measure()).inside).toBe(true);
  const proof = await measure();
  await info.attach("visual-viewport.json", {
    body: JSON.stringify(proof),
    contentType: "application/json",
  });
  await page.screenshot({
    path: info.outputPath("touch-reduced-viewport.png"),
    fullPage: true,
  });
  await context.close();
});

const tools = [
  "graph",
  "ratio-table",
  "value-table-graph",
  "cuboids",
  "number-line",
  "venn",
];
async function openMenu(page: Page) {
  const trigger = page.getByRole("button", {
    name: "File",
    exact: true,
  });
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
}
async function download(page: Page, label: string) {
  await openMenu(page);
  const event = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  const file = await event;
  const bytes = await readFile((await file.path())!);
  await expect(page.getByRole("menu")).toHaveCount(0);
  return bytes;
}
async function pixelHash(page: Page, uri: string) {
  return page.evaluate(async (src) => {
    const i = new Image();
    i.src = src;
    await i.decode();
    const c = document.createElement("canvas");
    c.width = i.width;
    c.height = i.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(i, 0, 0);
    const hash = await crypto.subtle.digest(
      "SHA-256",
      ctx.getImageData(0, 0, c.width, c.height).data,
    );
    return {
      width: c.width,
      height: c.height,
      hash: Array.from(new Uint8Array(hash)).join(","),
    };
  }, uri);
}
async function clipboard(page: Page, type: "image/png" | "text/html") {
  return page.evaluate(async (type) => {
    const items = await navigator.clipboard.read();
    const item = items.find((i) => i.types.includes(type));
    if (!item) throw Error("Expected clipboard type " + type);
    const blob = await item.getType(type);
    if (type === "text/html") return blob.text();
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }, type);
}

for (const tool of tools) {
  test(`${tool}: one bounded keyboard menu with predictable dismissal`, async ({
    page,
  }, info) => {
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?tool=${tool}`);
      const trigger = page.getByRole("button", {
        name: "File",
        exact: true,
      });
      await trigger.focus();
      await trigger.press("ArrowDown");
      const menu = page.getByRole("menu");
      await expect(menu).toHaveCount(1);
      const labels = await menu
        .getByRole("menuitem")
        .evaluateAll((items) =>
          items.map((i) => i.querySelector("strong")!.textContent),
        );
      expect(labels.slice(0, 5)).toEqual([
        "Download SVG",
        "Download PNG (600 ppi)",
        "Save editable file",
        "Open editable file",
        "Copy editable link",
      ]);
      await expect(menu.getByRole("menuitem").first()).toBeFocused();
      await page.keyboard.press("End");
      await expect(menu.getByRole("menuitem").last()).toBeFocused();
      await page.keyboard.press("Home");
      await expect(menu.getByRole("menuitem").first()).toBeFocused();
      await page.keyboard.press("ArrowUp");
      await expect(menu.getByRole("menuitem").last()).toBeFocused();
      const box = await menu.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(900);
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.press("ArrowUp");
      await expect(menu.getByRole("menuitem").last()).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(menu).toHaveCount(0);
      await expect(trigger).not.toBeFocused();
      await openMenu(page);
      await page.getByRole("heading", { level: 1 }).click();
      await expect(menu).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      if (width === 320)
        await page.screenshot({
          path: info.outputPath("mobile.png"),
          fullPage: true,
        });
    }
  });
  test(`${tool}: real files, both clipboard routes and editable round trip agree`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/?tool=${tool}`);
    const initial = await download(page, "Save editable file"),
      svg = await download(page, "Download SVG"),
      png = await download(page, "Download PNG (600 ppi)");
    await info.attach("resource.svg", {
      body: svg,
      contentType: "image/svg+xml",
    });
    await info.attach("resource.png", { body: png, contentType: "image/png" });
    await info.attach("resource.json", {
      body: initial,
      contentType: "application/json",
    });
    const dimensions = await page.evaluate((text) => {
      const e = new DOMParser().parseFromString(
        text,
        "image/svg+xml",
      ).documentElement;
      const cm = (key: string) => {
        const s = e.getAttribute(key)!;
        return parseFloat(s) / (s.endsWith("mm") ? 10 : 1);
      };
      return { width: cm("width"), height: cm("height") };
    }, svg.toString());
    const size = printRasterSize(dimensions.width, dimensions.height);
    verifyPrintBytes(png, size.width, size.height);
    await expect(
      page.locator(".site-page:not([hidden]) .resource-size"),
    ).toHaveText(
      `Actual export size: ${dimensions.width.toFixed(2)} × ${dimensions.height.toFixed(2)} cm`,
    );
    const expected = await pixelHash(
      page,
      "data:image/png;base64," + png.toString("base64"),
    );
    await page.getByRole("button", { name: "Copy image", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Copy image", exact: true }),
    ).toBeEnabled();
    const image = await clipboard(page, "image/png");
    expect(await pixelHash(page, image)).toEqual(expected);
    await page
      .getByRole("button", { name: "Copy for Word", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Copy for Word", exact: true }),
    ).toBeEnabled();
    const html = await clipboard(page, "text/html");
    const word = await page.evaluate((source) => {
      const e = new DOMParser()
        .parseFromString(source, "text/html")
        .querySelector("img")!;
      return {
        src: e.getAttribute("src")!,
        width: parseFloat(e.style.width || e.getAttribute("width")!),
        height: parseFloat(e.style.height || e.getAttribute("height")!),
      };
    }, html);
    expect(word.width).toBe(dimensions.width);
    expect(word.height).toBe(dimensions.height);
    expect(await pixelHash(page, word.src)).toEqual(expected);
    const styles = await page
      .getByRole("button", { name: "Copy image", exact: true })
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { size: s.fontSize, weight: s.fontWeight };
      });
    expect(styles).toEqual({ size: "14px", weight: "650" });
    await page
      .locator('.site-page:not([hidden]) input[type="file"]')
      .setInputFiles({
        name: "resource.json",
        mimeType: "application/json",
        buffer: initial,
      });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    expect(await download(page, "Save editable file")).toEqual(initial);
    await page
      .locator('.site-page:not([hidden]) input[type="file"]')
      .setInputFiles({
        name: "resource.json",
        mimeType: "application/json",
        buffer: initial,
      });
    await page.getByRole("dialog").getByRole("button").last().click();
    expect(await download(page, "Save editable file")).toEqual(initial);
    await page.getByRole("link", { name: "All tools", exact: true }).click();
    await page.goBack();
    expect(await download(page, "Save editable file")).toEqual(initial);
    await page.reload();
    expect(await download(page, "Save editable file")).toEqual(initial);
  });
}

test("Graph rejects stale exports and retains invalid equation/coordinate drafts across navigation", async ({
  page,
}) => {
  await page.goto("/?tool=graph");
  await page
    .getByRole("button", { name: "Line by equation", exact: true })
    .click();
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  const original = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  );
  await page
    .getByRole("button", { name: "Edit equation", exact: true })
    .click();
  await page.getByRole("button", { name: "Use m and c", exact: true }).click();
  await openMenu(page);
  const gradient = page.getByRole("textbox", {
    name: "Gradient m",
    exact: true,
  });
  await gradient.fill("1/0");
  await gradient.press("Enter");
  await expect(gradient).toHaveValue("1/0");
  await expect(gradient).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("menuitem", { name: "Download SVG", exact: true }),
  ).toBeDisabled();
  await page.getByRole("heading", { level: 1 }).click();
  for (const name of [
    "Copy image",
    "Copy for Word",
    "File",
    "Undo",
    "Redo",
    "Reset diagram",
  ])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await page.getByRole("link", { name: "Ratio tables", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Graph tool", exact: true }).click();
  await expect(gradient).toHaveValue("1/0");
  await gradient.press("Escape");
  expect(
    JSON.parse((await download(page, "Save editable file")).toString())
      .document,
  ).toEqual(original.document);
  const x = page.getByRole("textbox", { name: "Start x", exact: true });
  const before = await x.inputValue();
  await x.fill("1/0");
  await x.press("Tab");
  await expect(x).toHaveValue("1/0");
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await x.press("Escape");
  await expect(x).toHaveValue(before);
  await x.fill("-3/2");
  await x.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(x).toHaveValue(before);
  expect(
    JSON.parse((await download(page, "Save editable file")).toString())
      .document,
  ).toEqual(original.document);
  await x.fill("-3/2");
  await x.press("Enter");
  await expect(x).toHaveValue("−3/2");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    JSON.parse((await download(page, "Save editable file")).toString())
      .document,
  ).toEqual(original.document);
});

test("Graph range controls remain outside the entire white resource and 48 px at every viewport and zoom", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const normal = cloneDefaultDocument(),
    boundary = cloneDefaultDocument(),
    maximum = cloneDefaultDocument();
  boundary.axes.x.negativeSquares = 0;
  boundary.axes.y.negativeSquares = 0;
  boundary.axes.x.positiveSquares = 2;
  boundary.axes.y.positiveSquares = 2;
  maximum.axes.x.negativeSquares = 9;
  maximum.axes.x.positiveSquares = 9;
  maximum.axes.y.negativeSquares = 13;
  maximum.axes.y.positiveSquares = 13;
  maximum.axes.x.unitsPerSquare = 0.5;
  maximum.axes.y.unitsPerSquare = 2;
  for (const [index, document] of [normal, boundary, maximum].entries())
    for (const width of [1440, 1024, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/?tool=graph");
      await page.evaluate((doc) => {
        localStorage.clear();
        localStorage.setItem(
          "maths-booklet-tools:graph-1cm:v1",
          JSON.stringify(doc),
        );
      }, document);
      await page.reload();
      for (const zoom of ["0", "0.75", "1", "1.25", "1.5"]) {
        await page
          .getByRole("combobox", { name: "Preview zoom", exact: true })
          .selectOption(zoom);
        const boxes = await page.locator(".graph-board").evaluate((board) => {
          const paper = board
            .querySelector(".canvas-paper")!
            .getBoundingClientRect();
          return [...board.querySelectorAll(".graph-axis-controls button")].map(
            (e) => {
              const b = e.getBoundingClientRect();
              return {
                width: b.width,
                height: b.height,
                outside:
                  b.right <= paper.left ||
                  b.left >= paper.right ||
                  b.bottom <= paper.top ||
                  b.top >= paper.bottom,
                left: b.left,
                right: b.right,
                top: b.top,
                bottom: b.bottom,
              };
            },
          );
        });
        expect(boxes).toHaveLength(8);
        expect(
          boxes.every((b) => b.width === 48 && b.height === 48 && b.outside),
        ).toBe(true);
        expect(
          boxes.some((a, i) =>
            boxes
              .slice(i + 1)
              .some(
                (b) =>
                  a.left < b.right &&
                  a.right > b.left &&
                  a.top < b.bottom &&
                  a.bottom > b.top,
              ),
          ),
        ).toBe(false);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
      if (width === 320 || width === 1440)
        await page.screenshot({
          path: info.outputPath(`graph-${index}-${width}.png`),
          fullPage: true,
        });
    }
});

test("Graph precise ranges validate supported steps and pointer mapping survives zoom and scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/?tool=graph");
  await page.getByText("Precise axis ranges", { exact: true }).click();
  const minimum = page.getByRole("textbox", { name: "x minimum", exact: true });
  await minimum.fill("-3/2");
  await minimum.press("Enter");
  await expect(minimum).toHaveAttribute("aria-invalid", "true");
  await minimum.press("Escape");
  await minimum.fill("-6");
  await minimum.press("Enter");
  await expect(minimum).toHaveValue("-6");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(minimum).toHaveValue("-5");
  await page
    .getByRole("combobox", { name: "Preview zoom", exact: true })
    .selectOption("1.5");
  await page.getByRole("button", { name: "Point", exact: true }).click();
  await page.locator(".graph-stage").evaluate((el) => {
    el.scrollLeft = 300;
    el.scrollTop = 200;
  });
  await page.locator(".graph-stage").scrollIntoViewIfNeeded();
  await page.locator(".graph-stage").evaluate((stage) => {
    const e = stage.querySelector("svg")!,
      x = e.querySelector(".graph-axes line:nth-child(1)")!,
      y = e.querySelector(".graph-axes line:nth-child(2)")!,
      plot = e.querySelector("#editor-plot-clip rect")!;
    const square = Number(plot.getAttribute("width")) / 10;
    const target = new DOMPoint(
      Number(y.getAttribute("x1")) + 2 * square,
      Number(x.getAttribute("y1")) - square,
    ).matrixTransform(e.getScreenCTM()!);
    const box = stage.getBoundingClientRect();
    stage.scrollLeft += target.x - box.left - stage.clientWidth / 2;
    stage.scrollTop += target.y - box.top - stage.clientHeight / 2;
  });
  const point = await page.locator(".graph-canvas").evaluate((svg) => {
    const e = svg as SVGSVGElement,
      x = e.querySelector(".graph-axes line:nth-child(1)")!,
      y = e.querySelector(".graph-axes line:nth-child(2)")!,
      plot = e.querySelector("#editor-plot-clip rect")!,
      matrix = e.getScreenCTM()!;
    const square = Number(plot.getAttribute("width")) / 10;
    const p = new DOMPoint(
      Number(y.getAttribute("x1")) + 2 * square,
      Number(x.getAttribute("y1")) - square,
    ).matrixTransform(matrix);
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(point.x, point.y);
  const saved = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  );
  expect(saved.document.objects).toHaveLength(1);
  expect(saved.document.objects[0].position).toEqual({ x: 2, y: 1 });
});

test("Venn editable links preserve reverse nesting, Unicode and pupil state despite answer preview", async ({
  page,
  browser,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const e = parseVenn(
    await readFile(
      "docs/venn-layout-examples/reverse-nested-scaffold.json",
      "utf8",
    ),
  );
  e.document.labels[1].text = "Ω";
  const canonical = canonicalVenn(e);
  await page.goto("/?tool=venn");
  await page.evaluate(
    (text) => localStorage.setItem("maths-booklet-tools:venn:v1", text),
    canonical,
  );
  await page.reload();
  await page
    .getByRole("checkbox", { name: "Show saved answers", exact: true })
    .check();
  await openMenu(page);
  await page.getByRole("menuitem", { name: /^Copy editable link/ }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(canonicalVenn(parseVennLink(link))).toBe(canonical);
  const freshContext = await browser.newContext();
  const fresh = await freshContext.newPage();
  await fresh.goto(link);
  await expect(fresh.getByRole("dialog")).toBeVisible();
  await expect(
    fresh.getByRole("button", { name: "Overlap", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await fresh
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(fresh).not.toHaveURL(/#venn=/);
  await fresh.goto(link);
  await fresh
    .getByRole("dialog")
    .getByRole("button", { name: "Use this diagram", exact: true })
    .click();
  await expect(
    fresh.getByRole("checkbox", { name: "Show saved answers", exact: true }),
  ).not.toBeChecked();
  expect(
    canonicalVenn(
      parseVenn((await download(fresh, "Save editable file")).toString()),
    ),
  ).toBe(canonical);
  await fresh.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    fresh.getByRole("button", { name: "Overlap", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await fresh.goto(editorBase() + "?tool=venn#venn=bad!");
  await expect(fresh.locator(".resource-feedback")).toContainText(
    "supported editable Venn link",
  );
  await freshContext.close();
});

test("new Graph documents are portable and an old legacy document keeps its font and size", async ({
  page,
}, info) => {
  await page.goto("/?tool=graph");
  await expect(page.locator(".graph-canvas")).toHaveAttribute(
    "data-style-profile",
    "portable-v1",
  );
  const portable = await download(page, "Download SVG");
  expect(portable.toString()).toContain("data:font/otf;base64,");
  const old = createEnvelope(cloneDefaultDocument());
  await page.locator('input[type="file"]').setInputFiles({
    name: "old.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Open this graph", exact: true })
    .click();
  await expect(page.locator(".graph-canvas")).toHaveAttribute(
    "data-style-profile",
    "legacy",
  );
  const legacy = await download(page, "Download SVG");
  expect(legacy.toString()).toContain('width="11.24cm"');
  expect(legacy.toString()).toContain("Cambria Math");
  expect(legacy.toString()).not.toContain("data:font/otf;base64,");
  await info.attach("old-legacy.svg", {
    body: legacy,
    contentType: "image/svg+xml",
  });
  await page.getByText("Print settings", { exact: true }).click();
  await page
    .getByRole("button", { name: "Use portable graph font", exact: true })
    .click();
  await expect(page.locator(".graph-canvas")).toHaveAttribute(
    "data-style-profile",
    "portable-v1",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".graph-canvas")).toHaveAttribute(
    "data-style-profile",
    "legacy",
  );
});

test("quadratic source cards keep scaffolds and intentional errors, and worked versions replace with Undo", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto("/?tool=value-table-graph");
  await showExamples(page);
  for (const example of quadraticSources) {
    const card = page.getByRole("article", {
      name: example.source,
      exact: true,
    });
    await expect(
      card.getByRole("link", { name: "View source question", exact: true }),
    ).toHaveAttribute(
      "href",
      `https://mathsdock.co.uk/?tool=question-bank&question=${example.id}`,
    );
    await expect(card.getByRole("link")).toHaveAttribute("target", "_blank");
    await card
      .getByRole("button", {
        name: "Open scaffold",
        exact: true,
      })
      .click();
    await page.getByRole("dialog").getByRole("button").last().click();
    const saved = await download(page, "Save editable file");
    const document = JSON.parse(saved.toString()).document;
    if (example.name === "November 2017 error")
      expect(document.graph.series[0].connection).toBe("straight-joins");
    else
      expect(
        document.columns.some(
          (c: { y: { kind: string } }) => c.y.kind === "blank",
        ),
      ).toBe(true);
    await showExamples(page);
    await card
      .getByRole("button", {
        name: "Use worked version",
        exact: true,
      })
      .click();

    const result = JSON.parse(
      (await download(page, "Save editable file")).toString(),
    ).document;
    expect(
      result.columns.every(
        (c: { y: { kind: string } }) => c.y.kind === "value",
      ),
    ).toBe(true);
    expect(result.graph.series[0].connection).toBe("none");
    expect(result.graph.curves).toHaveLength(1);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(await download(page, "Save editable file")).toEqual(saved);
    await showExamples(page);
  }
  await page.screenshot({
    path: info.outputPath("source-cards.png"),
    fullPage: true,
  });
});

test("Graph protects a newer tab's draft until its original bytes are backed up", async ({
  page,
}) => {
  await page.goto("/?tool=graph");
  await expect(
    page.getByText("Saved on this device", { exact: true }).first(),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("maths-booklet-tools:graph-envelope:v1"),
      ),
    )
    .not.toBeNull();
  const other = await page.context().newPage();
  await other.goto(editorBase() + "?tool=graph");
  await other
    .getByRole("button", {
      name: "Add one square at the positive end of the x-axis",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "Review local graph recovery",
      exact: true,
    }),
  ).toBeVisible();
  const newer = await other.evaluate(() =>
    localStorage.getItem("maths-booklet-tools:graph-envelope:v1"),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "Keep recovery copy and continue",
      exact: true,
    })
    .click();
  const retained = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([key]) =>
        key.startsWith("maths-booklet-tools:graph-envelope:v1:recovery:"),
      )
      .map(([, value]) => value),
  );
  expect(retained).toContain(newer);
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeEnabled();
  await other.close();
});

test("failed copy/link operations keep a useful fallback and valid-file saving survives storage refusal", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?tool=venn");
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () =>
        Promise.reject(
          new DOMException(
            "Copying links was blocked. Save an editable file instead.",
            "NotAllowedError",
          ),
        ),
    }),
  );
  await openMenu(page);
  await page.getByRole("menuitem", { name: /^Copy editable link/ }).click();
  await expect(page.locator(".resource-feedback")).toContainText(
    "Save an editable file",
  );
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: /^Copy editable link/ }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await page.goto("/?tool=graph");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "maths-booklet-tools:graph-envelope:v1")
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page
    .getByRole("button", {
      name: "Add one square at the positive end of the x-axis",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Not saved on device", { exact: true }).first(),
  ).toBeVisible();
  const bytes = await download(page, "Save editable file");
  expect(JSON.parse(bytes.toString()).document.axes.x.positiveSquares).toBe(6);
});

test("a missing portable font blocks the real SVG and leaves editable-file fallback available", async ({
  page,
}) => {
  await page.route(/STIXTwoMath-Regular.*\.otf/, (route) => route.abort());
  const downloads: string[] = [];
  page.on("download", (file) => downloads.push(file.suggestedFilename()));
  await page.goto("/?tool=graph");
  await openMenu(page);
  await page
    .getByRole("menuitem", { name: "Download SVG", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(/fetch|font|network/i);
  await expect(page.getByRole("menu")).toBeVisible();
  expect(downloads).toEqual([]);
  expect(
    JSON.parse((await download(page, "Save editable file")).toString())
      .styleProfile,
  ).toBe("portable-v1");
});

test("busy link copying prevents duplicate requests and late completion cannot steal another editor's focus", async ({
  page,
}) => {
  await page.goto("/?tool=venn");
  await page.evaluate(() => {
    const state = window as typeof window & {
      finishLinkCopy?: () => void;
      linkCopies?: number;
    };
    state.linkCopies = 0;
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () => {
        state.linkCopies!++;
        return new Promise<void>((resolve) => {
          state.finishLinkCopy = resolve;
        });
      },
    });
  });
  await openMenu(page);
  const action = page.getByRole("menuitem", { name: /^Copy editable link/ });
  await action.click();
  await expect(action).toBeDisabled();
  expect(
    await page.evaluate(
      () => (window as typeof window & { linkCopies: number }).linkCopies,
    ),
  ).toBe(1);
  await page.getByRole("link", { name: "Ratio tables", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  const focus = page.getByRole("button", {
    name: "Copy image",
    exact: true,
  });
  await focus.focus();
  await page.evaluate(() =>
    (window as typeof window & { finishLinkCopy: () => void }).finishLinkCopy(),
  );
  await expect(focus).toBeFocused();
  await expect(focus).toBeEnabled();
});

test("Graph point, segment endpoints and equation labels still drag accurately after zoom, scroll and resize", async ({
  page,
}) => {
  const document = cloneDefaultDocument();
  document.styleProfile = "portable-v1";
  document.objects = [{ id: "point", kind: "point", position: { x: 2, y: 1 } }];
  await page.addInitScript(
    (value) =>
      localStorage.setItem("maths-booklet-tools:graph-envelope:v1", value),
    JSON.stringify(createEnvelope(document)),
  );
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/?tool=graph");
  await page
    .getByRole("combobox", { name: "Preview zoom", exact: true })
    .selectOption("1.5");
  async function screen(x: number, y: number) {
    return page.locator(".graph-canvas").evaluate(
      (svg, [x, y]) => {
        const e = svg as SVGSVGElement,
          a = e.querySelector(".graph-axes line:nth-child(1)")!,
          b = e.querySelector(".graph-axes line:nth-child(2)")!,
          plot = e.querySelector("#editor-plot-clip rect")!;
        const square = Number(plot.getAttribute("width")) / 10,
          p = new DOMPoint(
            Number(b.getAttribute("x1")) + x * square,
            Number(a.getAttribute("y1")) - y * square,
          ).matrixTransform(e.getScreenCTM()!);
        return { x: p.x, y: p.y };
      },
      [x, y],
    );
  }
  async function centre(x: number, y: number) {
    await page.locator(".graph-stage").scrollIntoViewIfNeeded();
    const p = await screen(x, y);
    await page.locator(".graph-stage").evaluate((stage, p) => {
      const box = stage.getBoundingClientRect();
      stage.scrollLeft += p.x - box.left - stage.clientWidth / 2;
      stage.scrollTop += p.y - box.top - stage.clientHeight / 2;
    }, p);
  }
  async function drag(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  }
  await centre(2.5, 1.5);
  await drag(await screen(2, 1), await screen(3, 2));
  let saved = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  ).document;
  expect(saved.objects[0].position).toEqual({ x: 3, y: 2 });
  await page.getByRole("button", { name: "Segment", exact: true }).click();
  await centre(-1.5, 1.5);
  await drag(await screen(-2, 1), await screen(-1, 2));
  saved = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  ).document;
  expect(saved.objects[1]).toMatchObject({
    start: { x: -2, y: 1 },
    end: { x: -1, y: 2 },
  });
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await centre(-2, 1.5);
  const handle = await page
    .locator(".selection-handles circle")
    .first()
    .boundingBox();
  await drag(
    { x: handle!.x + handle!.width / 2, y: handle!.y + handle!.height / 2 },
    await screen(-3, 1),
  );
  saved = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  ).document;
  expect(saved.objects[1].start).toEqual({ x: -3, y: 1 });
  await page
    .getByRole("button", { name: "Show equation", exact: true })
    .click();
  await page.setViewportSize({ width: 768, height: 1000 });
  await page
    .getByRole("combobox", { name: "Preview zoom", exact: true })
    .selectOption("0.75");
  await centre(-1, 2);
  const text = page.locator(".equation-labels text");
  await text.scrollIntoViewIfNeeded();
  const box = await text.boundingBox();
  await drag(
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    await screen(0, 2),
  );
  saved = JSON.parse(
    (await download(page, "Save editable file")).toString(),
  ).document;
  expect(saved.objects[1].equationLabelPosition.x).toBeCloseTo(0, 1);
  expect(saved.objects[1].equationLabelPosition.y).toBeCloseTo(2, 1);
});
