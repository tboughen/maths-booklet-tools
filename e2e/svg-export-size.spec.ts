import { test, expect } from "./release-fixtures";
import { readFile } from "node:fs/promises";

// U31: exported SVGs embed only the STIX glyphs they use, and draw exactly as they would with the
// whole fonts. Each tool's real Download SVG is compared, in Chromium, with the same file carrying
// the complete fonts.
const tools = ["graph", "ratio-table", "value-table-graph", "cuboids", "number-line", "venn", "triangle", "expanding-factorising", "bar-model", "charts", "probability-tree", "frequency-tree"];
const fontFiles = ["STIXTwoText-Regular.otf", "STIXTwoText-Italic.otf", "STIXTwoMath-Regular.otf"];

test("every tool's SVG export is small and draws exactly as it does with the whole fonts", async ({ page }) => {
  test.setTimeout(180000);
  const full = await Promise.all(fontFiles.map(async (name) => (await readFile(`assets/graph-fonts/${name}`)).toString("base64")));
  for (const tool of tools) {
    await page.goto(`/tools/${tool}`);
    await page.getByRole("button", { name: "File", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /Download SVG/ }).click();
    const svg = (await readFile((await (await download).path())!)).toString();
    const embedded = [...svg.matchAll(/data:font\/otf;base64,([A-Za-z0-9+/=]+)/g)].map((m) => m[1]);
    expect(embedded, tool).toHaveLength(3);
    expect(svg.length, `${tool} SVG bytes`).toBeLessThan(100_000);
    let i = 0;
    const whole = svg.replace(/data:font\/otf;base64,[A-Za-z0-9+/=]+/g, () => `data:font/otf;base64,${full[i++]}`);
    const [a, b] = await page.evaluate(async ([subset, original]) => {
      const draw = async (text: string) => {
        const image = new Image();
        image.src = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(2400, image.naturalWidth * 4);
        canvas.height = Math.round((canvas.width * image.naturalHeight) / image.naturalWidth);
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/png");
      };
      return [await draw(subset), await draw(original)];
    }, [svg, whole]);
    expect(a === b, `${tool} draws the same with subset and whole fonts`).toBe(true);
  }
});
