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

it("includes each part and stem cut's print file and previews", () => {
  const q = {...question("cuts", "Q1"), cuts: [{pdf: "bank/assets/cuts/Q1/part-a.pdf", views: [{preview: "bank/assets/cuts/Q1/part-a-1.png"}]}]};
  const paths = catalogueAssetPaths({questions: [q]});
  expect(paths).toContain("bank/assets/cuts/Q1/part-a.pdf");
  expect(paths).toContain("bank/assets/cuts/Q1/part-a-1.png");
  expect(() => catalogueAssetPaths({questions: [{...q, cuts: [{pdf: "bank/assets/../x.pdf", views: []}]}]})).toThrow("Invalid");
});

it("includes a worked solution's steps file and refuses one that is not JSON", () => {
  const workedSolution = {schemaVersion: 2 as const, revision: "w1", basedOnQuestionRevision: "r1", data: "bank/assets/worked/Q1/w1.json", dataSha256: "a".repeat(64)};
  const q = {...question("a", "Q1"), revision: "r1", workedSolution};
  expect(catalogueAssetPaths({questions: [q]})).toContain("bank/assets/worked/Q1/w1.json");
  expect(() => catalogueAssetPaths({questions: [{...q, workedSolution: {...workedSolution, data: "bank/assets/worked/Q1/w1.pdf"}}]})).toThrow();
  expect(() => catalogueAssetPaths({questions: [{...q, questionPdf: "bank/assets/a/Q1/question.json"}]})).toThrow("Invalid");
});
