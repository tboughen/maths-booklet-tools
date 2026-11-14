import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "./release-fixtures";
import { toolIds } from "../src/site/routes";

/** U34: every editor saves a title and note in its editable file and link, never prints them, and keeps them on reopen. */
const TITLE = "Year 9 starter ratio";
const NOTE = "Set 3, lesson 2: pupils fill the blanks.";

async function menuItem(page: Page, name: string | RegExp) {
  const trigger = page.getByRole("button", { name: "File", exact: true }).filter({ visible: true });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  return page.getByRole("menuitem", { name });
}
async function download(page: Page, name: string | RegExp) {
  const event = page.waitForEvent("download");
  await (await menuItem(page, name)).click();
  const file = await event;
  return { name: file.suggestedFilename(), text: (await readFile((await file.path())!)).toString() };
}

for (const tool of toolIds) {
  test(`${tool}: the title and note are saved in the file, never printed, and survive reopening`, async ({ page }, info) => {
    await page.goto(`/tools/${tool}`);
    const bar = page.getByRole("group", { name: "Resource utilities", exact: true });
    await expect(bar).toBeVisible();
    const svgBefore = (await download(page, "Download SVG")).text;

    await (await menuItem(page, /^Title and note/)).click();
    const dialog = page.getByRole("dialog", { name: "Title and note" });
    await expect(dialog.getByRole("textbox", { name: "Title" })).toBeFocused();
    await dialog.getByRole("textbox", { name: "Title" }).fill(`  ${TITLE}  `);
    await dialog.getByRole("textbox", { name: "Note" }).fill(NOTE);
    await dialog.getByRole("button", { name: "Save title and note" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(bar.getByRole("button", { name: "Undo", exact: true })).toHaveAttribute("title", "Undo change title and note (Ctrl+Z)");

    const saved = await download(page, /^Save editable file/);
    const envelope = JSON.parse(saved.text);
    expect(envelope.title).toBe(TITLE);
    expect(envelope.note).toBe(NOTE);
    expect(saved.name).toContain("year-9-starter-ratio");
    // Never printed: the artwork is unchanged.
    expect((await download(page, "Download SVG")).text).toBe(svgBefore);

    // Undo removes them again in one step.
    await bar.getByRole("button", { name: "Undo", exact: true }).click();
    expect(JSON.parse((await download(page, /^Save editable file/)).text).title).toBeUndefined();

    // Reopen the saved file, then save it again: the title and note are kept.
    const path = info.outputPath("saved.json");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, saved.text);
    const chooser = page.waitForEvent("filechooser");
    await (await menuItem(page, "Open editable file")).click();
    await (await chooser).setFiles(path);
    // Every editor asks before replacing the resource; its confirm button comes after Cancel.
    const confirm = page.getByRole("dialog").filter({ visible: true }).last();
    await expect(confirm.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await confirm.getByRole("button").last().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const again = JSON.parse((await download(page, /^Save editable file/)).text);
    expect(again.title).toBe(TITLE);
    expect(again.note).toBe(NOTE);
  });
}
