import type { Page } from "@playwright/test";

/** The page on screen; visited editors stay mounted but hidden. */
const shown = (page: Page) => page.locator(".site-page:not([hidden])");

/** Opens another diagram tool from the switcher on the current tool's name. */
export async function switchTool(page: Page, name: string) {
  await shown(page).locator(".tool-switcher-button").click();
  await shown(page).locator(".tool-switcher-groups").getByRole("link", { name, exact: true }).click();
}

/** Goes from a diagram tool to the Diagram builder page: by the link beside the tool's name, or
 * on a phone, where that link is hidden, by the link at the foot of the switcher. */
export async function allTools(page: Page) {
  const crumb = shown(page).locator(".tool-switcher-crumb");
  if (await crumb.isVisible()) return crumb.click();
  await shown(page).locator(".tool-switcher-button").click();
  await shown(page).locator(".tool-switcher-foot a").click();
}

/** A click on plain page text, to move focus out of a field. The tool's name is a button now,
 * so tests click the description under it instead. */
export async function clickAway(page: Page) {
  await shown(page).locator(".page-heading p").first().click();
}
