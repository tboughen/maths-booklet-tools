import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import * as c from "../packages/bar-model-core/src/versioned";
import * as v from "../packages/bar-model-core/src/v2";
import * as old from "../packages/bar-model-core/src/index";
import { verifyPrintBytes } from "../packages/graph-core/src/png-bytes";
import { denseFixture } from "../packages/bar-model-core/src/stress-fixture";
import { lessonExample } from "../packages/bar-model-core/src/lesson-examples";
// New empty browser sessions use v3; keep all existing v2 guarantees on an explicit saved v2 model.
test.beforeEach(async ({ page }, info) => {
  if (
    info.title.startsWith("fresh lesson") ||
    info.title.startsWith("explicit upgrade")
  )
    return;
  await page.addInitScript((e) => {
    if (
      !localStorage.getItem("maths-booklet-tools:bar-model:v2") &&
      !localStorage.getItem("maths-booklet-tools:bar-model:v1")
    )
      localStorage.setItem(
        "maths-booklet-tools:bar-model:v2",
        JSON.stringify({ storageVersion: 1, envelope: e }),
      );
  }, v.fresh());
});
test("choosing divergent saved work records the observed snapshot without overwriting the old key", async ({
  page,
}) => {
  const legacy = old.fresh(),
    hash = await c.hash(legacy);
  legacy.document.bars[0].name = old.label("Changed old model");
  const oldRaw = old.canonical(legacy),
    newRaw = JSON.stringify({
      storageVersion: 1,
      envelope: lessonExample("R4"),
      legacySourceHash: hash,
    });
  await page.addInitScript(
    ({ oldRaw, newRaw }) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("maths-booklet-tools:bar-model:v1", oldRaw);
        localStorage.setItem("maths-booklet-tools:bar-model:v2", newRaw);
        sessionStorage.setItem("seeded", "yes");
      }
    },
    { oldRaw, newRaw },
  );
  await page.goto("/?tool=bar-model");
  await expect(page.getByRole("region", { name: "Recovery" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Keep current model", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("maths-booklet-tools:bar-model:v1"),
    ),
  ).toBe(oldRaw);
  await page.reload();
  await expect(page.getByRole("region", { name: "Recovery" })).toHaveCount(0);
  expect((await saved(page)).schemaVersion).toBe(2);
});
test("both clipboard routes carry the actual v2 artwork and denied copying offers a file fallback", async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?tool=bar-model");
  await page.getByRole("button", { name: "Worked R5", exact: true }).click();
  const e = await saved(page),
    g = c.layout(e),
    before = c.canonical(e);
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Image copied" }),
  ).toBeVisible();
  const image = await page.evaluate(async () => {
    const item = (await navigator.clipboard.read()).find((i) =>
      i.types.includes("image/png"),
    );
    if (!item) throw Error("No clipboard PNG");
    const blob = await item.getType("image/png"),
      bitmap = await createImageBitmap(blob);
    return {
      width: bitmap.width,
      height: bitmap.height,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    };
  });
  expect(image.width).toBe(Math.round((g.width / 25.4) * 600));
  expect(image.height).toBe(Math.round((g.height / 25.4) * 600));
  await info.attach("v2-system-clipboard.png", {
    body: Buffer.from(image.bytes),
    contentType: "image/png",
  });
  await page
    .getByRole("button", { name: "Copy for Word", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Copied for Word" }),
  ).toBeVisible();
  const word = await page.evaluate(async () => {
    const item = (await navigator.clipboard.read()).find((i) =>
      i.types.includes("text/html"),
    );
    if (!item) throw Error("No Word clipboard HTML");
    const html = await (await item.getType("text/html")).text(),
      img = new DOMParser()
        .parseFromString(html, "text/html")
        .querySelector("img");
    if (!img) throw Error("No clipboard image");
    return {
      src: img.getAttribute("src"),
      width: img.style.width,
      height: img.style.height,
    };
  });
  expect(word.src).toContain("data:image/png;base64,");
  expect(parseFloat(word.width)).toBeCloseTo(g.width / 10, 6);
  expect(parseFloat(word.height)).toBeCloseTo(g.height / 10, 6);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        write: async () => {
          throw Error("Denied");
        },
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /Download PNG/ }),
  ).toBeVisible();
  expect(c.canonical(await saved(page))).toBe(before);
});
const visible = (page: Page) => page.locator(".site-page:not([hidden])");
async function saved(page: Page) {
  await visible(page)
    .getByRole("button", { name: "File", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "Save editable file", exact: true })
    .click();
  return c.parseFile(await readFile((await (await download).path())!, "utf8"));
}
async function label(page: Page, text: string) {
  await page.getByLabel("Saved label", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
}
async function useStarter(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  await page
    .getByRole("button", { name: "Use this model", exact: true })
    .click();
}
async function referenceUnit(page: Page) {
  await page
    .getByRole("button", { name: "Print settings", exact: true })
    .click();
  await page.getByLabel("Shared unit width (mm)", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
}
async function addRange(page: Page, from: number, to: number, text: string) {
  await page
    .getByRole("button", { name: "Add whole or range label", exact: true })
    .click();
  await page.getByLabel("Scope", { exact: true }).selectOption("range");
  await page
    .getByLabel("From boundary", { exact: true })
    .selectOption({ label: `Bar 1, section ${from}, start` });
  await page
    .getByLabel("To boundary", { exact: true })
    .selectOption({ label: `Bar 1, section ${to}, end` });
  await page.getByLabel("Placement", { exact: true }).selectOption("below");
  await label(page, text);
}
test("fresh lesson default is two blank parts and reading does not save or alter old keys", async ({
  page,
}) => {
  await page.goto("/?tool=bar-model");
  const e = await saved(page);
  expect(e.schemaVersion).toBe(3);
  expect(e.document.bars[0].parts).toHaveLength(2);
  expect(
    await page.evaluate(() => ({
      old: localStorage.getItem("maths-booklet-tools:bar-model:v1"),
      new: localStorage.getItem("maths-booklet-tools:bar-model:v2"),
    })),
  ).toEqual({ old: null, new: null });
});
test("teacher route creates dual-label fractions with two bulk actions and friendly range controls", async ({
  page,
}, info) => {
  const started = Date.now();
  await page.goto("/?tool=bar-model");
  await useStarter(page, "Equal sections");
  await referenceUnit(page);
  await page
    .getByRole("button", {
      name: "Set inside labels for whole bar",
      exact: true,
    })
    .click();
  await label(page, "1/5");
  await page
    .getByLabel("Label position", { exact: true })
    .selectOption("above");
  await page
    .getByRole("button", {
      name: "Set above labels for whole bar",
      exact: true,
    })
    .click();
  await label(page, "9");
  await page
    .getByRole("button", { name: "Edit whole bar annotation 1", exact: true })
    .click();
  await label(page, "45");
  await page
    .getByRole("button", { name: "Add whole or range label", exact: true })
    .click();
  await page.getByLabel("Scope", { exact: true }).selectOption("range");
  await page
    .getByLabel("To boundary", { exact: true })
    .selectOption({ label: "Bar 1, section 4, end" });
  await page.getByLabel("Placement", { exact: true }).selectOption("below");
  await label(page, "36");
  await page
    .getByRole("button", { name: "Add calculation line", exact: true })
    .click();
  await label(page, "4/5 × 45 = 36");
  const e = await saved(page);
  expect(e.schemaVersion).toBe(2);
  if (e.schemaVersion !== 2) throw Error();
  expect(
    e.document.bars[0].parts.every(
      (p) => p.labels.inside.text === "1/5" && p.labels.above?.text === "9",
    ),
  ).toBe(true);
  expect(e.document.annotations).toHaveLength(2);
  expect(v.layout(e).issues).toEqual([]);
  await page.screenshot({
    path: info.outputPath("authored-R4.png"),
    fullPage: true,
  });
  await info.attach("operator-task.json", {
    body: JSON.stringify({
      actor: "automated operator",
      task: "R4 from visible Equal sections starter",
      elapsedMs: Date.now() - started,
      bulkLabelActions: 2,
      jsonOrTechnicalIdInput: false,
    }),
    contentType: "application/json",
  });
});
test("teacher route creates seven-four comparison and between difference without calculating it", async ({
  page,
}) => {
  await page.goto("/?tool=bar-model");
  await page.getByLabel("Longer bar length (shared units)").fill("7");
  await page.getByLabel("Shorter bar length (shared units)").fill("4");
  await useStarter(page, "Comparison");
  await referenceUnit(page);
  await page
    .getByRole("button", { name: "Edit quantity name", exact: true })
    .click();
  await label(page, "Mia");
  await page
    .getByLabel("Bar", { exact: true })
    .selectOption({ label: "Bar 2" });
  await page
    .getByRole("button", { name: "Edit quantity name", exact: true })
    .click();
  await label(page, "Jack");
  await page
    .getByRole("button", { name: "Edit range annotation 1", exact: true })
    .click();
  expect(
    await page.getByLabel("Saved label", { exact: true }).inputValue(),
  ).toBe("");
  await label(page, "3");
  for (const [bar, text] of [
    ["Bar 2: Jack", "4"],
    ["Bar 1: Mia", "7"],
  ]) {
    await page.getByLabel("Bar", { exact: true }).selectOption({ label: bar });
    await page
      .getByRole("button", { name: "Add whole or range label", exact: true })
      .click();
    await page.getByLabel("Decoration", { exact: true }).selectOption("none");
    await label(page, text);
  }
  await page
    .getByRole("button", { name: "Add calculation line", exact: true })
    .click();
  await label(page, "7 - 4 = 3");
  const e = await saved(page);
  if (e.schemaVersion !== 2) throw Error();
  expect(e.document.bars.map((b) => b.parts.length)).toEqual([7, 4]);
  expect(e.document.annotations[0].placement).toBe("between");
  expect(e.document.annotations[0].label.text).toBe("3");
  expect(
    e.document.annotations
      .filter((a) => a.scope.kind === "whole")
      .map((a) => a.label.text)
      .sort(),
  ).toEqual(["4", "7"]);
  expect(v.layout(e).height).toBeLessThanOrEqual(65);
});
test("teacher route creates the unequal part-whole model with literal captions", async ({
  page,
}, info) => {
  const started = Date.now();
  await page.goto("/?tool=bar-model");
  await referenceUnit(page);
  for (const [index, weight, text] of [
    [0, "2", "b"],
    [1, "3", "c"],
  ] as const) {
    await page
      .getByRole("button", { name: "Relative length", exact: true })
      .nth(index)
      .click();
    await page.getByLabel("Relative length", { exact: true }).fill(weight);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page
      .getByRole("button", {
        name: `Edit bar 1 section ${index + 1} inside label`,
        exact: true,
      })
      .click();
    await label(page, text);
  }
  await page
    .getByRole("button", { name: "Edit whole bar annotation 1", exact: true })
    .click();
  await page
    .getByLabel("Decoration", { exact: true })
    .selectOption("dimension");
  await label(page, "a");
  for (const text of ["a = b + c", "a - b = c"]) {
    await page
      .getByRole("button", { name: "Add calculation line", exact: true })
      .click();
    await label(page, text);
  }
  const e = await saved(page);
  if (e.schemaVersion !== 2) throw Error();
  expect(e.document.bars[0].parts.map((p) => p.weight)).toEqual(["2", "3"]);
  expect(e.document.captions.map((c) => c.label.text)).toEqual([
    "a = b + c",
    "a - b = c",
  ]);
  expect(v.layout(e).height).toBeLessThanOrEqual(50);
  await info.attach("operator-R1.json", {
    body: JSON.stringify({
      actor: "automated operator",
      elapsedMs: Date.now() - started,
      jsonOrTechnicalIdInput: false,
    }),
    contentType: "application/json",
  });
});
test("teacher route creates inline ratio shares and a nested difference with keyboard label editing", async ({
  page,
}, info) => {
  const started = Date.now();
  await page.goto("/?tool=bar-model");
  await useStarter(page, "Inline ratio");
  await referenceUnit(page);
  await page
    .getByRole("button", {
      name: "Set inside labels for whole bar",
      exact: true,
    })
    .click();
  await label(page, "3");
  for (const [number, text] of [
    [1, "Eve"],
    [2, "Fred"],
  ] as const) {
    await page
      .getByRole("button", {
        name: `Edit range annotation ${number}`,
        exact: true,
      })
      .focus();
    await page.keyboard.press("Enter");
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
  }
  await addRange(page, 1, 3, "9");
  await addRange(page, 4, 8, "15");
  await addRange(page, 7, 8, "6");
  await page
    .getByRole("button", { name: "Add calculation line", exact: true })
    .click();
  await label(page, "6 ÷ 2 = 3");
  const e = await saved(page);
  if (e.schemaVersion !== 2) throw Error();
  const g = v.layout(e);
  expect(g.issues).toEqual([]);
  expect(g.annotations[0].lane).toBe(g.annotations[1].lane);
  const shares = g.annotations.filter((a) =>
    ["9", "15"].includes(a.annotation.label.text),
  );
  expect(shares[0].lane).toBe(shares[1].lane);
  expect(
    g.annotations.find((a) => a.annotation.label.text === "6")!.lane,
  ).not.toBe(shares[1].lane);
  expect(g.height).toBeLessThanOrEqual(65);
  await info.attach("operator-R5.json", {
    body: JSON.stringify({
      actor: "automated operator",
      elapsedMs: Date.now() - started,
      keyboardGroupLabels: 2,
      jsonOrTechnicalIdInput: false,
    }),
    contentType: "application/json",
  });
});
test("slot edits retain drafts, explicit copy previews hidden destinations and Undo is atomic", async ({
  page,
}) => {
  await page.goto("/?tool=bar-model");
  await page
    .getByRole("button", {
      name: "Edit bar 1 section 1 inside label",
      exact: true,
    })
    .click();
  await label(page, "b");
  await page
    .getByRole("button", { name: "Move or copy selected label", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  let e = await saved(page);
  if (e.schemaVersion !== 2) throw Error();
  expect(e.document.bars[0].parts[0].labels.above?.text).toBe("b");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  e = await saved(page);
  if (e.schemaVersion !== 2) throw Error();
  expect(e.document.bars[0].parts[0].labels.above).toBeUndefined();
  expect(e.document.bars[0].parts[0].labels.inside.text).toBe("b");
});
test("explicit upgrade previews and Undo restores v1 source and earlier history", async ({
  page,
}) => {
  const legacy = old.fresh();
  await page.addInitScript(
    (raw) => localStorage.setItem("maths-booklet-tools:bar-model:v1", raw),
    old.canonical(legacy),
  );
  await page.goto("/?tool=bar-model");
  await page.getByText("Use improved layout", { exact: true }).first().click();
  await page
    .getByRole("button", { name: "Use improved layout", exact: true })
    .click();
  expect((await saved(page)).schemaVersion).toBe(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(c.canonical(await saved(page))).toBe(old.canonical(legacy));
  expect(
    await page.evaluate(() =>
      localStorage.getItem("maths-booklet-tools:bar-model:v1"),
    ),
  ).toBe(old.canonical(legacy));
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await saved(page)).schemaVersion).toBe(2);
});
test("v2 downloads retain actual SVG fonts and verified 600ppi PNG with native dimensions", async ({
  page,
}, info) => {
  await page.goto("/?tool=bar-model");
  await page.getByRole("button", { name: "Worked R5", exact: true }).click();
  const e = await saved(page),
    g = c.layout(e);
  for (const format of ["SVG", "PNG (600 ppi)"]) {
    await visible(page)
      .getByRole("button", { name: "File", exact: true })
      .click();
    const event = page.waitForEvent("download");
    await page
      .getByRole("menuitem", { name: `Download ${format}`, exact: true })
      .click();
    const file = await event;
    expect(await file.failure(), format).toBeNull();
    await file.saveAs(info.outputPath(file.suggestedFilename()));
    const bytes = await readFile((await file.path())!);
    if (format === "SVG") {
      expect(bytes.toString()).toContain(`width="${g.width}mm"`);
      expect(bytes.toString()).toContain("data:font/otf;base64,");
    } else
      verifyPrintBytes(
        bytes,
        Math.round((g.width / 25.4) * 600),
        Math.round((g.height / 25.4) * 600),
      );
  }
});
for (const width of [320, 375, 768, 1440])
  test(`lesson controls, clean crop and focused fields remain usable at${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?tool=bar-model");
    await page.getByLabel("Open bar model file").setInputFiles({
      name: "dense-v2.json",
      mimeType: "application/json",
      buffer: Buffer.from(c.canonical(denseFixture())),
    });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Open bar model", exact: true })
      .click();
    const dense = await saved(page);
    expect(dense.document.bars.flatMap((b) => b.parts)).toHaveLength(96);
    await page.screenshot({
      path: info.outputPath(`dense-v2-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Worked R4", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const overlap = await visible(page)
      .locator(".bm-scroll")
      .evaluate((stage) => {
        const r = stage.querySelector(".bm-resource")!.getBoundingClientRect();
        return [...stage.querySelectorAll(".bm-side-controls button")].some(
          (button) => {
            const b = button.getBoundingClientRect();
            return (
              b.left < r.right &&
              b.right > r.left &&
              b.top < r.bottom &&
              b.bottom > r.top
            );
          },
        );
      });
    expect(overlap).toBe(false);
    await page
      .getByRole("button", { name: "Edit quantity name", exact: true })
      .click();
    await page
      .getByLabel("Saved label", { exact: true })
      .fill(
        "Long quantity name with fractions and unknowns "
          .repeat(2)
          .slice(0, 80),
      );
    await expect(
      page.getByRole("button", { name: "Apply", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`focused-v2-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
