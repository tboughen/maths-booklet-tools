import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import {
  canonical,
  addTriangle,
  addHeight,
  caption,
  create,
  layout,
  parseFile,
  validate,
  type Envelope,
} from "../packages/triangle-core/src";
import {
  example,
  examples,
  sourceExamples,
} from "../packages/triangle-core/src/examples";
import {
  verifyPrintBytes,
  printRasterSize,
} from "../packages/graph-core/src/png-bytes";
import { triangleEditorLink } from "../src/triangle/links";
import { clickResourceAction, openResourceMenu } from "./resource-actions";
const report = resolve(
    process.env.TRIANGLE_REPORT_DIR || "test-results/triangle-artifacts",
  ),
  key = "maths-booklet-tools:triangle:v1",
  staging = join(tmpdir(), "mathsdock-triangle-imports");
const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});
mkdirSync(report, { recursive: true });
mkdirSync(staging, { recursive: true });
async function boot(page: Page, e: Envelope | string = create()) {
  await page.addInitScript(
    ([key, raw]) => {
      if (!sessionStorage.getItem("triangle-test-booted")) {
        localStorage.setItem(key, raw);
        sessionStorage.setItem("triangle-test-booted", "1");
      }
    },
    [key, typeof e === "string" ? e : canonical(e)],
  );
  await page.goto("/?tool=triangle");
  await expect(
    page.getByRole("heading", { name: "Triangles", exact: true }),
  ).toBeVisible();
}
async function saved(page: Page) {
  return page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  ) as Promise<Envelope>;
}
async function download(page: Page, action: string) {
  await openResourceMenu(page);
  const event = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: action, exact: true }).click();
  const d = await event;
  expect(await d.failure()).toBe(null);
  const p = await d.path();
  expect(p).toBeTruthy();
  const bytes = readFileSync(p!);
  await expect(page.getByRole("menu")).toHaveCount(0);
  return bytes;
}
async function edit(page: Page, ref: string, text: string, state?: string) {
  await page.locator(`[data-tr-anchor="${ref}"]`).click();
  await page
    .getByRole("textbox", {
      name: ref.startsWith("v:") ? "Vertex name" : "Label text",
      exact: true,
    })
    .fill(text);
  if (state)
    await page
      .getByRole("combobox", { name: "Printed state", exact: true })
      .selectOption(state);
  await page.getByRole("button", { name: "Apply label", exact: true }).click();
  await expect(page.locator(".tr-floating")).toHaveCount(0);
}
async function section(page: Page, title: string) {
  if (["Calculate a value", "Construct from measurements"].includes(title))
    await section(page, "More tools");
  const item = page.locator(
    `details.tr-section:has(> summary:text-is("${title}"))`,
  );
  if ((await item.getAttribute("open")) === null)
    await item.locator("summary").first().click();
  return item;
}
async function loadExample(page: Page, title: string) {
  const panel = await section(page, "Examples");
  const card = panel
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await card.getByRole("button", { name: "Use scaffold", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Use this diagram", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function pixels(page: Page, src: string) {
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data,
      hash = await crypto.subtle.digest("SHA-256", data);
    return {
      width: c.width,
      height: c.height,
      hash: Array.from(new Uint8Array(hash)).join(","),
    };
  }, src);
}

test("direct edits, symbols, valid blur, cancel, history and reload", async ({
  page,
}) => {
  await boot(page);
  await edit(page, "e:AB", "6");
  await edit(page, "e:AC", "8");
  await edit(page, "e:BC", "x", "symbol");
  const original = canonical(await saved(page));
  await page.locator('[data-tr-anchor="e:AB"]').click();
  await page.getByLabel("Label text", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Cancel label", exact: true }).click();
  expect(canonical(await saved(page))).toBe(original);
  await page.locator('[data-tr-anchor="e:AB"]').click();
  await page.getByLabel("Label text", { exact: true }).fill("9");
  await page.getByLabel("Preview zoom").focus();
  await expect(page.locator(".tr-floating")).toHaveCount(0);
  expect(
    (await saved(page)).document.edges.find((e) => e.id === "AB")!.label.text,
  ).toBe("9");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(canonical(await saved(page))).toBe(original);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.reload();
  await expect(
    page.locator('.tr-art [data-triangle-label="e:AB"]'),
  ).toContainText("9 cm");
});
test("invalid draft stays available, guards actions, and is inert while another tool is active", async ({
  page,
}) => {
  await boot(page);
  await page.locator('[data-tr-anchor="e:AB"]').click();
  await page.getByLabel("Label text", { exact: true }).fill("1/0");
  await page.getByRole("button", { name: "Apply label", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/zero/);
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Download options", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Graph tool", exact: true }).click();
  await expect(page.locator(".tr-floating")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Triangles", exact: true }).click();
  await expect(page.getByLabel("Label text", { exact: true })).toHaveValue(
    "1/0",
  );
  await page.getByRole("button", { name: "Cancel label", exact: true }).click();
  expect((await saved(page)).document.edges[0].label.state).toBe("blank");
});
for (const ex of examples)
  test(`${ex.key}: real SVG/PNG/editable downloads and file reopening`, async ({
    page,
  }) => {
    await boot(page, ex.build());
    const expected = canonical(ex.build()),
      m = layout(ex.build());
    const json = await download(page, "Save editable file"),
      svg = await download(page, "Download SVG"),
      png = await download(page, "Download PNG (600 ppi)");
    expect(canonical(parseFile(json.toString()))).toBe(expected);
    expect(svg.toString()).toContain("data:font/otf;base64,");
    expect(svg.toString()).not.toMatch(/<button|data-tr-anchor|<image/);
    verifyPrintBytes(
      png,
      printRasterSize(m.width / 10, m.height / 10).width,
      printRasterSize(m.width / 10, m.height / 10).height,
    );
    writeFileSync(join(report, `${ex.key}.json`), json);
    writeFileSync(join(report, `${ex.key}.svg`), svg);
    writeFileSync(join(report, `${ex.key}.png`), png);
    if (ex.build().document.vertices.length > 3)
      expect((await saved(page)).document.vertices).toHaveLength(
        ex.build().document.vertices.length,
      );
    const path = join(staging, `${ex.key}.json`);
    writeFileSync(path, json);
    await page
      .getByRole("combobox", { name: "Selected object", exact: true })
      .selectOption("t:T1");
    await page
      .getByRole("button", { name: "Rotate right", exact: true })
      .click();
    const event = page.waitForEvent("filechooser");
    await clickResourceAction(page, "Open editable file");
    await (await event).setFiles(path);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("button", { name: "Use this diagram", exact: true })
      .click();
    expect(canonical(await saved(page))).toBe(expected);
  });
test("all ten example cards preserve declared scaffolds and production source URLs", async ({
  page,
}) => {
  await boot(page);
  for (const ex of sourceExamples) {
    await loadExample(page, ex.title);
    expect(canonical(await saved(page))).toBe(canonical(ex.build()));
    const card = page.locator("article.tr-example").filter({
      has: page.getByRole("heading", { name: ex.title, exact: true }),
    });
    await expect(card.getByRole("link")).toHaveAttribute(
      "href",
      `https://mathsdock.co.uk/?tool=question-bank&question=${ex.sourceId}`,
    );
  }
});
test("worked copy opens independent storage and never changes the pupil scaffold", async ({
  page,
  context,
}) => {
  await boot(page, example("right-trig"));
  const original = canonical(await saved(page));
  await page.getByLabel("Show saved answers", { exact: true }).check();
  await expect(page.locator(".tr-art")).toContainText("33.6°");
  const pupilSvg = (await download(page, "Download SVG")).toString();
  expect(pupilSvg).not.toContain("33.6°");
  expect(canonical(await saved(page))).toBe(original);
  const event = context.waitForEvent("page");
  await page
    .getByRole("button", { name: "Open worked copy", exact: true })
    .first()
    .click();
  const child = await event;
  await expect(
    child.getByRole("heading", { name: "Triangles", exact: true }),
  ).toBeVisible();
  await expect(child.locator(".tr-art")).toContainText("33.6°");
  expect((await download(child, "Download SVG")).toString()).toContain("33.6°");
  await child
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption("t:T1");
  await child
    .getByRole("button", { name: "Rotate right", exact: true })
    .click();
  expect(canonical(await saved(page))).toBe(original);
  await child.reload();
  await expect(child.locator(".tr-art")).toContainText("33.6°");
  await child.close();
});
test("editable link replacement can be cancelled and accepted without losing hidden answers", async ({
  page,
}) => {
  await boot(page, example("fractions"));
  const original = canonical(await saved(page)),
    linked = example("joined-rules"),
    href = triangleEditorLink(linked, page.url());
  await page.goto(href);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(canonical(await saved(page))).toBe(original);
  await page.goto(href);
  await page
    .getByRole("button", { name: "Use this diagram", exact: true })
    .click();
  expect(canonical(await saved(page))).toBe(canonical(linked));
  expect(
    (await saved(page)).document.edges.find((v) => v.id === "AD")!.label.answer,
  ).toBe("13.1");
});
test("empty file selection, malformed import and replacement cancellation preserve work", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  const before = canonical(await saved(page));
  let event = page.waitForEvent("filechooser");
  await clickResourceAction(page, "Open editable file");
  await (await event).setFiles([]);
  expect(canonical(await saved(page))).toBe(before);
  const bad = join(staging, "malformed.json");
  writeFileSync(bad, '{"kind":"triangle","bad":1}');
  event = page.waitForEvent("filechooser");
  await clickResourceAction(page, "Open editable file");
  await (await event).setFiles(bad);
  await expect(page.locator(".tr-feedback")).not.toBeEmpty();
  expect(canonical(await saved(page))).toBe(before);
  const good = join(staging, "replacement.json");
  writeFileSync(good, canonical(example("bisector")));
  event = page.waitForEvent("filechooser");
  await clickResourceAction(page, "Open editable file");
  await (await event).setFiles(good);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(canonical(await saved(page))).toBe(before);
});
test("joined, separate and split structures preview, cancel, remove and undo", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  const original = canonical(await saved(page));
  for (const addition of ["separate", "joined", "split"]) {
    if (addition === "separate")
      await page
        .getByRole("button", { name: "Add separate triangle", exact: true })
        .click();
    else {
      await page
        .getByRole("button", {
          name: addition === "joined" ? "Attach triangle" : "Split triangle",
          exact: true,
        })
        .click();
      expect(canonical(await saved(page))).toBe(original);
      await expect(
        page.getByRole("button", { name: "Copy to clipboard", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "Cancel preview", exact: true })
        .click();
      expect(canonical(await saved(page))).toBe(original);
      await page
        .getByRole("button", {
          name: addition === "joined" ? "Attach triangle" : "Split triangle",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: addition === "joined" ? "Add triangle" : "Apply split",
          exact: true,
        })
        .click();
    }
    expect(
      (await saved(page)).document.triangles.filter(
        (t) => t.role === "component",
      ),
    ).toHaveLength(2);
    await expect(
      page.getByRole("button", { name: "Add separate triangle", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: addition === "split" ? "Remove split" : /^Remove triangle /,
      })
      .click();
    expect((await saved(page)).document.vertices).toHaveLength(3);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(
      (await saved(page)).document.triangles.filter(
        (t) => t.role === "component",
      ),
    ).toHaveLength(2);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(canonical(await saved(page))).toBe(original);
  }
});
test("actual pointer vertex dragging commits once and preserves right-angle geometry", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  const before = canonical(await saved(page));
  const handle = page.getByRole("button", {
    name: "Move vertex C",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const b = (await handle.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 35, b.y + b.height / 2 - 10, {
    steps: 8,
  });
  await page.mouse.up();
  const after = await saved(page);
  expect(canonical(after)).not.toBe(before);
  expect(() => validate(after)).not.toThrow();
  expect(after.document.edges.map((v) => v.label)).toEqual(
    JSON.parse(before).document.edges.map((v: { label: unknown }) => v.label),
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(canonical(await saved(page))).toBe(before);
});
test("actual label dragging changes physical offsets and is one undoable edit", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  const before = canonical(await saved(page));
  const hit = page.locator('[data-tr-anchor="e:AB"]');
  await hit.scrollIntoViewIfNeeded();
  const b = (await hit.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2 + 12, {
    steps: 6,
  });
  await page.mouse.up();
  expect((await saved(page)).document.edges[0].label.dx).not.toBe(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(canonical(await saved(page))).toBe(before);
});
test("split symbol editing updates both copies and preserves stable angle anchors", async ({
  page,
}) => {
  await boot(page, example("bisector"));
  const before = (await saved(page)).document.angles.map((a) => [
    a.from,
    a.vertex,
    a.to,
  ]);
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption("a:T2-A");
  await page
    .getByRole("button", { name: "Edit selected label", exact: true })
    .click();
  await page.getByLabel("Linked label text", { exact: true }).fill("θ");
  await page.getByRole("button", { name: "Apply label", exact: true }).click();
  await expect(page.locator(".tr-art")).toContainText("θ°");
  expect((await saved(page)).document.sharedLabels[0].text).toBe("θ");
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption("t:T1");
  await page.getByRole("button", { name: "Rotate right", exact: true }).click();
  expect(
    (await saved(page)).document.angles.map((a) => [a.from, a.vertex, a.to]),
  ).toEqual(before);
});
test("sine helper offers two branches and saves only an explicit hidden result", async ({
  page,
}) => {
  await boot(page, example("ssa"));
  const panel = await section(page, "Calculate a value");
  await panel
    .getByRole("combobox", { name: "Method", exact: true })
    .selectOption("sine-angle");
  await panel.getByLabel("Known side a", { exact: true }).fill("8");
  await panel
    .getByLabel("Opposite angle A (degrees)", { exact: true })
    .fill("30");
  await panel
    .getByLabel("Side b opposite target angle B", { exact: true })
    .fill("12");
  await panel
    .getByRole("button", { name: "Calculate possible results", exact: true })
    .click();
  await expect(panel.locator(".tr-result")).toHaveCount(2);
  expect(
    (await saved(page)).document.angles.find((a) => a.id === "T1-B")!.label
      .answer,
  ).toBe("");
  await panel
    .getByRole("combobox", { name: "Save result to", exact: true })
    .selectOption("a:T1-B");
  await edit(page, "e:AC", "13");
  await expect(panel).toContainText(
    "Diagram givens changed. Calculate again before saving a result.",
  );
  const oldResult = panel
    .locator(".tr-result")
    .filter({ hasText: "Acute B" })
    .getByRole("button", { name: "Save as hidden answer", exact: true });
  await expect(oldResult).toBeDisabled();
  expect(
    (await saved(page)).document.angles.find((a) => a.id === "T1-B")!.label
      .answer,
  ).toBe("");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(oldResult).toBeEnabled();
  await panel
    .locator(".tr-result")
    .filter({ hasText: "Acute B" })
    .getByRole("button", { name: "Save as hidden answer", exact: true })
    .click();
  expect(
    (await saved(page)).document.angles.find((a) => a.id === "T1-B")!.label
      .answer,
  ).toBe("48.6");
  await expect(page.locator(".tr-art")).not.toContainText("48.6");
  await edit(page, "e:AC", "13");
  await expect(page.locator(".tr-warnings")).toContainText("out of date");
});
test("measurement construction previews a replacement and keeps all existing pupil labels", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  const before = (await saved(page)).document.edges.map((v) => v.label),
    panel = await section(page, "Construct from measurements");
  await panel.getByLabel("Side a", { exact: true }).fill("5");
  await panel.getByLabel("Side b", { exact: true }).fill("4");
  await panel.getByLabel("Side c", { exact: true }).fill("3");
  await panel
    .getByRole("button", { name: "Preview constructed shape", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Use this diagram", exact: true })
    .click();
  expect((await saved(page)).document.edges.map((v) => v.label)).toEqual(
    before,
  );
  expect((await saved(page)).document.triangles[0].rightAt).toBe(null);
});
test("print-width draft validation, image clipboard and Word physical-size clipboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await boot(page, example("fractions"));
  const panel = await section(page, "Print size");
  await panel.getByLabel("Print width (cm)").fill("0");
  await panel
    .getByRole("button", { name: "Apply print width", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeDisabled();
  await panel
    .getByRole("button", { name: "Cancel print width", exact: true })
    .click();
  const png = await download(page, "Download PNG (600 ppi)"),
    metrics = layout(example("fractions")),
    data = "data:image/png;base64," + png.toString("base64"),
    expected = await pixels(page, data);
  await page
    .getByRole("button", { name: "Copy to clipboard", exact: true })
    .click();
  await expect(page.locator(".tr-feedback")).toContainText("Image copied");
  const copied = await page.evaluate(async () => {
    const all = await navigator.clipboard.read(),
      blob = await all
        .find((x) => x.types.includes("image/png"))!
        .getType("image/png");
    return new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(blob);
    });
  });
  expect(await pixels(page, copied)).toEqual(expected);
  writeFileSync(
    join(report, "clipboard-image.png"),
    Buffer.from(copied.split(",")[1], "base64"),
  );
  await page
    .getByRole("button", { name: "Copy for Word", exact: true })
    .click();
  await expect(page.locator(".tr-feedback")).toContainText(
    "Copied for Word at",
  );
  const html = await page.evaluate(async () => {
    const all = await navigator.clipboard.read();
    return (
      await all.find((x) => x.types.includes("text/html"))!.getType("text/html")
    ).text();
  });
  writeFileSync(join(report, "clipboard-word.html"), html);
  const src = html.match(/src="([^"]+)"/)![1];
  expect(await pixels(page, src)).toEqual(expected);
  const dimensions = await page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html"),
      img = doc.querySelector("img")!;
    return { width: img.style.width, height: img.style.height };
  }, html);
  expect(parseFloat(dimensions.width)).toBeCloseTo(metrics.width / 10, 6);
  expect(dimensions.width).toMatch(/cm$/);
  // Chromium serialises CSS lengths to six significant figures on rich copy.
  // Compare that exact serialisation; the original HTML attribute is checked below.
  expect(parseFloat(dimensions.height)).toBe(
    Number((metrics.height / 10).toPrecision(6)),
  );
  expect(dimensions.height).toMatch(/cm$/);
  expect(html).toContain(`height="${metrics.height / 10}cm"`);
});
test("corrupt recovery retains its exact original and requires a deliberate fresh start", async ({
  page,
}) => {
  const original = '{"kind":"triangle","incomplete":true}';
  await boot(page, original);
  await expect(
    page.getByRole("heading", { name: "Protect saved data", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start a fresh diagram", exact: true }),
  ).toBeDisabled();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download original saved data", exact: true })
    .click();
  const file = await event;
  expect(readFileSync((await file.path())!).toString()).toBe(original);
  await page
    .getByRole("button", { name: "Start a fresh diagram", exact: true })
    .click();
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  expect(canonical(await saved(page))).toBe(canonical(create()));
});
test("another tab's newer saved draft is protected even during recovery confirmation", async ({
  page,
  context,
}) => {
  await boot(page);
  const other = await context.newPage();
  await other.goto("/?tool=triangle");
  await expect(
    other.getByRole("heading", { name: "Triangles", exact: true }),
  ).toBeVisible();
  await edit(page, "e:AB", "6");
  await expect(
    other.getByRole("heading", { name: "Protect saved data", exact: true }),
  ).toBeVisible();
  const event = other.waitForEvent("download");
  await other
    .getByRole("button", { name: "Download original saved data", exact: true })
    .click();
  await event;
  await other
    .getByRole("button", { name: "Start a fresh diagram", exact: true })
    .click();
  await edit(page, "e:AC", "8");
  await expect(
    other.getByRole("button", { name: "Start fresh", exact: true }),
  ).toBeDisabled();
  await other.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(other.locator(".tr-recovery")).toBeVisible();
  expect(
    (await saved(page)).document.edges.find((v) => v.id === "AC")!.label.text,
  ).toBe("8");
  await other.close();
});
test("All tools uses the actual renderer preview and navigation retains triangle work", async ({
  page,
}) => {
  await boot(page, example("joined-rules"));
  const before = canonical(await saved(page));
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  const card = page.getByRole("link").filter({
    has: page.getByRole("img", {
      name: "Right-angled triangle with 6 cm and 8 cm sides and an unknown hypotenuse labelled x.",
      exact: true,
    }),
  });
  await expect(card).toBeVisible();
  await card.click();
  expect(canonical(await saved(page))).toBe(before);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Booklet tools", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Triangles", exact: true }),
  ).toBeVisible();
});
test("six vertices, two heights and two wrapped captions retain their real print output on a phone", async ({
  page,
}) => {
  let e = addTriangle(create("scalene"), "separate");
  e = addHeight(e, "T1", "A");
  e = addHeight(e, "T2", "P");
  e = caption(
    e,
    "Use the perpendicular heights for both triangles. Keep all pupil answers blank until the working is complete.",
  );
  e = caption(e, "Area of the first triangle", "answer-line", "cm²");
  expect(layout(e).issues).toEqual([]);
  await page.setViewportSize({ width: 320, height: 1000 });
  await boot(page, e);
  await expect(page.locator(".tr-art")).toContainText(
    "Keep all pupil answers blank",
  );
  const resource = await page.locator(".tr-resource").boundingBox();
  const viewport = await page.locator(".tr-scroll").boundingBox();
  expect(resource!.x + resource!.width).toBeLessThanOrEqual(
    viewport!.x + viewport!.width,
  );
  const bytes = await download(page, "Download PNG (600 ppi)");
  const size = printRasterSize(layout(e).width / 10, layout(e).height / 10);
  verifyPrintBytes(new Uint8Array(bytes), size.width, size.height);
  writeFileSync(join(report, "maximum-structure.png"), bytes);
  const editable = await download(page, "Save editable file");
  expect(canonical(parseFile(editable.toString()))).toBe(canonical(e));
  await page.screenshot({
    path: join(report, "maximum-mobile.png"),
    fullPage: true,
  });
});
test("contextual inspector, keyboard selection and local attachment preserve the resource", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  const original = canonical(await saved(page));
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Triangle editing mode", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('details:has(> summary:text-is("Start a new triangle"))'),
  ).not.toHaveAttribute("open");
  await expect(
    page.locator('details:has(> summary:text-is("More tools"))'),
  ).not.toHaveAttribute("open");
  const chooser = page.getByRole("combobox", {
    name: "Selected object",
    exact: true,
  });
  await chooser.focus();
  await chooser.selectOption("e:BC");
  await expect(
    page.getByRole("heading", { name: "Side BC", exact: true }),
  ).toBeVisible();
  const outside = await page.locator(".tr-structure").boundingBox(),
    paper = await page.locator(".tr-resource").boundingBox();
  expect(outside!.y).toBeGreaterThanOrEqual(paper!.y + paper!.height);
  expect(await page.locator(".tr-resource .tr-structure").count()).toBe(0);
  await expect(
    page.getByRole("button", { name: /^Remove triangle / }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Attach triangle to BC", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Attachment side", exact: true }),
  ).toHaveValue("BC");
  expect(canonical(await saved(page))).toBe(original);
  await page.getByRole("button", { name: "Add triangle", exact: true }).click();
  const e = await saved(page);
  expect(e.document.layout).toBe("joined");
  expect(
    e.document.edges.filter(
      (x) => ["B", "C"].includes(x.from) && ["B", "C"].includes(x.to),
    ),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(canonical(await saved(page))).toBe(original);
});
test("small label editor retains advanced marks and hidden answers and cancels invalid offsets", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  const original = canonical(await saved(page));
  await page.locator('[data-tr-anchor="e:BC"]').click();
  await expect(
    page.getByRole("combobox", { name: "Selected object", exact: true }),
  ).toHaveValue("e:BC");
  await expect(
    page.getByRole("button", { name: "Edit selected label", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Saved answer (optional)", { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByLabel("Equal-side ticks", { exact: true }),
  ).toBeHidden();
  const compact = await page.locator(".tr-floating").boundingBox();
  expect(compact!.height).toBeLessThan(540);
  await page
    .locator(".tr-floating summary")
    .getByText("Saved answer", { exact: true })
    .click();
  await expect(
    page.getByLabel("Saved answer (optional)", { exact: true }),
  ).toHaveValue("10");
  await page.getByLabel("Saved answer (optional)", { exact: true }).fill("13");
  await page
    .locator(".tr-floating summary")
    .getByText("Presentation and marks", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Equal-side ticks", exact: true })
    .selectOption("2");
  await page.getByLabel("Dashed side", { exact: true }).check();
  await page.getByRole("button", { name: "Apply label", exact: true }).click();
  const edge = (await saved(page)).document.edges.find((x) => x.id === "BC")!;
  expect(edge.label.text).toBe("x");
  expect(edge.label.answer).toBe("13");
  expect(edge.label.answerVisible).toBe(false);
  expect(edge.ticks).toBe(2);
  expect(edge.dashed).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(canonical(await saved(page))).toBe(original);
  await page.locator('[data-tr-anchor="e:BC"]').click();
  await page
    .locator(".tr-floating summary")
    .getByText("Label position (mm)", { exact: true })
    .click();
  await page.getByLabel("Horizontal offset", { exact: true }).fill("-70");
  await page.getByRole("button", { name: "Apply label", exact: true }).click();
  await page
    .locator(".tr-floating summary")
    .getByText("Label position (mm)", { exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Selected object", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel label", exact: true }).click();
  expect(canonical(await saved(page))).toBe(original);
});

test("precise position and new-diagram replacement preserve pending edits and Undo", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  const original = canonical(await saved(page));
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption("v:A");
  await page
    .locator("summary")
    .getByText("Precise vertex position", { exact: true })
    .click();
  await page.getByLabel("Horizontal position", { exact: true }).fill("bad");
  await page
    .getByRole("button", { name: "Apply position", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Selected object", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Add separate triangle", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Cancel position", exact: true })
    .click();
  expect(canonical(await saved(page))).toBe(original);
  await page
    .locator("summary")
    .getByText("Start a new triangle", { exact: true })
    .click();
  await page.getByRole("button", { name: "Equilateral", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(canonical(await saved(page))).toBe(original);
  await page.getByRole("button", { name: "Equilateral", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Use this diagram", exact: true })
    .click();
  expect((await saved(page)).document.triangles[0].equilateral).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(canonical(await saved(page))).toBe(original);
});

test("focused edge editors stay reachable with a reduced viewport and expanded options", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 500 });
  await boot(page, example("missing-side"));
  for (const ref of ["v:A", "v:C", "e:BC"]) {
    await page
      .getByRole("combobox", { name: "Selected object", exact: true })
      .selectOption(ref);
    await page
      .getByRole("button", { name: "Edit selected label", exact: true })
      .click();
    await page
      .locator(".tr-floating summary")
      .getByText(
        ref.startsWith("v:") ? "Label position (mm)" : "Presentation and marks",
        { exact: true },
      )
      .click();
    await expect
      .poll(async () => {
        const measured = await page.locator(".tr-floating").boundingBox();
        return measured!.y + measured!.height;
      })
      .toBeLessThanOrEqual(501);
    const bounds = await page.locator(".tr-floating").boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(501);
    await page
      .getByRole("button", { name: "Cancel label", exact: true })
      .click();
  }
  await page.screenshot({
    path: join(report, "reduced-viewport.png"),
    fullPage: true,
  });
});

for (const width of [1440, 1100, 1000, 900, 768, 620, 375, 320])
  test(`layout ${width}px: complete artwork, reachable actions and bounded focused editor`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await boot(page, example("joined-rules"));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    const resource = await page.locator(".tr-resource").boundingBox();
    const viewport = await page.locator(".tr-scroll").boundingBox();
    expect(resource!.x).toBeGreaterThanOrEqual(viewport!.x);
    expect(resource!.x + resource!.width).toBeLessThanOrEqual(
      viewport!.x + viewport!.width,
    );
    expect(
      await page
        .locator(".tr-scroll")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: join(report, `desktop-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("combobox", { name: "Selected object", exact: true })
      .selectOption("e:CD");
    await page
      .getByRole("button", { name: "Edit selected label", exact: true })
      .click();
    await expect(page.getByLabel("Label text", { exact: true })).toBeFocused();
    const b = await page.locator(".tr-floating").boundingBox();
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.y).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(width + 1);
    expect(b!.y + b!.height).toBeLessThanOrEqual(1001);
    await page.screenshot({ path: join(report, `focused-${width}.png`) });
    await page
      .getByRole("button", { name: "Cancel label", exact: true })
      .click();
    await openResourceMenu(page);
    const menu = await page.getByRole("menu").boundingBox();
    expect(menu!.x).toBeGreaterThanOrEqual(0);
    expect(menu!.x + menu!.width).toBeLessThanOrEqual(width + 1);
    await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Download options", exact: true }),
    ).toBeFocused();
  });

for (const apex of ["A", "B", "C"])
  test(`direct split from ${apex} uses its opposite side and restores exact pupil data`, async ({
    page,
  }) => {
    await boot(page, example("missing-side"));
    const before = canonical(await saved(page));
    await page
      .getByRole("button", { name: `Move vertex ${apex}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: `Split triangle from ${apex}`, exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Split apex", exact: true }),
    ).toHaveValue(apex);
    expect(canonical(await saved(page))).toBe(before);
    await page
      .getByRole("button", { name: "Apply split", exact: true })
      .click();
    const e = await saved(page);
    expect([e.document.split!.from, e.document.split!.to]).not.toContain(apex);
    expect(
      e.document.triangles
        .filter((t) => t.role === "component")
        .every((t) => t.vertices.includes(apex)),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Remove split", exact: true })
      .click();
    expect((await saved(page)).document.vertices).toHaveLength(3);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(canonical(await saved(page))).toBe(before);
  });

test("vertex names remain directly editable separately from geometric vertex handles", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  const before = await saved(page);
  for (const id of ["A", "B", "C"]) {
    await page.locator(`[data-tr-anchor="v:${id}"]`).click();
    await page
      .getByLabel("Vertex name", { exact: true })
      .fill(id.toLowerCase());
    await page
      .getByRole("button", { name: "Apply label", exact: true })
      .click();
  }
  const after = await saved(page);
  expect(after.document.vertices.map((v) => [v.x, v.y])).toEqual(
    before.document.vertices.map((v) => [v.x, v.y]),
  );
  expect(after.document.vertices.map((v) => v.label.text)).toEqual([
    "a",
    "b",
    "c",
  ]);
});

test("Escape and pointer cancellation restore a gesture and consume no Undo action", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  const before = canonical(await saved(page));
  const handle = page.getByRole("button", {
      name: "Move vertex C",
      exact: true,
    }),
    b = (await handle.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 24, b.y + b.height / 2 - 8, {
    steps: 4,
  });
  expect(canonical(await saved(page))).toBe(before);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(canonical(await saved(page))).toBe(before);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  const current = (await handle.boundingBox())!;
  await page.mouse.move(
    current.x + current.width / 2,
    current.y + current.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    current.x + current.width / 2 + 20,
    current.y + current.height / 2 - 8,
    { steps: 4 },
  );
  await expect(
    page.getByRole("button", { name: "Copy to clipboard", exact: true }),
  ).toBeDisabled();
  await handle.dispatchEvent("pointercancel", {
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });
  await page.mouse.up();
  expect(canonical(await saved(page))).toBe(before);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
});

test("side line and shared interior selection provide named targets instead of arbitrary triangle selection", async ({
  page,
}) => {
  const e = addTriangle(example("missing-side"), "joined", "BC");
  await boot(page, e);
  const g = layout(e),
    a = g.vertices.B,
    b = g.vertices.C;
  const paper = (await page.locator(".tr-resource").boundingBox())!,
    scale = paper.width / g.width;
  await page.mouse.click(
    paper.x + (a.x * 0.7 + b.x * 0.3) * scale,
    paper.y + (a.y * 0.7 + b.y * 0.3) * scale,
  );
  const choice = page.getByRole("group", {
    name: "Choose overlapping object",
    exact: true,
  });
  await expect(choice).toBeVisible();
  await expect(
    choice.getByRole("button", { name: "Side BC", exact: true }),
  ).toBeVisible();
  await expect(
    choice.getByRole("button", { name: "Triangle ABC", exact: true }),
  ).toBeVisible();
  await choice.getByRole("button", { name: "Side BC", exact: true }).click();
  await expect(
    page.getByText("Shared by ABC and BCD; one side label.", { exact: true }),
  ).toBeVisible();
  expect(canonical(await saved(page))).toBe(canonical(e));
});

test("contextual Pythagoras names givens and only saves an explicit hidden answer", async ({
  page,
}) => {
  const e = example("missing-side");
  e.document.edges.find((a) => a.id === "BC")!.label.answer = "";
  await boot(page, e);
  const before = canonical(await saved(page));
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption("e:BC");
  await page
    .getByRole("button", { name: "Calculate side BC", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Calculate selected value",
    exact: true,
  });
  await expect(
    panel.getByRole("combobox", { name: "Calculation triangle", exact: true }),
  ).toHaveValue("T1");
  await panel
    .getByRole("button", { name: "Load selected context", exact: true })
    .click();
  await expect(panel).toContainText("AB = 6 cm");
  await expect(panel).toContainText("CA = 8 cm");
  expect(canonical(await saved(page))).toBe(before);
  await panel
    .getByRole("button", { name: "Calculate possible results", exact: true })
    .click();
  await expect(panel).toContainText("10.0 cm");
  await expect(
    panel.getByRole("combobox", { name: "Save result to", exact: true }),
  ).toHaveValue("e:BC");
  await panel
    .getByRole("button", { name: "Save as hidden answer", exact: true })
    .click();
  const label = (await saved(page)).document.edges.find(
    (a) => a.id === "BC",
  )!.label;
  expect(label.state).toBe("symbol");
  expect(label.text).toBe("x");
  expect(label.answer).toBe("10.0");
  expect(label.answerVisible).toBe(false);
});

test("shared calculation context requires a triangle and selection changes preserve manually edited inputs", async ({
  page,
}) => {
  await boot(page, example("joined-rules"));
  const e = await saved(page),
    shared = e.document.edges.find(
      (a) =>
        e.document.triangles.filter(
          (t) => t.vertices.includes(a.from) && t.vertices.includes(a.to),
        ).length === 2,
    )!;
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption(`e:${shared.id}`);
  await page
    .getByRole("button", {
      name: `Calculate side ${shared.from}${shared.to}`,
      exact: true,
    })
    .click();
  const panel = page.getByRole("region", {
    name: "Calculate selected value",
    exact: true,
  });
  await expect(
    panel.getByRole("combobox", { name: "Calculation triangle", exact: true }),
  ).toHaveValue("");
  await expect(
    panel.getByRole("button", { name: "Load selected context", exact: true }),
  ).toHaveCount(0);
  await panel
    .getByRole("combobox", { name: "Calculation triangle", exact: true })
    .selectOption("T1");
  await panel
    .getByRole("combobox", { name: "Suggested method", exact: true })
    .selectOption("cosine-side");
  await panel
    .getByRole("button", { name: "Load selected context", exact: true })
    .click();
  await panel.getByLabel("Side b", { exact: true }).fill("17");
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption("v:A");
  await expect(panel.getByLabel("Side b", { exact: true })).toHaveValue("17");
  await panel
    .getByRole("combobox", { name: "Calculation triangle", exact: true })
    .selectOption("T2");
  await expect(panel.getByLabel("Side b", { exact: true })).toHaveValue("17");
  await panel
    .getByRole("button", {
      name: "Reload selected context (replace helper inputs)",
      exact: true,
    })
    .click();
  await expect(
    panel.getByRole("combobox", { name: "Triangle", exact: true }),
  ).toHaveValue("T2");
});

test("coarse-pointer editing leaves the keyboard optional and supports deliberate touch dragging", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const touchErrors: string[] = [];
  page.on("pageerror", (e) => touchErrors.push(e.message));
  await page.addInitScript(() => {
    const log: unknown[] = [];
    Object.assign(window, { triangleTouchEvents: log });
    for (const kind of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "click",
      "touchstart",
      "touchend",
      "focusin",
      "focusout",
    ])
      document.addEventListener(
        kind,
        (event) => {
          const e = event as PointerEvent,
            button = (e.target as Element)?.closest("button");
          log.push({
            kind,
            time: performance.now(),
            x: e.clientX,
            y: e.clientY,
            id: e.pointerId,
            prevented: e.defaultPrevented,
            tag: (e.target as Element)?.tagName,
            target:
              button?.getAttribute("aria-label") ||
              button?.textContent?.slice(0, 25),
            disabled: button?.disabled,
          });
        },
        true,
      );
    new MutationObserver((m) => {
      for (const x of m) {
        const el = x.target as Element;
        if (el.matches?.('[aria-label="Undo"]'))
          log.push({
            kind: "mutation",
            attribute: x.attributeName,
            disabled: (el as HTMLButtonElement).disabled,
            connected: el.isConnected,
            time: performance.now(),
          });
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
  });
  await boot(page, example("missing-side"));
  let before = canonical(await saved(page));
  const hit = page.locator('[data-tr-anchor="e:AB"]'),
    box = (await hit.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".tr-floating")).toBeVisible();
  await expect(
    page.getByLabel("Label text", { exact: true }),
  ).not.toBeFocused();
  await page.getByLabel("Label text", { exact: true }).tap();
  await expect(page.getByLabel("Label text", { exact: true })).toBeFocused();
  await page.getByLabel("Label text", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Apply label", exact: true }).tap();
  before = canonical(await saved(page));
  await page.locator('[data-tr-anchor="e:AB"]').tap();
  await page.getByRole("button", { name: "Cancel label", exact: true }).tap();
  const handle = page.getByRole("button", {
      name: "Move vertex C",
      exact: true,
    }),
    b = (await handle.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: b.x + b.width / 2 - 25, y: b.y + b.height / 2 - 12 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(canonical(await saved(page))).not.toBe(before);
  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  writeFileSync(
    join(report, "touch-events.json"),
    JSON.stringify(
      await page.evaluate(() => Reflect.get(window, "triangleTouchEvents")),
      null,
      2,
    ),
  );
  await expect.poll(async () => canonical(await saved(page))).toBe(before);
  // A browser-generated click after the touch release must not undo the first
  // label edit as well. Redo/Undo must each traverse exactly one history entry.
  await page.getByRole("button", { name: "Redo", exact: true }).tap();
  await expect.poll(async () => canonical(await saved(page))).not.toBe(before);
  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  await expect.poll(async () => canonical(await saved(page))).toBe(before);
  const ub = (await page
    .getByRole("button", { name: "Undo", exact: true })
    .boundingBox())!;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: ub.x + ub.width / 2, y: ub.y + ub.height / 2 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: ub.x + ub.width / 2, y: ub.y + ub.height / 2 - 50 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(canonical(await saved(page))).toBe(before);
  expect(touchErrors).toEqual([]);
  await page.screenshot({
    path: join(report, "touch-375.png"),
    fullPage: true,
  });
  await context.close();
});

test("a selected height uses stated area and base, saving only an explicit hidden height", async ({
  page,
}) => {
  const e = caption(
    addHeight(example("missing-side"), "T1", "B"),
    "24",
    "value",
    "cm²",
  );
  await boot(page, e);
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption("h:H1");
  await page.getByRole("button", { name: /^Calculate height / }).click();
  const panel = page.getByRole("region", {
    name: "Calculate selected value",
    exact: true,
  });
  await panel
    .getByRole("button", { name: "Load selected context", exact: true })
    .click();
  await expect(
    panel.getByRole("combobox", { name: "Method", exact: true }),
  ).toHaveValue("height-area");
  await expect(
    panel.getByLabel("Area (square units)", { exact: true }),
  ).toHaveValue("24");
  await expect(panel.getByLabel("Base length", { exact: true })).toHaveValue(
    "8",
  );
  await panel
    .getByRole("button", { name: "Calculate possible results", exact: true })
    .click();
  await expect(panel).toContainText("6.0 cm");
  await panel
    .getByRole("button", { name: "Save as hidden answer", exact: true })
    .click();
  const h = (await saved(page)).document.heights[0];
  expect(h.label.text).toBe("h");
  expect(h.label.answer).toBe("6.0");
  expect(h.label.answerVisible).toBe(false);
});

test("changed diagram givens require a context reload and revoke unsaved calculated results", async ({
  page,
}) => {
  await boot(page, example("missing-side"));
  await page
    .getByRole("combobox", { name: "Selected object", exact: true })
    .selectOption("e:BC");
  await page
    .getByRole("button", { name: "Calculate side BC", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Calculate selected value",
    exact: true,
  });
  await panel
    .getByRole("button", { name: "Load selected context", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Calculate possible results", exact: true })
    .click();
  await edit(page, "e:AB", "7");
  await expect(
    panel.getByRole("button", {
      name: "Replace saved answer (keep pupil label)",
      exact: true,
    }),
  ).toBeDisabled();
  await panel
    .getByRole("button", { name: "Calculate possible results", exact: true })
    .click();
  await expect(panel).toContainText(
    "Reload the selected context before calculating",
  );
  await panel
    .getByRole("button", { name: "Use numerical diagram givens", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Calculate possible results", exact: true })
    .click();
  await expect(panel).toContainText("10.6 cm");
});
