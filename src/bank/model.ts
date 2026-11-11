import { compareAccessibility, type QuestionPerformance } from "./performance";
import { validateWorkedSolution, type WorkedSolution } from "../../workedSolution";
import { paperDetailPath, type DetailKey } from "../../bankCatalogueSplit";

export type Tier = "all" | "F" | "H";
export type CalculatorFilter = "all" | "yes" | "no";
export type CollectionFilter = "all" | "past" | "mock";
export type ViewRole = "question" | "scheme" | "worked-solution";
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

/** A question as the catalogue index lists it: everything except its views, PDFs and worked solution. */
/** A part as the catalogue index lists it. */
export type BankListPart = Pick<BankPart, "label" | "marks" | "codes">;

export interface BankListQuestion {
  performance?: QuestionPerformance;
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
  parts: BankListPart[];
  description: string;
  scaleSensitive: boolean;
  writingSpacePolicy?: "source" | "generated" | "none";
  equivalentId?: string;
  equivalentSource?: string;
  review: "reviewed" | "draft";
  revision: string;
  sourceErrata?: {note: string}[];
  schemeSourceNote?: string;
  /** Index only: how many question views the detail file holds. */
  questionViewCount?: number;
  /** Index only: whether the detail file holds a worked solution. */
  hasWorkedSolution?: boolean;
}

/** The fields kept in the per-paper detail files (`DETAIL_KEYS` in bankCatalogueSplit.ts). */
export interface BankQuestionDetail {
  questionViews: BankView[];
  schemeViews: BankView[];
  questionPdf: string;
  printPdf: string;
  schemePdf: string;
  workedSolution?: WorkedSolution;
  printPages: {width: number; height: number}[];
  exportRouting74?: { policy: "q8-classroom-compact74"; scopeSHA256: string; authoritySHA256: string };
}
// The split must move exactly these fields; this fails to compile if the two lists drift apart.
const detailKeysMatch: [Exclude<keyof BankQuestionDetail, DetailKey>, Exclude<DetailKey, keyof BankQuestionDetail>] extends [never, never] ? true : false = true;
void detailKeysMatch;

export interface BankQuestion extends BankListQuestion, BankQuestionDetail {
  parts: BankPart[];
}

export interface BankTopic {
  code: string;
  title: string;
  strand: string;
  bankCount: number;
  pilotCount: number;
  availableCount?: number;
}

export interface BankCatalogue<Q extends BankListQuestion = BankQuestion> {
  paperQuestionCounts?: Record<string, number>;
  schemaVersion: 1;
  version: string;
  title: string;
  reviewedAt: string;
  pilotCodes: string[];
  aliases: Record<string, string>;
  topics: BankTopic[];
  questions: Q[];
  /** Index only: each paper's detail file. */
  papers?: Record<string, string>;
  scope: {sets: number; papers: number; sourceQuestions: number; publishedQuestions: number};
  publication?: {status: "draft" | "partial" | "complete"; label: string; heading: string; description: string};
}

export interface BankRoute {
  bankView?: "questions" | "topics";
  code: string;
  tier: Tier;
  calculator: CalculatorFilter;
  collection: CollectionFilter;
  question: string;
  /** The question view, counted from 0 here; the address counts from 1 (`view=1` is the first view). */
  view: number;
  /** Set only when the address asked for a view that does not exist; the route then opens the first view. */
  viewError?: string;
}

export const emptyRoute: BankRoute = {bankView: "questions", code: "", tier: "all", calculator: "all", collection: "all", question: "", view: 0};
export const normalizeCode = (code: string) => code.replace(/\s/g, "").toUpperCase();

export function readRoute(search: string, catalogue?: BankCatalogue<BankListQuestion>): BankRoute {
  const p = new URLSearchParams(search);
  const raw = normalizeCode(p.get("code") || "");
  return {
    bankView: p.get("bankView") === "topics" ? "topics" : "questions",
    code: catalogue?.aliases[raw] || raw,
    tier: p.get("tier") === "F" || p.get("tier") === "H" ? p.get("tier") as Tier : "all",
    calculator: p.get("calc") === "yes" || p.get("calc") === "no" ? p.get("calc") as CalculatorFilter : "all",
    collection: p.get("collection") === "past" || p.get("collection") === "mock" ? p.get("collection") as CollectionFilter : "all",
    question: p.get("question") || "",
    ...readView(p.get("view"), viewCount(catalogue, p.get("question") || "")),
  };
}

/** Most views a question link may name; matches the cap old links were clamped to. */
const MAX_VIEWS = 100;

function viewCount(catalogue: BankCatalogue<BankListQuestion> | undefined, id: string): number | undefined {
  const q = id ? catalogue?.questions.find(item => item.id === id) : undefined;
  return q?.questionViewCount ?? (q as Partial<BankQuestion> | undefined)?.questionViews?.length;
}

/**
 * Reads the 1-based `view` address value. A missing value is the first view. A value that is not a
 * whole number from 1, or names a view the question does not have, opens the first view and says so
 * instead of quietly showing a different one.
 */
function readView(raw: string | null, count: number | undefined): Pick<BankRoute, "view" | "viewError"> {
  if (raw === null || raw === "") return {view: 0};
  const n = /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  const limit = count && count > 0 ? Math.min(count, MAX_VIEWS) : MAX_VIEWS;
  if (Number.isInteger(n) && n >= 1 && n <= limit) return {view: n - 1};
  const reason = !(Number.isInteger(n) && n > limit) ? "views are numbered from 1"
    : count && count <= MAX_VIEWS ? `this question has ${count} view${count === 1 ? "" : "s"}`
    : `a link can name at most ${MAX_VIEWS} views`;
  return {view: 0, viewError: `The link asked for view ${raw.trim() || "(blank)"}, but ${reason}. Showing view 1.`};
}

/** The query string for a bank route, without the page path; empty for the default route. */
export function routeQuery(route: BankRoute): string {
  const p = new URLSearchParams();
  if (route.bankView === "topics") p.set("bankView", "topics");
  if (route.code) p.set("code", normalizeCode(route.code));
  if (route.tier !== "all") p.set("tier", route.tier);
  if (route.calculator !== "all") p.set("calc", route.calculator);
  if (route.collection !== "all") p.set("collection", route.collection);
  if (route.question) p.set("question", route.question);
  if (route.view > 0) p.set("view", String(route.view + 1));
  const query = p.toString();
  return query ? `?${query}` : "";
}

export function topicQuestions<Q extends BankListQuestion>(catalogue: BankCatalogue<Q>, code: string): Q[] {
  return catalogue.questions.filter(q => !code || q.codes.includes(code)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function filterQuestions<Q extends BankListQuestion>(catalogue: BankCatalogue<Q>, route: BankRoute): Q[] {
  const questions = topicQuestions(catalogue, route.code).filter(q => questionEligible(q, route));
  // Filter first: retain the matching tier and mapping, including old direct links.
  return (route.code ? distinctQuestions(questions, route.question) : questions).sort(compareAccessibility);
}

export const questionIdentity = (q: BankListQuestion): string => q.equivalentId ? [q.id, q.equivalentId].sort().join("|") : q.id;

export function questionEligible(q: BankListQuestion, filters: Pick<BankRoute, "tier" | "calculator" | "collection">): boolean {
  return (filters.tier === "all" || q.tier === filters.tier) &&
    (filters.calculator === "all" || q.calculator === (filters.calculator === "yes")) &&
    (filters.collection === "all" || (/^mock/i.test(q.collection) ? "mock" : "past") === filters.collection);
}

function distinctQuestions<Q extends BankListQuestion>(questions: Q[], preferredId = ""): Q[] {
  const key = questionIdentity;
  const preferred = questions.find(q => q.id === preferredId);
  const seen = new Set<string>();
  return questions.flatMap(q => {
    const identity = key(q);
    if (seen.has(identity)) return [];
    seen.add(identity);
    return [preferred && key(preferred) === identity ? preferred : q];
  });
}

export function matchingParts(question: BankListQuestion, code: string): {labels: string[]; marks: number} {
  const parts = question.parts.filter(p => !code || p.codes.includes(code));
  return {labels: parts.map(p => p.label), marks: parts.reduce((n, p) => n + p.marks, 0)};
}

export function exportSelection<Q extends BankListQuestion>(catalogue: BankCatalogue<Q>, ids: string[]): {questions: Q[]; marks: number; version: string} {
  const byId = new Map(catalogue.questions.map(q => [q.id, q]));
  const unique = [...new Set(ids)];
  if (!unique.length) throw new Error("Choose at least one question.");
  const questions = distinctQuestions(unique.map(id => {
    const question = byId.get(id);
    if (!question) throw new Error(`Question ${id} is not in this catalogue.`);
    return question;
  }));
  return {questions, marks: questions.reduce((n, q) => n + q.marks, 0), version: catalogue.version};
}

export function emptyReason(catalogue: BankCatalogue<BankListQuestion>, route: BankRoute): "unknown" | "filtered" | "no-bank-match" | "not-in-pilot" | null {
  const topic = catalogue.topics.find(t => t.code === route.code);
  if (route.code && !topic) return "unknown";
  if (filterQuestions(catalogue, route).length) return null;
  if (topicQuestions(catalogue, route.code).length) return "filtered";
  return topic?.bankCount === 0 ? "no-bank-match" : "not-in-pilot";
}

/**
 * Stops the catalogue check for one question. Teachers keep the short message; the console also
 * names the question and the field that failed, so the bad entry can be found and fixed (A95).
 */
function failQuestion(message: string, id: unknown, field: string): never {
  console.error(`Catalogue check failed: question ${String(id || "(no id)")}, field ${field}. ${message}`);
  throw new Error(message);
}

/** The first missing detail field of a full question, or null when every detail is present. */
function missingDetail(q: BankQuestion): string | null {
  if (!q.questionViews?.length) return "questionViews";
  if (!q.schemeViews?.length) return "schemeViews";
  if (!q.questionPdf) return "questionPdf";
  if (!q.printPdf) return "printPdf";
  if (!q.schemePdf) return "schemePdf";
  return null;
}

const QUESTION_FAILED = "A question failed its catalogue check. Please report the affected question.";

export function verifyCatalogue(data: unknown): BankCatalogue {
  return checkCatalogue(data, true) as BankCatalogue;
}

/** Checks the light catalogue index (`bank/catalogue-index.json`); details are checked as they load. */
export function verifyCatalogueIndex(data: unknown): BankCatalogue<BankListQuestion> & {papers: Record<string, string>} {
  const d = checkCatalogue(data, false);
  const papers = d.papers;
  if (!papers || typeof papers !== "object") throw new Error("This catalogue could not be read. Reload the page or use a saved PDF.");
  for (const q of d.questions) {
    if (!paperDetailPath(papers[q.paperId])) failQuestion(QUESTION_FAILED, q.id, "paperId");
    if (!Number.isInteger(q.questionViewCount) || (q.questionViewCount ?? 0) < 1) failQuestion(QUESTION_FAILED, q.id, "questionViewCount");
    if (typeof q.hasWorkedSolution !== "boolean") failQuestion(QUESTION_FAILED, q.id, "hasWorkedSolution");
  }
  return d as BankCatalogue<BankListQuestion> & {papers: Record<string, string>};
}

/** Checks one question once its detail has been merged in from its paper file. */
export function verifyQuestionDetail(q: BankQuestion): BankQuestion {
  if (q.workedSolution !== undefined) validateWorkedSolution(q.workedSolution, q.revision);
  const missing = missingDetail(q);
  if (missing) failQuestion(QUESTION_FAILED, q.id, missing);
  if (q.questionViewCount !== undefined && q.questionViewCount !== q.questionViews.length) failQuestion(QUESTION_FAILED, q.id, "questionViewCount");
  if (q.hasWorkedSolution !== undefined && q.hasWorkedSolution !== (q.workedSolution !== undefined)) failQuestion(QUESTION_FAILED, q.id, "hasWorkedSolution");
  return q;
}

function checkCatalogue(data: unknown, detail: boolean): BankCatalogue<BankListQuestion> {
  const d = data as BankCatalogue<BankListQuestion>;
  if (d?.schemaVersion !== 1 || !Array.isArray(d.questions) || !Array.isArray(d.topics) || !d.version || !d.aliases) {
    throw new Error("This catalogue could not be read. Reload the page or use a saved PDF.");
  }
  const ids = new Set<string>();
  const byId = new Map(d.questions.map(q => [q.id, q]));
  const codes = new Set(d.topics.map(t => t.code));
  for (const q of d.questions) {
    const full = q as BankQuestion;
    if (detail && full.workedSolution !== undefined) validateWorkedSolution(full.workedSolution, q.revision);
    if (q.review !== "reviewed" && !(d.publication?.status === "draft" && q.review === "draft")) {
      failQuestion("This question has not passed review and cannot be included in a released catalogue.", q.id, "review");
    }
    if (ids.has(q.id)) failQuestion(QUESTION_FAILED, q.id, "id (duplicate)");
    const missing = detail ? missingDetail(full) : null;
    if (missing) failQuestion(QUESTION_FAILED, q.id, missing);
    const unknownCode = q.codes.find(c => !codes.has(c));
    if (unknownCode !== undefined) failQuestion(QUESTION_FAILED, q.id, `codes (${unknownCode} is not a topic)`);
    if (q.writingSpacePolicy !== undefined && !["source", "generated", "none"].includes(q.writingSpacePolicy)) failQuestion("Question writing-space policy is invalid.", q.id, "writingSpacePolicy");
    if (q.parts.reduce((sum, p) => sum + p.marks, 0) !== q.marks) failQuestion("Question marks do not match the catalogue.", q.id, "marks");
    if (q.equivalentId) {
      const other = byId.get(q.equivalentId);
      const sameSeries = other && (q.paperId && other.paperId ? q.paperId.replace(/_[123][FH]$/, "") === other.paperId.replace(/_[123][FH]$/, "") : q.set === other.set);
      if (!other || !sameSeries || other.equivalentId !== q.id || other.tier === q.tier || other.calculator !== q.calculator || other.marks !== q.marks) {
        failQuestion("A crossover question failed its catalogue check.", q.id, "equivalentId");
      }
    }
    ids.add(q.id);
  }
  return d;
}
