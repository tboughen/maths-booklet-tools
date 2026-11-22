import { compareAccessibility, type QuestionPerformance } from "./performance";
import type { PartPerformanceData } from "./partPerformance";
import { bankAssetPath, validateWorkedSolution, type WorkedSolution } from "../../workedSolution";
import { paperDetailPath, type DetailKey } from "../../bankCatalogueSplit";

export type Tier = "all" | "F" | "H";
export type CalculatorFilter = "all" | "yes" | "no";
export type CollectionFilter = "all" | "past" | "mock";
/** "only" keeps questions that appear on both a Foundation and a Higher paper (a reviewed `equivalentId` pair). */
export type CrossoverFilter = "all" | "only";
/** "hide" (the default) leaves out questions from papers kept for the Year 11 revision programme (`revisionUse`). */
export type RevisionFilter = "hide" | "include";
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

/**
 * One separately served piece of a question, cut from the original paper: a part (as labelled on the
 * paper, covering one or more catalogue parts) or the question's shared stem. `context` lists the
 * cuts shown above it so it makes sense; `requiresAnswerTo` the earlier parts whose answers it needs,
 * so it is never served without them.
 */
export interface BankCut {
  id: string;
  kind: "part" | "stem";
  label: string;
  /** The catalogue part labels this cut covers; empty for a stem. */
  parts: string[];
  pdf: string;
  views: BankView[];
  context: string[];
  requiresAnswerTo: string[];
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
  /** Set when the paper is kept for the Year 11 revision programme: its use, such as "Mini-mock MM1". */
  revisionUse?: string;
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
  /** The question's part and stem cuts; absent when the question is only served whole. */
  cuts?: BankCut[];
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
  /** In memory only: Pearson rates per part, when performance-parts.json has loaded. */
  partPerformance?: PartPerformanceData;
  publication?: {status: "draft" | "partial" | "complete"; label: string; heading: string; description: string};
}

export interface BankRoute {
  bankView?: "questions" | "topics";
  code: string;
  tier: Tier;
  calculator: CalculatorFilter;
  collection: CollectionFilter;
  crossover: CrossoverFilter;
  revision: RevisionFilter;
  /** One paper (`paperId`, e.g. 1MA1_NOV_2023_2H) shown whole in paper order; set only when chosen. */
  paper?: string;
  question: string;
  /** The question view, counted from 0 here; the address counts from 1 (`view=1` is the first view). */
  view: number;
  /** Set only when the address asked for a view that does not exist; the route then opens the first view. */
  viewError?: string;
}

export const emptyRoute: BankRoute = {bankView: "questions", code: "", tier: "all", calculator: "all", collection: "all", crossover: "all", revision: "hide", question: "", view: 0};
export const normalizeCode = (code: string) => code.replace(/\s/g, "").toUpperCase();

export function readRoute(search: string, catalogue?: BankCatalogue<BankListQuestion>): BankRoute {
  const p = new URLSearchParams(search);
  const raw = normalizeCode(p.get("code") || "");
  const paper = (p.get("paper") || "").trim().toUpperCase();
  // A paper is opened whole, with no topic. Its Year 11 revision questions are shown (filterQuestions),
  // but the revision filter stays hidden, so leaving the paper does not include them elsewhere.
  if (paper) return {...emptyRoute, bankView: "questions", paper, question: p.get("question") || "", ...readView(p.get("view"), viewCount(catalogue, p.get("question") || ""))};
  return {
    bankView: p.get("bankView") === "topics" ? "topics" : "questions",
    code: catalogue?.aliases[raw] || raw,
    tier: p.get("tier") === "F" || p.get("tier") === "H" ? p.get("tier") as Tier : "all",
    calculator: p.get("calc") === "yes" || p.get("calc") === "no" ? p.get("calc") as CalculatorFilter : "all",
    collection: p.get("collection") === "past" || p.get("collection") === "mock" ? p.get("collection") as CollectionFilter : "all",
    crossover: p.get("crossover") === "only" ? "only" : "all",
    // A link to a question kept for the Year 11 revision programme opens it, so its papers are included.
    revision: p.get("revision") === "include" || Boolean(p.get("question") && catalogue?.questions.find(q => q.id === p.get("question"))?.revisionUse) ? "include" : "hide",
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
  if (route.paper) {
    p.set("paper", route.paper);
    if (route.question) p.set("question", route.question);
    if (route.view > 0) p.set("view", String(route.view + 1));
    return `?${p}`;
  }
  if (route.bankView === "topics") p.set("bankView", "topics");
  if (route.code) p.set("code", normalizeCode(route.code));
  if (route.tier !== "all") p.set("tier", route.tier);
  if (route.calculator !== "all") p.set("calc", route.calculator);
  if (route.collection !== "all") p.set("collection", route.collection);
  if (route.crossover === "only") p.set("crossover", "only");
  if (route.revision === "include") p.set("revision", "include");
  if (route.question) p.set("question", route.question);
  if (route.view > 0) p.set("view", String(route.view + 1));
  const query = p.toString();
  return query ? `?${query}` : "";
}

export function topicQuestions<Q extends BankListQuestion>(catalogue: BankCatalogue<Q>, code: string): Q[] {
  return catalogue.questions.filter(q => !code || q.codes.includes(code)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function filterQuestions<Q extends BankListQuestion>(catalogue: BankCatalogue<Q>, route: BankRoute): Q[] {
  if (route.paper) return paperQuestions(catalogue, route.paper);
  const questions = topicQuestions(catalogue, route.code).filter(q => questionEligible(q, route));
  // Filter first: retain the matching tier and mapping, including old direct links.
  return (route.code ? distinctQuestions(questions, route.question) : questions).sort(compareAccessibility);
}

export const questionIdentity = (q: BankListQuestion): string => q.equivalentId ? [q.id, q.equivalentId].sort().join("|") : q.id;

export function questionEligible(q: BankListQuestion, filters: Pick<BankRoute, "tier" | "calculator" | "collection" | "crossover" | "revision">): boolean {
  return (filters.crossover === "all" || Boolean(q.equivalentId)) &&
    (filters.revision === "include" || !q.revisionUse) &&
    (filters.tier === "all" || q.tier === filters.tier) &&
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

export function emptyReason(catalogue: BankCatalogue<BankListQuestion>, route: BankRoute): "unknown" | "unknown-paper" | "filtered" | "revision" | "no-bank-match" | "not-in-pilot" | null {
  if (route.paper) return paperQuestions(catalogue, route.paper).length ? null : "unknown-paper";
  const topic = catalogue.topics.find(t => t.code === route.code);
  if (route.code && !topic) return "unknown";
  if (filterQuestions(catalogue, route).length) return null;
  // Only Year 11 revision programme questions match: say so, since clearing the other filters cannot help.
  if (route.revision === "hide" && filterQuestions(catalogue, {...route, tier: "all", calculator: "all", collection: "all", crossover: "all", revision: "include"}).length && !filterQuestions(catalogue, {...route, tier: "all", calculator: "all", collection: "all", crossover: "all"}).length) return "revision";
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
  if (q.cuts !== undefined && !cutsValid(q)) return "cuts";
  return null;
}

/**
 * True when the cuts cover every catalogue part exactly once, each has its file and previews, and
 * every context and needs-answer link points at another cut of the same question.
 */
function cutsValid(q: BankQuestion): boolean {
  const cuts = q.cuts;
  if (!Array.isArray(cuts) || !cuts.length) return false;
  const ids = new Set(cuts.map(c => c.id));
  if (ids.size !== cuts.length) return false;
  if (!cuts.every(c => c && Array.isArray(c.parts))) return false;
  const covered = cuts.flatMap(c => c.parts);
  const labels = q.parts.map(p => p.label);
  if (covered.length !== labels.length || new Set(covered).size !== covered.length || covered.some(l => !labels.includes(l))) return false;
  return cuts.every(c => Array.isArray(c.parts) && Array.isArray(c.context) && Array.isArray(c.requiresAnswerTo) && (c.kind === "part" ? c.parts.length > 0 : c.kind === "stem" && c.parts.length === 0)
    && typeof c.label === "string" && !!c.label && bankAssetPath(c.pdf, "pdf") && Array.isArray(c.views) && c.views.length > 0 && c.views.every(v => bankAssetPath(v.preview, "png"))
    && [...c.context, ...c.requiresAnswerTo].every(id => id !== c.id && ids.has(id))
    && c.requiresAnswerTo.every(id => c.context.includes(id) && cuts.find(o => o.id === id)?.kind === "part"));
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
    if (q.revisionUse !== undefined && (typeof q.revisionUse !== "string" || !q.revisionUse.trim())) failQuestion(QUESTION_FAILED, q.id, "revisionUse");
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

/** One paper's questions in the order they are printed on it. */
export function paperQuestions<Q extends BankListQuestion>(catalogue: BankCatalogue<Q>, paperId: string): Q[] {
  return catalogue.questions.filter(q => q.paperId === paperId).sort((a, b) => a.number - b.number || a.order - b.order || a.id.localeCompare(b.id));
}

export interface BankPaper {
  id: string;
  /** The series or mock set, as `set` on its questions: "November 2023", "Mock Set 6". */
  set: string;
  /** "1", "2" or "3". */
  paper: string;
  tier: "F" | "H";
  calculator: boolean;
  mock: boolean;
  questions: number;
  marks: number;
  revisionUse?: string;
}

const MONTHS: Record<string, number> = {january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12};
/** Exam series newest first, then mock sets in number order. */
function compareSets(a: string, b: string): number {
  const series = (s: string) => {const m = /^(\w+) (\d{4})$/.exec(s); return m && MONTHS[m[1].toLowerCase()] ? Number(m[2]) * 12 + MONTHS[m[1].toLowerCase()] : null;};
  const mock = (s: string) => Number(/(\d+)\s*$/.exec(s)?.[1] ?? 0);
  const x = series(a), y = series(b);
  if (x !== null && y !== null) return y - x;
  if (x !== null || y !== null) return x !== null ? -1 : 1;
  return mock(a) - mock(b) || a.localeCompare(b);
}

/** Every paper in the bank, grouped by set (series newest first, then mocks), then Foundation 1-3, Higher 1-3. */
export function bankPapers(catalogue: BankCatalogue<BankListQuestion>): BankPaper[] {
  const papers = new Map<string, BankPaper>();
  for (const q of catalogue.questions) {
    const found = papers.get(q.paperId);
    if (found) {found.questions++; found.marks += q.marks; continue;}
    papers.set(q.paperId, {id: q.paperId, set: q.set, paper: /_(\d)[FH]$/.exec(q.paperId)?.[1] ?? "", tier: q.tier, calculator: q.calculator, mock: /^mock/i.test(q.collection), questions: 1, marks: q.marks, revisionUse: q.revisionUse});
  }
  return [...papers.values()].sort((a, b) => compareSets(a.set, b.set) || a.tier.localeCompare(b.tier) || a.paper.localeCompare(b.paper));
}

/** A paper's name as teachers say it: "November 2023 2H". */
export const paperName = (paper: Pick<BankPaper, "set" | "paper" | "tier">): string => `${paper.set} ${paper.paper}${paper.tier}`;

const MONTH_WORDS: Record<string, string> = {j: "june", jun: "june", june: "june", n: "november", nov: "november", november: "november"};
/**
 * Papers a typed search names, newest first: "nov 23 2h", "N23 2H", "November 2023 paper 2 higher",
 * "1MA1 June 2019 1F", "mock set 6 2h", "MS6 3F". Empty when the text names no series, year, mock set
 * or paper code, so topic searches are left alone.
 */
export function matchPapers(papers: BankPaper[], text: string): BankPaper[] {
  let rest = ` ${text.toLowerCase().replace(/1ma1/g, " ").replace(/[_,./-]/g, " ")} `;
  let month = "", year = "", mock = "", number = "", tier = "";
  const take = (pattern: RegExp, apply: (m: RegExpMatchArray) => void) => {const m = rest.match(pattern); if (m) {apply(m); rest = rest.replace(m[0], " ");}};
  take(/\s(?:mock\s*(?:set\s*)?|ms\s*)(\d{1,2})\s/, m => {mock = String(Number(m[1]));});
  take(/\s([123])\s*([fh])\s/, m => {number = m[1]; tier = m[2].toUpperCase();});
  take(/\s(?:(jun|june|nov|november)\s*(\d{2}|\d{4})?|(j|n)\s*(\d{2}|\d{4}))\s/, m => {const y = m[2] ?? m[4]; month = MONTH_WORDS[m[1] ?? m[3]]; if (y) year = y.length === 2 ? `20${y}` : y;});
  take(/\s(20\d{2})\s/, m => {year = m[1];});
  take(/\spaper\s*([123])\s/, m => {number = m[1];});
  take(/\s(foundation|higher)\s/, m => {tier = m[1][0].toUpperCase();});
  if (!number) take(/\s([123])\s/, m => {number = m[1];});
  if (!year && month) take(/\s(\d{2})\s/, m => {year = `20${m[1]}`;});
  if (!month && !year && !mock && !(number && tier)) return [];
  // Anything left over that is not a filler word means the text was not a paper.
  if (rest.replace(/\b(paper|set|tier|calculator|non|exam|series)\b/g, " ").trim()) return [];
  return papers.filter(p => {
    const set = p.set.toLowerCase();
    if (mock) return set === `mock set ${mock}` && (!number || p.paper === number) && (!tier || p.tier === tier) && !month && !year;
    return (!month || set.startsWith(month)) && (!year || set.endsWith(year)) && (!number || p.paper === number) && (!tier || p.tier === tier) && (!(month || year) || !p.mock);
  });
}
