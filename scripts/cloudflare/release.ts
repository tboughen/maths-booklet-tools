import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync, readdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { catalogueAssetPaths, type CatalogueAssets } from "../../bankAssets.ts";
import { bankAssetPath } from "../../workedSolution.ts";
import { parseSchemeIndex, schemeIds, schemeSourcePath, SCHEMES_PATH } from "../../bankSchemes.ts";

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
  // Reuse the publication validators before resolving filesystem paths. Uploads read every
  // inventory source through here, schemes of work included.
  if (!schemeSourcePath(path) && !bankAssetPath(path)) throw new Error("Invalid question-bank asset path");
  const root = realpathSync(publicRoot);
  const file = realpathSync(resolve(root, path));
  if (!file.startsWith(root + sep) || !statSync(file).isFile()) throw new Error("Asset escapes the public directory");
  return file;
}

export function sourceFingerprint(root: string): string {
  const files = ["package.json", "package-lock.json", "vite.config.ts", "bankAssets.ts", "bankSchemes.ts", "bankCatalogueSplit.ts", "workedSolution.ts", "index.html", "scripts/cloudflare/release.ts", "scripts/bank/solution-files.ts"];
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

/**
 * The scheme index with each scheme that is present rewritten to its immutable object, and those
 * objects. A scheme missing from the bank checkout is left out, so the page offers typed objectives.
 */
export function prepareSchemes(publicRoot: string): { schemesJson: string; assets: ReleaseAsset[] } {
  const indexFile = resolve(publicRoot, SCHEMES_PATH);
  const index = existsSync(indexFile) ? parseSchemeIndex(JSON.parse(readFileSync(indexFile, "utf8"))) : { schemaVersion: 1 as const };
  const root = realpathSync(publicRoot);
  const out: Record<string, unknown> = { schemaVersion: 1 };
  const assets: ReleaseAsset[] = [];
  for (const id of schemeIds) {
    const path = index[id];
    if (!path || !existsSync(resolve(root, path))) continue;
    const file = realpathSync(resolve(root, path));
    if (!file.startsWith(root + sep) || !statSync(file).isFile()) throw new Error("Scheme escapes the public directory");
    const data = readFileSync(file);
    JSON.parse(data.toString("utf8")); // a scheme must be JSON before it is published
    const sha256 = digest(data), key = `bank/assets/sha256/${sha256}.json`;
    out[id] = key;
    if (!assets.some(a => a.key === key)) assets.push({ key, sha256, md5: digest(data, "md5"), bytes: data.length, contentType: "application/json", sources: [path] });
  }
  return { schemesJson: JSON.stringify(out), assets };
}

const contentTypes = { pdf: "application/pdf", png: "image/png", json: "application/json" } as const;

export function prepareRelease(publicRoot: string, sourceCommit: string, fingerprint = "") {
  const source = readFileSync(resolve(publicRoot, "bank/catalogue.json"));
  const catalogue = JSON.parse(source.toString()) as CatalogueAssets;
  const paths = catalogueAssetPaths(catalogue);
  const pathMap = new Map<string, string>();
  const objects = new Map<string, ReleaseAsset>();
  for (const path of paths) {
    const data = readFileSync(assetFile(publicRoot, path));
    const sha256 = digest(data);
    const extension = path.endsWith(".pdf") ? "pdf" : path.endsWith(".json") ? "json" : "png";
    // A worked solution's steps file must be JSON before it is published.
    if (extension === "json") JSON.parse(data.toString("utf8"));
    const key = `bank/assets/sha256/${sha256}.${extension}`;
    pathMap.set(path, key);
    const existing = objects.get(key);
    if (existing) existing.sources.push(path);
    else objects.set(key, { key, sha256, md5: digest(data, "md5"), bytes: data.length,
      contentType: contentTypes[extension], sources: [path] });
  }
  for (const question of catalogue.questions) {
    for (const field of ["questionPdf", "printPdf", "schemePdf"] as const) question[field] = pathMap.get(question[field])!;
    for (const view of [...question.questionViews, ...question.schemeViews]) view.preview = pathMap.get(view.preview)!;
    for (const cut of question.cuts ?? []) {
      cut.pdf = pathMap.get(cut.pdf)!;
      for (const view of cut.views) view.preview = pathMap.get(view.preview)!;
    }
    if (question.workedSolution) question.workedSolution.data = pathMap.get(question.workedSolution.data)!;
  }
  const catalogueJson = JSON.stringify(catalogue);
  const { schemesJson, assets: schemes } = prepareSchemes(publicRoot);
  for (const asset of schemes) if (!objects.has(asset.key)) objects.set(asset.key, asset);
  const manifest: ReleaseManifest = {
    schemaVersion: 1, assetOrigin, bucket: bucketName, sourceCommit, sourceFingerprint: fingerprint,
    sourceCatalogueSha256: digest(source), catalogueSha256: digest(catalogueJson),
    assets: [...objects.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
  return { catalogueJson, schemesJson, manifest };
}
