import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync, readdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { catalogueAssetPaths, type CatalogueAssets } from "../../bankAssets.ts";

// Question files are served by the website's own Worker at /bank/assets/*, behind
// Cloudflare Access. There is no separate public asset origin.
export const assetOrigin = "same-origin";
export const bucketName = "maths-booklet-assets";
export const immutableCache = "public, max-age=31536000, immutable";
export interface ReleaseAsset {
  key: string; sha256: string; md5: string; bytes: number;
  contentType: string; sources: string[];
}
export interface ReleaseManifest {
  schemaVersion: 1; assetOrigin: string; bucket: string; sourceCommit: string;
  sourceFingerprint: string;
  sourceCatalogueSha256: string; catalogueSha256: string; assets: ReleaseAsset[];
}
export const digest = (data: Uint8Array | string, algorithm = "sha256") => createHash(algorithm).update(data).digest("hex");

export function assetFile(publicRoot: string, path: string): string {
  // Reuse the publication validator before resolving filesystem paths.
  catalogueAssetPaths({ questions: [{ questionPdf: path, printPdf: path, schemePdf: path, questionViews: [], schemeViews: [] }] });
  const root = realpathSync(publicRoot);
  const file = realpathSync(resolve(root, path));
  if (!file.startsWith(root + sep) || !statSync(file).isFile()) throw new Error("Asset escapes the public directory");
  return file;
}

export function sourceFingerprint(root: string): string {
  const files = ["package.json", "package-lock.json", "vite.config.ts", "bankAssets.ts", "workedSolution.ts", "index.html", "scripts/cloudflare/release.ts", "scripts/bank/solution-files.ts"];
  const walk = (directory: string) => {
    for (const item of readdirSync(resolve(root, directory), {withFileTypes: true})) {
      const path = `${directory}/${item.name}`;
      if (item.isDirectory()) walk(path); else if (item.isFile()) files.push(path);
    }
  };
  for (const directory of ["src", "packages", "assets"]) walk(directory);
  const hash = createHash("sha256");
  for (const path of files.sort()) hash.update(path + "\0" + digest(readFileSync(resolve(root, path))) + "\n");
  return hash.digest("hex");
}

export function prepareRelease(publicRoot: string, sourceCommit: string, fingerprint = "") {
  const source = readFileSync(resolve(publicRoot, "bank/catalogue.json"));
  const catalogue = JSON.parse(source.toString()) as CatalogueAssets;
  const paths = catalogueAssetPaths(catalogue);
  const pathMap = new Map<string, string>();
  const objects = new Map<string, ReleaseAsset>();
  for (const path of paths) {
    const data = readFileSync(assetFile(publicRoot, path));
    const sha256 = digest(data);
    const extension = path.endsWith(".pdf") ? "pdf" : "png";
    const key = `bank/assets/sha256/${sha256}.${extension}`;
    pathMap.set(path, key);
    const existing = objects.get(key);
    if (existing) existing.sources.push(path);
    else objects.set(key, { key, sha256, md5: digest(data, "md5"), bytes: data.length,
      contentType: extension === "pdf" ? "application/pdf" : "image/png", sources: [path] });
  }
  for (const question of catalogue.questions) {
    for (const field of ["questionPdf", "printPdf", "schemePdf"] as const) question[field] = pathMap.get(question[field])!;
    for (const view of [...question.questionViews, ...question.schemeViews]) view.preview = pathMap.get(view.preview)!;
    if (question.workedSolution) {
      question.workedSolution.pdf = pathMap.get(question.workedSolution.pdf)!;
      for (const view of question.workedSolution.views) view.preview = pathMap.get(view.preview)!;
    }
  }
  const catalogueJson = JSON.stringify(catalogue);
  const manifest: ReleaseManifest = {
    schemaVersion: 1, assetOrigin, bucket: bucketName, sourceCommit, sourceFingerprint: fingerprint,
    sourceCatalogueSha256: digest(source), catalogueSha256: digest(catalogueJson),
    assets: [...objects.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
  return { catalogueJson, manifest };
}
