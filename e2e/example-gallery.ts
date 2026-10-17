import { expect, type Page } from "@playwright/test";

export async function showExamples(page: Page) {
  const gallery = page.locator("dialog.example-gallery[open]");
  if (!(await gallery.isVisible()))
    await page
      .getByRole("button", { name: "Start from an example", exact: true })
      .click();
  await expect(gallery).toBeVisible();
  // Source-regression audits inspect the full retained notes and links. The new
  // usability suite separately checks the concise, initially collapsed cards.
  for (const details of await gallery.locator("details").all()) {
    if ((await details.getAttribute("open")) === null)
      await details.locator("summary").click();
  }
  return gallery;
}
export function galleryCard(page: Page, title: string) {
  return page
    .locator("dialog.example-gallery[open]")
    .getByRole("article", { name: title, exact: true });
}
export async function chooseExample(page: Page, title: string) {
  await showExamples(page);
  await galleryCard(page, title)
    .getByRole("button", { name: /^Open (scaffold|blank grid|diagram)$/ })
    .click();
}
export async function closeExamples(page: Page) {
  const gallery = page.locator("dialog.example-gallery[open]");
  if (await gallery.isVisible())
    await gallery.getByRole("button", { name: "Close", exact: true }).click();
}
