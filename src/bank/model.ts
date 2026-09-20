export type Tier = "all" | "F" | "H";
export type CalculatorFilter = "all" | "yes" | "no";
export type CollectionFilter = "all" | "past" | "mock";
export type ViewRole = "question" | "scheme";
export type RoomLayout = "auto" | "single" | "two";

export interface BankView {
  id: string;
  label: string;
  page: number;
  width: number;
  height: number;
  preview: string;
  description: string;
  sourcePages: number[];
  repeatedContext?: string;
}

export interface BankPart {
  label: string;
  marks: number;
  codes: string[];
  sourceCodes: string[];
  mappingStatus: string;
  notes: string[];
}

export interface BankQuestion {
  id: string;
  source: string;
  set: string;
  paperId: string;
  number: number;
  order: number;
  tier: "F" | "H";
  calculator: boolean;
  collection: string;
  marks: number;
  codes: string[];
  parts: BankPart[];
  description: string;
  questionViews: BankView[];
  schemeViews: BankView[];
  questionPdf: string;
  printPdf: string;
  schemePdf: string;
  printPages: {width: number; height: number}[];
  scaleSensitive: boolean;
  equivalentId?: string;
  equivalentSource?: string;
  review: "reviewed" | "draft";
  revision: string;
  sourceErrata?: {note: string}[];
  schemeSourceNote?: string;
}

export interface BankTopic {
  code: string;
  title: string;
  strand: string;
  bankCount: number;
  pilotCount: number;
  availableCount?: number;
}

export interface BankCatalogue {
  schemaVersion: 1;
  version: string;
  title: string;
  reviewedAt: string;
  pilotCodes: string[];
  aliases: Record<string, string>;
  topics: BankTopic[];
  questions: BankQuestion[];
  scope: {sets: number; papers: number; sourceQuestions: number; publishedQuestions: number};
  publication?: {status: "draft" | "partial" | "complete"; label: string; heading: string; description: string};
}

export interface BankRoute {
  code: string;
  tier: Tier;
  calculator: CalculatorFilter;
  collection: CollectionFilter;
  question: string;
  view: number;
}

export const emptyRoute: BankRoute = {code: "", tier: "all", calculator: "all", collection: "all", question: "", view: 0};
export const normalizeCode = (code: string) => code.replace(/\s/g, "").toUpperCase();

export function readRoute(search: string, catalogue?: BankCatalogue): BankRoute {
  const p = new URLSearchParams(search);
  const raw = normalizeCode(p.get("code") || "");
  return {
    code: catalogue?.aliases[raw] || raw,
    tier: p.get("tier") === "F" || p.get("tier") === "H" ? p.get("tier") as Tier : "all",
    calculator: p.get("calc") === "yes" || p.get("calc") === "no" ? p.get("calc") as CalculatorFilter : "all",
    collection: p.get("collection") === "past" || p.get("collection") === "mock" ? p.get("collection") as CollectionFilter : "all",
    question: p.get("question") || "",
    view: Math.max(0, Math.min(99, Number.parseInt(p.get("view") || "1", 10) - 1 || 0)),
  };
}

export function routeQuery(route: BankRoute): string {
  const p = new URLSearchParams({tool: "question-bank"});
  if (route.code) p.set("code", normalizeCode(route.code));
  if (route.tier !== "all") p.set("tier", route.tier);
  if (route.calculator !== "all") p.set("calc", route.calculator);
  if (route.collection !== "all") p.set("collection", route.collection);
  if (route.question) p.set("question", route.question);
  if (route.view > 0) p.set("view", String(route.view + 1));
  return `?${p.toString()}`;
}

export function topicQuestions(catalogue: BankCatalogue, code: string): BankQuestion[] {
  return catalogue.questions.filter(q => !code || q.codes.includes(code)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function filterQuestions(catalogue: BankCatalogue, route: BankRoute): BankQuestion[] {
  return topicQuestions(catalogue, route.code).filter(q =>
    (route.tier === "all" || q.tier === route.tier) &&
    (route.calculator === "all" || q.calculator === (route.calculator === "yes")) &&
    (route.collection === "all" || (q.collection.startsWith("Mock") ? "mock" : "past") === route.collection),
  );
}

export function matchingParts(question: BankQuestion, code: string): {labels: string[]; marks: number} {
  const parts = question.parts.filter(p => !code || p.codes.includes(code));
  return {labels: parts.map(p => p.label), marks: parts.reduce((n, p) => n + p.marks, 0)};
}

export function exportSelection(catalogue: BankCatalogue, ids: string[]): {questions: BankQuestion[]; marks: number; version: string} {
  const byId = new Map(catalogue.questions.map(q => [q.id, q]));
  const unique = [...new Set(ids)];
  if (!unique.length) throw new Error("Choose at least one question.");
  const questions = unique.map(id => {
    const question = byId.get(id);
    if (!question) throw new Error(`Question ${id} is not in this catalogue.`);
    return question;
  });
  return {questions, marks: questions.reduce((n, q) => n + q.marks, 0), version: catalogue.version};
}

export function emptyReason(catalogue: BankCatalogue, route: BankRoute): "unknown" | "filtered" | "no-bank-match" | "not-in-pilot" | null {
  const topic = catalogue.topics.find(t => t.code === route.code);
  if (route.code && !topic) return "unknown";
  if (filterQuestions(catalogue, route).length) return null;
  if (topicQuestions(catalogue, route.code).length) return "filtered";
  return topic?.bankCount === 0 ? "no-bank-match" : "not-in-pilot";
}

export function verifyCatalogue(data: unknown): BankCatalogue {
  const d = data as BankCatalogue;
  if (d?.schemaVersion !== 1 || !Array.isArray(d.questions) || !Array.isArray(d.topics) || !d.version || !d.aliases) {
    throw new Error("This catalogue could not be read. Reload the page or use a saved PDF.");
  }
  const ids = new Set<string>();
  const codes = new Set(d.topics.map(t => t.code));
  for (const q of d.questions) {
    if (q.review !== "reviewed" && !(d.publication?.status === "draft" && q.review === "draft")) {
      throw new Error("This question has not passed review and cannot be included in a released catalogue.");
    }
    if (ids.has(q.id) || !q.questionViews.length || !q.schemeViews.length || !q.questionPdf || !q.printPdf || !q.schemePdf || q.codes.some(c => !codes.has(c))) {
      throw new Error("A question failed its catalogue check. Please report the affected question.");
    }
    if (q.parts.reduce((sum, p) => sum + p.marks, 0) !== q.marks) throw new Error("Question marks do not match the catalogue.");
    ids.add(q.id);
  }
  return d;
}
