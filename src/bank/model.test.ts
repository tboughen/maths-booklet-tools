import { describe, expect, it } from "vitest";
import { emptyReason, emptyRoute, exportSelection, filterQuestions, matchingParts, readRoute, routeQuery, verifyCatalogue, type BankCatalogue, type BankQuestion } from "./model";

const first = {id: "first", order: 1, codes: ["U837", "U879"], tier: "H", calculator: true, collection: "Past papers", marks: 5, parts: [{label: "9a", marks: 2, codes: ["U837"]}, {label: "9b", marks: 2, codes: ["U879"]}, {label: "9c", marks: 1, codes: ["U837"]}]} as BankQuestion;
const second = {id: "second", order: 2, codes: ["U862"], tier: "F", calculator: false, collection: "Mock Set 6", marks: 3, parts: [{label: "11", marks: 3, codes: ["U862"]}]} as BankQuestion;
const catalogue = {schemaVersion: 1, title: "Test bank", reviewedAt: "2026-09-20", pilotCodes: [], scope: {sets: 1, papers: 2, sourceQuestions: 2, publishedQuestions: 2}, version: "test", aliases: {U638: "U862"}, questions: [first, second], topics: [{code: "U837", bankCount: 6}, {code: "U879", bankCount: 8}, {code: "U862", bankCount: 13}, {code: "U652", bankCount: 0}, {code: "U293", bankCount: 11}].map(t => ({...t, title: t.code, strand: "Test", pilotCount: 0}))} as BankCatalogue;

describe("Sparx link and question selection contract", () => {
  it("recognises both historical and current Mock collection labels", () => {
    const current = {...second, id: "current", order: 3, collection: "mock"};
    const bank = {...catalogue, questions: [first, second, current]};
    expect(filterQuestions(bank, {...emptyRoute, collection: "mock"})).toEqual([second, current]);
    expect(filterQuestions(bank, {...emptyRoute, collection: "past"})).toEqual([first]);
  });
  it("normalises an Excel code link and applies a reviewed alias without importing old filters", () => {
    const route = readRoute("?tool=question-bank&code=%20u%20638%20", catalogue);
    expect(route).toEqual({...emptyRoute, code: "U862"});
    expect(readRoute(routeQuery({...route, question: "second", view: 1}), catalogue)).toEqual({...route, question: "second", view: 1});
  });
  it("counts a whole question once while retaining the matching part marks", () => {
    expect(filterQuestions(catalogue, {...emptyRoute, code: "U837"})).toEqual([first]);
    expect(matchingParts(first, "U837")).toEqual({labels: ["9a", "9c"], marks: 3});
  });
  it("distinguishes an unknown code, a real gap, omitted pilot content and restrictive filters", () => {
    expect(emptyReason(catalogue, {...emptyRoute, code: "U000"})).toBe("unknown");
    expect(emptyReason(catalogue, {...emptyRoute, code: "U652"})).toBe("no-bank-match");
    expect(emptyReason(catalogue, {...emptyRoute, code: "U293"})).toBe("not-in-pilot");
    expect(emptyReason(catalogue, {...emptyRoute, code: "U862", tier: "H"})).toBe("filtered");
  });
  it("exports every requested question in order, deduplicating topic overlaps and retaining full marks", () => {
    const selection = exportSelection(catalogue, ["second", "first", "first"]);
    expect(selection.questions.map(q => q.id)).toEqual(["second", "first"]);
    expect(selection.marks).toBe(8);
    expect(selection.version).toBe("test");
    expect(() => exportSelection(catalogue, ["missing"])).toThrow("not in this catalogue");
  });
  it("shows a crossover once per topic, retaining each tier and both unfiltered paper records", () => {
    const f = {...first, id: "foundation", tier: "F", equivalentId: "higher"} as BankQuestion;
    const h = {...first, id: "higher", order: 3, equivalentId: "foundation"};
    const bank = {...catalogue, questions: [f, second, h]};
    expect(filterQuestions(bank, {...emptyRoute, code: "U837"}).map(q => q.id)).toEqual(["foundation"]);
    expect(filterQuestions(bank, {...emptyRoute, code: "U837", tier: "H"}).map(q => q.id)).toEqual(["higher"]);
    expect(filterQuestions(bank, {...emptyRoute, code: "U837", tier: "F"}).map(q => q.id)).toEqual(["foundation"]);
    expect(filterQuestions(bank, emptyRoute)).toHaveLength(3);
    expect(filterQuestions(bank, {...emptyRoute, code: "U837", question: "higher"}).map(q => q.id)).toEqual(["higher"]);
  });
  it("filters mappings before deduplicating, so a code mapped only to Higher remains available", () => {
    const f = {...second, id: "foundation", equivalentId: "higher"};
    const h = {...first, id: "higher", equivalentId: "foundation"};
    const bank = {...catalogue, questions: [f, h]};
    expect(filterQuestions(bank, {...emptyRoute, code: "U837"})).toEqual([h]);
    expect(filterQuestions(bank, {...emptyRoute, code: "U862"})).toEqual([f]);
  });
  it("exports one shared question with one mark total, preserves selection order and keeps similar unlinked questions", () => {
    const f = {...first, id: "foundation", equivalentId: "higher"};
    const h = {...first, id: "higher", equivalentId: "foundation"};
    const similar = {...first, id: "similar"};
    const bank = {...catalogue, questions: [f, h, second, similar]};
    const selection = exportSelection(bank, ["higher", "second", "foundation", "higher", "similar"]);
    expect(selection.questions.map(q => q.id)).toEqual(["higher", "second", "similar"]);
    expect(selection.marks).toBe(13);
  });
  it("rejects broken or inconsistent crossover links before they can hide a question", () => {
    const ready = {...first, review: "reviewed", questionViews: [{}], schemeViews: [{}], questionPdf: "q.pdf", printPdf: "p.pdf", schemePdf: "m.pdf"} as BankQuestion;
    const f = {...ready, id: "foundation", tier: "F", equivalentId: "higher"} as BankQuestion;
    const h = {...ready, id: "higher", equivalentId: "foundation"};
    expect(verifyCatalogue({...catalogue, questions: [f, h]})).toBeDefined();
    for (const bad of [{...h, equivalentId: undefined}, {...h, tier: "F"}, {...h, calculator: false}, {...h, set: "Other series"}]) {
      expect(() => verifyCatalogue({...catalogue, questions: [f, bad] as BankQuestion[]})).toThrow("crossover");
    }
    expect(() => verifyCatalogue({...catalogue, questions: [f]})).toThrow("crossover");
  });
  it("only opens draft assets in an explicitly labelled draft catalogue", () => {
    const q = {...first, review: "draft", questionViews: [{}], schemeViews: [{}], questionPdf: "q.pdf", printPdf: "p.pdf", schemePdf: "m.pdf"};
    const draft = {...catalogue, questions: [q]};
    expect(() => verifyCatalogue(draft)).toThrow("has not passed review");
    expect(verifyCatalogue({...draft, publication: {status: "draft", label: "Draft", heading: "Review", description: "Unapproved content"}}).questions).toHaveLength(1);
  });
});
