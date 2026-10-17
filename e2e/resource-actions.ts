import type { Page } from "@playwright/test";
/** Follow the same common menu route a person uses; successful actions close it. */
export async function openResourceMenu(page: Page) {
  const trigger = page.getByRole("button", {
    name: "File",
    exact: true,
  });
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
}
export async function clickResourceAction(page: Page, name: string | RegExp) {
  await openResourceMenu(page);
  await page
    .getByRole("menuitem", { name, exact: typeof name === "string" })
    .click();
}
