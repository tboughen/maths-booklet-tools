/* eslint-disable @typescript-eslint/no-explicit-any -- the checks read saved booklet JSON as written, like the build script did. */
/**
 * Script checks for one booklet lesson (Tim, 27 November 2026: "run the script checks"). They take over the
 * mechanical part of the reviewers' work. findings: exact rules, a build fails on them. warnings: heuristics
 * (T10 give-aways, P10 lone words) that a person looks at; they do not fail a build.
 *
 * One copy for everyone: the booklet build script (a3-worksheets/tools/build-booklet.mjs) imports this through
 * its bundle, and the Booklet builder runs it live on the lesson being edited.
 *
 * Usage: scriptChecks({ source, lesson, lessonNumber, pages: { pupil: [svg] } })
 *   source = the saved lesson source ({ working: [...] , booklet }), lesson = one lesson of its booklet.
 */
import type { Booklet } from "./booklet";
import { bookletGaps, issuePlace, lessonPagesOf, renderBooklet } from "./booklet-render";

type J = any;

export interface ScriptCheck {
  /** The booklet standard rule, such as "M1" or "N18". */
  check: string;
  /** Where on the lesson, in the printed labels' words. */
  where: string;
  message: string;
}
export interface ScriptCheckResult {
  findings: ScriptCheck[];
  warnings: ScriptCheck[];
}
export interface ScriptCheckInput {
  /** The saved source: its `working` list is the stored working the answers are checked against. */
  source: { working?: J[] } & Record<string, unknown>;
  lesson: J;
  /** 1-based lesson number, for "From lessons ..." headings. */
  lessonNumber: number;
  pages: { pupil?: string[]; answers?: string[] };
}

export const RULER = "Draw with a ruler and a pencil. Write with a pen.";
const strip = (t: unknown) =>
  String(t ?? "")
    .replace(/(\d)([½¼¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, "$1 $2")
    .normalize("NFKC")
    .replace(/⁄/g, "/")
    .replace(/\*/g, "")
    .replace(/(\d)\{(\d+)\/(\d+)\}/g, "$1 $2/$3")
    .replace(/\{(\d+)\/(\d+)\}/g, "$1/$2")
    .replace(/\s+/g, " ")
    .trim();
const norm = (t: unknown) => strip(t).replace(/[−–]/g, "-").replace(/(\d) (\d+\/\d+)/g, "$1+$2").replace(/\s/g, "").toLowerCase();

interface Label {
  si: number;
  ci: number;
  label: string;
  part?: string;
  item?: J;
  kind: "we" | "ot" | "q";
}

// ---- printed labels, as the renderer numbers them: letters for the check in and "From ..." cards, then one run of numbers.
function labels(lesson: J): Label[] {
  // A cover lesson (lesson.cover, Tim 27 Nov 2026) numbers its Silent starter 1 to 8 and restarts at 1 for the stages:
  // its stored working names them "Silent starter 1" ... "Silent starter 8", then 1, 2, 3 ...
  const out: Label[] = [];
  let letter = 0,
    num = 0,
    starter = 0,
    opening = true;
  lesson.sections.forEach((s: J, si: number) => {
    if (s.kind !== "check-in" && !(s.kind === "practice" && /^From /i.test(s.title ?? ""))) opening = false;
    if (lesson.cover && !opening && s.numbering === "restart") num = 0;
    s.cards.forEach((c: J, ci: number) => {
      if (s.kind === "worked") {
        out.push({ si, ci, label: ci === 0 ? "Worked example" : "Our turn", kind: ci === 0 ? "we" : "ot" });
        return;
      }
      const label = opening ? (lesson.cover ? "Silent starter " + ++starter : "Check in " + String.fromCharCode(65 + letter++)) : String(++num);
      const parts = c.items.filter((i: J) => i.type === "part");
      if (parts.length) parts.forEach((p: J, k: number) => out.push({ si, ci, label, part: "abcdefgh"[k], item: p, kind: "q" }));
      else out.push({ si, ci, label, kind: "q" });
    });
  });
  return out;
}

function cardAnswers(items: J[] | undefined): J[] {
  const a: J[] = [];
  for (const i of items ?? []) {
    if (i.type === "answerLine" && i.answer) a.push(i.answer);
    if (i.type === "choice" && Number.isInteger(i.answer)) a.push(["ABCD"[i.answer], i.options?.[i.answer] ?? ""]);
    if (i.type === "part") continue;
    if (i.items) a.push(...cardAnswers(i.items));
  }
  return a;
}

// Everything printed on the pupil copy of a card (no answers), as plain text.
function cardText(card: J): string {
  const t: string[] = [card.title ?? ""];
  const walk = (items: J[] | undefined) => {
    for (const i of items ?? []) {
      if (i.type === "text" || i.type === "part") t.push(i.text ?? "");
      if (i.type === "choice") t.push(...(i.options ?? []));
      if (i.type === "steps") t.push(...(i.steps ?? []).map((s: J) => s.text));
      if (i.type === "answerLine") t.push(i.prefix ?? "", i.suffix ?? "");
      if (i.type === "diagram" && i.diagram?.tool === "ratio-table") for (const r of i.diagram.spec?.table ?? []) t.push(r.filter((v: string) => !/^\[/.test(v)).join(" | "));
      if (i.items) walk(i.items);
    }
  };
  walk(card.items);
  return strip(t.join("\n"));
}

const graphs = (items: J[] | undefined, out: J[] = []): J[] => {
  for (const i of items ?? []) {
    if (i.type === "diagram" && i.diagram?.tool === "graph" && i.diagram.spec?.axes) out.push(i.diagram.spec);
    if (i.items) graphs(i.items, out);
  }
  return out;
};
const tables = (items: J[] | undefined, out: J[] = []): J[] => {
  for (const i of items ?? []) {
    if (i.type === "diagram" && i.diagram?.tool === "ratio-table" && i.diagram.spec?.table) out.push({ ...i.diagram.spec, beside: !!i.beside });
    if (i.items) tables(i.items, out);
  }
  return out;
};

// Signatures that would let a pupil read off another question's answer: movements, printed ratio rows, equations, coordinates.
function signatures(card: J, view = "pupil"): Set<string> {
  const sig = new Set<string>();
  const text = cardText(card).replace(/[−–]/g, "-");
  for (const m of text.matchAll(/(\d+(?:\/\d+)?) (?:squares? )?right,? (?:then )?(-?\d+(?:\/\d+)?) (?:squares? )?(down|up)/g))
    sig.add(`movement ${m[1]} right, ${m[3] === "down" ? "-" : ""}${m[2].replace("-", "")} up`);
  for (const m of text.matchAll(/\by ?= ?[^,.;”"\n]+/g)) sig.add("equation " + m[0].replace(/\s/g, ""));
  for (const m of text.matchAll(/\((-?\d+), ?(-?\d+)\)/g)) sig.add(`point (${m[1]}, ${m[2]})`);
  for (const t of tables(card.items)) for (const r of t.table ?? []) if (r.length === 2 && r.every((v: string) => v && !/^\[/.test(v)) && r[0] !== "1") sig.add(`ratio row ${norm(r[0])} | ${norm(r[1])}`);
  for (const g of graphs(card.items)) {
    const seg = (g.objects ?? []).filter((o: J) => o.kind === "segment" && o.strokeStyle === "dashed" && (view === "answers" || !o.answerOnly));
    const h = seg.find((o: J) => o.start.y === o.end.y),
      v = seg.find((o: J) => o.start.x === o.end.x);
    if (h && v) {
      const dx = Math.abs(h.end.x - h.start.x),
        dy = v.end.y - v.start.y;
      sig.add(`movement ${dx} right, ${dy} up`);
    }
  }
  return sig;
}

interface SvgText {
  x: number;
  y: number;
  size: number;
  text: string;
  plain: string;
}
interface SvgCard {
  y: number;
  b: number;
  x: number;
  dotted: number[];
  boxes: { y: number; b: number }[];
  texts: SvgText[];
  svgs: { table: boolean; x: number; y: number; b: number }[];
}

// ---- SVG reading: absolute positions from translate()s; nested diagram <svg>s are boxes.
function svgItems(svg: string): SvgCard[] {
  const cards: SvgCard[] = [];
  const stack: { x: number; y: number; card: SvgCard | null }[] = [{ x: 0, y: 0, card: null }];
  let depth = 0,
    inner = 0,
    curText: SvgText | null = null,
    italic = 0;
  const spans: boolean[] = [];
  const re = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  const attr = (a: string, n: string) => {
    const r = a.match(new RegExp(`\\s${n}="([^"]*)"`));
    return r ? r[1] : undefined;
  };
  while ((m = re.exec(svg))) {
    const [, close, tag, a = "", self, txt] = m;
    const top = stack[stack.length - 1];
    if (txt !== undefined) {
      if (curText && !inner) {
        curText.text += txt;
        curText.plain += italic ? txt.replace(/\S/g, "§") : txt;
      }
      continue;
    }
    if (tag === "svg" && depth > 0 && !close) {
      if (!inner && top.card) {
        const y0 = top.y + +(attr(a, "y") ?? 0),
          x0 = top.x + +(attr(a, "x") ?? 0);
        top.card.boxes.push({ y: y0, b: y0 + +attr(a, "height")! });
        top.card.svgs.push({ table: attr(a, "aria-label") === "Ratio table", x: x0, y: y0, b: y0 + +attr(a, "height")! });
      }
      if (!self) inner++;
      continue;
    }
    if (tag === "svg" && close) {
      if (inner) inner--;
      else depth--;
      continue;
    }
    if (tag === "svg") {
      depth++;
      continue;
    }
    if (inner) continue;
    if (tag === "g" && !close) {
      const t = (attr(a, "transform") ?? "").match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      stack.push({ x: top.x + (t ? +t[1] : 0), y: top.y + (t ? +t[2] : 0), card: top.card });
      if (self) stack.pop();
      continue;
    }
    if (tag === "g" && close) {
      stack.pop();
      continue;
    }
    if (tag === "rect" && attr(a, "stroke") === "#7f8a98" && attr(a, "rx") === "2") {
      const c: SvgCard = { y: top.y + +attr(a, "y")!, b: top.y + +attr(a, "y")! + +attr(a, "height")!, x: top.x, dotted: [], boxes: [], texts: [], svgs: [] };
      cards.push(c);
      top.card = c;
      continue;
    }
    if (tag === "tspan" && !close && !self) {
      const it = attr(a, "font-style") === "italic";
      spans.push(it);
      if (it) italic++;
      continue;
    }
    if (tag === "tspan" && close) {
      if (spans.pop()) italic--;
      continue;
    }
    if (!top.card) continue;
    if (tag === "line") {
      const y = top.y + Math.max(+attr(a, "y1")!, +attr(a, "y2")!);
      if (attr(a, "stroke-dasharray") === "0.05 1.05") top.card.dotted.push(y);
      else top.card.boxes.push({ y, b: y });
    }
    if (tag === "rect") top.card.boxes.push({ y: top.y + +(attr(a, "y") ?? 0), b: top.y + +(attr(a, "y") ?? 0) + +(attr(a, "height") ?? 0) });
    if (tag === "text" && !close) {
      curText = { x: top.x + +(attr(a, "x") ?? 0), y: top.y + +(attr(a, "y") ?? 0), size: +(attr(a, "font-size") ?? 0), text: "", plain: "" };
      top.card.texts.push(curText);
      if (self) curText = null;
    }
    if (tag === "text" && close) curText = null;
  }
  for (const c of cards)
    for (const t of c.texts) {
      t.text = t.text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      c.boxes.push({ y: t.y - t.size, b: t.y });
    }
  return cards;
}

export function scriptChecks({ source, lesson, lessonNumber, pages }: ScriptCheckInput): ScriptCheckResult {
  const findings: ScriptCheck[] = [],
    warnings: ScriptCheck[] = [];
  const fail = (check: string, where: string, message: string) => findings.push({ check, where, message });
  const warn = (check: string, where: string, message: string) => warnings.push({ check, where, message });
  const L = labels(lesson);
  const placeOf = (si: number, ci: number) => {
    const l = L.find((x) => x.si === si && x.ci === ci);
    return l ? (l.kind === "q" ? (/^\d/.test(l.label) ? `question ${l.label}` : l.label) : `${lesson.sections[si].title}, ${l.label}`) : `section ${si + 1}`;
  };

  // L13 as relaxed by N4 (booklet standard): the ruler sentence is printed at the FIRST your turn where pupils draw, not repeated.
  let rulerDone = false;
  lesson.sections.forEach((s: J, si: number) => {
    if (s.kind !== "practice" || rulerDone) return;
    const draws = s.cards.some((c: J) => graphs(c.items).some((g) => (g.objects ?? []).some((o: J) => o.answerOnly)) || /\bdraw\b/i.test(cardText(c)));
    if (!draws) return;
    rulerDone = true;
    if (!strip(s.instruction).includes(RULER))
      fail(
        "L13",
        `"${s.title}" section (${placeOf(si, 0)} on)`,
        `Pupils draw on a grid here, but the section instruction ${s.instruction ? `is "${strip(s.instruction)}"` : "is empty"}. The first section where pupils draw must include "${RULER}" (N4: once, not repeated).`,
      );
  });

  // N13: retrieval names real earlier lessons; never "From earlier".
  lesson.sections.forEach((s: J, si: number) =>
    [s.title, ...s.cards.map((c: J) => c.title)].forEach((t: J, k: number) => {
      const txt = strip(t);
      if (/^From earlier/i.test(txt)) fail("N13", placeOf(si, Math.max(0, k - 1)), `"${txt}": name the source lessons, never "From earlier".`);
      const m = txt.match(/^From lessons? ([\d ,and]+)/i);
      if (m) for (const n of m[1].match(/\d+/g) ?? []) if (+n >= lessonNumber) fail("N13", placeOf(si, Math.max(0, k - 1)), `"${txt}" names lesson ${n}, which is not before this lesson (${lessonNumber}).`);
    }),
  );

  // N35 (Tim, 28 November 2026): every stage has one "spot the mistake" or "explain why" card, from the lesson's
  // misconception list. A stage runs from a START banner to the next one; the Challenge is not a stage. Cover lessons are exempt.
  if (!lesson.cover) {
    const MISTAKE = /\bmistakes?\b|\berrors?\b|explain why|is (?:\S+ ){1,3}(?:correct|right)\?|\b(?:says|thinks|claims)\b/i;
    let stage: { name: string; si: number; found: boolean } | null = null;
    const close = () => {
      if (stage && !stage.found) fail("N35", `"${stage.name}" (${placeOf(stage.si, 0)} on)`, 'This stage has no "spot the mistake" or "explain why" card. Add one, built from the lesson\'s misconception list (N35).');
    };
    lesson.sections.forEach((s: J, si: number) => {
      if (s.kind === "challenge" || /Challenge/i.test(s.title ?? "")) {
        close();
        stage = null;
        return;
      }
      if (strip(s.startBanner)) {
        close();
        stage = { name: strip(s.startBanner), si, found: false };
      }
      if (stage && (s.kind === "mistake" || (s.kind !== "worked" && (MISTAKE.test(strip(s.title)) || s.cards.some((c: J) => MISTAKE.test(strip(cardText(c)))))))) stage.found = true;
    });
    close();
  }

  // M1: stored working uses the printed labels, in order, with the same answers.
  const want = L.filter((l) => l.kind === "q").map((l) => l.label + (l.part ? " " + l.part : ""));
  const stored = (source.working ?? []).filter((w: J) => !/^Our turn|^Worked/i.test(String(w.q))).map((w: J) => String(w.q) + (w.part ? " " + w.part : ""));
  const missing = want.filter((x) => !stored.includes(x)),
    extra = stored.filter((x: string) => !want.includes(x));
  if (missing.length) fail("M1", "stored working", `No stored working for printed ${missing.join(", ")}.`);
  if (extra.length) fail("M1", "stored working", `Stored working for ${extra.join(", ")}, which the page does not print.`);
  if (!missing.length && !extra.length && want.join() !== stored.join()) warn("M1", "stored working", "The stored working is not in printed order.");
  for (const l of L.filter((x) => x.kind === "q")) {
    const w = (source.working ?? []).find((w: J) => String(w.q) === l.label && (w.part ?? undefined) === l.part);
    if (!w || w.answer === undefined || w.open) continue;
    const card = lesson.sections[l.si].cards[l.ci];
    const printed = cardAnswers(l.item ? l.item.items : card.items);
    if (printed.length !== 1) continue;
    const alts = ([] as J[]).concat(printed[0]).filter(Boolean);
    const ok = [w.answer, ...(w.accept ?? [])].some((a: J) => alts.some((p) => norm(a) === norm(p) || (norm(p).length > 3 && norm(a).includes(norm(p)))));
    if (!ok) fail("M1", l.label + (l.part ? " " + l.part : ""), `The answers copy prints "${strip(alts[0])}" but the stored answer is "${strip(w.answer)}".`);
  }

  // P9: no marked point or drawn triangle side on the outermost grid line (unless on an axis).
  lesson.sections.forEach((s: J, si: number) =>
    s.cards.forEach((c: J, ci: number) =>
      graphs(c.items).forEach((g) => {
        const ax = g.axes,
          xs = [-(ax.x.negativeSquares ?? 0) * ax.x.unitsPerSquare, ax.x.positiveSquares * ax.x.unitsPerSquare],
          ys = [-(ax.y.negativeSquares ?? 0) * ax.y.unitsPerSquare, ax.y.positiveSquares * ax.y.unitsPerSquare];
        const edge = (p: J) => (xs.includes(p.x) && p.x !== 0) || (ys.includes(p.y) && p.y !== 0);
        for (const o of g.objects ?? []) {
          if (o.kind === "point" && edge(o.position) && o.position.x !== 0 && o.position.y !== 0)
            fail("P9", placeOf(si, ci), `The marked point (${o.position.x}, ${o.position.y}) is on the edge of the grid. Make the grid one square bigger or move the line.`);
          if (o.kind === "segment" && ((o.start.x === o.end.x && xs.includes(o.start.x) && o.start.x !== 0) || (o.start.y === o.end.y && ys.includes(o.start.y) && o.start.y !== 0)))
            fail("P9", placeOf(si, ci) + (o.answerOnly ? " (answers copy)" : ""), `A triangle side from (${o.start.x}, ${o.start.y}) to (${o.end.x}, ${o.end.y}) runs along the edge of the grid.`);
        }
      }),
    ),
  );

  const turnGroups: { si: number; title: string; labels: (string | undefined)[] }[] = [];
  // B12: the your turns of one section share one layout: same grid, same ratio table, same answer line.
  lesson.sections.forEach((s: J, si: number) => {
    if (s.kind !== "practice" || /^From |Challenge/i.test(s.title ?? "")) return;
    const shape = (c: J) => {
      const g = graphs(c.items)[0],
        t = tables(c.items)[0];
      return (
        g && {
          grid: `${g.axes.x.negativeSquares ?? 0}-${g.axes.x.positiveSquares} by ${g.axes.y.negativeSquares ?? 0}-${g.axes.y.positiveSquares}, ${g.axes.y.unitsPerSquare} a square`,
          table: t ? `${t.table.length} row${t.table.length === 1 ? "" : "s"}${t.columns?.some((h: string) => h && !/^\[/.test(h)) ? " with headings" : ""}${t.beside ? ", beside the grid" : ", under the grid"}` : "no table",
        }
      );
    };
    const prefix = (c: J) => {
      const a: string[] = [];
      const w = (it: J[] | undefined) => {
        for (const i of it ?? []) {
          if (i.type === "answerLine") a.push(strip(i.prefix));
          if (i.items) w(i.items);
        }
      };
      w(c.items);
      return a[0] ?? "";
    };
    const counts: Record<string, number> = {};
    for (const c of s.cards) counts[prefix(c)] = (counts[prefix(c)] ?? 0) + 1;
    const common = Object.entries(counts)
      .filter(([k]) => k)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const turns = s.cards
      .map((c: J, ci: number) => ({ ci, sh: shape(c), named: /\bsays\b|’s (table|line|graph)/i.test(cardText(c)), same: prefix(c) === common }))
      .filter((x: J) => x.sh && !x.named && x.same);
    if (turns.length < 2) return;
    turnGroups.push({ si, title: s.title, labels: turns.map((t: J) => L.find((l) => l.si === si && l.ci === t.ci)?.label) });
    for (const k of ["grid", "table"] as const) {
      const kinds = [...new Set(turns.map((t: J) => t.sh[k]))] as string[];
      if (kinds.length > 1)
        (k === "grid" && new Set(turns.map((t: J) => t.sh.grid.split(",")[0])).size === 1 ? warn : fail)(
          "B12",
          `"${s.title}" section, ${turns.map((t: J) => placeOf(si, t.ci)).join(", ")}`,
          `The your turns do not share one layout: ${k}s ${kinds
            .map(
              (v) =>
                `"${v}" (${turns
                  .filter((t: J) => t.sh[k] === v)
                  .map((t: J) => placeOf(si, t.ci).replace("question ", "Q"))
                  .join(", ")})`,
            )
            .join(" vs ")}.`,
        );
    }
  });

  // T10 (warning): the same movement, ratio row, equation or point printed in two cards lets a pupil copy an answer.
  const sigs: { si: number; ci: number; kind: Label["kind"] | undefined; sig: Set<string> }[] = [];
  lesson.sections.forEach((s: J, si: number) => s.cards.forEach((c: J, ci: number) => sigs.push({ si, ci, kind: L.find((l) => l.si === si && l.ci === ci)?.kind, sig: signatures(c) })));
  for (let a = 0; a < sigs.length; a++)
    for (let b = a + 1; b < sigs.length; b++) {
      const A = sigs[a],
        B = sigs[b];
      if (A.kind !== "q" && B.kind !== "q") continue; // worked examples and Our turns only rehearse: the design
      const both = [...A.sig].filter((x) => B.sig.has(x));
      if (both.length) warn("T10", `${placeOf(A.si, A.ci)} and ${placeOf(B.si, B.ci)}`, `Both print the same ${both.join("; ")}. Check that neither gives away the other's answer.`);
    }
  // T10 (warning): a part's answer printed in another part of the same card.
  for (const s of lesson.sections)
    s.cards.forEach((c: J, ci: number) => {
      const parts = c.items.filter((i: J) => i.type === "part");
      if (parts.length < 2) return;
      parts.forEach((p: J, k: number) => {
        for (const ans of cardAnswers(p.items)) {
          if (Array.isArray(ans) || norm(ans).length < 2 || /^[a-d]$/.test(norm(ans))) continue;
          parts.forEach((q: J, j: number) => {
            if (j !== k && norm(q.text).includes(norm(ans))) warn("T10", `${placeOf(lesson.sections.indexOf(s), ci)} ${"abcdefgh"[j]}`, `Part ${"abcdefgh"[j]} prints "${strip(ans)}", the answer to part ${"abcdefgh"[k]}.`);
          });
        }
      });
    });

  // Page checks on the drawn pupil copy.
  (pages.pupil ?? []).forEach((svg, pi) => {
    const side = `side ${pi + 1}`;
    for (const c of svgItems(svg)) {
      // N18: the answer line sits at the foot of its card.
      if (c.dotted.length) {
        const low = Math.max(...c.dotted),
          last = Math.max(low, ...c.boxes.map((b) => b.b));
        const blank = c.b - last;
        if (low >= last - 15 && blank > 15)
          fail("N18", `${side}, card at ${Math.round(c.y)} mm`, `The answer line floats with ${Math.round(blank)} mm of blank card under it ("${(c.texts.find((t) => t.text.trim())?.text ?? "").trim().slice(0, 40)}"). Move the working space above it.`);
      }
      // P10 (warning): a wrapped line that leaves one short word alone.
      const lines = c.texts.filter((t) => t.text.trim()).sort((a, b) => a.x - b.x || a.y - b.y);
      for (let i = 1; i < lines.length; i++) {
        const p = lines[i - 1],
          t = lines[i];
        const wrapped = Math.abs(p.x - t.x) < 0.05 && p.size === t.size && t.y - p.y > 1.05 * t.size && t.y - p.y < 1.7 * t.size;
        const next = lines[i + 1],
          continues = next && Math.abs(next.x - t.x) < 0.05 && next.size === t.size && next.y - t.y < 1.7 * t.size;
        if (wrapped && !continues && t.text.trim().length <= 7 && p.text.trim().length > 20) warn("P10", side, `"${t.text.trim()}" is alone on its line after "…${p.text.trim().slice(-30)}".`);
      }
      // M9 / N16: true minus signs; maths letters in serif italic (the renderer prints them as 𝑥, 𝑦).
      for (const t of c.texts) {
        if (/(^|[\s(=:,])-(?=\s*[\d½¼¾]|\s*$)/.test(t.text)) fail("M9", side, `A hyphen prints where a minus sign belongs: "${t.text.trim().slice(0, 40)}".`);
        if (/(^|[^A-Za-z’'§])[xy] ?=|\d[xy]\b/.test(t.plain)) fail("M9", side, `A maths letter prints upright: "${t.text.trim().slice(0, 40)}". Mark it as maths (*x*).`);
      }
    }
  });
  // B12 on the drawn page: each your turn of a section puts its ratio table in the same place relative to its grid.
  const placed: Record<string, { dx: number; dy: number }> = {};
  (pages.pupil ?? []).forEach((svg) => {
    for (const c of svgItems(svg)) {
      const label = (c.texts.find((t) => t.text.trim())?.text ?? "").trim();
      const g = c.svgs.find((v) => !v.table),
        t = c.svgs.find((v) => v.table);
      if (g && t) placed[label] = { dx: t.x - g.x, dy: t.y - g.b };
    }
  });
  for (const grp of turnGroups) {
    const at = grp.labels.filter((l): l is string => !!l && !!placed[l]).map((l) => ({ l, ...placed[l] }));
    if (at.length < 2) continue;
    const key = (p: { dx: number; dy: number }) => `${Math.round(p.dx / 5)}:${Math.round(p.dy / 5)}`;
    const counts: Record<string, number> = {};
    for (const p of at) counts[key(p)] = (counts[key(p)] ?? 0) + 1;
    const common = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const odd = at.filter((p) => key(p) !== common);
    if (odd.length && odd.length < at.length)
      fail(
        "B12",
        `"${grp.title}" section, question ${odd.map((p) => p.l).join(", ")}`,
        `The ratio table sits in a different place from the other your turns (${odd.map((p) => `Q${p.l}: ${Math.round(p.dx)} mm right of the grid, ${Math.round(p.dy)} mm below it`).join("; ")}; the others: ${at
          .filter((p) => key(p) === common)
          .map((p) => "Q" + p.l)
          .join(", ")}).`,
      );
  }
  // Group repeated findings of one kind on one side into one line each.
  const seen = new Set<string>();
  const dedupe = (list: ScriptCheck[]) =>
    list.filter((f) => {
      const k = f.check + f.where + f.message;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return { findings: dedupe(findings), warnings: dedupe(warnings) };
}

/** The printed text of SVG pages, one text element after another, for the wording rules. */
export function svgPlainText(pages: string[]): string {
  const out: string[] = [];
  for (const svg of pages) for (const m of svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) out.push(m[1].replace(/<[^>]*>/g, ""));
  return out.join("\n").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** A saved lesson source as threads write it: the booklet, its stored working and how many sides each lesson has. */
export interface LessonSource {
  booklet: Booklet;
  working?: J[];
  sides?: number;
  lessonNumber?: number;
  [key: string]: unknown;
}

/**
 * Every lesson check the booklet build makes that does not need files on disk: layout (P1), empty space (N21),
 * sides (B2), cycles (B9), cover lessons (B11), check in (B7), multiple choice (B14), wording (L14, N14) and the
 * script checks. The build adds only its file checks (Word files, the PDF text). `pupilText` is the pupil copy's
 * text when the caller has it (the build reads the PDF); otherwise it is read from the drawn pages.
 */
export function lessonChecks(source: LessonSource, li: number, options: { pupilText?: string } = {}): ScriptCheckResult & { pages: { pupil: string[]; answers: string[] } } {
  const findings: ScriptCheck[] = [];
  const warnings: ScriptCheck[] = [];
  const fail = (check: string, where: string, message: string) => findings.push({ check, where, message });
  const booklet = source.booklet;
  const lesson = booklet.document.lessons[li];
  const wantSides = source.sides ?? 6;
  const pages = { pupil: [] as string[], answers: [] as string[] };
  for (const view of ["pupil", "answers"] as const) {
    // A lesson file numbers its own sides from 1 and keeps its lesson number in the unit (source.lessonNumber).
    const firstPage = renderBooklet(booklet, { view, style: "mathsdock" }).lessonPages[li];
    const numbering = { lessonOffset: (source.lessonNumber ?? 1) - 1, pageOffset: 1 - firstPage };
    const r = lessonPagesOf(booklet, li, { view, style: "mathsdock", numbering });
    pages[view] = r.pages;
    for (const i of r.issues) fail("P1", `${view} copy, ${issuePlace(i)}`, i.message);
    if (view === "pupil") for (const g of bookletGaps(booklet, { view, style: "mathsdock", numbering }).filter((g) => g.lesson === li + 1)) fail("N21", `side ${g.page}`, g.message);
  }
  if (pages.pupil.length !== wantSides) fail("B2", "lesson", `The lesson is ${pages.pupil.length} sides of A4; it must be exactly ${wantSides}.`);
  if (pages.pupil.length !== pages.answers.length) fail("B2", "lesson", `The pupil copy is ${pages.pupil.length} sides and the answers copy ${pages.answers.length}.`);
  const kinds: Record<string, number> = {};
  for (const s of lesson.sections) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
  const cycles = kinds.worked ?? 0;
  if (cycles < 2 || cycles > 3) fail("B9", "lesson", `The lesson has ${cycles} worked example section(s); a lesson has two or three cycles.`);
  // B11 (cover template, Tim 27 Nov 2026): a cover lesson has no We do, and its Silent starter is numbered, never lettered.
  if (lesson.cover)
    lesson.sections.forEach((s, si) => {
      if (s.kind === "worked" && s.cards.length > 1) fail("B11", `section ${si + 1}`, `A cover lesson has no We do: this worked section has ${s.cards.length - 1} card(s) after its worked example. Put those questions in a practice section.`);
      if (s.kind === "check-in" && s.numbering === "letters") fail("B11", `section ${si + 1}`, 'A cover lesson numbers its Silent starter 1 to 8: use numbering "restart", not letters.');
    });
  if (!kinds["check-in"]) fail("B7", "lesson", "The lesson has no check in section.");
  if ((kinds.diagnostic ?? 0) < 1) fail("B14", "lesson", "The lesson has no mini whiteboard (diagnostic) section.");
  const text = options.pupilText ?? svgPlainText(pages.pupil);
  if (/\bacross\b/i.test(text)) fail("L14", "lesson", 'The pupil copy says "across"; the school says "right".');
  if (/mini[\s-]*whiteboard/i.test(text)) fail("N14", "lesson", 'The pupil copy says "mini whiteboard"; the heading is "Multiple choice questions" (N14).');
  try {
    const sc = scriptChecks({ source, lesson, lessonNumber: (source.lessonNumber ?? 1) + li, pages });
    findings.push(...sc.findings);
    warnings.push(...sc.warnings);
  } catch (e) {
    fail("SC", "lesson", `The script checks could not run: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { findings, warnings, pages };
}
