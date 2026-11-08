// Loads the split question-bank catalogue (bankCatalogueSplit.ts): the light index first, then one
// paper's detail file when a question from it is opened, previewed or exported.
import { INDEX_PATH, paperDetailPath, type PaperDetailFile } from "../../bankCatalogueSplit";
import { resolveBankAssetUrl } from "./assetUrl";
import { verifyCatalogueIndex, verifyQuestionDetail, type BankListQuestion, type BankQuestion } from "./model";

// The catalogue files are site files, never bank assets, so they always come from the site itself.
const assetUrl = (path: string) => resolveBankAssetUrl(path, import.meta.env.BASE_URL, import.meta.env.VITE_BANK_ASSET_ORIGIN);

export type BankIndex = ReturnType<typeof verifyCatalogueIndex>;

export async function fetchCatalogueIndex(signal?: AbortSignal): Promise<BankIndex> {
  const response = await fetch(assetUrl(INDEX_PATH), {signal});
  if (!response.ok) throw new Error("Could not load the catalogue.");
  return verifyCatalogueIndex(await response.json());
}

export interface DetailLoader {
  /** The questions with their views, PDFs and worked solutions, fetching any paper not yet loaded. */
  load<Q extends BankListQuestion>(questions: Q[]): Promise<(Q & BankQuestion)[]>;
}

const detailError = "This question could not be loaded. Check your connection and try again.";

export function createDetailLoader(index: BankIndex): DetailLoader {
  const files = new Map<string, Promise<PaperDetailFile>>();
  const paper = (paperId: string) => {
    const path = index.papers[paperId];
    if (!paperDetailPath(path)) return Promise.reject(new Error(detailError));
    let pending = files.get(path);
    if (!pending) {
      pending = fetch(assetUrl(path)).then(async response => {
        if (!response.ok) throw new Error(detailError);
        const file = await response.json() as PaperDetailFile;
        if (file?.schemaVersion !== 1 || file.version !== index.version || file.paperId !== paperId || !file.questions || typeof file.questions !== "object") {
          throw new Error("The question bank was updated. Reload the page to see the current questions.");
        }
        return file;
      });
      // A failed request is not remembered, so Try again fetches it afresh.
      pending.catch(() => files.delete(path));
      files.set(path, pending);
    }
    return pending;
  };
  const merged = new Map<string, BankQuestion>();
  return {
    async load<Q extends BankListQuestion>(questions: Q[]) {
      const loaded = await Promise.all([...new Set(questions.map(q => q.paperId))].map(async id => [id, await paper(id)] as const));
      const byPaper = new Map(loaded);
      return questions.map(question => {
        const known = merged.get(question.id);
        if (known) return {...known, ...question} as Q & BankQuestion;
        const detail = byPaper.get(question.paperId)?.questions[question.id];
        if (!detail) throw new Error(detailError);
        const full = verifyQuestionDetail({...question, ...detail} as unknown as BankQuestion);
        merged.set(question.id, full);
        return full as Q & BankQuestion;
      });
    },
  };
}
