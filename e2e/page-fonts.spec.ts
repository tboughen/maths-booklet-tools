import { test, expect } from "./release-fixtures";

// S42: the page loads the STIX fonts as WOFF2 (about 640 kB instead of 1.56 MB of OTF).
test("diagram editors load the STIX fonts as WOFF2, not OTF", async ({ page }) => {
  const fonts: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/STIXTwo.*\.(woff2|otf)$/.test(path)) fonts.push(path);
  });
  await page.goto("/tools/value-table-graph");
  const loaded = await page.evaluate(async () => {
    const faces = [
      ...(await document.fonts.load("16px 'STIX Two Text'", "x = 2")),
      ...(await document.fonts.load("italic 16px 'STIX Two Text'", "x")),
      ...(await document.fonts.load("16px 'STIX Two Math'", "𝑥")),
    ];
    return faces.filter((face) => face.status === "loaded").map((face) => `${face.family.replaceAll('"', "")} ${face.style}`);
  });
  expect(new Set(loaded)).toEqual(new Set(["STIX Two Text normal", "STIX Two Text italic", "STIX Two Math normal"]));
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.filter((path) => !path.endsWith(".woff2"))).toEqual([]);
});
