import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { verifyCatalogue, questionIdentity } from "../bank/model";
import { withPerformance } from "../bank/performance";
import { importMappings, importPupils, paperMappings, parseDelimited, questionLabel, resultsCsv } from "./import";
import { generateClass, preferredRange, prioritiesFor, accessibility } from "./select";
import { A4, BOTTOM, TOP, blockHeading, layoutPack } from "./layout";
import { defaults, type AssessmentItem, type Pupil } from "./types";
import { approvedPresets, assessmentPresets, fullHppPresets } from "./presets";

const bank = withPerformance(verifyCatalogue(JSON.parse(readFileSync("public/bank/catalogue.json", "utf8"))));
const paper = "1MA1_NOV_2019_1H";
const mappings = paperMappings(bank, paper);
const makePupil = (identifier: string, score: number | null): Pupil => ({ identifier, key: identifier, profile: {}, scores: Object.fromEntries(mappings.map(i => [questionLabel(i.label), score === null ? null : Math.min(i.marks, score)])) });

describe("assessment import and diagnostic boundaries", () => {
  it("accepts headerless scores without dropping the first pupil or treating Q1 marks as identifiers", () => {
    const items = [1, 2, 3].map(i => ({ label: `Q${i}`, marks: 3, codes: ["U753"] }));
    const imported = importPupils(parseDelimited("1\t2\t3\n0\t1\t2"), items);
    expect(imported.detection.hasHeaders).toBe(false); expect(imported.detection.identifierColumn).toBeNull();
    expect(imported.rows).toHaveLength(2); expect(imported.rows[0].identifier).toBe("S001");
    expect(imported.rows[0].scores).toEqual({ Q1: 1, Q2: 2, Q3: 3 });
    expect(imported.rows[1].scores.Q1).toBe(0);
    const blankPupil = importPupils(parseDelimited("0\t1\n\t\n2\t3"), items.slice(0, 2));
    expect(blankPupil.rows).toHaveLength(3); expect(blankPupil.rows[1].scores).toEqual({ Q1: null, Q2: null });
    expect(blankPupil.rows[2].identifier).toBe("S003");
    const questionLikeId = importPupils(parseDelimited("Q1\t0\nQ2\t1"), items.slice(0, 1));
    expect(questionLikeId.rows).toHaveLength(2); expect(questionLikeId.rows[0].identifier).toBe("Q1");
  });
  it("detects text and numeric identifiers with no header and preserves missing/invalid marks", () => {
    const items = [1, 2].map(i => ({ label: `Q${i}`, marks: 3, codes: ["U753"] }));
    for (const id of ["ANON-01", "1001"]) {
      const imported = importPupils(parseDelimited(`${id}\t0\tAbsent\nANON-02\t4\t1`), items);
      expect(imported.rows[0].identifier).toBe(id); expect(imported.rows[0].scores).toEqual({ Q1: 0, Q2: null });
      expect(imported.rows[1].scores.Q1).toBeNull(); expect(imported.detection.missingResults).toBe(2);
    }
  });
  it("allows explicit corrections to headers, identifier choice and score-column alignment", () => {
    const items = [1, 2].map(i => ({ label: `Q${i}`, marks: 3, codes: ["U753"] }));
    const input = parseDelimited("5001\tignored\t0\t2\n5002\tignored\t1\t3");
    const imported = importPupils(input, items, { headers: "no", identifier: 0, firstQuestionColumn: 2 });
    expect(imported.rows[0].identifier).toBe("5001"); expect(imported.rows[0].scores).toEqual({ Q1: 0, Q2: 2 });
    const numericHeaders = importPupils(parseDelimited("1\t2\n0\t2"), items, { headers: "yes", identifier: "none" });
    expect(numericHeaders.rows).toHaveLength(1); expect(numericHeaders.rows[0].scores).toEqual({ Q1: 0, Q2: 2 });
    const headers = importPupils(parseDelimited("Q1,Q2\n0,2"), items);
    expect(headers.rows[0].identifier).toBe("S001"); expect(headers.rows[0].scores.Q1).toBe(0);
  });
  it("registers all eighteen approved HPP/MM selections with full marks, unique parts and known codes", () => {
    expect(approvedPresets).toHaveLength(18);
    expect(approvedPresets.find(p => p.id === "MM1_H")?.marks).toBe(55);
    expect(approvedPresets.find(p => p.id === "HPP1_H")?.items.map(i => i.label)).toEqual(["Q1", "Q3", "Q5", "Q7", "Q9", "Q11", "Q13", "Q15", "Q17", "Q19", "Q21"]);
    for (const preset of approvedPresets) {
      expect(preset.items.reduce((n, item) => n + item.marks, 0)).toBe(preset.marks);
      expect(preset.parts.reduce((n, part) => n + part.marks, 0)).toBe(preset.marks);
      expect(new Set(preset.parts.map(p => questionLabel(p.label))).size).toBe(preset.parts.length);
      for (const items of [preset.items, preset.parts]) {
        const imported = importMappings(parseDelimited(["Question,Max marks,Sparx codes,Question ID", ...items.map(i => `${i.label},${i.marks},${i.codes.join(" ")},${i.questionId}`)].join("\n")), bank);
        expect(imported.warnings).toEqual([]); expect(imported.rows).toHaveLength(items.length);
      }
    }
    expect(assessmentPresets(bank).find(p => p.id === paper)?.name).toBe("November 2019 — Paper 1 — Higher");
  });
  it("combines all six full HPP presets into complete 80-mark papers in original question and part order", () => {
    expect(fullHppPresets).toHaveLength(6);
    for (const preset of fullHppPresets) {
      const first = Number(preset.id.match(/\d+/)![0]);
      const pair = [first, first + 1].map(n => approvedPresets.find(p => p.id === `HPP${n}_${preset.tier}`)!);
      expect(pair[0].sourcePaperId).toBe(pair[1].sourcePaperId);
      expect(preset.sourcePaperId).toBe(pair[0].sourcePaperId);
      expect(preset.marks).toBe(80);
      expect(preset.items.map(i => i.label)).toEqual(Array.from({ length: preset.items.length }, (_, i) => `Q${i + 1}`));
      for (const key of ["items", "parts"] as const) {
        expect(preset[key].reduce((n, item) => n + item.marks, 0)).toBe(80);
        expect(new Set(preset[key].map(i => questionLabel(i.label))).size).toBe(preset[key].length);
        for (const item of preset.items) expect(preset.parts.filter(p => p.questionId === item.questionId)).toEqual(pair.flatMap(p => p.parts.filter(part => part.questionId === item.questionId)));
        const imported = importMappings(parseDelimited(["Question,Max marks,Sparx codes,Question ID", ...preset[key].map(i => `${i.label},${i.marks},${i.codes.join(" ")},${i.questionId}`)].join("\n")), bank);
        expect(imported.warnings).toEqual([]); expect(imported.rows).toHaveLength(preset[key].length);
      }
      expect(assessmentPresets(bank).find(p => p.id === preset.id)).toBe(preset);
    }
  });
  it("uses both codes from one assessment cell and selects a shared practice question only once", () => {
    const question = bank.questions.find(q => q.tier === "H" && q.codes.length >= 2 && q.marks <= 4 && q.questionViews.every(v => v.height < v.width / 2))!;
    const codes = question.codes.slice(0, 2);
    for (const separator of [" ", ",", ";"]) {
      const imported = importMappings(parseDelimited(`Question,Max marks,Sparx codes\nQ1,3,"${codes.join(separator)}"`), bank);
      expect(imported.warnings).toEqual([]); expect(imported.rows[0].codes).toEqual(codes);
      const pupil: Pupil = { key: "one", identifier: "S001", profile: {}, scores: { Q1: 0 } };
      expect(prioritiesFor(imported.rows, pupil).map(p => p.code).sort()).toEqual([...codes].sort());
      const plan = generateClass({ ...bank, questions: [question] }, imported.rows, [pupil], { ...defaults, pageLimit: null, marksLimit: 20 });
      expect(plan.packs[0].entries).toHaveLength(1);
      expect(plan.packs[0].entries[0].question.id).toBe(question.id);
      expect(plan.packs[0].entries[0].codes.sort()).toEqual([...codes].sort());
      expect(plan.packs[0].entries[0].references).toEqual(["Q1"]);
    }
  });
  it("preserves zero and absence, validates score ranges, anonymises missing identifiers and reads overrides", () => {
    const items: AssessmentItem[] = [{ label: "Q1(a)", marks: 3, codes: [bank.topics[0].code] }];
    const data = parseDelimited('Student identifier,Year,Tier,Strength,Q1(a)\n,9,F,developing,0\nS2,10,H,strong,Absent\nS2,99,invalid,bad,4');
    const result = importPupils(data, items);
    expect(result.rows[0].identifier).toBe("S001"); expect(result.rows[0].scores.Q1A).toBe(0);
    expect(result.rows[0].profile).toEqual({ year: 9, tier: "F", strength: "developing" });
    expect(result.rows[1].scores.Q1A).toBeNull(); expect(result.rows[2].scores.Q1A).toBeNull();
    expect(result.rows[2].identifier).not.toBe("S2"); expect(result.warnings.join(" ")).not.toContain("S2");
    expect(prioritiesFor(items, result.rows[1])).toEqual([]);
    expect(prioritiesFor(items, result.rows[0])).toHaveLength(1);
  });
  it("reads quoted CSV and TSV, rejects malformed quotes and skips duplicate or unmapped rows", () => {
    expect(parseDelimited('Identifier\tQ1\n"S,01"\t0')[1]).toEqual(["S,01", "0"]);
    expect(() => parseDelimited('a,b\n"missing')).toThrow(/closing/);
    const code = bank.topics[0].code;
    const result = importMappings(parseDelimited(`Question,Max marks,Sparx codes\nQ1,3,${code}\nQ1,3,${code}\nQ2,3,INVALID`), bank);
    expect(result.rows).toHaveLength(1); expect(result.warnings.length).toBeGreaterThan(0);
    expect(() => importPupils(parseDelimited("Identifier,Q99\nS001,0"), result.rows)).toThrow(/match/);
  });
  it("supplies whole-question and part templates that roundtrip without changing marks", () => {
    const parts = paperMappings(bank, paper, true);
    expect(parts.length).toBeGreaterThan(mappings.length);
    expect(parts.reduce((n, p) => n + p.marks, 0)).toBe(mappings.reduce((n, p) => n + p.marks, 0));
    expect(new Set(parts.map(i => questionLabel(i.label))).size).toBe(parts.length);
    expect(importPupils(parseDelimited(resultsCsv(mappings)), mappings).rows[0].identifier).toBe("S001");
  });
});

describe("deterministic class selection and print limits", () => {
  it("does not treat the percentage bands as hard exclusions and keeps the full agreed endpoints", () => {
    expect(preferredRange({ year: 10, tier: "H", strength: "developing" }, 1)).toEqual([70, 100]);
    expect(preferredRange({ year: 10, tier: "H", strength: "strong" }, 1)).toEqual([0, 65]);
    const q = bank.questions.find(q => q.tier === "H")!;
    const easier = { ...q, performance: { kind: "measured" as const, percentage: 90 } }, harder = { ...q, performance: { kind: "measured" as const, percentage: 10 } };
    expect(accessibility(easier, bank, defaults, 0)).toBeGreaterThan(accessibility(harder, bank, defaults, 0));
    expect(accessibility({ ...q, number: 1, performance: { kind: "estimated", percentage: 5 } }, bank, defaults, 0)).toBeGreaterThan(accessibility({ ...q, number: 20, performance: { kind: "estimated", percentage: 90 } }, bank, defaults, 0));
  });
  it.each([1, 2, 4, 8] as const)("fits complete questions, working and answers into %i A4 pages", pageLimit => {
    const plan = generateClass(bank, mappings, [makePupil("S001", 0)], { ...defaults, pageLimit });
    const entries = plan.packs[0].entries, layout = layoutPack(entries, pageLimit);
    expect(entries.length).toBeGreaterThan(0); expect(layout.valid).toBe(true); expect(layout.pages).toBe(pageLimit);
    for (const placement of layout.placements) { expect(placement.y).toBeGreaterThanOrEqual(TOP); expect(placement.y + placement.height).toBeLessThanOrEqual(A4.height - BOTTOM + .01); }
    expect(layout.placements.filter(p => p.kind === "scheme").length).toBe(entries.reduce((n, e) => n + e.question.schemeViews.length, 0));
    const source = new Set(mappings.map(i => i.questionId)); expect(entries.every(e => !source.has(e.question.id) && !source.has(e.question.equivalentId))).toBe(true);
    expect(new Set(entries.map(e => questionIdentity(e.question))).size).toBe(entries.length);
    const firstAnswer = layout.placements.findIndex(p => p.kind === "scheme"); expect(layout.placements.slice(firstAnswer).every(p => p.kind === "scheme")).toBe(true);
  });
  it("makes missing and common sets equal, disregards overrides only in common mode, and reproduces results", () => {
    const pupils = [makePupil("S001", 0), makePupil("S002", 1), makePupil("S003", null)];
    const individual = generateClass(bank, mappings, pupils, defaults);
    expect(individual.packs[2].entries).toEqual(individual.commonEntries);
    pupils[2].profile = { tier: "F", strength: "strong" };
    const common = generateClass(bank, mappings, pupils, { ...defaults, common: true });
    expect(common.packs.every(p => JSON.stringify(p.entries) === JSON.stringify(common.commonEntries))).toBe(true);
    expect(common.packs.every(p => p.profile.tier === "H")).toBe(true);
    expect(generateClass(bank, mappings, pupils, defaults)).toEqual(generateClass(bank, mappings, pupils, defaults));
    expect(generateClass(bank, mappings, [makePupil("Absent", null)], defaults).packs[0].entries.length).toBeGreaterThan(0);
  });
  it("stops at the tighter constraint and allows marks-only output", () => {
    const pupil = makePupil("S001", 0);
    for (const pageLimit of [1, 4, null] as const) {
      const settings = { ...defaults, pageLimit, marksLimit: 10 }, pack = generateClass(bank, mappings, [pupil], settings).packs[0];
      expect(pack.entries.reduce((n, e) => n + e.question.marks, 0)).toBeLessThanOrEqual(10);
      expect(layoutPack(pack.entries, pageLimit).valid).toBe(true);
    }
    expect(() => generateClass(bank, mappings, [pupil], { ...defaults, pageLimit: null, marksLimit: null })).toThrow(/Enable/);
  });
  it("changes the practice topic when two pupils have different demonstrated weaknesses", () => {
    const items: AssessmentItem[] = [{ label: "Q1", marks: 3, codes: ["U753"] }, { label: "Q2", marks: 3, codes: ["U751"] }];
    const pupils: Pupil[] = [{ key: "one", identifier: "S001", profile: {}, scores: { Q1: 0, Q2: 3 } }, { key: "two", identifier: "S002", profile: {}, scores: { Q1: 3, Q2: 0 } }];
    const plan = generateClass(bank, items, pupils, defaults);
    expect(plan.packs[0].entries.length).toBeGreaterThan(0); expect(plan.packs[1].entries.length).toBeGreaterThan(0);
    expect(plan.packs[0].entries.every(e => e.codes.includes("U753"))).toBe(true);
    expect(plan.packs[1].entries.every(e => e.codes.includes("U751"))).toBe(true);
    expect(plan.packs[0].entries.map(e => e.question.id)).not.toEqual(plan.packs[1].entries.map(e => e.question.id));
  });
  it("accounts for long references and source notes instead of truncating them", () => {
    const entry = generateClass(bank, mappings, [makePupil("S001", 0)], defaults).packs[0].entries[0];
    const long = { ...entry, references: Array.from({ length: 60 }, (_, i) => `Q${i + 1}(a)`), question: { ...entry.question, sourceErrata: [{ note: "Source note ".repeat(60) }] } };
    expect(blockHeading(long, 0, 0, false).length).toBeGreaterThan(10);
    expect(layoutPack([long], null).placements[0].headingHeight).toBeGreaterThan(layoutPack([entry], null).placements[0].headingHeight);
  });
});
