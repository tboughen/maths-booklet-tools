import { test, expect, type Page } from "./release-fixtures";
import { comparativeBarCharts } from "../packages/resource-core/src/fixtures";

// The settings kit (docs/tools/APP-HOUSE-STYLE.md, "The settings kit"), on Bar modelling, Statistical charts, the tree tools, Plans and elevations
// and the other tools that share the tree tools' settings classes.
const card = (page: Page, heading: string) =>
  page.locator(".md-kit .site-panel").filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
const box = async (page: Page, heading: string) => (await card(page, heading).boundingBox())!;

test("a wide window sets the settings cards in two fixed columns, with 32 px controls", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/bar-model");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const [model, whole, title, examples] = await Promise.all(
    ["Current model", "Whole labels and ranges", "Title and calculations", "Lesson examples"].map((name) => box(page, name)),
  );
  // Left: the model and its labels. Right: the title, the output and the examples.
  expect(whole.x).toBe(model.x);
  expect(examples.x).toBe(title.x);
  expect(title.x).toBeGreaterThanOrEqual(model.x + model.width);
  expect(whole.y).toBeGreaterThan(model.y + model.height);
  expect(Math.abs(title.width - model.width)).toBeLessThanOrEqual(1);
  // Nothing is squeezed: the diagram keeps most of the window.
  const stage = (await page.locator(".editor-card").first().boundingBox())!;
  expect(stage.width).toBeGreaterThan(1200);
  // The settings were 3,369 px long before the kit.
  expect(await stack.evaluate((el) => el.scrollHeight)).toBeLessThan(1150);

  for (const name of ["Edit quantity name", "Select all sections", "Add bar", "Edit title", "Worked R4"]) {
    const button = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(button.height, name).toBe(32);
  }
  for (const name of ["Bar", "Label position", "Fill", "Output"])
    expect((await page.getByLabel(name, { exact: true }).boundingBox())!.height, name).toBe(32);
  expect(await page.getByLabel("Section 1", { exact: true }).boundingBox()).toMatchObject({ width: 16, height: 16 });
  // The diagram's own buttons are not settings.
  expect((await page.getByRole("button", { name: "+ Section", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // A card stays in its column when another opens or a form appears above it.
  await page.getByText("Start a new model", { exact: true }).click();
  await expect(page.getByLabel("Equal sections", { exact: true })).toBeVisible();
  expect(await box(page, "Title and calculations")).toEqual(title);
  expect((await box(page, "Current model")).x).toBe(model.x);
  await page.getByRole("button", { name: "Edit quantity name", exact: true }).click();
  await expect(page.getByLabel("Saved label", { exact: true })).toBeFocused();
  expect(await box(page, "Title and calculations")).toEqual(title);
  expect((await page.locator(".bm-draft").boundingBox())!.x).toBeLessThan(title.x);
  // What went wrong stands out from the notes around it.
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Add calculation line", exact: true }).click();
  await page.getByLabel("Saved label", { exact: true }).fill("9/10/2026");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const alert = page.locator(".bm-draft [role=alert]");
  await expect(alert).toBeVisible();
  expect(await alert.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(179, 38, 30)");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  // A dialog that opens from the settings is not a settings card and keeps its own buttons.
  await page.getByRole("button", { name: "Pupil model R1", exact: true }).click();
  const cancel = page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true });
  expect((await cancel.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("a smaller window keeps one column of settings, and a phone gets finger-sized controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tools/bar-model");
  const model = await box(page, "Current model"), title = await box(page, "Title and calculations");
  expect(title.x).toBe(model.x);
  expect(title.y).toBeGreaterThan(model.y + model.height);
  expect((await page.getByRole("button", { name: "Edit quantity name", exact: true }).boundingBox())!.height).toBe(32);
  // Two columns start only where the diagram still has the room it has at 1440.
  await page.setViewportSize({ width: 1790, height: 900 });
  expect((await box(page, "Title and calculations")).x).toBe((await box(page, "Current model")).x);
  await page.setViewportSize({ width: 1800, height: 900 });
  expect((await box(page, "Title and calculations")).x).toBeGreaterThan((await box(page, "Current model")).x);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1100);

  await page.setViewportSize({ width: 375, height: 800 });
  for (const name of ["Edit quantity name", "Edit inside label", "Worked R4"])
    expect((await page.getByRole("button", { name, exact: true }).first().boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
  expect((await page.getByLabel("Bar", { exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByText("Section 1", { exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("an upright monitor sets the same cards in three columns under the diagram", async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto("/tools/bar-model");
  const lefts = new Set<number>();
  for (const name of ["Start a new model", "Current model", "Whole labels and ranges", "Title and calculations", "Lesson examples"]) {
    const b = await box(page, name);
    lefts.add(Math.round(b.x));
    expect(b.width, name).toBeLessThan(360);
  }
  expect(lefts.size).toBe(3);
});

// Statistical charts: its cards are `.panel-card`, and every chart type has a data card and settings cards.
const chartCard = async (page: Page, heading: string) =>
  (await page.locator(".md-kit .panel-card").filter({ has: page.getByRole("heading", { name: heading, exact: true }) }).boundingBox())!;
// What every tool on the kit shares: the heights of its buttons and fields, the width of its ticks, buttons that are
// off and faded as well (there should be none), cards with something cut off, and the font of a card's heading.
// A test names the few buttons whose words need a second line in a narrow column; every other button is measured.
// Only controls that are drawn count: one inside a closed part (a shut <details>) has no box at all.
const kitSizes = (page: Page, twoLines: string[] = []) =>
  page.locator(".inspector-stack.md-kit").evaluate((el, twoLines) => {
    const drawn = (selector: string) => [...el.querySelectorAll<HTMLElement>(selector)].filter((c) => c.getClientRects().length > 0);
    return {
      // A folded group's row and a text link in a hint line are words, not buttons to size.
      buttons: [...new Set(drawn(".panel-card button:not(.md-fold-toggle, .pt-link)").filter((b) => !twoLines.includes(b.textContent ?? "")).map((b) => b.getBoundingClientRect().height))],
      fields: [...new Set(drawn(".panel-card :is(select, input:not([type=checkbox]))").map((b) => b.getBoundingClientRect().height))],
      ticks: [...new Set(drawn(".panel-card input[type=checkbox]").map((b) => b.getBoundingClientRect().width))],
      faded: [...el.querySelectorAll<HTMLElement>(".panel-card button:disabled")].filter((b) => getComputedStyle(b).opacity !== "1").length,
      cut: [...el.querySelectorAll<HTMLElement>(".panel-card")].filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.querySelector("h2")?.textContent),
      heading: getComputedStyle(el.querySelector(".panel-card h2")!).font,
    };
  }, twoLines);
// The controls in the cards that are too small for a finger (there should be none on a phone).
const tooSmall = (page: Page) =>
  page.locator(".inspector-stack.md-kit").evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>(".panel-card :is(button, select, input:not([type=checkbox]), label:has(> input[type=checkbox]))")]
      .filter((c) => c.getBoundingClientRect().height > 0 && c.getBoundingClientRect().height < 44)
      .map((c) => c.textContent || c.getAttribute("aria-label")),
  );

test("Statistical charts uses the kit: the data in one column and its settings in the other", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/charts");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const type = await chartCard(page, "Chart type"), data = await chartCard(page, "Data"), axes = await chartCard(page, "Axes and grid");
  expect(data.x).toBe(type.x);
  expect(data.y).toBeGreaterThan(type.y + type.height);
  expect(axes.x).toBeGreaterThanOrEqual(type.x + type.width);
  expect(Math.abs(axes.width - type.width)).toBeLessThanOrEqual(1);
  // The settings were 1,432 px long before the kit. Now they are all in view.
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);

  // The chart type that is on is marked, and a click moves the mark.
  const dual = page.getByRole("button", { name: "Dual bar chart", exact: true });
  const colour = (name: string) => page.getByRole("button", { name, exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(dual).toHaveAttribute("aria-pressed", "true");
  expect((await dual.boundingBox())!.height).toBe(32);
  expect(await colour("Dual bar chart")).toBe("rgb(230, 239, 255)");
  expect(await colour("Pictogram")).toBe("rgb(255, 255, 255)");
  // A table's fields keep their own width, and its ticks are ticks.
  expect(await page.getByLabel("Value for Car, boys", { exact: true }).boundingBox()).toMatchObject({ width: 84, height: 32 });
  expect(await page.getByLabel("Axis start", { exact: true }).evaluate((el) => el.getBoundingClientRect().height)).toBe(32);
  expect(await page.locator(".ch-table .ch-hide input").first().boundingBox()).toMatchObject({ width: 16, height: 16 });
  const heading = await page.getByRole("heading", { name: "Chart type", exact: true }).evaluate((el) => getComputedStyle(el).font);
  expect(heading).toContain("600 17px");

  // Every chart type keeps its data on the left and its settings on the right, with nothing cut off.
  for (const [kind, left, right] of [
    ["Pie chart", "Data", "Pie chart"],
    ["Pictogram", "Data", "Pictogram"],
    ["Scatter graph", "Points", "Line of best fit and readings"],
    ["Histogram", "Classes", "Axes and graph paper"],
    ["Frequency polygon", "Classes", "Polygons and mistakes"],
    ["Cumulative frequency graph", "Classes", "Readings"],
    ["Box plot", "Box plots", "Scale and graph paper"],
    ["Stem-and-leaf diagram", "Stems and leaves", "Key and size"],
    ["Time series graph", "Times and values", "Axes and graph paper"],
  ]) {
    await page.getByRole("button", { name: kind, exact: true }).click();
    expect((await chartCard(page, left)).x, kind).toBe(type.x);
    expect((await chartCard(page, right)).x, kind).toBe(axes.x);
    const cut = await stack.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>(".panel-card")].filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.querySelector("h2")?.textContent),
    );
    expect(cut, kind).toEqual([]);
  }
  // A value that cannot be used is outlined in red, and a narrow table field stays narrow.
  await page.getByRole("button", { name: "Bar chart", exact: true }).click();
  const value = page.getByLabel("Value for Car", { exact: true });
  await value.fill("lots");
  await value.press("Enter");
  await expect(value).toHaveAttribute("aria-invalid", "true");
  expect(await value.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe("rgb(179, 38, 30)");
  expect((await value.boundingBox())!.width).toBe(84);
});

test("Statistical charts keeps one column in a smaller window, three on an upright monitor and finger-sized controls on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tools/charts");
  const type = await chartCard(page, "Chart type"), axes = await chartCard(page, "Axes and grid");
  expect(axes.x).toBe(type.x);
  expect(axes.y).toBeGreaterThan(type.y + type.height);

  await page.setViewportSize({ width: 1080, height: 1920 });
  const lefts = new Set<number>();
  for (const name of ["Chart type", "Data", "Axes and grid"]) lefts.add(Math.round((await chartCard(page, name)).x));
  expect(lefts.size).toBe(3);

  await page.setViewportSize({ width: 375, height: 800 });
  expect((await page.getByRole("button", { name: "Pictogram", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByLabel("Value for Car, boys", { exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await page.getByLabel("Axis start", { exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

// The three tree tools. Each: its address, the card a click on the tree opens, the cards on the left, the cards on the
// right, and how many columns its cards make on an upright monitor (the browser balances them and never splits a card).
/** Tools whose settings are one narrow column with folded groups (from 21 Nov 2026). */
const ONE_COLUMN = new Set(["/tools/probability-tree", "/tools/frequency-tree", "/tools/factor-tree", "/tools/sample-space", "/tools/two-way-table", "/tools/probability-objects", "/tools/function-machine", "/tools/bubble-method", "/tools/written-method"]);
const TREES: [string, string, string[], string[], number][] = [
  ["/tools/probability-tree", "Branches", ["What pupils see"], ["Fill probabilities", "Outcome columns", 'Questions and "given that"', "Layout"], 2],
  ["/tools/frequency-tree", "Total and groups", ["What pupils see"], ["Work out counts", "Questions", "Layout"], 2],
  ["/tools/factor-tree", "Trees and answer lines", ["What pupils see"], ["Complete the trees", "Layout"], 2],
  ["/tools/sample-space", "What pupils see", ["What pupils see"], ["Fill the cells", "Layout"], 2],
  ["/tools/two-way-table", "What pupils see", ["What pupils see"], ["Totals", "Layout"], 2],
  ["/tools/probability-objects", "Objects", ["What pupils see"], ["Layout"], 2],
  ["/tools/function-machine", "Machines", ["What pupils see"], ["Work the machines out", "Layout"], 2],
  ["/tools/bubble-method", "Steps", ["What pupils see"], ["Layout"], 2],
  ["/tools/written-method", "Method", ["What pupils see"], ["Work the method out", "Layout"], 3],
];

test("the tree tools use the kit: the tree's own values on the left, what is done with them on the right, all in view", async ({ page }) => {
  // One pass per tool on the pattern: allow for the whole list.
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const [path, selected, left, right] of TREES) {
    await page.goto(path);
    const stack = page.locator(".inspector-stack.md-kit");
    await expect(stack).toBeVisible();
    await page.locator(".pt-hit").first().click();
    const chosen = (await page.locator(`.md-kit .panel-card[aria-label="${selected}"]`).boundingBox())!;
    const layout = await chartCard(page, "Layout");
    for (const name of left) expect((await chartCard(page, name)).x, `${path} ${name}`).toBe(chosen.x);
    if (ONE_COLUMN.has(path)) {
      // One narrow column (the usability pilot): the folded groups sit under the cards, in one card, inset by its border.
      for (const name of right) expect(Math.abs((await chartCard(page, name)).x - chosen.x), `${path} ${name}`).toBeLessThanOrEqual(1);
      expect(layout.y, path).toBeGreaterThan(chosen.y + chosen.height);
    } else {
      for (const name of right) expect((await chartCard(page, name)).x, `${path} ${name}`).toBe(layout.x);
      expect(layout.x, path).toBeGreaterThanOrEqual(chosen.x + chosen.width);
      expect(Math.abs(layout.width - chosen.width), path).toBeLessThanOrEqual(1);
    }
    // With something selected the settings were 1,597, 1,531 and 1,157 px long before the kit.
    // A one-column stack may scroll (a tree opens with its path-end working, 22 Nov 2026); a fade at its foot then shows there is more.
    expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight || "more" in el.dataset), path).toBe(true);
    if (!ONE_COLUMN.has(path)) expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight), path).toBe(true);
    expect((await page.locator(".editor-card").first().boundingBox())!.width, path).toBeGreaterThan(1200);
    // Some tools keep every field in a folded group: open one to measure it.
    if (path === "/tools/sample-space") await page.getByRole("button", { name: "Fill the cells", exact: true }).click();
    if (["/tools/two-way-table", "/tools/function-machine", "/tools/bubble-method", "/tools/written-method"].includes(path)) await page.getByRole("button", { name: "Layout", exact: true }).click();
    const sizes = await kitSizes(page);
    expect(sizes, path).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });
    // Every card in the one column folds (22 Nov 2026), so its headings are the fold rows' 15 px.
    expect(sizes.heading, path).toContain(ONE_COLUMN.has(path) ? "600 15px" : "600 17px");
  }
  // Frequency trees (one column, 22 Nov 2026): no Hide ticks (What pupils see and the tree set pupil spaces), and the
  // list grows with the tree instead of scrolling inside its card.
  await page.goto("/tools/frequency-tree");
  await expect(page.locator(".pt-hide input[aria-label^='Hide']")).toHaveCount(0);
  const list = page.locator(".pt-branches").first();
  expect(await list.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
});

test("the tree tools keep one column in a smaller window, three on an upright monitor and finger-sized controls on a phone", async ({ page }) => {
  // One pass per tool on the pattern: allow for the whole list.
  test.setTimeout(120_000);
  for (const [path, , left, right, upright] of TREES) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const first = await chartCard(page, left[0]), layout = await chartCard(page, "Layout");
    expect(Math.abs(layout.x - first.x), path).toBeLessThanOrEqual(1);
    expect(layout.y, path).toBeGreaterThan(first.y + first.height);

    await page.setViewportSize({ width: 1080, height: 1920 });
    const lefts = new Set<number>();
    // To the nearest 4 px: folded groups sit 1 px in, inside their shared card.
    for (const name of [...left, ...right]) lefts.add(Math.round((await chartCard(page, name)).x / 4));
    expect(lefts.size, path).toBe(upright);

    await page.setViewportSize({ width: 375, height: 800 });
    const small = await tooSmall(page);
    expect(small, path).toEqual([]);
    // The list of branches is as long as it needs to be: no scrolling inside the scrolling page.
    const lists = await page.locator(".pt-branches").evaluateAll((all) => all.map((el) => el.scrollHeight <= el.clientHeight));
    expect(lists, path).toEqual(["/tools/factor-tree", "/tools/sample-space", "/tools/two-way-table", "/tools/probability-objects", "/tools/function-machine", "/tools/bubble-method", "/tools/written-method"].includes(path) ? [] : [true]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
});

test("Plans and elevations uses the kit: the solid on the left with printing under it, the panels on the right", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/elevations");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const solid = (await page.locator('.md-kit .panel-card[aria-label="The solid"]').boundingBox())!;
  const printing = await chartCard(page, "Printing"), panels = await chartCard(page, "Panels");
  expect(printing.x).toBe(solid.x);
  expect(printing.y).toBeGreaterThan(solid.y + solid.height);
  expect(panels.x).toBeGreaterThanOrEqual(solid.x + solid.width);
  expect(panels.y).toBe(solid.y);
  // The settings were 1,693 px long before the kit. With four panels they are now about 1,000 px in a 967 px column.
  expect(await stack.evaluate((el) => el.scrollHeight)).toBeLessThan(1100);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);

  // The grid of heights stays a small grid, and a square with cubes on it stays marked.
  const grid = (await page.locator(".ev-heights").boundingBox())!;
  expect(grid.width).toBeLessThan(solid.width / 2);
  const filled = page.locator(".ev-heights select.ev-filled").first(), empty = page.locator(".ev-heights select:not(.ev-filled)").first();
  expect(await filled.boundingBox()).toMatchObject({ height: 32 });
  expect(await filled.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(230, 239, 255)");
  expect(await empty.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
  // The widest solid there can be (six columns) still fits its card at the narrowest two-column window.
  await page.setViewportSize({ width: 1800, height: 900 });
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Add a column on the right", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add a column on the right", exact: true })).toBeDisabled();
  const fits = await page.locator(".ev-heights").evaluate((el) => {
    const cardStyle = getComputedStyle(el.closest(".panel-card")!), card = el.closest(".panel-card")!.getBoundingClientRect();
    return el.getBoundingClientRect().right <= card.right - parseFloat(cardStyle.paddingRight) - parseFloat(cardStyle.borderRightWidth);
  });
  expect(fits).toBe(true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const sizes = await kitSizes(page);
  expect(sizes).toMatchObject({ buttons: [32], fields: [32], faded: 0, cut: [] });

  // One column in a smaller window, in the same order.
  await page.setViewportSize({ width: 1440, height: 900 });
  const [a, b, c] = [(await page.locator('.md-kit .panel-card[aria-label="The solid"]').boundingBox())!, await chartCard(page, "Panels"), await chartCard(page, "Printing")];
  expect([b.x, c.x]).toEqual([a.x, a.x]);
  expect(b.y).toBeGreaterThan(a.y);
  expect(c.y).toBeGreaterThan(b.y);

  // Finger-sized controls on a phone, and the page is no wider than the window.
  await page.setViewportSize({ width: 375, height: 800 });
  const small = await tooSmall(page);
  expect(small).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Expanding and factorising uses the kit: the task on the left, the print size on the right, all in view", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/expanding-factorising");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const task = await chartCard(page, "Teaching resource"), size = await chartCard(page, "Print size");
  expect(size.y).toBe(task.y);
  expect(size.x).toBeGreaterThanOrEqual(task.x + task.width);
  expect(Math.abs(size.width - task.width)).toBeLessThanOrEqual(1);
  // The settings were 1,337 px long in a 967 px column before the kit. Now they are all in view.
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);

  // The three sizes are choices with their millimetres on a second line, and the one that is on is marked.
  const sizes = page.locator(".md-kit .ag-presets button");
  const names = (await sizes.allTextContents()) as string[];
  expect(names).toEqual(["Compact12 mm", "Default15 mm", "Larger18 mm"]);
  expect(await kitSizes(page, names)).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });
  await expect(sizes.nth(1)).toHaveAttribute("aria-pressed", "true");
  expect(await sizes.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(230, 239, 255)");
  expect(await sizes.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
  // A button in a row keeps its own width.
  expect((await page.getByRole("button", { name: "Fill products", exact: true }).boundingBox())!.width).toBeLessThan(task.width / 2);

  // The buttons that apply a typed setting come under its field, at the kit's height.
  const cell = page.getByLabel("Cell size (mm)", { exact: true });
  await cell.fill("16");
  const field = (await cell.boundingBox())!, apply = (await page.getByRole("button", { name: "Apply setting", exact: true }).boundingBox())!;
  expect(apply.height).toBe(32);
  expect(Math.abs(apply.y - (field.y + field.height) - 8)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Cancel setting", exact: true }).click();

  // The help is the last thing in the Print size card, and its paragraphs keep a space between them.
  const help = page.locator(".md-kit .panel-card details").filter({ hasText: "Notation and help" });
  expect(await help.locator("summary").evaluate((el) => [getComputedStyle(el).cursor, getComputedStyle(el).fontWeight])).toEqual(["pointer", "500"]);
  await help.locator("summary").click();
  expect(await help.locator("p").evaluateAll((all) => all.map((p) => getComputedStyle(p).marginTop))).toEqual(["6px", "6px", "6px", "6px"]);
  const open = await chartCard(page, "Print size");
  expect((await help.boundingBox())!.y + (await help.boundingBox())!.height).toBeLessThanOrEqual(open.y + open.height);

  // One column in a smaller window, in the same order.
  await page.setViewportSize({ width: 1440, height: 900 });
  const [a, b] = [await chartCard(page, "Teaching resource"), await chartCard(page, "Print size")];
  expect(b.x).toBe(a.x);
  expect(b.y).toBeGreaterThan(a.y + a.height);

  // Finger-sized controls on a phone, and the page is no wider than the window.
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await tooSmall(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Venn diagrams uses the kit: the diagram and its print size on the left, the regions on the right, all in view", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/venn");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const [tools, diagram, regions, size] = [await chartCard(page, "Diagram tools"), await chartCard(page, "Diagram"), await chartCard(page, "Region contents"), await chartCard(page, "Print size")];
  expect(regions.y).toBe(tools.y);
  expect(regions.x).toBeGreaterThanOrEqual(tools.x + tools.width);
  expect(Math.abs(regions.width - tools.width)).toBeLessThanOrEqual(1);
  expect([diagram.x, size.x]).toEqual([tools.x, tools.x]);
  expect(diagram.y).toBeGreaterThan(tools.y + tools.height);
  expect(size.y).toBeGreaterThan(diagram.y + diagram.height);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);

  // Edit or Shade sits beside the number of sets, level with its field.
  const shade = (await page.getByRole("button", { name: "Shade", exact: true }).boundingBox())!, sets = (await page.getByLabel("Number of sets", { exact: true }).boundingBox())!;
  expect(Math.abs(shade.y + shade.height - (sets.y + sets.height))).toBeLessThanOrEqual(1);
  expect(sets.x).toBeGreaterThan(shade.x + shade.width);

  // The three arrangements are choices in one row, each a picture over its name, and the one that is on is marked.
  const choices = page.locator(".md-kit .vn-arrangements button");
  const names = (await choices.allTextContents()) as string[];
  expect(names.map((n) => n.replace(/^[AB]+/, ""))).toEqual(["Overlap", "Separate", "Nested"]);
  const rows = await choices.evaluateAll((all) => all.map((b) => b.getBoundingClientRect().y));
  expect(new Set(rows).size).toBe(1);
  await expect(choices.nth(0)).toHaveAttribute("aria-pressed", "true");
  expect(await choices.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(230, 239, 255)");
  expect(await choices.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");

  // A region's row is one line: its name on the left, what it holds on the right.
  const row = page.locator(".md-kit .vn-regions button").first();
  const [rowBox, held] = [(await row.boundingBox())!, (await row.locator("small").boundingBox())!];
  expect(rowBox.height).toBe(32);
  expect(held.x + held.width).toBeGreaterThan(rowBox.x + rowBox.width - 14);

  // With the labels open and three sets, every control keeps the kit's size and the settings are still all in view.
  // They were 1,060 px long in a 967 px column before the kit, with the labels closed.
  await page.getByLabel("Number of sets", { exact: true }).selectOption("3");
  const labels = page.locator(".md-kit .panel-card details").filter({ hasText: "Labels and definitions" });
  expect(await labels.locator("summary").evaluate((el) => [getComputedStyle(el).cursor, getComputedStyle(el).fontWeight])).toEqual(["pointer", "500"]);
  await labels.locator("summary").click();
  expect(await kitSizes(page, names)).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  await page.getByLabel("Number of sets", { exact: true }).selectOption("2");

  // The help closes the right column's card, Region contents or Region shading, and stays open from one to the other.
  const help = page.locator(".md-kit .panel-card details").filter({ hasText: "Editing and printing help" });
  await help.locator("summary").click();
  expect(await help.locator("p").evaluateAll((all) => all.map((p) => getComputedStyle(p).marginTop))).toEqual(["6px", "6px"]);
  const open = await chartCard(page, "Region contents");
  expect((await help.boundingBox())!.y + (await help.boundingBox())!.height).toBeLessThanOrEqual(open.y + open.height);
  await page.getByRole("button", { name: "Shade", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Print size", exact: true })).toHaveCount(0);
  const shading = await chartCard(page, "Region shading");
  expect([shading.x, shading.y]).toEqual([regions.x, regions.y]);
  await expect(page.locator(".md-kit .panel-card").filter({ hasText: "Region shading" }).locator("details[open]")).toContainText("Editing and printing help");
  expect(await kitSizes(page, names)).toMatchObject({ buttons: [32], fields: [32], faded: 0, cut: [] });
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(help).toHaveAttribute("open", "");

  // One column in a smaller window, in the order the Tab key takes them at any size.
  await page.setViewportSize({ width: 1440, height: 900 });
  const column = [await chartCard(page, "Diagram tools"), await chartCard(page, "Diagram"), await chartCard(page, "Print size"), await chartCard(page, "Region contents")];
  expect(new Set(column.map((c) => c.x)).size).toBe(1);
  expect(column.map((c) => c.y)).toEqual([...column.map((c) => c.y)].sort((a, b) => a - b));

  // Finger-sized controls on a phone, and the page is no wider than the window.
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await tooSmall(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Number lines uses the kit: drawing and the scale on the left with More settings under them, the second scale on the right", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/number-line");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const more = page.locator(".md-kit .panel-card").filter({ hasText: "More settings" });
  const cards = async () => [await chartCard(page, "Selected item"), await chartCard(page, "Draw"), await chartCard(page, "Scale"), (await more.boundingBox())!, await chartCard(page, "Second scale")];
  const [selected, draw, scale, moreBox, second] = await cards();
  expect(second.y).toBe(selected.y);
  expect(second.x).toBeGreaterThanOrEqual(selected.x + selected.width);
  expect(Math.abs(second.width - selected.width)).toBeLessThanOrEqual(1);
  expect([draw.x, scale.x, moreBox.x]).toEqual([selected.x, selected.x, selected.x]);
  expect([selected.y, draw.y, scale.y, moreBox.y]).toEqual([selected.y, draw.y, scale.y, moreBox.y].sort((a, b) => a - b));
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);

  // The three ways to draw share a row, and the one that is on is marked as the kit marks a choice.
  const point = page.getByRole("button", { name: "Point", exact: true });
  expect(await page.locator(".md-kit .nl-draw-actions button").evaluateAll((all) => new Set(all.map((b) => b.getBoundingClientRect().y)).size)).toBe(1);
  await point.click();
  await expect(point).toHaveAttribute("aria-pressed", "true");
  expect(await point.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color])).toEqual(["rgb(230, 239, 255)", "rgb(20, 38, 61)"]);
  await point.click();

  // A field that shows what is wrong under it stays level with the fields beside it.
  const step = page.getByLabel("Tick step", { exact: true });
  await step.fill("0");
  await step.press("Enter");
  await expect(page.locator(".md-kit .nl-scale-fields [role=alert]")).toBeVisible();
  expect((await step.boundingBox())!.y).toBe((await page.getByLabel("First tick", { exact: true }).boundingBox())!.y);
  await step.press("Escape");
  await expect(page.locator(".md-kit .nl-scale-fields [role=alert]")).toHaveCount(0);

  // A second scale with eleven ticks is the long card. It has the right column to itself, so it is still all in view.
  await page.getByRole("button", { name: "Add a second scale", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove second scale", exact: true })).toBeVisible();
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);

  // Every part that opens is a row as tall as a control, and what is in it keeps the kit's sizes.
  await stack.evaluate((el) => el.querySelectorAll("details").forEach((d) => { d.open = true; }));
  expect(await stack.evaluate((el) => [...new Set([...el.querySelectorAll("summary")].map((s) => s.getBoundingClientRect().height))])).toEqual([32]);
  expect(await more.locator("summary").first().evaluate((el) => [getComputedStyle(el).cursor, getComputedStyle(el).fontWeight])).toEqual(["pointer", "500"]);
  expect(await kitSizes(page)).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });

  // One column in a smaller window, in the same order, with More settings last.
  await page.setViewportSize({ width: 1440, height: 900 });
  const column = await cards();
  expect(new Set(column.map((c) => c.x)).size).toBe(1);
  const order = [column[0], column[1], column[2], column[4], column[3]].map((c) => c.y);
  expect(order).toEqual([...order].sort((a, b) => a - b));

  // Finger-sized controls and rows on a phone, and the page is no wider than the window.
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await tooSmall(page)).toEqual([]);
  expect(await stack.evaluate((el) => [...new Set([...el.querySelectorAll("summary")].map((s) => s.getBoundingClientRect().height))])).toEqual([44]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Cuboids uses the kit: the shape on the left, labels, shading and printing on the right, and a selected label comes top left", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/cuboids");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const print = page.locator(".md-kit .panel-card").filter({ hasText: "Print settings" });
  const [shape, labels, shading, printBox] = [await chartCard(page, "Shape"), await chartCard(page, "Labels"), await chartCard(page, "Shading"), (await print.boundingBox())!];
  expect(labels.y).toBe(shape.y);
  expect(labels.x).toBeGreaterThanOrEqual(shape.x + shape.width);
  expect(Math.abs(labels.width - shape.width)).toBeLessThanOrEqual(1);
  expect([shading.x, printBox.x]).toEqual([labels.x, labels.x]);
  expect(shading.y).toBeGreaterThan(labels.y + labels.height);
  expect(printBox.y).toBeGreaterThan(shading.y + shading.height);
  // The settings filled the 967 px column before the kit, with every part closed.
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);

  // A list shares its row with the tick or the button that goes with it: level with the list, on one line.
  const [units, cube, view, cubes] = [
    (await page.getByLabel("Units", { exact: true }).boundingBox())!,
    (await page.locator(".md-kit label").filter({ hasText: "Cube (equal edges)" }).boundingBox())!,
    (await page.getByLabel("View", { exact: true }).boundingBox())!,
    (await page.getByRole("button", { name: /^Show 1 cm/ }).boundingBox())!,
  ];
  expect([cube.height, cubes.height]).toEqual([32, 32]);
  expect(Math.abs(cube.y - units.y)).toBeLessThanOrEqual(1);
  expect(cubes.y).toBe(view.y);
  // The list of views keeps room for its longest choice, "Separate layers".
  expect(view.width).toBeGreaterThanOrEqual(128);
  // The three ways to shade share a row on one line each, and the one that is on has the kit's mark.
  const shades = page.locator(".md-kit .cb-shade-options button");
  expect(await shades.evaluateAll((all) => all.map((b) => b.getBoundingClientRect().height))).toEqual([32, 32, 32]);
  expect(await shades.first().evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).boxShadow])).toEqual(["rgb(230, 239, 255)", "none"]);

  // Every part open: the kit's sizes throughout, nothing cut.
  for (const name of ["Cube size and counts", "More shape options", "Position and advanced", "Worked values and captions", "Print settings"])
    await page.locator(".md-kit summary").filter({ hasText: name }).click();
  expect(await kitSizes(page)).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });

  // A click on a label brings its card to the top left, where the other tools show what is selected, and the shape
  // goes to the right. The cards are placed, not rebuilt, so the parts that were open stay open.
  await page.locator(".md-kit .panel-card").filter({ has: page.getByRole("heading", { name: "Shape", exact: true }) }).evaluate((card) => card.setAttribute("data-kept", ""));
  await page.getByRole("button", { name: /^Edit height label/ }).click();
  const topHeading = page.locator(".md-kit .panel-card h2").first();
  await expect(topHeading).toHaveText("Selected label: height");
  const [picked, moved] = [await chartCard(page, "Selected label: height"), await chartCard(page, "Shape")];
  expect([picked.x, picked.y]).toEqual([shape.x, shape.y]);
  expect([moved.x, moved.y]).toEqual([labels.x, labels.y]);
  expect(Math.abs(picked.width - moved.width)).toBeLessThanOrEqual(1);
  await expect(page.locator(".md-kit details[open] > summary")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(topHeading).toHaveText("Shape");
  expect((await chartCard(page, "Shape")).x).toBe(shape.x);
  await expect(page.locator(".md-kit .panel-card[data-kept]")).toHaveCount(1);
  await expect(page.locator(".md-kit details[open] > summary")).toHaveCount(5);
  for (const name of ["Cube size and counts", "More shape options", "Position and advanced", "Worked values and captions", "Print settings"])
    await page.locator(".md-kit summary").filter({ hasText: name }).click();

  // With a second cuboid, the list that picks one runs across both columns, over the cards.
  await page.getByRole("button", { name: "Add cuboid", exact: true }).click();
  const pick = (await page.locator(".md-kit .panel-card").filter({ hasText: "Selected cuboid" }).boundingBox())!;
  const [under, beside] = [await chartCard(page, "Shape"), await chartCard(page, "Labels")];
  expect([pick.x, pick.y]).toEqual([shape.x, shape.y]);
  expect(Math.abs(pick.x + pick.width - (beside.x + beside.width))).toBeLessThanOrEqual(1);
  expect([under.x, beside.y]).toEqual([shape.x, under.y]);
  expect(under.y).toBeGreaterThan(pick.y + pick.height);
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);

  // One column in a smaller window, in the same order.
  await page.setViewportSize({ width: 1440, height: 900 });
  const column = [await chartCard(page, "Shape"), await chartCard(page, "Labels"), await chartCard(page, "Shading"), (await print.boundingBox())!];
  expect(new Set(column.map((c) => c.x)).size).toBe(1);
  expect(column.map((c) => c.y)).toEqual([...column.map((c) => c.y)].sort((a, b) => a - b));

  // Finger-sized controls on a phone, and the page is no wider than the window.
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await tooSmall(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Triangles uses the kit: what is selected on the left with the label box over it, the worked version, a new triangle and the print size on the right", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/triangle");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const more = page.locator(".md-kit .panel-card.tr-more");
  const [selected, worked, start, print, tools] = [await chartCard(page, "Selected object"), await chartCard(page, "Worked version"), await chartCard(page, "Start a new triangle"), await chartCard(page, "Print size"), (await more.boundingBox())!];
  expect(worked.y).toBe(selected.y);
  expect(worked.x).toBeGreaterThanOrEqual(selected.x + selected.width);
  expect(Math.abs(worked.width - selected.width)).toBeLessThanOrEqual(1);
  expect([start.x, print.x]).toEqual([worked.x, worked.x]);
  expect(start.y).toBeGreaterThan(worked.y + worked.height);
  expect(print.y).toBeGreaterThan(start.y + start.height);
  // More tools and the help come last in the settings and sit under what is selected.
  expect(tools.x).toBe(selected.x);
  expect(tools.y).toBeGreaterThan(selected.y + selected.height);
  // The settings were 1,093 px long in a 967 px column before the kit.
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);
  // A button with a row to itself is as wide as its words, on one line.
  const use = (await page.getByRole("button", { name: "Use worked version", exact: true }).boundingBox())!;
  expect(use.height).toBe(32);
  expect(use.width).toBeLessThan(worked.width / 2 + 40);

  // A selected triangle with every part open: the kit's sizes throughout, nothing cut, and still all in view.
  await page.getByLabel("Selected object", { exact: true }).selectOption("t:T1");
  for (const name of ["Shape locks", "Precise vertex position", "Captions and diagram notes"])
    await page.locator(".md-kit summary").filter({ hasText: name }).click();
  // Half a column is too narrow for the longest names, so those buttons take two lines, and a button beside one is as tall.
  const twoLines = ["Reflect horizontally", "Reflect vertically", "Make right angle", "Make equal sides at apex", "Make equilateral", "Release shape locks", "Add perpendicular height from selected vertex"];
  expect(await kitSizes(page, twoLines)).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });
  const pair = async (names: string[]) => Promise.all(names.map(async (name) => (await page.getByRole("button", { name, exact: true }).boundingBox())!.height));
  for (const row of [["Reflect horizontally", "Reflect vertically"], ["Make right angle", "Make equal sides at apex"], ["Make equilateral", "Release shape locks"]]) {
    const [left, right] = await pair(row);
    expect(left).toBe(right);
    expect(left).toBeLessThan(44);
  }
  // The name of a part that opens is a row as tall as a control.
  expect(await page.locator(".md-kit summary").evaluateAll((all) => [...new Set(all.map((s) => Math.round(s.getBoundingClientRect().height)))])).toEqual([32]);

  // A click on a label opens the box that edits it at the top of the left column, over what is selected. It is a
  // card like the others, and its choices are as tall as a control.
  await page.locator('.tr-hit[aria-label="Edit side ab"]').click();
  const box = page.locator(".md-kit .tr-floating");
  await expect(box).toBeVisible();
  const edit = (await box.boundingBox())!;
  expect([edit.x, edit.y]).toEqual([selected.x, selected.y]);
  expect(Math.abs(edit.width - selected.width)).toBeLessThanOrEqual(1);
  expect((await chartCard(page, "Selected object")).y).toBeGreaterThan(edit.y + edit.height);
  expect(await box.locator(".tr-option").evaluateAll((all) => [...new Set(all.map((o) => o.getBoundingClientRect().height))])).toEqual([32]);
  expect(await box.locator(":is(button, select, input:not([type=radio], [type=checkbox]))").evaluateAll((all) => [...new Set(all.map((c) => c.getBoundingClientRect().height))])).toEqual([32]);
  // The button that carries the step on is the filled one.
  const apply = box.getByRole("button", { name: "Apply label", exact: true });
  expect(await apply.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor === getComputedStyle(el).borderTopColor])).toEqual(["rgb(255, 255, 255)", true]);
  await box.getByRole("button", { name: "Cancel label", exact: true }).click();
  await expect(box).toBeHidden();
  // Under the diagram, outside the settings, the button that confirms a step keeps the tool's filled look.
  await page.getByRole("button", { name: "Split triangle", exact: true }).click();
  expect(await page.getByRole("button", { name: "Apply split", exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(15, 98, 254)");
  await page.getByRole("button", { name: "Cancel preview", exact: true }).click();

  // One column in a smaller window, in the order the cards are read.
  await page.setViewportSize({ width: 1440, height: 900 });
  const column = [await chartCard(page, "Selected object"), await chartCard(page, "Worked version"), await chartCard(page, "Start a new triangle"), await chartCard(page, "Print size"), (await more.boundingBox())!];
  expect(new Set(column.map((c) => c.x)).size).toBe(1);
  expect(column.map((c) => c.y)).toEqual([...column.map((c) => c.y)].sort((a, b) => a - b));

  // Finger-sized controls on a phone, More tools open too, and the page is no wider than the window.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.locator(".md-kit summary").filter({ hasText: "More tools" }).click();
  expect(await tooSmall(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Ratio tables uses the kit: what is selected and the tools on the left, the table's settings on the right", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/ratio-table");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const selected = page.locator(".md-kit .panel-card.ratio-selection-panel");
  const [picked, tools, settings] = [(await selected.boundingBox())!, await chartCard(page, "Table tools"), await chartCard(page, "Table settings")];
  expect(settings.y).toBe(picked.y);
  expect(settings.x).toBeGreaterThanOrEqual(picked.x + picked.width);
  expect(Math.abs(settings.width - picked.width)).toBeLessThanOrEqual(1);
  expect(tools.x).toBe(picked.x);
  expect(tools.y).toBeGreaterThan(picked.y + picked.height);
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);

  // The tool that is on has the kit's mark, and each tool keeps its icon beside its name.
  const edit = page.getByRole("button", { name: "Edit", exact: true });
  await expect(edit).toHaveAttribute("aria-pressed", "true");
  expect(await edit.evaluate((el) => [getComputedStyle(el).backgroundColor, el.getBoundingClientRect().height, el.querySelector("svg") !== null])).toEqual(["rgb(230, 239, 255)", 32, true]);

  // Both headings open, and the list of scaling steps: the kit's sizes throughout, nothing cut, all in view.
  await page.getByRole("button", { name: "Edit headings", exact: true }).click();
  await expect(selected.getByRole("heading", { name: "Edit headings", exact: true })).toBeVisible();
  await page.locator(".md-kit summary").filter({ hasText: "Scaling steps" }).click();
  expect(await kitSizes(page)).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });
  expect(await page.locator(".md-kit summary").evaluateAll((all) => all.map((s) => Math.round(s.getBoundingClientRect().height)))).toEqual([32]);
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);

  // A scaling arrow: its operation and its factor share a row and are level.
  await page.getByRole("button", { name: /^Row 1 → Row 2/ }).click();
  await expect(selected.getByRole("heading", { name: "Scaling arrow", exact: true })).toBeVisible();
  const [operation, factor] = [(await page.getByLabel("Row 1 scaling operation", { exact: true }).boundingBox())!, (await page.getByLabel("Row 1 scaling factor", { exact: true }).boundingBox())!];
  expect(Math.abs(operation.y - factor.y)).toBeLessThanOrEqual(1);
  expect(factor.x).toBeGreaterThan(operation.x + operation.width);
  expect(await kitSizes(page)).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });
  // Once the arrow is on the table, the button that removes it is still red.
  await selected.getByRole("button", { name: "Add arrow", exact: true }).click();
  await page.getByRole("button", { name: /^Row 1 → Row 2/ }).click();
  expect(await selected.getByRole("button", { name: "Remove arrow", exact: true }).evaluate((el) => getComputedStyle(el).color)).toBe("rgb(173, 67, 61)");

  // One column in a smaller window, in the order the cards are read.
  await page.setViewportSize({ width: 1440, height: 900 });
  const column = [(await selected.boundingBox())!, await chartCard(page, "Table tools"), await chartCard(page, "Table settings")];
  // The settings are longer than the window here, and scroll: no card is squeezed so that its fields spill out.
  expect(await page.locator(".md-kit .panel-card").evaluateAll((all) => all.filter((card) => card.scrollHeight > card.clientHeight + 1).length)).toBe(0);
  expect(new Set(column.map((c) => c.x)).size).toBe(1);
  expect(column.map((c) => c.y)).toEqual([...column.map((c) => c.y)].sort((a, b) => a - b));

  // Finger-sized controls on a phone, and the page is no wider than the window.
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await tooSmall(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Table of values uses the kit: the card for what is selected on the left, the tools that open it on the right", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/value-table-graph");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const hint = page.locator(".md-kit .panel-card.vg-selected-empty");
  const [empty, tools] = [(await hint.boundingBox())!, await chartCard(page, "Table and graph")];
  expect(tools.y).toBe(empty.y);
  expect(tools.x).toBeGreaterThanOrEqual(empty.x + empty.width);
  expect(Math.abs(tools.width - empty.width)).toBeLessThanOrEqual(1);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);

  // Each tool opens its card in the left column: the kit's sizes, a gap between one control and the next, nothing
  // cut and all in view. Two buttons share a row where one needs two lines, and are the same height.
  const twoLines = ["Add point or segment", "Graph options"];
  for (const [tool, heading] of [["Table settings", "Table"], ["Plot table values", "Plot"], ["Draw curve", "Curve"], ["Add point or segment", "Add"], ["Graph options", "Graph"], ["Select object", "Objects"], ["Layout", "Layout"]]) {
    await page.getByRole("button", { name: tool, exact: true }).click();
    const editor = page.locator(".md-kit .panel-card.vg-inspector-editor");
    await expect(editor.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    const [open, beside] = [(await editor.boundingBox())!, await chartCard(page, "Table and graph")];
    expect([open.x, open.y], tool).toEqual([empty.x, empty.y]);
    expect(beside.x, tool).toBe(tools.x);
    const sizes = await kitSizes(page, twoLines);
    expect(sizes, tool).toMatchObject({ buttons: [32], faded: 0, cut: [] });
    expect(sizes.fields.every((height) => height === 32), `${tool}: ${sizes.fields}`).toBe(true);
    const gaps = await editor.locator(".vg-context-body > *").evaluateAll((all) => all.map((el) => el.getBoundingClientRect()).filter((r) => r.height > 0).map((r, i, rs) => (i ? Math.round(r.top - rs[i - 1].bottom) : 8)));
    expect(gaps.every((gap) => gap === 8), `${tool}: ${gaps}`).toBe(true);
    expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight), tool).toBe(true);
  }
  const pair = await Promise.all(twoLines.map(async (name) => (await page.getByRole("button", { name, exact: true }).boundingBox())!.height));
  expect(pair[0]).toBe(pair[1]);

  // Inside "Table and graph" the heading over the further tools, and the line shown while a point is placed, keep the gap.
  await page.getByRole("button", { name: "Add point or segment", exact: true }).click();
  await page.getByRole("button", { name: "Place point on grid", exact: true }).click();
  expect(await page.locator(".md-kit :is(.vg-secondary-tools, .vg-placing)").evaluateAll((all) => all.map((el) => Math.round(el.children[1].getBoundingClientRect().top - el.children[0].getBoundingClientRect().bottom)))).toEqual([8, 8]);
  await page.getByRole("button", { name: "Cancel placement", exact: true }).click();
  await page.getByRole("button", { name: "Layout", exact: true }).click();

  // The page's name is the same plain switcher as on every other tool, not a boxed button.
  expect(await page.locator(".tool-switcher-button").evaluate((el) => [getComputedStyle(el).borderTopColor, getComputedStyle(el).backgroundColor])).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
  // Nor does the star beside it take the tool's old navy mark when the tool is a favourite.
  await page.locator(".tool-switcher-star").click();
  await expect(page.locator(".tool-switcher-star")).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator(".tool-switcher-star").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");

  // One column in a smaller window, the open card first.
  await page.setViewportSize({ width: 1440, height: 900 });
  const column = [(await page.locator(".md-kit .panel-card.vg-inspector-editor").boundingBox())!, await chartCard(page, "Table and graph")];
  expect(column[1].x).toBe(column[0].x);
  expect(column[1].y).toBeGreaterThan(column[0].y + column[0].height);

  // Finger-sized controls on a phone, and the page is no wider than the window.
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await tooSmall(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Graph tool uses the kit: what is selected on the left with the list of objects under it, the drawing tools, the axes and printing on the right", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/graph");
  const stack = page.locator(".inspector-stack.md-kit");
  await expect(stack).toBeVisible();
  const first = page.locator(".md-kit .panel-card").first();
  const objects = page.locator(".md-kit .panel-card.objects-panel");
  const printing = page.locator(".md-kit .panel-card").filter({ hasText: "Print settings" });
  await expect(first).toHaveAccessibleName("Selected object");
  const [empty, tools, axes, print, list] = [(await first.boundingBox())!, await chartCard(page, "Drawing tools"), await chartCard(page, "Axis scale"), (await printing.boundingBox())!, (await objects.boundingBox())!];
  expect(tools.y).toBe(empty.y);
  expect(tools.x).toBeGreaterThanOrEqual(empty.x + empty.width);
  expect(Math.abs(tools.width - empty.width)).toBeLessThanOrEqual(1);
  expect([axes.x, print.x]).toEqual([tools.x, tools.x]);
  expect(axes.y).toBeGreaterThan(tools.y + tools.height);
  expect(print.y).toBeGreaterThan(axes.y + axes.height);
  expect(list.x).toBe(empty.x);
  expect(list.y).toBeGreaterThan(empty.y + empty.height);
  expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);

  // The three drawing tools share a row, and the one that is on has the kit's mark.
  const row = await Promise.all(["Select", "Point", "Segment"].map(async (name) => (await page.getByRole("button", { name, exact: true }).boundingBox())!));
  expect(new Set(row.map((button) => button.y)).size).toBe(1);
  expect(await page.getByRole("button", { name: "Select", exact: true }).evaluate((el) => [el.getAttribute("aria-pressed"), getComputedStyle(el).backgroundColor])).toEqual(["true", "rgb(230, 239, 255)"]);

  // The kit's sizes: every button and field that shows is 32 px, but for the axis scales, which say two things on
  // two lines. Nothing is cut off, and the settings fit the window.
  const fits = async (what: string) => {
    const sizes = await stack.evaluate((el) => {
      const shown = (all: NodeListOf<HTMLElement>) => [...all].filter((c) => c.getBoundingClientRect().height > 0);
      return {
        buttons: [...new Set(shown(el.querySelectorAll(".panel-card button")).filter((b) => !b.closest(".scale-options, .objects-list")).map((b) => Math.round(b.getBoundingClientRect().height)))],
        scales: [...new Set(shown(el.querySelectorAll(".scale-options button")).map((b) => Math.round(b.getBoundingClientRect().height)))],
        fields: [...new Set(shown(el.querySelectorAll(".panel-card :is(select, input:not([type=checkbox]))")).map((b) => Math.round(b.getBoundingClientRect().height)))],
        cut: [...el.querySelectorAll<HTMLElement>(".panel-card")].filter((c) => c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1).length,
        inView: el.scrollHeight <= el.clientHeight,
      };
    });
    expect(sizes, what).toMatchObject({ buttons: [32], scales: [42], cut: 0, inView: true });
    expect(sizes.fields.every((height) => height === 32), `${what}: ${sizes.fields}`).toBe(true);
  };
  await fits("nothing selected");

  // Each thing that can be added opens its card top left, where the hint was, and still fits.
  for (const [add, heading] of [["Add shape", "Shape"], ["Shade a region", "Shaded region"], ["Graph through points", "Graph through points"], ["Equation curve", "Equation curve"], ["Add circle", "Circle"], ["Reading lines", "Reading lines"]]) {
    await page.getByRole("button", { name: add, exact: true }).click();
    await expect(first.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    const [open, under] = [(await first.boundingBox())!, (await objects.boundingBox())!];
    expect([open.x, open.y], add).toEqual([empty.x, empty.y]);
    expect(under.y, add).toBeGreaterThan(open.y + open.height);
    await fits(add);
  }
  // The button that deletes is red, and a field shares its row with the button that uses it, level at the foot.
  expect(await first.getByRole("button", { name: "Delete reading lines", exact: true }).evaluate((el) => getComputedStyle(el).color)).toBe("rgb(179, 38, 30)");

  // The form for a line by its equation: the button that adds the line is the filled one.
  await page.getByRole("button", { name: "Line by equation", exact: true }).click();
  await expect(first.getByRole("heading", { name: "Line by equation", exact: true })).toBeVisible();
  expect(await first.getByRole("button", { name: "Add line", exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(15, 98, 254)");
  await fits("Line by equation");
  await first.getByRole("button", { name: "Add line", exact: true }).click();
  await expect(first.getByRole("heading", { name: "Straight line", exact: true })).toBeVisible();
  await fits("Straight line");

  // The list of objects opens under what is selected: one row for each, the selected one marked.
  await objects.getByRole("button", { name: "Objects" }).click();
  const rows = objects.locator(".objects-list button");
  await expect(rows).toHaveCount(7);
  expect(await rows.evaluateAll((all) => all.map((row) => [row.getAttribute("aria-pressed"), getComputedStyle(row).backgroundColor].join(" ")).filter((mark) => mark.startsWith("true")))).toEqual(["true rgb(230, 239, 255)"]);
  expect(await objects.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  // One column in a smaller window, in the order the cards have always had.
  await page.setViewportSize({ width: 1440, height: 900 });
  const column = [(await first.boundingBox())!, await chartCard(page, "Drawing tools"), await chartCard(page, "Axis scale"), (await printing.boundingBox())!, (await objects.boundingBox())!];
  expect(new Set(column.map((c) => c.x)).size).toBe(1);
  expect(column.map((c) => c.y)).toEqual([...column.map((c) => c.y)].sort((a, b) => a - b));

  // Three columns under the diagram on an upright monitor.
  await page.setViewportSize({ width: 1080, height: 1920 });
  const upright = [(await first.boundingBox())!, await chartCard(page, "Drawing tools"), await chartCard(page, "Axis scale"), (await printing.boundingBox())!, (await objects.boundingBox())!];
  expect(new Set(upright.map((c) => c.x)).size).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // Finger-sized controls on a phone, and the page is no wider than the window.
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await tooSmall(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

// The other tools that share the tree tools' settings classes. Each: its name, its address, the card a click on the
// diagram fills, the other cards on the left and the cards on the right. Some also have cards that come last in the
// settings and sit under the left column (`under`), a button whose words need two lines in a narrow column, or
// settings too long for one screen whatever is done (`longest`, the most they may be).
type Extra = { under?: string[]; twoLines?: string[]; longest?: number };
const SAVED = "Print every saved answer on the pupil copy";
const PRINT: Extra = { under: ["Printing"], twoLines: [SAVED] };
const SHARED: [string, string, string, string[], string[], Extra?][] = [
  ["Algebra tiles", "/tools/algebra-tiles", "Selected item", ["Tiles"], ["Expression and answer", "Layout"]],
  ["Angle diagrams", "/tools/angles", "Selected angle", [], ["Figure"], PRINT],
  ["Area and perimeter", "/tools/area", "Selected label", [], ["Shape", "Hole and shading"], PRINT],
  ["Geometry figures", "/tools/figures", "Selected object", [], ["Add to the figure"], PRINT],
  // Six cards, four of them lists that grow: 2,025 px long before the kit, and still more than one screen.
  ["Constructions and loci", "/tools/construction", "Selected point", ["Points", "Lines and marks"], ["Ruler and compass constructions", "Shaded regions", "Drawing"], { longest: 1200 }],
  ["Nets", "/tools/nets", "Selected face", ["Shape"], ["Nets"], { under: ["Paper"] }],
  ["3D solids", "/tools/solids", "Selected object", ["View"], ["Add to the drawing", "Printing"], { twoLines: [SAVED] }],
];
// What a click on the diagram selects, whatever the tool calls it.
const HIT = ".pt-hit, .ang-hit, .area-hit, .fig-hit, .nets-face";

for (const [tool, path, selected, left, right, { under = [], twoLines = [], longest = 0 } = {}] of SHARED)
  test(`${tool} uses the kit${longest ? "" : ", with everything in view"}`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(path);
    const stack = page.locator(".inspector-stack.md-kit");
    await expect(stack).toBeVisible();
    await page.locator(HIT).first().click();
    const chosenCard = page.locator(`.md-kit .panel-card[aria-label="${selected}"]`);
    const chosen = (await chosenCard.boundingBox())!;
    const first = await chartCard(page, right[0]);
    const leftCards = await Promise.all(left.map((name) => chartCard(page, name)));
    for (const [i, card] of leftCards.entries()) expect(card.x, left[i]).toBe(chosen.x);
    for (const name of right) expect((await chartCard(page, name)).x, name).toBe(first.x);
    // A card of the third group starts 12 px under the last card of the left column.
    let foot = Math.max(...[chosen, ...leftCards].map((card) => card.y + card.height));
    for (const name of under) {
      const card = await chartCard(page, name);
      expect(card.x, name).toBe(chosen.x);
      expect(card.y, name).toBe(foot + 12);
      foot = card.y + card.height;
    }
    expect(first.x).toBeGreaterThanOrEqual(chosen.x + chosen.width);
    expect(Math.abs(first.width - chosen.width)).toBeLessThanOrEqual(1);
    expect(await stack.evaluate((el, longest) => el.scrollHeight <= Math.max(el.clientHeight, longest), longest)).toBe(true);
    expect((await page.locator(".editor-card").first().boundingBox())!.width).toBeGreaterThan(1200);
    expect(await kitSizes(page, twoLines)).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });

    // One column in a smaller window, in the same order.
    await page.setViewportSize({ width: 1440, height: 900 });
    const top = (await chosenCard.boundingBox())!;
    let below = top.y;
    for (const name of [...left, ...right, ...under]) {
      const next = await chartCard(page, name);
      expect(next.x, name).toBe(top.x);
      expect(next.y, name).toBeGreaterThan(below);
      below = next.y;
    }

    // Finger-sized controls on a phone, and the page is no wider than the window.
    await page.setViewportSize({ width: 375, height: 800 });
    expect(await tooSmall(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

test("Spinners, dice and bags: each object is a named group, and Layout stays reachable however many there are", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/probability-objects");
  const group = page.locator(".md-kit fieldset.md-kit-group");
  expect(await group.first().evaluate((el) => [getComputedStyle(el).display, getComputedStyle(el).rowGap])).toEqual(["grid", "8px"]);
  // One column (22 Nov 2026): the list of objects grows and pushes Layout down; the column scrolls, with a fade.
  for (const name of ["Add a dice", "Add a bag", "Add a spinner"]) await page.getByRole("button", { name, exact: true }).click();
  await expect(group).toHaveCount(4);
  const layout = await chartCard(page, "Layout"), objects = await chartCard(page, "Objects");
  expect(Math.abs(layout.x - objects.x)).toBeLessThanOrEqual(1);
  expect(layout.y).toBeGreaterThan(objects.y + objects.height);
  const stack = page.locator(".inspector-stack.md-kit");
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight || "more" in el.dataset)).toBe(true);
});

test("Bubble method: a tick sits beside its words, and Layout stays reachable however many steps there are", async ({ page }) => {
  // The tool once shared a class prefix with Bar modelling, whose label rule stacked every tick over its words.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/bubble-method");
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  const label = page.locator(".md-kit .panel-card label").filter({ hasText: "This working has a deliberate error" });
  expect(await label.evaluate((el) => getComputedStyle(el).flexDirection)).toBe("row");
  const tick = (await label.locator("input").boundingBox())!, whole = (await label.boundingBox())!;
  expect(Math.abs(tick.y + tick.height / 2 - (whole.y + whole.height / 2))).toBeLessThanOrEqual(1);
  // One column (22 Nov 2026): the list of steps grows and pushes Layout down; the column scrolls, with a fade.
  const add = page.getByRole("button", { name: "Add a step", exact: true });
  while (await add.isEnabled()) await add.click();
  await expect(page.locator(".md-kit fieldset.md-kit-group")).toHaveCount(8);
  const layout = await chartCard(page, "Layout"), steps = await chartCard(page, "Steps");
  expect(Math.abs(layout.x - steps.x)).toBeLessThanOrEqual(1);
  expect(layout.y).toBeGreaterThan(steps.y + steps.height);
  const stack = page.locator(".inspector-stack.md-kit");
  expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight || "more" in el.dataset)).toBe(true);
});

test("Algebra tiles, Function machines and Written methods stay usable when they are full", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const fits = () => page.locator(".inspector-stack.md-kit").evaluate((el) => el.scrollHeight <= el.clientHeight);
  const fill = async (name: string) => {
    const add = page.getByRole("button", { name, exact: true }).first();
    while (await add.isEnabled()) await add.click();
  };

  await page.goto("/tools/algebra-tiles");
  await fill("Add a term");
  await page.locator(".pt-hit").first().click();
  expect(await fits()).toBe(true);

  // Function machines and Written methods are one folding column (22 Nov 2026): a full list may scroll the column, with a fade.
  const fitsOrFades = () => page.locator(".inspector-stack.md-kit").evaluate((el) => el.scrollHeight <= el.clientHeight || "more" in el.dataset);
  await page.goto("/tools/function-machine");
  await fill("Add a different machine");
  await fill("Add a box");
  expect(await page.locator(".md-kit fieldset.md-kit-group").count()).toBe(3);
  expect(await fitsOrFades()).toBe(true);

  // Twelve digits, the most a row holds, give the longest list of small digits: one each and one to carry into.
  // They sit in the row's options box, which stays inside the window.
  await page.goto("/tools/written-method");
  await page.locator(".pt-hit").first().click();
  await page.keyboard.type("123456789.123");
  await page.keyboard.press("Enter");
  const box = page.locator(".md-options-box");
  const small = box.locator(".wm-mark input:not([type=checkbox])");
  await expect(small).toHaveCount(13);
  const shown = (await box.boundingBox())!;
  expect(shown.y + shown.height).toBeLessThanOrEqual(1080);
  // A small digit keeps its narrow field.
  expect((await small.first().boundingBox())!.width).toBeLessThan(60);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Layout", exact: true }).click();

  // Lists side by side share the card evenly and never overlap, at the narrowest two-column window too.
  await page.setViewportSize({ width: 1800, height: 1000 });
  const square = (await page.getByRole("combobox", { name: "Square size", exact: true }).boundingBox())!;
  const lines = (await page.getByRole("combobox", { name: "Lines", exact: true }).boundingBox())!;
  const layout = await chartCard(page, "Layout");
  expect(square.x + square.width).toBeLessThanOrEqual(lines.x);
  expect(lines.x + lines.width).toBeLessThanOrEqual(layout.x + layout.width);
  expect(Math.abs(square.width - lines.width)).toBeLessThanOrEqual(1);
});

test("Angle diagrams, Area and perimeter and Geometry figures: short fields keep their rows and the table of corners fits its card", async ({ page }) => {
  // The narrowest window with two columns, so the narrowest card.
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto("/tools/angles");
  const figure = page.getByRole("combobox", { name: "Figure", exact: true });
  // A list on its own has the whole row, so the longest figure name is not cut short.
  const card = await chartCard(page, "Figure");
  expect((await figure.boundingBox())!.width).toBeGreaterThan(card.width - 40);
  // A ray's direction is a short field with its Remove button beside it, not under it.
  await figure.selectOption("point");
  const ray = page.locator(".md-kit .ang-ray").first();
  const field = (await ray.locator("input").boundingBox())!, remove = (await ray.getByRole("button").boundingBox())!;
  expect(field.width).toBeLessThan(100);
  expect(remove.x).toBeGreaterThan(field.x + field.width);
  expect(Math.abs(remove.y + remove.height / 2 - (field.y + field.height / 2))).toBeLessThanOrEqual(1);

  await page.goto("/tools/area");
  const shape = page.locator(".md-kit .panel-card").filter({ has: page.getByRole("heading", { name: "Shape", exact: true }) });
  await shape.locator("summary").click();
  const table = shape.locator(".area-corner-table");
  await expect(table.locator("thead th")).toHaveCount(5);
  // All five columns are inside the card, a number field still shows four characters and the side shows "Straight".
  expect(await shape.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const box = (await shape.boundingBox())!, grid = (await table.boundingBox())!;
  expect(grid.x + grid.width).toBeLessThanOrEqual(box.x + box.width);
  expect((await table.locator("input:not([type=checkbox])").first().boundingBox())!.width).toBeGreaterThanOrEqual(41);
  expect((await table.locator("select").first().boundingBox())!.width).toBeGreaterThanOrEqual(80);
  // What a folded part holds is spaced like the rest of a card: the buttons sit 8 px under the table.
  const add = (await shape.getByRole("button", { name: "Add a corner", exact: true }).boundingBox())!;
  expect(Math.round(add.y - (grid.y + grid.height))).toBe(8);
  // A dashed height is one row: two short lists and its Remove button.
  await page.getByRole("button", { name: "Add a dashed height", exact: true }).click();
  const row = shape.locator(".area-row").first();
  const tops = await row.locator("select, button").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().bottom)));
  expect(new Set(tops).size).toBe(1);

  // A caption's Bold tick stays a tick beside the caption's short fields.
  await page.goto("/tools/figures");
  const captions = page.locator(".md-kit .panel-card").filter({ hasText: "Shading and captions" });
  await captions.locator("summary").click();
  await captions.getByRole("button", { name: "Add a caption", exact: true }).click();
  const bold = (await captions.getByRole("checkbox", { name: /Bold/ }).boundingBox())!;
  expect([bold.width, bold.height]).toEqual([16, 16]);
  expect((await captions.locator(".fig-row input:not([type=checkbox])").first().boundingBox())!.width).toBeLessThan(100);
});

test("Constructions and loci: a line's label shares its row, and the selected point's chip is marked", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/construction");
  // The word "Label", its field and the Hide tick are one row, as they were before the kit.
  const row = page.locator(".md-kit .cn-inline").first();
  const field = (await row.locator("input:not([type=checkbox])").boundingBox())!, whole = (await row.boundingBox())!;
  expect(whole.height).toBeLessThan(40);
  expect(field.width).toBeGreaterThanOrEqual(100);
  expect(field.width).toBeLessThan(whole.width);
  // The chip of the point that is selected is the choice that is on, in the kit's blue.
  const chips = page.locator(".md-kit .cn-chip");
  await expect(chips.first()).toHaveAttribute("aria-pressed", "false");
  await page.locator(".pt-hit").first().click();
  await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "false");
  const colours = (chip: number) => chips.nth(chip).evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderColor]);
  expect(await colours(0)).not.toEqual(await colours(1));
  // A list with long choices has the whole row, so "Perpendicular bisector of a line" is not cut short.
  const kind = page.getByRole("combobox", { name: "Construction to add", exact: true });
  const card = await chartCard(page, "Ruler and compass constructions");
  expect((await kind.boundingBox())!.width).toBeGreaterThan(card.width - 40);
});

// The three builders are on the kit too, in one narrow column, because the sheet beside it is the content.
const BUILDERS: [string, string, string][] = [
  ["/worksheets", "Worksheet settings", "details.ws-card"],
  ["/booklets", "Booklet settings", "details.bk-lesson"],
  ["/starters", "Starter settings", "details.ws-card"],
];
// What is in view in a builder's settings: the heights of its buttons and fields, its ticks, the look of a box of
// several lines beside the look of a field, the arrows that move a question, and the columns the cards make.
const builderSizes = (page: Page) =>
  page.locator(".inspector-stack.md-kit").evaluate((el) => {
    const seen = (selector: string) => [...el.querySelectorAll<HTMLElement>(selector)].filter((c) => c.getBoundingClientRect().height > 0);
    const heights = (selector: string) => [...new Set(seen(selector).map((c) => c.getBoundingClientRect().height))];
    const look = (c: HTMLElement) => {
      const style = getComputedStyle(c);
      return `${style.fontSize} ${style.fontFamily} ${style.borderTopColor} ${style.borderRadius} ${style.paddingLeft}`;
    };
    return {
      buttons: heights(".panel-card button"),
      fields: heights(".panel-card :is(select, input:not([type=checkbox], [type=file]))"),
      ticks: [...new Set(seen(".panel-card input[type=checkbox]").map((c) => c.getBoundingClientRect().width))],
      boxes: [...new Set(seen(".panel-card textarea").map(look))],
      field: look(seen('.panel-card input:not([type=checkbox], [type=file], [type=number])')[0]),
      arrows: [...new Set(seen(".panel-card .icon-button").map((c) => `${c.getBoundingClientRect().width} x ${c.getBoundingClientRect().height}`))],
      faded: seen(".panel-card button:disabled").filter((b) => getComputedStyle(b).opacity !== "1").length,
      cut: seen(".panel-card").filter((c) => c.scrollWidth > c.clientWidth + 1).length,
      heading: getComputedStyle(el.querySelector(".panel-card h2")!).font,
      columns: [...new Set(seen(".panel-card").map((c) => c.getBoundingClientRect().x))].length,
      width: el.getBoundingClientRect().width,
    };
  });

test("the Worksheet, Booklet and Starter builders use the kit in one narrow column beside the sheet", async ({ page }) => {
  for (const [path, name, opens] of BUILDERS) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(path);
    const stack = page.locator(".inspector-stack.md-kit");
    await expect(stack).toHaveAccessibleName(name);
    // A question (or a lesson) is open, so its arrows, fields and boxes are measured too.
    const first = stack.locator(opens).first();
    if (!(await first.evaluate((d: HTMLDetailsElement) => d.open))) await first.locator(":scope > summary").click();
    const at = await builderSizes(page);
    expect([at.buttons, at.fields, at.ticks], path).toEqual([[32], [32], [16]]);
    expect(at.boxes, path).toEqual([at.field]);
    expect(at.arrows, path).toEqual(["32 x 32"]);
    expect([at.faded, at.cut, at.columns], path).toEqual([0, 0, 1]);
    expect(at.heading, path).toContain("600 17px");
    // The sheet keeps the window: the settings are no wider than they were.
    expect(at.width, path).toBeLessThanOrEqual(340);
    expect((await page.locator(".editor-card").first().boundingBox())!.width, path).toBeGreaterThan(1500);

    // A phone gets finger-sized controls and nothing runs off the side.
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await tooSmall(page), path).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), path).toBe(true);
  }
});

test("the Worksheet builder keeps its own marks on the kit: the filled Make button, a short number field, and a table cell's hidden and blank states", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), ["maths-booklet-tools:worksheet:v1", JSON.stringify(comparativeBarCharts)]);
  await page.goto("/worksheets");
  const stack = page.locator(".inspector-stack.md-kit");
  const colours = (name: string) => stack.getByRole("button", { name, exact: true }).evaluate((b) => [getComputedStyle(b).backgroundColor, getComputedStyle(b).color]);
  // Off until there is a key and an objective, then the one filled button in the column.
  await expect(stack.getByRole("button", { name: "Make worksheet", exact: true })).toBeDisabled();
  expect(await colours("Make worksheet")).not.toContain("rgb(15, 98, 254)");
  await stack.getByLabel("Your API key").fill("sk-ant-not-a-real-key");
  await stack.getByLabel("Learning objective").fill("Compare two bar charts");
  await expect(stack.getByRole("button", { name: "Make worksheet", exact: true })).toBeEnabled();
  expect(await colours("Make worksheet")).toEqual(["rgb(15, 98, 254)", "rgb(255, 255, 255)"]);
  expect((await colours("Import a scheme…"))[0]).toBe("rgb(255, 255, 255)");

  // A table cell: hidden is outlined pink, blank is grey, given is neither.
  await stack.locator("details.ws-card", { has: page.locator(".ws-q", { hasText: /^3$/ }) }).locator(":scope > summary").click();
  const shows = stack.getByRole("combobox", { name: "Row 1 cell 2 shows" }).first();
  const cell = () => stack.getByLabel(/^Row 1 cell 2( \(saved answer\))?$/).first().evaluate((i) => [getComputedStyle(i).borderTopColor, getComputedStyle(i).backgroundColor]);
  const given = await cell();
  expect(given).not.toContain("rgb(176, 18, 91)");
  await shows.selectOption("hidden");
  expect(await cell()).toEqual(["rgb(176, 18, 91)", given[1]]);
  await shows.selectOption("blank");
  expect(await cell()).toEqual([given[0], "rgb(246, 248, 251)"]);
  // The cells of a row share its width, and none is pushed out of the card.
  expect(await stack.locator(".panel-card").evaluateAll((cards) => cards.filter((c) => c.scrollWidth > c.clientWidth + 1).length)).toBe(0);

  // A number that is a few digits long keeps a short field.
  await stack.getByLabel("Score box").first().check();
  expect((await stack.getByLabel("Side 1 score out of").boundingBox())!.width).toBeLessThan(100);

  // On a phone the open table, its lists and the number field are finger-sized and stay on the page.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(shows).toBeVisible();
  expect(await tooSmall(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("the Booklet builder's list of objectives: a tick stays on the first line of a long objective, and Tick all reads as a link that a finger can press", async ({ page }) => {
  const long = "Construct and interpret comparative bar charts for two sets of data, and say which set is larger in each category and overall";
  const scheme = { schemaVersion: 1, kind: "scheme-of-work", name: "Department scheme", units: [{ code: "SP2", title: "Presentation of data", years: [8], objectives: [{ code: "SP2.06", level: "C", text: long }, { code: "SP2.07", level: "C", text: "Read a pie chart" }] }] };
  const object = `bank/assets/sha256/${"a".repeat(64)}.json`;
  await page.route("**/bank/schemes.json", (route) => route.fulfill({ json: { schemaVersion: 1, school: object } }));
  await page.route(`**/${object}`, (route) => route.fulfill({ json: scheme }));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/booklets");
  const ai = page.getByRole("region", { name: "Make with AI" });
  await expect(ai.getByLabel("Choose from").locator('option[value="school"]')).toBeAttached();
  await ai.getByLabel("Choose from").selectOption("school");
  await ai.getByRole("combobox", { name: "Unit", exact: true }).selectOption("SP2");
  const all = ai.getByRole("button", { name: "Tick all", exact: true });
  await expect(all).toBeVisible();
  expect(await all.evaluate((b) => [getComputedStyle(b).borderTopWidth, getComputedStyle(b).backgroundColor, getComputedStyle(b).textDecorationLine])).toEqual(["0px", "rgba(0, 0, 0, 0)", "underline"]);
  expect((await all.boundingBox())!.height).toBeLessThan(32);
  const objective = ai.locator("label.bk-objective").first();
  const [label, tick] = [(await objective.boundingBox())!, (await objective.locator("input").boundingBox())!];
  expect(label.height).toBeGreaterThan(40);
  expect(tick.y - label.y).toBeLessThanOrEqual(3);
  expect(await ai.evaluate((card) => card.scrollWidth <= card.clientWidth + 1)).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(all).toBeVisible();
  expect(await tooSmall(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

