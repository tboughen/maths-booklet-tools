import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { digest, prepareRelease } from "./release";
const roots: string[] = [];
afterEach(() => {for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true});});
function fixture(path = "bank/assets/one.pdf") {
  const root = mkdtempSync(join(tmpdir(), "mathsdock-release-")); roots.push(root);
  mkdirSync(join(root, "bank/assets"), {recursive: true});
  writeFileSync(join(root, "bank/assets/one.pdf"), "%PDF-test");
  writeFileSync(join(root, "bank/assets/two.pdf"), "%PDF-test");
  writeFileSync(join(root, "bank/assets/view.png"), "png-test");
  const q = {id: "one", marks: 4, questionPdf: path, printPdf: "bank/assets/two.pdf", schemePdf: path,
    questionViews: [{preview: "bank/assets/view.png", width: 100}], schemeViews: []};
  writeFileSync(join(root, "bank/catalogue.json"), JSON.stringify({version: "test", questions: [q]}));
  return root;
}
describe("Cloudflare release construction", () => {
  it("deduplicates identical bytes, retains metadata and produces deterministic immutable references", () => {
    const root = fixture();
    const first = prepareRelease(root, "commit");
    expect(first).toEqual(prepareRelease(root, "commit"));
    expect(first.manifest.assets).toHaveLength(2);
    expect(first.manifest.catalogueSha256).toBe(digest(first.catalogueJson));
    const q = JSON.parse(first.catalogueJson).questions[0];
    expect(q.id).toBe("one"); expect(q.marks).toBe(4); expect(q.questionViews[0].width).toBe(100);
    expect(q.questionPdf).toBe(q.printPdf);
    expect(q.questionPdf).toMatch(/^bank\/assets\/sha256\/[a-f0-9]{64}\.pdf$/);
  });
  it("changes object URLs when bytes change, without replacing the previous release", () => {
    const root = fixture();
    const first = prepareRelease(root, "commit");
    writeFileSync(join(root, "bank/assets/one.pdf"), "%PDF-changed");
    const second = prepareRelease(root, "commit");
    expect(JSON.parse(second.catalogueJson).questions[0].questionPdf).not.toBe(JSON.parse(first.catalogueJson).questions[0].questionPdf);
  });
  it("refuses traversal, missing files and malformed catalogue paths before uploading", () => {
    expect(() => prepareRelease(fixture("bank/assets/../secret.pdf"), "commit")).toThrow();
    expect(() => prepareRelease(fixture("bank/assets/missing.pdf"), "commit")).toThrow();
    expect(() => prepareRelease(fixture("https://other.example/file.pdf"), "commit")).toThrow();
  });
});
