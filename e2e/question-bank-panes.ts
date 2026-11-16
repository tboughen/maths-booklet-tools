import type { Locator, Page } from "@playwright/test";

/** The three panes of the Question bank viewer. Each has a switch of the same name. */
export type PaneName = "Question" | "Mark scheme" | "Worked solution";

/** The switch that turns a pane on or off. */
export const paneSwitch = (page: Page, name: PaneName): Locator => page.getByRole("button", { name, exact: true });

/** A pane that is on screen. */
export const pane = (page: Page, name: PaneName): Locator => page.getByRole("group", { name, exact: true });

/** Shows one pane by itself: switches it on and every other pane off. */
export async function showOnly(page: Page, name: PaneName) {
  if (await paneSwitch(page, name).getAttribute("aria-pressed") !== "true") await paneSwitch(page, name).click();
  for (const other of ["Question", "Mark scheme", "Worked solution"] as const) {
    if (other !== name && await paneSwitch(page, other).getAttribute("aria-pressed") === "true") await paneSwitch(page, other).click();
  }
}
