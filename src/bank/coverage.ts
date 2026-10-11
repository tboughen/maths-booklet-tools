import { questionEligible, questionIdentity, type BankCatalogue, type BankQuestion, type BankRoute } from "./model";

export type PaperFilters = Pick<BankRoute, "tier" | "collection" | "calculator">;
export interface Coverage {
  groups: Map<string, BankQuestion[]>;
  codes: Map<string, Set<string>>;
  foundation: Map<string, Set<string>>;
  higher: Map<string, Set<string>>;
  examSeries: number;
  mockSeries: number;
  examPapers: number;
  mockPapers: number;
}

/** Index the eligible appearances before grouping mapped identities. */
export function catalogueCoverage(catalogue: BankCatalogue, filters: PaperFilters): Coverage {
  const groups = new Map<string, BankQuestion[]>();
  const codes = new Map<string, Set<string>>(), foundation = new Map<string, Set<string>>(), higher = new Map<string, Set<string>>();
  const examSeries = new Set<string>(), mockSeries = new Set<string>(), examPapers = new Set<string>(), mockPapers = new Set<string>();
  for (const q of [...catalogue.questions].sort((a,b) => a.order-b.order || a.id.localeCompare(b.id))) {
    if (!questionEligible(q, filters)) continue;
    const key = questionIdentity(q);
    groups.set(key, [...(groups.get(key) || []), q]);
    for (const code of q.codes) {
      for (const index of [codes, q.tier === "F" ? foundation : higher]) {
        const found = index.get(code) || new Set<string>(); found.add(key); index.set(code, found);
      }
    }
    const mock = /^mock/i.test(q.collection), series = q.paperId.replace(/_[123][FH]$/, "");
    (mock ? mockSeries : examSeries).add(series);
    (mock ? mockPapers : examPapers).add(q.paperId);
  }
  return {groups, codes, foundation, higher, examSeries: examSeries.size, mockSeries: mockSeries.size, examPapers: examPapers.size, mockPapers: mockPapers.size};
}
