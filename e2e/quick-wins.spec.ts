// Usability quick wins from the 21 Nov 2026 review: the keyboard shortcuts card, the hover
// highlight on diagram targets, the message repeated beside the copy buttons, and copy tooltips.
// All of it is screen furniture: nothing here may reach an export.
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tools/probability-tree");
  await expect(page.locator(".site-page:not([hidden]) .editor-card > .editor-stage")).toBeVisible();
});

test("? opens the keyboard shortcuts card, but not while typing", async ({ page }) => {
  const shown = page.locator(".site-page:not([hidden])");
  const card = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await shown.getByRole("textbox").first().focus();
  await page.keyboard.type("?");
  await expect(card).toHaveCount(0);
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("?");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Undo, redo");
  await expect(card).toContainText("Move the selected object 1 mm");
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  // The File menu lists it too.
  await shown.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Keyboard shortcuts" }).click();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Close" }).click();
  await expect(card).toHaveCount(0);
});

test("diagram targets get a soft highlight on hover", async ({ page }) => {
  const hit = page.locator(".site-page:not([hidden]) .pt-hit").first();
  await expect(hit).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await hit.hover();
  await expect(hit).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(hit).toHaveCSS("cursor", "pointer");
});

test("a copy message also shows for a moment just under the copy buttons", async ({ page }) => {
  const shown = page.locator(".site-page:not([hidden])");
  const copy = shown.getByRole("button", { name: "Copy image", exact: true });
  await expect(copy).toHaveAttribute("title", /slides or the board/);
  await expect(shown.getByRole("button", { name: "Copy for Word", exact: true })).toHaveAttribute("title", /real print size/);
  await copy.click();
  const flash = page.locator(".editor-status-flash");
  await expect(flash).toBeVisible();
  await expect(flash).toHaveAttribute("aria-hidden", "true");
  await expect(flash).toHaveCSS("pointer-events", "none");
  // The words are drawn from an attribute, so the message is in the page's text only once.
  await expect(flash).toHaveText("");
  await expect(flash).not.toHaveAttribute("data-text", "");
  const actions = (await shown.locator(".editor-copy-actions").boundingBox())!;
  const box = (await flash.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(actions.y + actions.height);
  expect(box.y).toBeLessThan(actions.y + actions.height + 40);
  await expect(flash).toHaveCount(0, { timeout: 5000 });
});

test("a message that does not follow a copy, download or file press is not repeated", async ({ page }) => {
  const shown = page.locator(".site-page:not([hidden])");
  await shown.getByRole("button", { name: 'Questions and "given that"' }).click();
  await shown.getByRole("button", { name: "Add question" }).click();
  await expect(page.locator(".editor-status-flash")).toHaveCount(0);
});
