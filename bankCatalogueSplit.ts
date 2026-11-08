// Shared browser, build and release contract for the split question-bank catalogue
// (improvement list S43, A15). No Node or browser side effects.
//
// `bank/catalogue.json` stays the single source of truth and is still published whole. The build
// derives from it:
//
//   - `bank/catalogue-index.json`: everything the topic list, filters, paper builder and question list
//     need, with each question's view, PDF and worked-solution detail removed;
//   - `bank/catalogue-papers/<paperId>.<hash>.json`: that detail for one paper's questions. The name
//     carries a hash of the file, so a released file never changes and can be cached for good.
//
// The question bank page loads the index first and fetches a paper file only when a question from
// that paper is opened, previewed or exported.

/** Question fields that live in the per-paper files, not in the index. `parts` is in both: the
 * index keeps each part's label, marks and codes, and the detail file the whole part. */
export const DETAIL_KEYS = [
  "questionViews",
  "schemeViews",
  "questionPdf",
  "printPdf",
  "schemePdf",
  "workedSolution",
  "printPages",
  "exportRouting74",
] as const;
export type DetailKey = (typeof DETAIL_KEYS)[number];

export const INDEX_PATH = "bank/catalogue-index.json";
export const PAPER_FOLDER = "bank/catalogue-papers/";
const paperFile = /^bank\/catalogue-papers\/[A-Za-z0-9_-]+\.[a-f0-9]{16}\.json$/;

/** True for a paper detail path as the index lists it. */
export const paperDetailPath = (path: unknown): path is string =>
  typeof path === "string" && paperFile.test(path);

interface SplittableQuestion {
  id: string;
  paperId: string;
  questionViews: unknown[];
  workedSolution?: unknown;
  [key: string]: unknown;
}
interface SplittableCatalogue {
  version: string;
  questions: SplittableQuestion[];
  [key: string]: unknown;
}

export interface PaperDetailFile {
  schemaVersion: 1;
  version: string;
  paperId: string;
  questions: Record<string, Record<string, unknown>>;
}

/**
 * Splits a verified catalogue into its index and one detail file per paper. `hash` returns a hex
 * digest of a string (SHA-256 in the build). The output is deterministic for the same catalogue.
 */
export function splitCatalogue(
  catalogue: SplittableCatalogue,
  hash: (text: string) => string,
): { index: string; files: { path: string; json: string }[] } {
  const byPaper = new Map<string, PaperDetailFile>();
  const questions = catalogue.questions.map((question) => {
    if (!/^[A-Za-z0-9_-]+$/.test(question.paperId || ""))
      throw new Error(`Question ${question.id} has no usable paper id for the split catalogue.`);
    const light: Record<string, unknown> = {};
    const detail: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(question))
      ((DETAIL_KEYS as readonly string[]).includes(key) ? detail : light)[key] = value;
    // The index keeps what the paper builder needs from each part; the detail keeps the whole part.
    if (Array.isArray(question.parts)) {
      light.parts = (question.parts as {label: unknown; marks: unknown; codes: unknown}[]).map(({label, marks, codes}) => ({label, marks, codes}));
      detail.parts = question.parts;
    }
    light.questionViewCount = question.questionViews.length;
    light.hasWorkedSolution = question.workedSolution !== undefined;
    let paper = byPaper.get(question.paperId);
    if (!paper) {
      paper = { schemaVersion: 1, version: catalogue.version, paperId: question.paperId, questions: {} };
      byPaper.set(question.paperId, paper);
    }
    paper.questions[question.id] = detail;
    return light;
  });
  const files: { path: string; json: string }[] = [];
  const papers: Record<string, string> = {};
  for (const [paperId, paper] of [...byPaper].sort(([a], [b]) => a.localeCompare(b))) {
    const json = JSON.stringify(paper);
    const path = `${PAPER_FOLDER}${paperId}.${hash(json).slice(0, 16)}.json`;
    papers[paperId] = path;
    files.push({ path, json });
  }
  const index = JSON.stringify({ ...catalogue, questions, papers });
  return { index, files };
}
