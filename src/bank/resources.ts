import type { BankQuestion, BankView, ViewRole } from "./model";

export function questionResource(question: BankQuestion, role: ViewRole): { pdf: string; views: BankView[]; label: string } {
  switch (role) {
    case "question": return { pdf: question.questionPdf, views: question.questionViews, label: "Question" };
    case "scheme": return { pdf: question.schemePdf, views: question.schemeViews, label: "Mark scheme" };
    case "worked-solution": {
      // The working is drawn over the question's own cuts, so its pages are the question's.
      const solution = question.workedSolution;
      if (!solution || solution.basedOnQuestionRevision !== question.revision) throw new Error("Worked solution is not available for this question revision.");
      return { pdf: question.questionPdf, views: question.questionViews, label: "Worked solution" };
    }
  }
}
