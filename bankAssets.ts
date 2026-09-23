export interface CatalogueAssets {
  questions: {
    questionPdf: string;
    printPdf: string;
    schemePdf: string;
    questionViews: {preview: string}[];
    schemeViews: {preview: string}[];
  }[];
}

// A release can deliberately retain asset URLs from several earlier revisions.
// Include precisely the catalogue's assets, never a guessed revision directory.
export function catalogueAssetPaths(catalogue: CatalogueAssets): string[] {
  const paths = catalogue.questions.flatMap(question => [
    question.questionPdf, question.printPdf, question.schemePdf,
    ...question.questionViews.map(view => view.preview),
    ...question.schemeViews.map(view => view.preview),
  ]);
  for (const asset of paths) {
    if (typeof asset !== "string" || !/^bank\/assets\/[A-Za-z0-9_./-]+\.(pdf|png)$/.test(asset)
        || asset.split("/").some(part => part === ".." || part === "." || part === "")) {
      throw new Error("Invalid question-bank asset path");
    }
  }
  return [...new Set(paths)].sort();
}
