// The editor frame (docs/tools/APP-HOUSE-STYLE.md): at 1920 x 1080 every diagram tool fills the
// window under the app bar, the page itself does not scroll, and the diagram's stage takes the
// room the bars leave. The foot strip sits straight under the stage and holds zoom, print size,
// the hint and the latest message. Room is kept for the message and for a two-line hint,
// so neither a message arriving nor a prompt replacing the tip resizes the diagram.
import { test, expect, type Page } from "@playwright/test";
import { toolIds } from "../src/site/routes";

const STAGE = ".site-page:not([hidden]) .editor-card > .editor-stage";
const frame = (page: Page) =>
  page.evaluate((selector) => {
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const card = box(".site-page:not([hidden]) .editor-card"), stage = box(selector), settings = box(".site-page:not([hidden]) .inspector-stack");
    const foot = box(".site-page:not([hidden]) .editor-card > .editor-foot");
    return { page: document.documentElement.scrollHeight, cardBottom: card.bottom, stage: stage.height, stageBottom: stage.bottom, settingsBottom: settings.bottom, footTop: foot.top, foot: foot.height };
  }, STAGE);

for (const tool of toolIds)
  test(`${tool}: the tool fills a 1920 x 1080 window and the page does not scroll`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/tools/${tool}`);
    await expect(page.locator(STAGE)).toBeVisible();
    const at = await frame(page);
    expect(at.page, "the page is no taller than the window").toBeLessThanOrEqual(1080);
    expect(at.cardBottom).toBeLessThanOrEqual(1080);
    expect(at.settingsBottom).toBeLessThanOrEqual(1080);
    expect(at.stageBottom).toBeLessThanOrEqual(1080);
    // Two tools keep their own entry grid under the diagram; the rest give it nearly everything.
    expect(at.stage).toBeGreaterThanOrEqual(["two-way-table", "sample-space"].includes(tool) ? 480 : 800);
    expect(Math.abs(at.footTop - at.stageBottom), "the foot strip is straight under the stage").toBeLessThanOrEqual(1);
    expect(at.foot, "one row at this width").toBeLessThanOrEqual(40);
  });

test.describe("a message in the foot strip", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  // The Graph tool has its own toast.
  for (const tool of toolIds.filter((id) => id !== "graph"))
    test(`${tool}: "Image copied" shows in the foot strip beside the hint and leaves the diagram's stage the same size`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/tools/${tool}`);
      await expect(page.locator(STAGE)).toBeVisible();
      const before = await frame(page);
      await page.getByRole("button", { name: "Copy image", exact: true }).click();
      const line = page.locator(".site-page:not([hidden]) .editor-foot").getByRole("status").filter({ hasText: /copied/i });
      await expect(line).toBeVisible();
      await expect(page.locator(".site-page:not([hidden]) .editor-foot .editor-hint:not(.editor-hint--prompt)")).toBeVisible();
      const box = (await line.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(before.stageBottom - 1);
      expect(box.y + box.height).toBeLessThanOrEqual(before.cardBottom + 1);
      const after = await frame(page);
      expect(after.stage).toBe(before.stage);
      expect(after.foot, "the strip keeps its height").toBe(before.foot);
    });

  test("a prompt and a message together leave the strip and the stage the same size", async ({ page }) => {
    for (const width of [1100, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/tools/venn");
      await expect(page.locator(STAGE)).toBeVisible();
      const before = await frame(page);
      await page.getByRole("button", { name: "Shade", exact: true }).click();
      await page.getByRole("button", { name: "Copy image", exact: true }).click();
      const foot = page.locator(".site-page:not([hidden]) .editor-foot");
      await expect(foot.getByRole("status").filter({ hasText: /copied/i })).toBeVisible();
      await expect(foot.locator(".editor-hint--prompt")).toBeVisible();
      const after = await frame(page);
      expect(after.foot, `strip at ${width}`).toBe(before.foot);
      expect(after.stage, `stage at ${width}`).toBe(before.stage);
    }
  });

  test("a recovery panel under the card is never covered by the foot strip", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(() => localStorage.setItem("maths-booklet-tools:venn:v1", "{broken"));
    await page.goto("/tools/venn");
    const line = page.locator(".site-page:not([hidden])").getByRole("status").filter({ hasText: /needs recovery/ });
    await expect(line).toBeVisible();
    const box = (await line.boundingBox())!;
    const at = await frame(page);
    expect(box.y).toBeGreaterThanOrEqual(at.stageBottom - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(at.cardBottom + 1);
    const panel = (await page.locator(".vn-recovery").boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(at.cardBottom);
    expect(panel.y + panel.height).toBeLessThanOrEqual(1000);
  });

  test("a recovery block inside the card sits under the foot strip, with its button free to press", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(() => localStorage.setItem("maths-booklet-tools:cuboids:v1", "not-json"));
    await page.goto("/tools/cuboids");
    const button = page.getByRole("button", { name: "Download recovery data", exact: true });
    await expect(button).toBeVisible();
    const at = await frame(page), press = (await button.boundingBox())!;
    expect(Math.abs(at.footTop - at.stageBottom)).toBeLessThanOrEqual(1);
    expect(press.y).toBeGreaterThanOrEqual(at.footTop + at.foot - 1);
    expect(press.y + press.height).toBeLessThanOrEqual(at.cardBottom + 1);
    const download = page.waitForEvent("download");
    await button.click();
    await download;
  });

  test("with an entry grid under the diagram, the strip stays under the stage and the card scrolls", async ({ page }) => {
    // Sample space keeps its entry grid under the diagram, so on a small window its card scrolls.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/tools/sample-space");
    const card = page.locator(".site-page:not([hidden]) .editor-card");
    expect(await card.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(40);
    const at = await frame(page);
    expect(Math.abs(at.footTop - at.stageBottom)).toBeLessThanOrEqual(1);
    expect(at.footTop + at.foot, "in view before any scrolling").toBeLessThanOrEqual(800);
    await page.getByRole("button", { name: "Copy image", exact: true }).click();
    await expect(page.locator(".site-page:not([hidden]) .editor-foot").getByRole("status").filter({ hasText: /copied/i })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(800);
  });
});

for (const [width, height, why] of [[600, 900, "narrow"], [1280, 720, "short"]] as const)
  test(`a ${why} window keeps the stacked page that scrolls`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/tools/charts");
    await expect(page.locator(STAGE)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

for (const tool of toolIds)
  test(`${tool}: on a laptop window too short for the frame, the foot strip is still in view`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 650 });
    await page.goto(`/tools/${tool}`);
    await expect(page.locator(STAGE)).toBeVisible();
    const foot = page.locator(".site-page:not([hidden]) .editor-foot");
    await expect.poll(async () => { const box = (await foot.boundingBox())!; return box.y + box.height; }).toBeLessThanOrEqual(650);
    await expect(foot.getByRole("combobox", { name: "Preview zoom" })).toBeInViewport();
  });

test("the keyboard jump to the settings shows over the stage and does not resize the diagram", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/venn");
  await expect(page.locator(STAGE)).toBeVisible();
  const before = await frame(page);
  await page.getByRole("button", { name: "File", exact: true }).focus();
  await page.keyboard.press("Tab");
  const jump = page.getByRole("button", { name: "Edit settings ↓", exact: true });
  await expect(jump).toBeFocused();
  expect((await jump.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  expect((await frame(page)).stage).toBe(before.stage);
});

test("print keeps the stacked page: the frame is for screens only", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/tools/bar-model");
  await expect(page.locator(STAGE)).toBeVisible();
  const styles = () =>
    page.evaluate(() => ({
      app: getComputedStyle(document.querySelector(".site-app")!).display,
      card: getComputedStyle(document.querySelector(".site-page:not([hidden]) .editor-card")!).overflowY,
    }));
  expect(await styles()).toEqual({ app: "flex", card: "auto" });
  await page.emulateMedia({ media: "print" });
  expect(await styles()).toEqual({ app: "block", card: "hidden" });
});

// A tall window, such as a portrait monitor: the settings go underneath the diagram in three
// columns, so the diagram keeps the full width (docs/tools/APP-HOUSE-STYLE.md, "A tall window").
const tall = (page: Page) =>
  page.evaluate(() => {
    const shown = document.querySelector(".site-page:not([hidden])")!;
    const box = (s: string) => shown.querySelector(s)!.getBoundingClientRect();
    const card = box(".editor-card"), stage = box(".editor-card > .editor-stage"), foot = box(".editor-card > .editor-foot"), bar = box(".editor-toolbar");
    const settings = shown.querySelector(".inspector-stack")!, area = settings.getBoundingClientRect(), workspace = shown.querySelector(".workspace")!;
    // In two tools the cards sit inside groups that have no box of their own. The jump back to
    // the diagram is out of sight until the keyboard reaches it.
    const cards = [...settings.querySelectorAll(":scope > *, :scope > :is(.graph-control-group, .ratio-settings) > *")].filter((el) => el.getClientRects().length && !el.matches(".editor-diagram-link"));
    return {
      page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      card: { top: card.top, bottom: card.bottom, width: card.width, height: card.height },
      stage: { width: stage.width, height: stage.height, bottom: stage.bottom }, footTop: foot.top, bar: bar.height,
      settings: { top: area.top, left: area.left, width: area.width },
      workspace: { height: workspace.clientHeight, scroll: workspace.scrollHeight - workspace.clientHeight },
      columns: [...new Set(cards.map((el) => Math.round(el.getBoundingClientRect().left)))].length,
      split: cards.filter((el) => el.getClientRects().length > 1).length,
      widest: Math.max(...cards.map((el) => el.getBoundingClientRect().width)),
    };
  });

for (const tool of toolIds)
  test(`${tool}: on a 1080 x 1920 window the settings sit under the diagram in three columns`, async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 });
    await page.goto(`/tools/${tool}`);
    await expect(page.locator(STAGE)).toBeVisible();
    const at = await tall(page);
    expect(at.page[0], "no sideways scroll").toBeLessThanOrEqual(1080);
    expect(at.page[1], "the page is no taller than the window").toBeLessThanOrEqual(1920);
    expect(at.card.width, "the diagram's card has the full width").toBeGreaterThanOrEqual(1000);
    expect(at.stage.width).toBeGreaterThanOrEqual(1000);
    expect(Math.abs(at.card.height - (at.workspace.height * 2) / 3), "two thirds of the height, whatever the settings hold").toBeLessThanOrEqual(2);
    expect(at.settings.top, "the settings start under the card").toBeGreaterThanOrEqual(at.card.bottom);
    expect(at.settings.width).toBeGreaterThanOrEqual(1000);
    // Short cards share a column where one long card sets the height, so some tools fill two.
    expect(at.columns, "at least two columns").toBeGreaterThanOrEqual(2);
    expect(at.columns, "at most three columns").toBeLessThanOrEqual(3);
    expect(at.split, "no settings card is split between columns").toBe(0);
    expect(at.widest).toBeLessThanOrEqual(at.settings.width / 3);
    expect(Math.abs(at.footTop - at.stage.bottom), "the foot strip is straight under the stage").toBeLessThanOrEqual(1);
    expect(at.bar, "the action bar is one row").toBeLessThanOrEqual(60);
  });

test("on a tall window long settings scroll under the diagram, which stays where it is", async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto("/tools/bar-model");
  await expect(page.locator(STAGE)).toBeVisible();
  const before = await tall(page);
  expect(before.workspace.scroll, "Bar modelling's settings are longer than the room left").toBeGreaterThan(100);
  const shown = page.locator(".site-page:not([hidden])");
  const last = shown.locator(".inspector-stack button").last();
  await expect(last).not.toBeInViewport();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  const after = await tall(page);
  expect(after.card.top, "the card has not moved").toBe(before.card.top);
  expect(after.stage.height).toBe(before.stage.height);
  expect(after.settings.top, "the settings have gone up under the card").toBeLessThan(before.settings.top);
  // A control that takes focus comes out from under the card.
  const first = shown.locator(".inspector-stack select").first();
  await first.focus();
  expect((await first.boundingBox())!.y).toBeGreaterThanOrEqual(after.card.bottom);
  expect(await page.evaluate(() => document.documentElement.scrollHeight), "the page itself still does not scroll").toBeLessThanOrEqual(1920);
});

test("on a tall window the action bar keeps its words, and gives them up only where an answers switch needs the room", async ({ page }) => {
  const words = async () => {
    const bar = page.locator(".site-page:not([hidden]) .editor-toolbar");
    await expect(bar).toBeVisible();
    expect((await bar.boundingBox())!.height, "one row").toBeLessThanOrEqual(60);
    return { examples: await bar.locator(".example-launch-button span").isVisible(), copyIcon: await bar.locator(".copy-main > svg").first().isVisible() };
  };
  // [width, height, tool, Examples and Start again show their words, the copy buttons show their icons]
  for (const [width, height, tool, examples, copyIcon] of [
    [1080, 1920, "bar-model", true, true], [1000, 1300, "graph", true, true],
    [1080, 1920, "elevations", false, true], [1037, 1400, "elevations", false, false], [1173, 1600, "elevations", true, true],
    // Exactly four fifths, a 1280 x 1024 monitor turned on its side, counts as tall.
    [1024, 1280, "bar-model", true, true],
    // Not tall: the steps of a wide window still apply.
    [1080, 1100, "bar-model", false, false], [1279, 900, "bar-model", false, true], [1280, 900, "bar-model", true, true],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(`/tools/${tool}`);
    expect(await words(), `${tool} at ${width} x ${height}`).toEqual({ examples, copyIcon });
  }
});

test("on a tall window nothing done in the settings resizes the diagram", async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto("/tools/graph");
  await expect(page.locator(STAGE)).toBeVisible();
  const before = await tall(page);
  const shown = page.locator(".site-page:not([hidden])");
  for (const name of ["Precise axis ranges", "Exam-style axes and grid", "Print settings"]) await shown.locator(".inspector-stack summary").filter({ hasText: name }).click();
  const after = await tall(page);
  expect(after.workspace.scroll, "the settings are now longer than the room left").toBeGreaterThan(0);
  expect(after.card).toEqual(before.card);
  expect(after.stage).toEqual(before.stage);
  expect(after.split).toBe(0);
});

test("on a tall window a triangle's label editor opens in view, not under the diagram", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 1250 });
  await page.goto("/tools/triangle");
  await expect(page.locator(STAGE)).toBeVisible();
  const workspace = page.locator(".site-page:not([hidden]) .workspace");
  // Open the folded sections, so that the settings are well over the room left.
  await workspace.evaluate((el) => {
    for (const fold of el.querySelectorAll<HTMLDetailsElement>(".inspector-stack details")) fold.open = true;
    el.scrollTop = el.scrollHeight;
  });
  expect(await workspace.evaluate((el) => el.scrollTop), "far enough to put the editor's place under the card").toBeGreaterThan(300);
  await page.locator('[data-tr-anchor="e:AB"]').click();
  const input = page.locator("[data-tr-label-text]");
  await expect(input).toBeFocused();
  await expect(input).toBeInViewport();
  expect((await input.boundingBox())!.y).toBeGreaterThanOrEqual((await tall(page)).card.bottom);
});

for (const [width, height, why] of [[1920, 1080, "wide"], [900, 1600, "tall but narrow"], [1300, 1500, "not tall enough for its width"]] as const)
  test(`a ${why} window keeps the settings beside the diagram`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/tools/graph");
    await expect(page.locator(STAGE)).toBeVisible();
    const at = await tall(page);
    expect(at.settings.left).toBeGreaterThanOrEqual(at.card.width);
    expect(at.settings.top).toBeLessThan(at.card.bottom);
    expect(at.columns).toBe(1);
  });
