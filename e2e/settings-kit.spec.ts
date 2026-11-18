import { test, expect, type Page } from "./release-fixtures";

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
const kitSizes = (page: Page, twoLines: string[] = []) =>
  page.locator(".inspector-stack.md-kit").evaluate((el, twoLines) => ({
    buttons: [...new Set([...el.querySelectorAll<HTMLElement>(".panel-card button")].filter((b) => !twoLines.includes(b.textContent ?? "")).map((b) => b.getBoundingClientRect().height))],
    fields: [...new Set([...el.querySelectorAll<HTMLElement>(".panel-card :is(select, input:not([type=checkbox]))")].map((b) => b.getBoundingClientRect().height))],
    ticks: [...new Set([...el.querySelectorAll<HTMLElement>(".panel-card input[type=checkbox]")].map((b) => b.getBoundingClientRect().width))],
    faded: [...el.querySelectorAll<HTMLElement>(".panel-card button:disabled")].filter((b) => getComputedStyle(b).opacity !== "1").length,
    cut: [...el.querySelectorAll<HTMLElement>(".panel-card")].filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.querySelector("h2")?.textContent),
    heading: getComputedStyle(el.querySelector(".panel-card h2")!).font,
  }), twoLines);
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
const TREES: [string, string, string[], string[], number][] = [
  ["/tools/probability-tree", "Selected branch", ["Branches"], ["Fill probabilities", "Outcome columns", 'Questions and "given that"', "Layout"], 3],
  ["/tools/frequency-tree", "Selected group", ["Total and groups"], ["Work out counts", "Questions", "Layout"], 2],
  ["/tools/factor-tree", "Selected number", ["Trees and answer lines"], ["Complete the trees", "Layout"], 3],
];

test("the tree tools use the kit: the tree's own values on the left, what is done with them on the right, all in view", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const [path, selected, left, right] of TREES) {
    await page.goto(path);
    const stack = page.locator(".inspector-stack.md-kit");
    await expect(stack).toBeVisible();
    await page.locator(".pt-hit").first().click();
    const chosen = (await page.locator(`.md-kit .panel-card[aria-label="${selected}"]`).boundingBox())!;
    const layout = await chartCard(page, "Layout");
    for (const name of left) expect((await chartCard(page, name)).x, `${path} ${name}`).toBe(chosen.x);
    for (const name of right) expect((await chartCard(page, name)).x, `${path} ${name}`).toBe(layout.x);
    expect(layout.x, path).toBeGreaterThanOrEqual(chosen.x + chosen.width);
    expect(Math.abs(layout.width - chosen.width), path).toBeLessThanOrEqual(1);
    // With something selected the settings were 1,597, 1,531 and 1,157 px long before the kit.
    expect(await stack.evaluate((el) => el.scrollHeight <= el.clientHeight), path).toBe(true);
    expect((await page.locator(".editor-card").first().boundingBox())!.width, path).toBeGreaterThan(1200);
    const sizes = await kitSizes(page);
    expect(sizes, path).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });
    expect(sizes.heading, path).toContain("600 17px");
  }
  // A Hide tick's label sits 3 px under its field, in a list that is not cut off and scrolls only from 460 px.
  await page.goto("/tools/frequency-tree");
  const row = page.locator(".pt-branch > span:has(> .pt-hide)").first();
  const fieldBox = (await row.locator("input:not([type=checkbox])").boundingBox())!;
  expect((await row.locator(".pt-hide").boundingBox())!.y).toBe(fieldBox.y + fieldBox.height + 3);
  const list = page.locator(".pt-branches").first();
  expect(await list.evaluate((el) => [el.scrollHeight <= el.clientHeight, getComputedStyle(el).maxHeight])).toEqual([true, "460px"]);
  // Two paragraphs of help do not run together.
  await page.getByText("Editing and printing help", { exact: true }).click();
  const help = await page.locator(".md-kit details[open] > p").evaluateAll((all) => all.map((p) => p.getBoundingClientRect()).map((r) => [r.top, r.bottom]));
  expect(help.length).toBeGreaterThanOrEqual(2);
  expect(help[1][0] - help[0][1]).toBe(6);
});

test("the tree tools keep one column in a smaller window, three on an upright monitor and finger-sized controls on a phone", async ({ page }) => {
  for (const [path, , left, right, upright] of TREES) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const first = await chartCard(page, left[0]), layout = await chartCard(page, "Layout");
    expect(layout.x, path).toBe(first.x);
    expect(layout.y, path).toBeGreaterThan(first.y + first.height);

    await page.setViewportSize({ width: 1080, height: 1920 });
    const lefts = new Set<number>();
    for (const name of [...left, ...right]) lefts.add(Math.round((await chartCard(page, name)).x));
    expect(lefts.size, path).toBe(upright);

    await page.setViewportSize({ width: 375, height: 800 });
    const small = await tooSmall(page);
    expect(small, path).toEqual([]);
    // The list of branches is as long as it needs to be: no scrolling inside the scrolling page.
    const lists = await page.locator(".pt-branches").evaluateAll((all) => all.map((el) => el.scrollHeight <= el.clientHeight));
    expect(lists, path).toEqual(path === "/tools/factor-tree" ? [] : [true]);
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
  expect(Math.abs(units.width - view.width)).toBeLessThanOrEqual(1);
  // The three ways to shade share a row on one line each, and the one that is on has the kit's mark.
  const shades = page.locator(".md-kit .cb-shade-options button");
  expect(await shades.evaluateAll((all) => all.map((b) => b.getBoundingClientRect().height))).toEqual([32, 32, 32]);
  expect(await shades.first().evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).boxShadow])).toEqual(["rgb(230, 239, 255)", "none"]);

  // Every part open: the kit's sizes throughout, nothing cut.
  for (const name of ["Cube size and counts", "More shape options", "Position and advanced", "Worked values and captions", "Print settings"])
    await page.locator(".md-kit summary").filter({ hasText: name }).click();
  expect(await kitSizes(page)).toMatchObject({ buttons: [32], fields: [32], ticks: [16], faded: 0, cut: [] });

  // A click on a label brings its card to the top left, where the other tools show what is selected. The shape goes
  // to the right, and the parts that were open stay open.
  await page.getByRole("button", { name: /^Edit height label/ }).click();
  const [picked, moved] = [await chartCard(page, "Selected label: height"), await chartCard(page, "Shape")];
  expect([picked.x, picked.y]).toEqual([shape.x, shape.y]);
  expect([moved.x, moved.y]).toEqual([labels.x, labels.y]);
  await expect(page.locator(".md-kit details[open] > summary")).toHaveCount(5);
  await page.keyboard.press("Escape");
  expect((await chartCard(page, "Shape")).x).toBe(shape.x);
  await expect(page.locator(".md-kit details[open] > summary")).toHaveCount(5);

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

// The other tools that share the tree tools' settings classes. Each: its name, its address, the card a click on the
// diagram fills, the other cards on the left and the cards on the right. Some also have cards that come last in the
// settings and sit under the left column (`under`), a button whose words need two lines in a narrow column, or
// settings too long for one screen whatever is done (`longest`, the most they may be).
type Extra = { under?: string[]; twoLines?: string[]; longest?: number };
const SAVED = "Print every saved answer on the pupil copy";
const PRINT: Extra = { under: ["Printing"], twoLines: [SAVED] };
const SHARED: [string, string, string, string[], string[], Extra?][] = [
  ["Two-way tables", "/tools/two-way-table", "Selected cell", [], ["Totals", "Layout"]],
  ["Sample space diagrams", "/tools/sample-space", "Selected cell", [], ["Fill the cells", "Layout"]],
  ["Spinners, dice and bags", "/tools/probability-objects", "Selected label", [], ["Objects"], { under: ["Layout"] }],
  ["Algebra tiles", "/tools/algebra-tiles", "Selected item", ["Tiles"], ["Expression and answer", "Layout"]],
  ["Bubble method", "/tools/bubble-method", "Selected item", [], ["Steps"], { under: ["Layout"] }],
  ["Function machines", "/tools/function-machine", "Selected item", ["Machines"], ["Work the machines out", "Layout"]],
  ["Written methods", "/tools/written-method", "Selected row", [], ["Method", "Work the method out", "Layout"]],
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

test("Spinners, dice and bags: each object is a named group, and Layout stays in view however many there are", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/probability-objects");
  const group = page.locator(".md-kit fieldset.md-kit-group");
  expect(await group.first().evaluate((el) => [getComputedStyle(el).display, getComputedStyle(el).rowGap])).toEqual(["grid", "8px"]);
  // The list of objects is the right column on its own, so it can grow without pushing another card away.
  for (const name of ["Add a dice", "Add a bag", "Add a spinner"]) await page.getByRole("button", { name, exact: true }).click();
  await expect(group).toHaveCount(4);
  const layout = await chartCard(page, "Layout"), objects = await chartCard(page, "Objects");
  expect(layout.x).toBeLessThan(objects.x);
  expect(layout.y + layout.height).toBeLessThan(1080);
});

test("Bubble method: a tick sits beside its words, and Layout stays in view however many steps there are", async ({ page }) => {
  // The tool once shared a class prefix with Bar modelling, whose label rule stacked every tick over its words.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/bubble-method");
  const label = page.locator(".md-kit .panel-card label").filter({ hasText: "This working has a deliberate error" });
  expect(await label.evaluate((el) => getComputedStyle(el).flexDirection)).toBe("row");
  const tick = (await label.locator("input").boundingBox())!, whole = (await label.boundingBox())!;
  expect(Math.abs(tick.y + tick.height / 2 - (whole.y + whole.height / 2))).toBeLessThanOrEqual(1);
  // The list of steps is the right column on its own, so it can grow without pushing another card away.
  const add = page.getByRole("button", { name: "Add a step", exact: true });
  while (await add.isEnabled()) await add.click();
  await expect(page.locator(".md-kit fieldset.md-kit-group")).toHaveCount(8);
  const layout = await chartCard(page, "Layout"), steps = await chartCard(page, "Steps");
  expect(layout.x).toBeLessThan(steps.x);
  expect(layout.y + layout.height).toBeLessThan(1080);
});

test("Algebra tiles, Function machines and Written methods still fit one screen when they are full", async ({ page }) => {
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

  await page.goto("/tools/function-machine");
  await fill("Add a different machine");
  await fill("Add a box");
  await page.locator(".pt-hit").first().click();
  expect(await page.locator(".md-kit fieldset.md-kit-group").count()).toBe(3);
  expect(await fits()).toBe(true);

  // Twelve digits, the most a row holds, give the longest list of small digits: one each and one to carry into.
  await page.goto("/tools/written-method");
  await page.locator(".pt-hit").first().click();
  const digits = page.locator("#wm-selected-value");
  await digits.fill("123456789.123");
  await digits.press("Enter");
  await page.locator(".pt-hit").first().click();
  const small = page.locator(".md-kit .wm-mark input:not([type=checkbox])");
  await expect(small).toHaveCount(13);
  expect(await fits()).toBe(true);
  // A small digit keeps its narrow field, and a field on its own row has the row to itself.
  expect((await small.first().boundingBox())!.width).toBeLessThan(60);
  const card = (await page.locator('.md-kit .panel-card[aria-label="Selected row"]').boundingBox())!;
  expect((await digits.boundingBox())!.width).toBeGreaterThan(card.width - 40);

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
