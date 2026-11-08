// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DETAIL_KEYS, INDEX_PATH, splitCatalogue } from "../../bankCatalogueSplit";
import { createDetailLoader } from "./catalogueLoader";
import { filterQuestions, verifyCatalogue, verifyCatalogueIndex, type BankCatalogue } from "./model";
import { draftEntries } from "./paper-builder";
import { catalogueCoverage } from "./coverage";

const source = readFileSync("public/bank/catalogue.json", "utf8");
const catalogue = verifyCatalogue(JSON.parse(source));
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const split = splitCatalogue(JSON.parse(source), sha256);
const index = verifyCatalogueIndex(JSON.parse(split.index));
const served = new Map([[INDEX_PATH, split.index], ...split.files.map(f => [f.path, f.json] as [string, string])]);
const fetches: string[] = [];
function serve(fail = new Set<string>()) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const path = url.replace(/^\//, "");
    fetches.push(path);
    const body = served.get(path);
    return body && !fail.has(path) ? new Response(body) : new Response("", {status: 404});
  }));
}
afterEach(() => { vi.unstubAllGlobals(); fetches.length = 0; });

describe("split question-bank catalogue (S43, A15)", () => {
  it("keeps every list field in the index and moves only the detail fields", () => {
    expect(index.questions.map(q => q.id)).toEqual(catalogue.questions.map(q => q.id));
    for (const [i, q] of index.questions.entries()) {
      for (const key of DETAIL_KEYS) expect(q).not.toHaveProperty(key);
      expect(q.questionViewCount).toBe(catalogue.questions[i].questionViews.length);
      expect(q.hasWorkedSolution).toBe(catalogue.questions[i].workedSolution !== undefined);
    }
    // The same filters, topics and paper-builder entries come from the index as from the whole catalogue.
    const route = {bankView: "questions" as const, code: catalogue.topics.find(t => t.availableCount)!.code, tier: "all" as const, calculator: "all" as const, collection: "all" as const, question: "", view: 0};
    expect(filterQuestions(index, route).map(q => q.id)).toEqual(filterQuestions(catalogue, route).map(q => q.id));
    const draft = {codes: [route.code], manual: {}, excluded: [], order: [], version: catalogue.version};
    const all = {tier: "all" as const, calculator: "all" as const, collection: "all" as const};
    expect(draftEntries(catalogueCoverage(index, all), draft).map(e => e.key)).toEqual(draftEntries(catalogueCoverage(catalogue as BankCatalogue, all), draft).map(e => e.key));
  });
  it("names each paper file by its content and makes the index much lighter", () => {
    expect(split.files).toHaveLength(new Set(catalogue.questions.map(q => q.paperId)).size);
    for (const file of split.files) expect(file.path).toContain(sha256(file.json).slice(0, 16));
    expect(split.index.length).toBeLessThan(JSON.stringify(catalogue).length / 4);
    expect(splitCatalogue(JSON.parse(source), sha256)).toEqual(split);
  });
  it("loads a paper's detail once and rebuilds exactly the original questions", async () => {
    serve();
    const loader = createDetailLoader(index);
    const paper = index.questions[0].paperId;
    const questions = index.questions.filter(q => q.paperId === paper);
    const full = await loader.load(questions);
    await loader.load(questions.slice(0, 1));
    expect(fetches).toEqual([index.papers[paper]]);
    for (const q of full) {
      const { questionViewCount, hasWorkedSolution, ...rest } = q;
      expect(questionViewCount).toBeGreaterThan(0);
      expect(typeof hasWorkedSolution).toBe("boolean");
      expect(rest).toEqual(catalogue.questions.find(c => c.id === q.id));
    }
  });
  it("retries a failed paper and refuses a file from another catalogue version", async () => {
    const paper = index.questions[0].paperId, path = index.papers[paper];
    serve(new Set([path]));
    const loader = createDetailLoader(index);
    await expect(loader.load([index.questions[0]])).rejects.toThrow("could not be loaded");
    serve();
    await expect(loader.load([index.questions[0]])).resolves.toHaveLength(1);
    const stale = createDetailLoader({...index, version: "older"});
    await expect(stale.load([index.questions[0]])).rejects.toThrow("Reload the page");
  });
  it("rejects an index whose paper file is missing or whose view count is wrong", () => {
    const broken = JSON.parse(split.index);
    delete broken.papers[broken.questions[0].paperId];
    expect(() => verifyCatalogueIndex(broken)).toThrow("catalogue check");
    const zero = JSON.parse(split.index);
    zero.questions[0].questionViewCount = 0;
    expect(() => verifyCatalogueIndex(zero)).toThrow("catalogue check");
  });
});
