import { test, expect, type Page } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

const graphKey = "maths-booklet-tools:graph-envelope:v1";
const ratioKey = "maths-booklet-tools:ratio-table-envelope:v1";
const current = (page: Page) => page.locator(".site-page:not([hidden])");
const tools = (page: Page) =>
  page.getByRole("navigation", { name: "Booklet tools", exact: true });
const sections = (page: Page) =>
  page.getByRole("navigation", { name: "Main sections" });

async function addLine(page: Page) {
  await current(page).getByRole("button", { name: "Line by equation" }).click();
  await current(page)
    .getByRole("button", { name: "Add line", exact: true })
    .click();
}

test("home and overview keep the two sections distinct; bare and existing URLs still work", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("main", { name: "Home", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(
    page.getByRole("main", { name: "Home", exact: true }),
  ).toBeVisible();
  await current(page)
    .getByRole("link", { name: /Explore booklet tools/ })
    .click();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("main", { name: "Home", exact: true }),
  ).toBeVisible();
  await page.goto("/?tool=home");
  await expect(page).toHaveURL(/tool=home$/);
  await expect(
    page.getByRole("main", { name: "Home", exact: true }),
  ).toBeVisible();
  await current(page)
    .getByRole("link", { name: /Explore booklet tools/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Booklet tools", exact: true }),
  ).toBeVisible();
  await current(page)
    .getByRole("link", { name: /Open Ratio tables/ })
    .click();
  await expect(page).toHaveTitle("Ratio tables · Maths Dock");
  await expect(
    tools(page).getByRole("link", { name: "Ratio tables" }),
  ).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Booklet tools", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Ratio tables", exact: true }),
  ).toBeVisible();
});

test("immediate tool switching retains graphs, ratio edits and separate undo histories", async ({
  page,
}) => {
  await page.goto("/?tool=graph");
  await addLine(page);
  await tools(page).getByRole("link", { name: "Ratio tables" }).click();
  await current(page)
    .getByRole("group", { name: "Table structure" })
    .getByRole("button", { name: "Add row", exact: true })
    .click();
  await expect(
    current(page).getByLabel("Row 3 x cell type", { exact: true }),
  ).toBeVisible();
  // Add row intentionally focuses its new cell on the next animation frame.
  // Observe that completed interaction before directing the keyboard shortcut
  // to the workspace; otherwise its pending focus can steal Control+z.
  await expect(
    current(page).getByLabel("Row 3 x value", { exact: true }),
  ).toBeFocused();
  const ratioWorkspace = current(page).getByRole("region", {
    name: "Ratio table workspace",
  });
  await ratioWorkspace.focus();
  await expect(ratioWorkspace).toBeFocused();
  await page.keyboard.press("Control+z");
  await expect(
    current(page).getByLabel("Row 3 x cell type", { exact: true }),
  ).toHaveCount(0);
  await tools(page).getByRole("link", { name: "Graph tool" }).click();
  await expect(
    current(page).getByRole("button", { name: /Objects 1/ }),
  ).toBeVisible();
  await current(page)
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(
    current(page).getByRole("button", { name: /Objects 0/ }),
  ).toBeVisible();
  await current(page)
    .getByRole("button", { name: "Redo", exact: true })
    .click();
  await expect(
    current(page).getByRole("button", { name: /Objects 1/ }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) || "null")?.document.objects
            .length,
        graphKey,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) || "null")?.document.rows.length,
        ratioKey,
      ),
    )
    .toBe(2);
});

test("invalid ratio drafts survive leaving and returning without silently replacing their values", async ({
  page,
}) => {
  await page.goto("/?tool=ratio-table");
  const field = current(page).getByLabel("Row 1 x value", { exact: true });
  await field.fill("1/");
  await tools(page).getByRole("link", { name: "Graph tool" }).click();
  await tools(page).getByRole("link", { name: "Ratio tables" }).click();
  await expect(field).toHaveValue("1/");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(
    current(page).getByRole("button", { name: "Copy for Word" }),
  ).toBeDisabled();
});

test("Question bank keeps filters, question, scheme and selection through section navigation and exports both presets", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.goto("/?tool=question-bank&code=U332&tier=H");
  await expect(
    current(page).getByRole("button", { name: "Select question", exact: true }),
  ).toBeEnabled();
  await current(page)
    .getByRole("button", { name: "Select question", exact: true })
    .click();
  await current(page)
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await current(page)
    .getByRole("button", { name: "Show mark scheme", exact: true })
    .click();
  const bankUrl = page.url();
  const source = await current(page)
    .locator(".qb-source-heading strong")
    .innerText();
  await sections(page)
    .getByRole("link", { name: "Booklet tools", exact: true })
    .click();
  await sections(page)
    .getByRole("link", { name: "Question bank", exact: true })
    .click();
  await expect(page).toHaveURL(bankUrl);
  await expect(current(page).locator(".qb-source-heading strong")).toHaveText(
    source,
  );
  await expect(
    current(page).getByRole("button", {
      name: "Hide mark scheme",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    current(page).getByRole("button", {
      name: "Review paper (1)",
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Booklet tools", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(bankUrl);
  await current(page)
    .getByRole("button", { name: "Display", exact: true })
    .click();
  await expect(sections(page)).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(sections(page)).toBeVisible();
  await current(page)
    .getByRole("button", { name: "Review paper (1)", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  for (const preset of ["Compact practice", "Writing space"]) {
    await dialog.getByRole("radio", { name: new RegExp(preset) }).check();
    await dialog.getByRole("button", { name: "Prepare both PDFs" }).click();
    for (const name of ["Questions PDF", "Mark schemes PDF"]) {
      const download = page.waitForEvent("download");
      await dialog.getByRole("button", { name, exact: true }).click();
      const saved = info.outputPath(
        `${preset.split(" ")[0]}-${name.replaceAll(" ", "-")}.pdf`,
      );
      await (await download).saveAs(saved);
      const pdf = await PDFDocument.load(await readFile(saved));
      expect(pdf.getPageCount()).toBeGreaterThan(0);
    }
  }
  await dialog.getByRole("button", { name: "Close paper review" }).click();
});

test("a late bank response cannot hijack another page or lock its scrolling", async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/bank/catalogue.json", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/?tool=question-bank");
  await sections(page)
    .getByRole("link", { name: "Booklet tools", exact: true })
    .click();
  release();
  await expect(page).toHaveURL(/tool=booklet-tools$/);
  await expect(
    page.getByRole("heading", { name: "Booklet tools", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("body")
        .evaluate((element) => getComputedStyle(element).overflow),
    )
    .not.toBe("hidden");
  await sections(page)
    .getByRole("link", { name: "Question bank", exact: true })
    .click();
  await expect(
    current(page).getByRole("button", { name: "Select question", exact: true }),
  ).toBeVisible();
});

test("storage failure retains current work through tool navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable for test");
    };
  });
  await page.goto("/?tool=graph");
  await addLine(page);
  await tools(page).getByRole("link", { name: "Ratio tables" }).click();
  await tools(page).getByRole("link", { name: "Graph tool" }).click();
  await expect(
    current(page).getByRole("button", { name: /Objects 1/ }),
  ).toBeVisible();
  await expect(current(page).locator(".resource-save-status")).toHaveText(
    "Not saved on device",
  );
});

test("layouts fit laptop, tablet and narrow screens; mobile navigation supports keyboard dismissal", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  for (const width of [1280, 768, 375, 320]) {
    await page.setViewportSize({ width, height: width < 620 ? 812 : 800 });
    for (const id of [
      "home",
      "booklet-tools",
      "graph",
      "ratio-table",
      "question-bank",
    ]) {
      await page.goto(`/?tool=${id}`);
      if (id === "home")
        await expect(
          current(page).getByRole("main", { name: "Home", exact: true }),
        ).toBeVisible();
      else
        await expect(
          current(page).getByRole("heading", { level: 1 }),
        ).toBeVisible();
      if (id === "question-bank") {
        await expect(
          current(page).locator(".qb-canvas-host canvas"),
        ).toBeVisible();
        await expect(current(page).locator(".qb-view-error")).toHaveCount(0);
        const clipped = await current(page)
          .locator(
            ".qb-toolbar-actions > button, .qb-toolbar-actions > details > summary, .qb-source-actions > button, .qb-source-actions > details > summary, .qb-footer button, .qb-footer select, .qb-footer summary",
          )
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const box = element.getBoundingClientRect();
                return (
                  box.width > 0 &&
                  (box.left < 0 || box.right > window.innerWidth)
                );
              })
              .map(
                (element) =>
                  element.textContent || element.getAttribute("aria-label"),
              ),
          );
        expect(clipped).toEqual([]);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: info.outputPath(`${id}-${width}.png`),
        fullPage: true,
      });
    }
  }
  const menu = page.getByRole("button", { name: /Question bank/ });
  await menu.click();
  await expect(sections(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sections(page)).toBeHidden();
  await expect(menu).toBeFocused();
});
