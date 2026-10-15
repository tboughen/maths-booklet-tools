import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const [baselineRoot, candidateRoot] = process.argv.slice(2);
if (!baselineRoot || !candidateRoot) throw new Error("Supply baseline and candidate PDF directories");
const proof = [];
for (const name of ["compact-questions.pdf", "compact-schemes.pdf", "writing-questions.pdf", "writing-schemes.pdf"]) {
  const load = root => getDocument({data: new Uint8Array(readFileSync(resolve(root, name))), isEvalSupported: false,
    standardFontDataUrl: resolve("public/bank/pdfjs/standard_fonts/") + "/"}).promise;
  const left = await load(baselineRoot), right = await load(candidateRoot);
  if (left.numPages !== right.numPages) throw new Error(`Page count changed: ${name}`);
  const pages = [];
  for (let index = 1; index <= left.numPages; index++) {
    const hashes = [];
    for (const doc of [left, right]) {
      const page = await doc.getPage(index), viewport = page.getViewport({scale: 1.5});
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({canvas, canvasContext: context, viewport}).promise;
      hashes.push(createHash("sha256").update(context.getImageData(0,0,canvas.width,canvas.height).data).digest("hex"));
    }
    if (hashes[0] !== hashes[1]) throw new Error(`Rendered page changed: ${name}, page ${index}`);
    pages.push({page: index, pixelSha256: hashes[0]});
  }
  proof.push({file: name, pages, pixelEquivalent: true});
  await left.destroy(); await right.destroy();
}
writeFileSync("cloudflare-release/pdf-comparison.json", JSON.stringify(proof, null, 2));
console.log("All four PDF exports match the retained original exports on every rendered page.");
