import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

mkdirSync("docs/brand", {recursive: true});
const render = (source, path, width) => writeFileSync(path, new Resvg(source, {
  fitTo: {mode: "width", value: width},
}).render().asPng());
const icon = readFileSync("public/favicon.svg", "utf8");
for (const size of [16, 32, 48]) render(icon, `public/brand/favicon-${size}.png`, size);
for (const size of [180, 192, 512]) render(icon, `public/brand/icon-${size}.png`, size);
render(readFileSync("public/brand/mathsdock-social.svg", "utf8"), "public/brand/mathsdock-social.png", 1200);
const normal = readFileSync("public/brand/mathsdock-logo.svg", "utf8");
const inverse = readFileSync("public/brand/mathsdock-logo-inverse.svg", "utf8");
const standalone = readFileSync("public/brand/mathsdock-icon.svg", "utf8");
render(normal, "docs/brand/mathsdock-logo-preview.png", 1501);
const nested = (source, x, y, width, height) => source.replace('<svg ', `<svg x="${x}" y="${y}" width="${width}" height="${height}" `);
const board = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800" viewBox="0 0 1600 800">
<rect width="1600" height="800" fill="white"/>
${nested(normal, 50, 35, 1501, 326)}
<rect x="45" y="410" width="1130" height="315" fill="#173c65"/>
${nested(inverse, 90, 450, 1040, 226)}
${nested(standalone, 1230, 430, 310, 200)}
${[16, 32, 48].map((size, i) => nested(icon, 1240 + i * 100, 690 - size, size, size)).join("")}
</svg>`;
writeFileSync("docs/brand/review-board.svg", board);
render(board, "docs/brand/review-board.png", 1600);
console.log("Rendered favicons, mobile icons, social image and SVG review board.");
