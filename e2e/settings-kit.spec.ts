import { test, expect, type Page } from "./release-fixtures";

// The settings kit (docs/tools/APP-HOUSE-STYLE.md, "The settings kit"), on Bar modelling, Statistical charts and the tree tools.
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
    const sizes = await stack.evaluate((el) => ({
      buttons: [...new Set([...el.querySelectorAll<HTMLElement>(".panel-card button")].map((b) => b.getBoundingClientRect().height))],
      fields: [...new Set([...el.querySelectorAll<HTMLElement>(".panel-card :is(select, input:not([type=checkbox]))")].map((b) => b.getBoundingClientRect().height))],
      ticks: [...new Set([...el.querySelectorAll<HTMLElement>(".panel-card input[type=checkbox]")].map((b) => b.getBoundingClientRect().width))],
      // A button that is off is grey, not grey and faded as well.
      faded: [...el.querySelectorAll<HTMLElement>(".panel-card button:disabled")].filter((b) => getComputedStyle(b).opacity !== "1").length,
      cut: [...el.querySelectorAll<HTMLElement>(".panel-card")].filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.querySelector("h2")?.textContent),
      heading: getComputedStyle(el.querySelector(".panel-card h2")!).font,
    }));
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
    const small = await page.locator(".inspector-stack.md-kit").evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>(".panel-card :is(button, select, input:not([type=checkbox]), label:has(> input[type=checkbox]))")]
        .filter((c) => c.getBoundingClientRect().height > 0 && c.getBoundingClientRect().height < 44)
        .map((c) => c.textContent || c.getAttribute("aria-label")),
    );
    expect(small, path).toEqual([]);
    // The list of branches is as long as it needs to be: no scrolling inside the scrolling page.
    const lists = await page.locator(".pt-branches").evaluateAll((all) => all.map((el) => el.scrollHeight <= el.clientHeight));
    expect(lists, path).toEqual(path === "/tools/factor-tree" ? [] : [true]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
});
