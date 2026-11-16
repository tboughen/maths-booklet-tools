import { bankAssetPath, validateWorkedSolution, type BankAssetExtension, type WorkedSolution } from "./workedSolution.ts";

export interface CatalogueAssets {
  questions: {
    revision?: string;
    workedSolution?: WorkedSolution;
    questionPdf: string;
    printPdf: string;
    schemePdf: string;
    questionViews: {preview: string}[];
    schemeViews: {preview: string}[];
    cuts?: {pdf: string; views: {preview: string}[]}[];
  }[];
}

// A release can deliberately retain asset URLs from several earlier revisions.
// Include precisely the catalogue's assets, never a guessed revision directory.
export function catalogueAssetPaths(catalogue: CatalogueAssets): string[] {
  const paths: [string, BankAssetExtension][] = catalogue.questions.flatMap(question => {
    if (question.workedSolution !== undefined) validateWorkedSolution(question.workedSolution, question.revision || "");
    return [
      ...[question.questionPdf, question.printPdf, question.schemePdf].map(path => [path, "pdf"] as [string, BankAssetExtension]),
      ...[...question.questionViews, ...question.schemeViews].map(view => [view.preview, "png"] as [string, BankAssetExtension]),
      ...(question.cuts ?? []).flatMap(cut => [[cut.pdf, "pdf"], ...cut.views.map(view => [view.preview, "png"])] as [string, BankAssetExtension][]),
      ...(question.workedSolution ? [[question.workedSolution.data, "json"] as [string, BankAssetExtension]] : []),
    ];
  });
  for (const [asset, extension] of paths) {
    if (!bankAssetPath(asset, extension)) {
      throw new Error("Invalid question-bank asset path");
    }
  }
  return [...new Set(paths.map(([asset]) => asset))].sort();
}
