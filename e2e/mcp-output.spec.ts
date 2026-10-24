import { test, expect } from "./release-fixtures";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync } from "fflate";
// Actual public-MCP artifacts, produced by verify-consumption before this suite.
const directory = process.env.MCP_CONSUMPTION_DIR;
test.skip(
  !directory,
  "Run verify-consumption.js and set MCP_CONSUMPTION_DIR to its output directory.",
);
const cases = [
  ...["bar-model", "bar-model-revised"].map(name => ({ name, route: "bar-model", input: "Open bar model file", confirm: "Open bar model", key: "maths-booklet-tools:bar-model:v1", selector: ".bm-resource" })),
  ...["algebra-grid", "algebra-factor", "algebra-answer"].map((name) => ({
    name,
    route: "expanding-factorising",
    input: "Open algebra grid file",
    confirm: "Apply replacement",
    key: "maths-booklet-tools:algebra-grid:v1",
    selector: '[data-testid="algebra-resource"]',
  })),
  {
    name: "graph",
    route: "graph",
    input: "Open editable graph file",
    confirm: "Open this graph",
    key: "maths-booklet-tools:graph-envelope:v1",
    selector: ".graph-canvas",
  },
  {
    name: "ratio",
    route: "ratio-table",
    input: "Open editable ratio-table file",
    confirm: "Open this table",
    key: "maths-booklet-tools:ratio-table-envelope:v1",
    selector: ".ratio-table-svg",
  },
  {
    name: "quadratic-combined",
    route: "value-table-graph",
    input: "",
    confirm: "Continue",
    key: "mathsdock:value-table-graph:v1",
    selector: ".vg-paper",
  },
  {
    name: "cuboids-revised",
    route: "cuboids",
    input: "Open cuboids file",
    confirm: "Use these cuboids",
    key: "maths-booklet-tools:cuboids:v1",
    selector: '[data-testid="cuboid-resource"]',
  },
  {
    name: "number-line-revised",
    route: "number-line",
    input: "",
    confirm: "Open resource",
    key: "maths-booklet-tools:number-line:v1",
    selector: '[data-testid="number-line-resource"]',
  },
  {
    name: "venn-revised",
    route: "venn",
    input: "",
    confirm: "Use this diagram",
    key: "maths-booklet-tools:venn:v1",
    selector: ".vn-art svg",
  },
];
for (const c of cases) {
  test(`actual MCP ${c.name} source opens without changing blanks, settings or IDs`, async ({
    page,
  }, info) => {
    const bytes = await readFile(resolve(directory!, `${c.name}.json`));
    const expected = JSON.parse(bytes.toString());
    await page.goto(`/?tool=${c.route}`);
    await page.getByRole("button", { name: "File" }).click();
    const input = c.input
      ? page.getByLabel(c.input, { exact: true })
      : page.locator('input[type="file"]');
    await input.setInputFiles({
      name: "source.json",
      mimeType: "application/json",
      buffer: bytes,
    });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: c.confirm, exact: true })
      .click();
    await expect
      .poll(async () =>
        JSON.parse(
          await page.evaluate((key) => localStorage.getItem(key)!, c.key),
        ),
      )
      .toEqual(expected);
    const resource =
      c.name === "ratio"
        ? page.locator(".ratio-preview svg").first()
        : page.locator(c.selector);
    await expect(resource).toBeVisible();
    await resource.screenshot({
      path: info.outputPath("reopened-resource.png"),
    });
    await page.reload();
    await expect
      .poll(async () =>
        JSON.parse(
          await page.evaluate((key) => localStorage.getItem(key)!, c.key),
        ),
      )
      .toEqual(expected);
  });
}
test("actual algebra MCP link retains pupil blanks through a mobile edit and Undo", async ({
  page,
}, info) => {
  const evidence = JSON.parse(
      await readFile(resolve(directory!, "retrieval.json"), "utf8"),
    ),
    item = evidence.items["algebra-factor"],
    u = new URL(item.editorUrl);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/?${u.searchParams}${u.hash}`);
  await page
    .getByRole("button", { name: "Apply replacement", exact: true })
    .click();
  const key = "maths-booklet-tools:algebra-grid:v1";
  await expect
    .poll(async () =>
      JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, key)),
    )
    .toEqual(item.envelope);
  await page.locator('[data-ag-cell="0-2"]').click();
  await page.getByLabel("Cell entry", { exact: true }).fill("+3");
  await page.getByRole("button", { name: "Apply cell", exact: true }).click();
  await expect
    .poll(
      async () =>
        JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, key))
          .document.rows[0].cells[2].value,
    )
    .toBe("+3");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () =>
      JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, key)),
    )
    .toEqual(item.envelope);
  await page.screenshot({
    path: info.outputPath("algebra-mcp-mobile.png"),
    fullPage: true,
  });
});
test("actual algebra bundle source reopens with every pupil blank", async ({
  page,
}) => {
  const files = unzipSync(
    new Uint8Array(
      await readFile(resolve(directory!, "algebra-grid-bundle.zip")),
    ),
  );
  const bytes = Buffer.from(files["source.json"]),
    expected = JSON.parse(bytes.toString("utf8"));
  await page.goto("/?tool=expanding-factorising");
  await page
    .getByLabel("Open algebra grid file", { exact: true })
    .setInputFiles({
      name: "source.json",
      mimeType: "application/json",
      buffer: bytes,
    });
  await page
    .getByRole("button", { name: "Apply replacement", exact: true })
    .click();
  await expect
    .poll(async () =>
      JSON.parse(
        await page.evaluate(
          () => localStorage.getItem("maths-booklet-tools:algebra-grid:v1")!,
        ),
      ),
    )
    .toEqual(expected);
});

test("an actual ZIP's editable source opens in the existing ratio editor", async ({
  page,
}) => {
  const zip = unzipSync(
    new Uint8Array(await readFile(resolve(directory!, "ratio-bundle.zip"))),
  );
  const expected = JSON.parse(Buffer.from(zip["source.json"]).toString());
  await page.goto("/?tool=ratio-table");
  await page.getByRole("button", { name: "File" }).click();
  await page
    .getByLabel("Open editable ratio-table file", { exact: true })
    .setInputFiles({
      name: "source.json",
      mimeType: "application/json",
      buffer: Buffer.from(zip["source.json"]),
    });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Open this table", exact: true })
    .click();
  await expect
    .poll(async () =>
      JSON.parse(
        await page.evaluate(
          () =>
            localStorage.getItem(
              "maths-booklet-tools:ratio-table-envelope:v1",
            )!,
        ),
      ),
    )
    .toEqual(expected);
});

for (const c of cases.filter((c) =>
  ["cuboids", "number-line", "venn"].includes(c.route),
)) {
  test(`actual MCP ${c.route} editor link retains exact source and allows editing at 320px`, async ({
    page,
  }, info) => {
    const evidence = JSON.parse(
      await readFile(resolve(directory!, "retrieval.json"), "utf8"),
    );
    const item = evidence.items[c.name],
      u = new URL(item.editorUrl);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/?${u.searchParams.toString()}${u.hash}`);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: c.confirm, exact: true })
      .click();
    await expect
      .poll(async () =>
        JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, c.key)),
      )
      .toEqual(item.envelope);
    await expect(
      page.getByRole("button", { name: "Copy for Word", exact: true }),
    ).toBeEnabled();
    if (c.route === "cuboids") {
      await page
        .getByRole("button", {
          name: "Edit depth label on cuboid-1",
          exact: true,
        })
        .click();
      await page
        .getByRole("textbox", { name: "Edit depth", exact: true })
        .fill("3");
      await page
        .getByRole("textbox", { name: "Edit depth", exact: true })
        .press("Enter");
      await expect
        .poll(
          async () =>
            JSON.parse(
              await page.evaluate((k) => localStorage.getItem(k)!, c.key),
            ).document.shapes[0].dimensions.depth,
        )
        .toBe("3");
    } else if (c.route === "number-line") {
      await page.getByLabel("Last tick", { exact: true }).fill("6");
      await page.getByLabel("Last tick", { exact: true }).press("Enter");
      await expect
        .poll(
          async () =>
            JSON.parse(
              await page.evaluate((k) => localStorage.getItem(k)!, c.key),
            ).document.axis.maximum,
        )
        .toBe("6");
    } else {
      await page.locator('[data-region-hit="1"]').click();
      await page.getByLabel("Region content", { exact: true }).fill("2");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      await expect
        .poll(
          async () =>
            JSON.parse(
              await page.evaluate((k) => localStorage.getItem(k)!, c.key),
            ).document.regions[1].text,
        )
        .toBe("2");
      expect(
        JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, c.key))
          .document.regions[1].visibility,
      ).toBe("hidden");
    }
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(async () =>
        JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, c.key)),
      )
      .toEqual(item.envelope);
    await page.screenshot({
      path: info.outputPath("mobile-reopened.png"),
      fullPage: true,
    });
  });
  test(`actual ${c.route} bundle source reopens with pupil blanks`, async ({
    page,
  }) => {
    const zip = unzipSync(
      new Uint8Array(
        await readFile(resolve(directory!, `${c.route}-bundle.zip`)),
      ),
    );
    const bytes = Buffer.from(zip["source.json"]),
      expected = JSON.parse(bytes.toString());
    await page.goto(`/?tool=${c.route}`);
    await page
      .getByRole("button", { name: "File", exact: true })
      .click();
    const input = c.input
      ? page.getByLabel(c.input, { exact: true })
      : page.locator('input[type="file"]');
    await input.setInputFiles({
      name: "source.json",
      mimeType: "application/json",
      buffer: bytes,
    });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: c.confirm, exact: true })
      .click();
    await expect
      .poll(async () =>
        JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, c.key)),
      )
      .toEqual(expected);
  });
}

test('actual bar-model bundle preserves every saved label and pupil state',async({page})=>{const zip=unzipSync(new Uint8Array(await readFile(resolve(directory!,'bar-model-bundle.zip'))));const bytes=Buffer.from(zip['source.json']),expected=JSON.parse(bytes.toString('utf8'));await page.goto('/?tool=bar-model');await page.getByLabel('Open bar model file',{exact:true}).setInputFiles({name:'source.json',mimeType:'application/json',buffer:bytes});await page.getByRole('dialog').getByRole('button',{name:'Open bar model',exact:true}).click();await expect.poll(async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('maths-booklet-tools:bar-model:v1')!))).toEqual(expected);});
