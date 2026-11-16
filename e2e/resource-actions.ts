import type { Page } from "@playwright/test";
type Menu = "Download" | "File";
const pictures = ["Download SVG", "Download PNG (600 ppi)", "Download PDF (actual size)", "Download answers SVG", "Download answers PNG (600 ppi)", "Download pupil and answers (ZIP)"];
/** A diagram tool has two menus: Download holds the pictures, File everything else. */
export const menuFor = (name: string | RegExp): Menu =>
  pictures.some((label) => (typeof name === "string" ? label === name : name.test(label))) ? "Download" : "File";
/** Follow the same common menu route a person uses; successful actions close it. */
export async function openResourceMenu(page: Page, menu: Menu = "File") {
  const trigger = page.getByRole("button", {
    name: menu,
    exact: true,
  });
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
}
export async function clickResourceAction(page: Page, name: string | RegExp) {
  await openResourceMenu(page, menuFor(name));
  await page
    .getByRole("menuitem", { name, exact: typeof name === "string" })
    .click();
}
