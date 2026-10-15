import { test, expect } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
// Actual public-MCP artifacts, produced by verify-consumption before this suite.
const directory = process.env.MCP_CONSUMPTION_DIR;
test.skip(!directory, "Run verify-consumption.js and set MCP_CONSUMPTION_DIR to its output directory.");
const cases = [
  {name: "graph", route: "graph", input: "Open editable graph file", confirm: "Open this graph", key: "maths-booklet-tools:graph-envelope:v1", selector: ".graph-canvas"},
  {name: "ratio", route: "ratio-table", input: "Open editable ratio-table file", confirm: "Open this table", key: "maths-booklet-tools:ratio-table-envelope:v1", selector: ".ratio-table-svg"},
  {name: "quadratic-combined", route: "value-table-graph", input: "", confirm: "Continue", key: "mathsdock:value-table-graph:v1", selector: ".vg-paper"},
];
for (const c of cases) {
  test(`actual MCP ${c.name} source opens without changing blanks, settings or IDs`, async ({page}, info) => {
    const bytes = await readFile(resolve(directory!, `${c.name}.json`));
    const expected = JSON.parse(bytes.toString());
    await page.goto(`/?tool=${c.route}`);
    await page.getByRole("button", {name: "Download options"}).click();
    const input = c.input ? page.getByLabel(c.input, {exact: true}) : page.locator('input[type="file"]');
    await input.setInputFiles({name: "source.json", mimeType: "application/json", buffer: bytes});
    await page.getByRole("dialog").getByRole("button", {name: c.confirm, exact: true}).click();
    await expect.poll(async () => JSON.parse(await page.evaluate((key) => localStorage.getItem(key)!, c.key))).toEqual(expected);
    const resource = c.name === "ratio" ? page.locator(".ratio-preview svg").first() : page.locator(c.selector);
    await expect(resource).toBeVisible();
    await resource.screenshot({path: info.outputPath("reopened-resource.png")});
    await page.reload();
    await expect.poll(async () => JSON.parse(await page.evaluate((key) => localStorage.getItem(key)!, c.key))).toEqual(expected);
  });
}
test("an actual ZIP's editable source opens in the existing ratio editor", async ({page}) => {
  const zip = unzipSync(new Uint8Array(await readFile(resolve(directory!, "ratio-bundle.zip"))));
  const expected = JSON.parse(Buffer.from(zip["source.json"]).toString());
  await page.goto("/?tool=ratio-table");
  await page.getByRole("button", {name: "Download options"}).click();
  await page.getByLabel("Open editable ratio-table file", {exact: true}).setInputFiles({name: "source.json", mimeType: "application/json", buffer: Buffer.from(zip["source.json"])});
  await page.getByRole("dialog").getByRole("button", {name: "Open this table", exact: true}).click();
  await expect.poll(async () => JSON.parse(await page.evaluate(() => localStorage.getItem("maths-booklet-tools:ratio-table-envelope:v1")!))).toEqual(expected);
});
