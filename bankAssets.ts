import { bankAssetPath, validateWorkedSolution, type WorkedSolution } from "./workedSolution.ts";

export interface CatalogueAssets {
  questions: {
    revision?: string;
    workedSolution?: WorkedSolution;
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
  const paths = catalogue.questions.flatMap(question => {
    if (question.workedSolution !== undefined) validateWorkedSolution(question.workedSolution, question.revision || "");
    return [
      question.questionPdf, question.printPdf, question.schemePdf,
      ...question.questionViews.map(view => view.preview),
      ...question.schemeViews.map(view => view.preview),
      ...(question.workedSolution ? [question.workedSolution.pdf, ...question.workedSolution.views.map(view => view.preview)] : []),
    ];
  });
  for (const asset of paths) {
    if (!bankAssetPath(asset)) {
      throw new Error("Invalid question-bank asset path");
    }
  }
  return [...new Set(paths)].sort();
}
