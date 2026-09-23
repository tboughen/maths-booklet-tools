import { expect, it } from "vitest";
import { catalogueAssetPaths } from "../../bankAssets";

function question(revision: string, id: string) {
  const base = `bank/assets/${revision}/${id}`;
  return {questionPdf: `${base}/question.pdf`, printPdf: `${base}/print.pdf`, schemePdf: `${base}/scheme.pdf`,
    questionViews: [{preview: `${base}/question-1.png`}], schemeViews: [{preview: `${base}/scheme-1.png`}]};
}

it("includes retained and new revisions in the same release without duplicates", () => {
  const old = question("old123456789", "Q1"), added = question("new123456789", "Q2");
  const paths = catalogueAssetPaths({questions: [old, added, old]});
  expect(paths).toHaveLength(10);
  expect(paths).toContain(old.questionPdf);
  expect(paths).toContain(added.schemeViews[0].preview);
});

it.each(["../private.pdf", "bank/assets/../private.pdf", "bank/assets/a/../../x.pdf",
  "bank/assets/a\\x.pdf", "https://example.com/question.pdf", "bank/assets/a/secret.sqlite"])(
  "rejects unsafe or non-content paths: %s", path => {
    expect(() => catalogueAssetPaths({questions: [{...question("a", "Q1"), questionPdf: path}]})).toThrow("Invalid");
  });
