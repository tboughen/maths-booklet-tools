import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import * as c from "../packages/bar-model-core/src/versioned";
import * as v from "../packages/bar-model-core/src/v3";
import * as v2 from "../packages/bar-model-core/src/v2";
import * as old from "../packages/bar-model-core/src/index";
import { verifyPrintBytes } from "../packages/graph-core/src/png-bytes";

async function saved(page: Page) {
  await page.getByRole("button", { name: "File", exact: true }).click();
  const event = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "Save editable file", exact: true })
    .click();
  return c.parseFile(await readFile((await (await event).path())!, "utf8"));
}
test("new bar models stack working fractions and preserve explicit literal slashes and rejected drafts", async ({
  page,
}) => {
  await page.goto("/tools/bar-model");
  expect((await saved(page)).schemaVersion).toBe(3);
  await page
    .getByRole("button", { name: "Add calculation line", exact: true })
    .click();
  await page.getByLabel("Saved label", { exact: true }).fill("4/5 × 45 = 36");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.locator('.bm-resource [data-fraction="horizontal"]'),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Edit calculation line 1", exact: true })
    .click();
  await page.getByLabel("Saved label", { exact: true }).fill("9/10/2026");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByLabel("Saved label", { exact: true })).toHaveValue(
    "9/10/2026",
  );
  await expect(page.getByRole("alert")).toContainText(/fraction/i);
  await expect(
    page.getByRole("button", { name: "Copy image", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Line format", { exact: true }).selectOption("plain");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  let e = await saved(page);
  if (e.schemaVersion !== 3) throw Error();
  expect(e.document.captions[0]).toMatchObject({
    format: "plain",
    label: { text: "9/10/2026" },
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  e = await saved(page);
  if (e.schemaVersion !== 3) throw Error();
  expect(e.document.captions[0]).toMatchObject({
    format: "maths",
    label: { text: "4/5 × 45 = 36" },
  });
});
test("inside handwriting spaces raise actual bars without changing shared widths and Undo restores one edit", async ({
  page,
}) => {
  await page.goto("/tools/bar-model");
  const before = await saved(page);
  await page
    .getByRole("button", {
      name: "Edit bar 1 section 1 inside label",
      exact: true,
    })
    .click();
  await page.getByLabel("Saved label", { exact: true }).fill("1/2");
  await page.getByLabel("Pupil display", { exact: true }).selectOption("line");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const e = await saved(page);
  if (e.schemaVersion !== 3) throw Error();
  expect(v.layout(e).barHeightMm).toBe(20);
  expect(e.document.bars.map((b) => b.parts.map((p) => p.weight))).toEqual(
    before.document.bars.map((b) => b.parts.map((p) => p.weight)),
  );
  await expect(page.getByText(/actual bars 20 mm/)).toBeVisible();
  await page
    .getByRole("button", { name: "Print settings", exact: true })
    .click();
  await page.getByLabel("Minimum bar height (mm)", { exact: true }).fill("24");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect(v.layout(v.validate(await saved(page))).barHeightMm).toBe(24);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(v.layout(v.validate(await saved(page))).barHeightMm).toBe(20);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(c.canonical(await saved(page))).toBe(c.canonical(before));
});
for (const version of [1, 2] as const)
  test(`explicit v${version} to v3 upgrade previews and one Undo restores exact saved source`, async ({
    page,
  }) => {
    const e = version === 1 ? old.fresh() : v2.fresh();
    await page.addInitScript(
      (e) =>
        localStorage.setItem(
          "maths-booklet-tools:bar-model:v2",
          JSON.stringify({ storageVersion: 1, envelope: e }),
        ),
      e,
    );
    await page.goto("/tools/bar-model");
    await page
      .getByRole("button", {
        name: "Use horizontal fractions and larger answer spaces",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", {
        name: version === 1 ? "Open bar model" : "Use this model",
        exact: true,
      })
      .click();
    expect((await saved(page)).schemaVersion).toBe(3);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    expect(c.canonical(await saved(page))).toBe(c.canonical(e));
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    expect((await saved(page)).schemaVersion).toBe(3);
  });
test("upgrade preserves a literal date only after an explicit Plain text choice", async ({
  page,
}) => {
  const e = v2.fresh();
  e.document.captions = [
    { id: "date", label: v2.label("9/10/2026"), alignment: "right" },
  ];
  await page.addInitScript(
    (e) =>
      localStorage.setItem(
        "maths-booklet-tools:bar-model:v2",
        JSON.stringify({ storageVersion: 1, envelope: e }),
      ),
    e,
  );
  await page.goto("/tools/bar-model");
  await page
    .getByRole("button", {
      name: "Use horizontal fractions and larger answer spaces",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog"),
    confirm = dialog.getByRole("button", {
      name: "Use this model",
      exact: true,
    });
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText(/fraction/i);
  await dialog
    .getByLabel(
      "Keep existing calculation lines as Plain text (for dates or literal slashes)",
      { exact: true },
    )
    .check();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  const n = v.validate(await saved(page));
  expect(n.document.captions[0]).toEqual({
    ...e.document.captions[0],
    format: "plain",
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(c.canonical(await saved(page))).toBe(c.canonical(e));
});
test("v3 SVG PNG and both real clipboard routes retain native writing geometry and exact editable source", async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/tools/bar-model");
  await page
    .getByRole("button", { name: "Pupil model R5", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open bar model", exact: true })
    .click();
  const e = v.validate(await saved(page)),
    g = v.layout(e),
    before = c.canonical(e);
  expect(g.writingBoxes.length).toBeGreaterThan(1);
  for (const [name, ext] of [
    ["Download SVG", "svg"],
    ["Download PNG (600 ppi)", "png"],
  ] as const) {
    await page.getByRole("button", { name: "File", exact: true }).click();
    const event = page.waitForEvent("download");
    await page.getByRole("menuitem", { name, exact: true }).click();
    const file = await event;
    expect(await file.failure(), name).toBeNull();
    const path = info.outputPath(`v3-pupil.${ext}`);
    await file.saveAs(path);
    const bytes = await readFile(path);
    if (ext === "png")
      verifyPrintBytes(
        bytes,
        Math.round((g.width / 25.4) * 600),
        Math.round((g.height / 25.4) * 600),
      );
    else {
      expect(bytes.toString()).toContain("data:font/otf;base64,");
      expect(bytes.toString()).toContain('data-answer-line="true"');
    }
  }
  // Observe the actual payload while still calling the native clipboard writer.
  // Some OS/browser clipboard readbacks re-encode PNG and strip its pHYs chunk.
  await page.evaluate(() => {
    const write = navigator.clipboard.write.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard, "write", {
      configurable: true,
      value: (items: ClipboardItem[]) => {
        const result = write(items);
        return Promise.all([
          result,
          items[0].getType("image/png").then((b) => b.arrayBuffer()),
        ]).then(([, data]) => {
          (window as unknown as { copiedPng: number[] }).copiedPng = Array.from(
            new Uint8Array(data),
          );
        });
      },
    });
  });
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Image copied" }),
  ).toBeVisible();
  const bytes = await page.evaluate(async () => {
    const item = (await navigator.clipboard.read()).find((i) =>
      i.types.includes("image/png"),
    )!;
    return Array.from(
      new Uint8Array(await (await item.getType("image/png")).arrayBuffer()),
    );
  });
  const offered = await page.evaluate(
    () => (window as unknown as { copiedPng: number[] }).copiedPng,
  );
  verifyPrintBytes(
    Uint8Array.from(offered),
    Math.round((g.width / 25.4) * 600),
    Math.round((g.height / 25.4) * 600),
  );
  const pixelProof = await page.evaluate(
    async ({ readback, original }) => {
      async function pixels(bytes: number[]) {
        const bitmap = await createImageBitmap(
          new Blob([Uint8Array.from(bytes)], { type: "image/png" }),
        );
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return {
          width: bitmap.width,
          height: bitmap.height,
          digest: Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                context.getImageData(0, 0, bitmap.width, bitmap.height).data,
              ),
            ),
          ).join(","),
        };
      }
      return {
        actual: await pixels(readback),
        original: await pixels(original),
      };
    },
    { readback: bytes, original: offered },
  );
  expect(pixelProof.actual).toEqual(pixelProof.original);
  await page
    .getByRole("button", { name: "Copy for Word", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Copied for Word" }),
  ).toBeVisible();
  const size = await page.evaluate(async () => {
    const item = (await navigator.clipboard.read()).find((i) =>
        i.types.includes("text/html"),
      )!,
      doc = new DOMParser().parseFromString(
        await (await item.getType("text/html")).text(),
        "text/html",
      ),
      img = doc.querySelector("img")!;
    return { w: img.style.width, h: img.style.height };
  });
  expect(parseFloat(size.w)).toBeCloseTo(g.width / 10, 6);
  expect(parseFloat(size.h)).toBeCloseTo(g.height / 10, 6);
  await info.attach("clipboard-proof.json", {
    body: JSON.stringify({
      offered600ppiPNGVerified: true,
      readbackPixelsExact: true,
      readbackDensityMayBeNormalizedByOS: true,
      wordHtmlNativeCm: size,
      nativeWordInsertion: "pending",
    }),
    contentType: "application/json",
  });
  expect(c.canonical(await saved(page))).toBe(before);
});
for (const width of [320, 375, 768, 1440])
  test(`horizontal fraction draft remains focused and reachable at${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tools/bar-model");
    await page.getByRole("button", { name: "Worked R4", exact: true }).click();
    await page
      .getByRole("button", { name: "Edit calculation line 1", exact: true })
      .click();
    const input = page.getByLabel("Saved label", { exact: true });
    await input.fill("n/5 of 45 = 36");
    await input.focus();
    await expect(input).toBeFocused();
    const box = await page.locator(".bm-draft").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    await page.screenshot({ path: info.outputPath(`v3-focused-${width}.png`) });
    await input.press("Enter");
    const e = v.validate(await saved(page));
    expect(e.document.captions[0].label.text).toBe("n/5 of 45 = 36");
    await expect(
      page.locator('.bm-resource [data-fraction="horizontal"]'),
    ).not.toHaveCount(0);
  });
test("save status uses the shared vocabulary and is not red before any edit", async ({
  page,
}) => {
  await page.goto("/tools/bar-model");
  const status = page.locator(".resource-save-status");
  await expect(status).toHaveText("Saved on this device");
  await expect(status).toHaveClass(/resource-save-status--saved/);
});
test("save status stays neutral while damaged saved work waits for a recovery choice", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("maths-booklet-tools:bar-model:v2", "{not json"),
  );
  await page.goto("/tools/bar-model");
  const status = page.locator(".resource-save-status");
  await expect(status).toHaveText("Not saved on this device yet");
  await expect(status).toHaveClass(/resource-save-status--pending/);
});
