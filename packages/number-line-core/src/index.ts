import { z } from "zod";
import { canonicalNumber, fractionString, parseNumber, rational } from "../../ratio-table-core/src/numbers";
import { glyphAdvance } from "../../ratio-table-core/src/font-metrics";
import { patchSchema } from "../../graph-core/src/patch-schema";
const textWidth = (text: string, size: number) => Array.from(text).reduce((sum, c) => sum + glyphAdvance(c), 0) * size;
const num = z.string().max(32).superRefine((v, ctx) => { try {
    canonicalNumber(v);
}
catch (e) {
    ctx.addIssue({ code: "custom", message: String(e instanceof Error ? e.message : e) });
} });
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/);
export const pointSchema = z.object({ id, value: num, included: z.boolean().optional() }).strict();
export const connectionSchema = z.object({id, from: id, to: id}).strict();
export const setSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("interval"), id, lower: num, upper: num, lowerIncluded: z.boolean(), upperIncluded: z.boolean() }).strict(),
    z.object({ kind: z.literal("ray"), id, value: num, included: z.boolean(), direction: z.enum(["left", "right"]), intentional: z.boolean().default(false), stop: num.nullable().default(null) }).strict(),
    z.object({ kind: z.literal("points"), id, points: z.array(pointSchema).max(33), intervals: z.array(connectionSchema).max(32).optional() }).strict(),
]);
export const axisSchema = z.object({ minimum: num.default("-5"), maximum: num.default("5"), step: num.default("1"), labelEvery: z.number().int().min(1).max(32).default(1), variable: z.string().regex(/^[a-zA-Z]?$/).default("x"), numberFormat: z.enum(["decimal", "fraction"]).default("decimal"), variableBelow: z.boolean().default(false) }).strict();
export const teachingSchema = z.object({ solutionVisible: z.boolean().default(true), labels: z.record(z.string(), z.enum(["value", "hidden", "answer-line"])).default({}), prompt: z.string().max(160).default(""), answer: z.string().max(160).default(""), answerVisible: z.boolean().default(false), responseLines: z.number().int().min(0).max(3).default(0) }).strict();
export const documentSchema = z.object({ axis: axisSchema.default({ minimum: "-5", maximum: "5", step: "1", labelEvery: 1, variable: "x", numberFormat: "decimal", variableBelow: false }), solution: setSchema.nullable().default(null), teaching: teachingSchema.default({ solutionVisible: true, labels: {}, prompt: "", answer: "", answerVisible: false, responseLines: 0 }), widthCm: z.number().min(8).max(18).default(14) }).strict();
export const envelopeSchema = z.object({ schemaVersion: z.literal(1), rendererVersion: z.literal("number-line-1"), styleProfile: z.literal("examination-v1"), kind: z.literal("number-line"), document: documentSchema }).strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type LineDocument = z.infer<typeof documentSchema>;
export type Solution = z.infer<typeof setSchema>;
export const specSchema = z.object({ axis: patchSchema(axisSchema).optional(), solution: setSchema.nullable().optional(), teaching: patchSchema(teachingSchema).optional(), widthCm: z.number().min(8).max(18).optional() }).strict();
export const FONT = 11 * 25.4 / 72;
export const compare = (a: string, b: string) => { const x = parseNumber(a), y = parseNumber(b); const v = x.n * y.d - y.n * x.d; return v < 0n ? -1 : v > 0n ? 1 : 0; };
export function add(a: string, b: string, sign = 1) { const x = parseNumber(a), y = parseNumber(b); return fractionString(rational(x.n * y.d + BigInt(sign) * y.n * x.d, x.d * y.d)); }
export const valueOf = (s: string) => { const q = parseNumber(s); return Number(q.n) / Number(q.d); };
export const labelKey = (s: string) => fractionString(parseNumber(s));
export function ticks(d: LineDocument) { const a = parseNumber(d.axis.minimum), b = parseNumber(d.axis.maximum), s = parseNumber(d.axis.step); const numerator = (b.n * a.d - a.n * b.d) * s.d, denominator = b.d * a.d * s.n; if (denominator <= 0n || numerator % denominator || numerator / denominator < 2n || numerator / denominator > 32n)
    throw Error("Use 2–32 whole tick intervals with a positive step."); if ((a.n * s.d) % (a.d * s.n))
    throw Error("The first tick must align with the step from zero."); const n = Number(numerator / denominator); return Array.from({ length: n + 1 }, (_, i) => fractionString(rational(a.n * s.d + BigInt(i) * s.n * a.d, a.d * s.d))); }
export function labelled(d: LineDocument, v: string) { const x = parseNumber(v), s = parseNumber(d.axis.step); return (x.n * s.d) % (x.d * s.n * BigInt(d.axis.labelEvery)) === 0n; }
export function metrics(d: LineDocument) { const width = d.widthCm * 10, axisY = d.teaching.prompt ? 22 : 12; const fraction = ticks(d).some(v => labelled(d, v) && displayNumber(d, v).includes("/") && d.teaching.labels[labelKey(v)] !== "hidden"); const labelBottom = axisY + (fraction ? 10 : 7), answerY = labelBottom + 9; const height = labelBottom + 4 + (d.teaching.answerVisible && d.teaching.answer ? 8 : 0) + d.teaching.responseLines * 8; return { width, height, widthCm: d.widthCm, heightCm: height / 10, axisY, solutionY: axisY - 5, answerY, left: 7, right: width - 12 }; }
export function position(d: LineDocument, v: string) { const m = metrics(d); return m.left + (valueOf(v) - valueOf(d.axis.minimum)) / (valueOf(d.axis.maximum) - valueOf(d.axis.minimum)) * (m.right - m.left); }
export function validate(raw: unknown): Envelope {
    const e = envelopeSchema.parse(raw), d = e.document;
    if (compare(d.axis.minimum, d.axis.maximum) >= 0)
        throw Error("The first tick must be less than the last tick.");
    const values = ticks(d);
    for (const key of Object.keys(d.teaching.labels)) {
        if (labelKey(key) !== key)
            throw Error("Label states use exact canonical values.");
    }
    const s = d.solution;
    const required = s?.kind === "interval" ? [s.lower, s.upper] : s?.kind === "ray" ? [s.value, ...(s.stop === null ? [] : [s.stop])] : s?.kind === "points" ? s.points.map(p => p.value) : [];
    if (s?.kind === "interval" && compare(s.lower, s.upper) >= 0)
        throw Error("The lower endpoint must be less than the upper endpoint. Use a point for a single value.");
    if (s?.kind === "ray" && s.stop !== null) {
        if (!s.intentional)
            throw Error("A truncated ray must be explicitly marked as a deliberate error.");
        if (compare(s.stop, s.value) !== (s.direction === "left" ? -1 : 1))
            throw Error("The ray stop must lie in its direction.");
    }
    if (s?.kind === "points" && (new Set(s.points.map(p => p.id)).size !== s.points.length || new Set(s.points.map(p => labelKey(p.value))).size !== s.points.length))
        throw Error("Points need unique IDs and values.");
    if(s?.kind === "points") {
        const ids = new Set<string>(), pairs = new Set<string>();
        for(const line of s.intervals ?? []) {
            const a=s.points.find(p=>p.id===line.from), b=s.points.find(p=>p.id===line.to);
            const pair=[line.from,line.to].sort().join(":");
            if(!a || !b || a.id===b.id) throw Error("An interval must join two existing, different points.");
            if(ids.has(line.id)||pairs.has(pair)) throw Error("These points are already joined, or the interval ID is duplicated.");
            if(Math.abs(position(d,a.value)-position(d,b.value))<2.8) throw Error("The interval endpoints are too close at this print width.");
            ids.add(line.id);pairs.add(pair);
        }
    }
    for (const v of required)
        if (compare(v, d.axis.minimum) < 0 || compare(v, d.axis.maximum) > 0)
            throw Error(`Keep ${v} within the visible range; extend the axis first.`);
    let previous: {
        x: number;
        w: number;
    } | undefined;
    for (const v of values) {
        const state = d.teaching.labels[labelKey(v)] ?? "value";
        if (!labelled(d, v) || state === "hidden")
            continue;
        const w = state === "answer-line" ? 5 : numberWidth(displayNumber(d, v)), x = position(d, v);
        if (previous && x - previous.x < (previous.w + w) / 2 + 1.3)
            throw Error("Tick labels overlap at this print width. Widen the line, label fewer ticks or use a coarser step.");
        previous = { x, w };
    }
    const m = metrics(d);
    for (const text of [d.teaching.prompt, d.teaching.answerVisible ? d.teaching.answer : ""])
        if (textWidth(text, FONT) > m.width - 12)
            throw Error("The prompt or answer is too long for this print width.");
    return e;
}
export function create(raw: unknown = {}): Envelope { return validate({ schemaVersion: 1, rendererVersion: "number-line-1", styleProfile: "examination-v1", kind: "number-line", document: documentSchema.parse(raw) }); }
export function canonical(e: Envelope) { return JSON.stringify(validate(e)); }
export function parseFile(text: string) { if (new TextEncoder().encode(text).length > 32768)
    throw Error("Use a number-line file smaller than 32 KiB."); return validate(JSON.parse(text)); }
export async function hash(e: Envelope) { const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(e))); return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, "0")).join(""); }
export function encode(e: Envelope) { const bytes = new TextEncoder().encode(canonical(e)); let s = ""; bytes.forEach(v => s += String.fromCharCode(v)); return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }
export function decode(text: string) { if (text.length > 16000 || !/^[A-Za-z0-9_-]+$/.test(text))
    throw Error("Invalid number-line link."); return parseFile(new TextDecoder().decode(Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0)))); }
export function editorLink(e: Envelope, base: string) { const u = new URL(base); u.searchParams.set("tool", "number-line"); u.hash = `number-line=${encode(e)}`; return u.href.length > 7500 ? null : u.href; }
const axisPatch = patchSchema(axisSchema), teachingPatch = patchSchema(teachingSchema);
export const operationSchema = z.discriminatedUnion("op", [
    z.object({ op: z.literal("set_axis"), axis: axisPatch }).strict(),
    z.object({ op: z.literal("set_solution"), solution: setSchema.nullable() }).strict(),
    z.object({ op: z.literal("set_endpoint"), id, endpoint: z.enum(["lower", "upper", "value"]), value: num.optional(), included: z.boolean().optional() }).strict(),
    z.object({ op: z.literal("add_point"), point: pointSchema }).strict(),
    z.object({ op: z.literal("set_point"), id, value: num.optional(), included: z.boolean().optional() }).strict(),
    z.object({ op: z.literal("connect_points"), interval: connectionSchema }).strict(),
    z.object({ op: z.literal("remove_interval"), id }).strict(),
    z.object({ op: z.literal("remove_point"), id }).strict(),
    z.object({ op: z.literal("set_tick_label"), value: num, state: z.enum(["value", "hidden", "answer-line"]) }).strict(),
    z.object({ op: z.literal("set_presentation"), teaching: teachingPatch }).strict(),
    z.object({ op: z.literal("set_print"), widthCm: z.number().min(8).max(18) }).strict(),
]);
export type Operation = z.infer<typeof operationSchema>;
export const revisionSchema = z.object({ envelope: envelopeSchema, baseHash: z.string().regex(/^[a-f0-9]{64}$/), operations: z.array(operationSchema).max(30) }).strict();
export function apply(e: Envelope, raw: unknown): Envelope {
    const ops = z.array(operationSchema).max(30).parse(raw), next = structuredClone(validate(e)), d = next.document;
    for (const o of ops) {
        if (o.op === "set_axis")
            d.axis = { ...d.axis, ...o.axis };
        if (o.op === "set_solution")
            d.solution = o.solution;
        if (o.op === "set_endpoint") {
            const s = d.solution;
            if (!s || s.id !== o.id || s.kind === "points")
                throw Error("Select an existing interval or ray.");
            if (s.kind === "interval") {
                if (o.endpoint === "value")
                    throw Error("Use lower or upper for an interval.");
                if (o.value !== undefined)
                    s[o.endpoint] = o.value;
                if (o.included !== undefined)
                    s[o.endpoint === "lower" ? "lowerIncluded" : "upperIncluded"] = o.included;
            }
            else {
                if (o.endpoint !== "value")
                    throw Error("Use value for a ray.");
                if (o.value !== undefined)
                    s.value = o.value;
                if (o.included !== undefined)
                    s.included = o.included;
            }
        }
        if (o.op === "add_point") {
            if (d.solution && d.solution.kind !== "points")
                throw Error("Remove the continuous set before adding points.");
            d.solution ??= { kind: "points", id: "points", points: [] };
            if (d.solution.kind === "points")
                d.solution.points.push(o.point);
        }
        if (o.op === "set_point" || o.op === "remove_point") {
            const s = d.solution;
            if (s?.kind !== "points" || !s.points.some(p => p.id === o.id))
                throw Error("Point not found.");
            if (o.op === "remove_point")
                { s.points = s.points.filter(p => p.id !== o.id); if(s.intervals) s.intervals=s.intervals.filter(line=>line.from!==o.id&&line.to!==o.id); }
            else {
                const point=s.points.find(p => p.id === o.id)!;
                if(o.value!==undefined) point.value=o.value;
                if(o.included!==undefined) point.included=o.included;
            }
        }
        if(o.op==="connect_points") {
            if(d.solution?.kind!=="points") throw Error("Add points before joining them.");
            d.solution.intervals=[...(d.solution.intervals??[]),o.interval];
        }
        if(o.op==="remove_interval") {
            if(d.solution?.kind!=="points" || !d.solution.intervals?.some(line=>line.id===o.id)) throw Error("Interval not found.");
            d.solution.intervals=d.solution.intervals.filter(line=>line.id!==o.id);
        }
        if (o.op === "set_tick_label")
            d.teaching.labels[labelKey(o.value)] = o.state;
        if (o.op === "set_presentation")
            d.teaching = { ...d.teaching, ...o.teaching };
        if (o.op === "set_print")
            d.widthCm = o.widthCm;
    }
    return validate(next);
}
export async function revise(raw: unknown) { const v = revisionSchema.parse(raw); if (await hash(v.envelope) !== v.baseHash)
    throw Error("The baseHash does not match this definition. Use the last returned envelope and hash."); return apply(v.envelope, v.operations); }
export const warnings = (e: Envelope) => e.document.solution?.kind === "ray" && e.document.solution.intentional ? ["This drawing intentionally disagrees with the completed ray for an error-spotting task."] : [];
export const describe = (e: Envelope) => `Number line from ${e.document.axis.minimum} to ${e.document.axis.maximum}; step ${e.document.axis.step}; ${e.document.teaching.solutionVisible ? (e.document.solution?.kind ?? "blank") : "solution hidden"}.`;
export function printFacts(d: LineDocument) { return { recommendedScale: 1 as const, preserveAspectRatio: true as const, referenceFeatures: { textSizesPt: ticks(d).some(v => labelled(d, v) && d.teaching.labels[labelKey(v)] !== "hidden") || d.axis.variable || d.teaching.prompt || d.teaching.answerVisible ? [11] : [], gridPitchMm: [], answerLineLengthsMm: [...(d.teaching.responseLines ? [d.widthCm * 10 - 14] : []), ...(Object.values(d.teaching.labels).includes("answer-line") ? [5] : [])], tableRowHeightsMm: [] } }; }
export function displayNumber(d: LineDocument, s: string) {
    if (d.axis.numberFormat === "fraction")
        return fractionString(parseNumber(s));
    const q = parseNumber(s);
    let divisor = q.d;
    while (divisor % 2n === 0n)
        divisor /= 2n;
    while (divisor % 5n === 0n)
        divisor /= 5n;
    if (divisor !== 1n)
        return fractionString(q);
    return String(Number((Number(q.n) / Number(q.d)).toFixed(6)));
}
function esc(s: string) { return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"); }
function numberWidth(s: string) { return s.includes("/") ? Math.max(...s.split("/").map(v => textWidth(v.replace("-", "−"), FONT * .8))) : textWidth(s.replace("-", "−"), FONT); }
function numberSvg(s: string, x: number, y: number) { if (!s.includes("/"))
    return `<text x="${x}" y="${y}" text-anchor="middle">${esc(s.replace("-", "−"))}</text>`; const [n, b] = s.split("/"), w = numberWidth(s) + 1; return `<g font-size="${FONT * .8}"><text x="${x}" y="${y - 1.6}" text-anchor="middle">${n.replace("-", "−")}</text><path d="M${x - w / 2} ${y - .6}h${w}"/><text x="${x}" y="${y + 2.8}" text-anchor="middle">${b}</text></g>`; }
export function renderSvg(e: Envelope) {
    const d = validate(e).document, m = metrics(d), r = 1.3;
    let art = "";
    const circle = (v: string, filled: boolean) => `<circle data-value="${v}" cx="${position(d, v)}" cy="${m.solutionY}" r="${r}" fill="${filled ? "#111" : "white"}" stroke="#111"/>`;
    const arrow = (x: number, y: number, dir: number) => `<path d="M${x} ${y}l${-dir * 2.5} -1.1v2.2Z" fill="#111" stroke="none"/>`;
    if (d.teaching.prompt)
        art += `<text x="7" y="6">${esc(d.teaching.prompt)}</text>`;
    art += `<path d="M${m.left - 3} ${m.axisY}H${m.right + 4}"/>${arrow(m.right + 4, m.axisY, 1)}`;
    if (d.axis.variable)
        art += `<text x="${m.right + 6}" y="${m.axisY + (d.axis.variableBelow ? 6 : 1.2)}" font-style="italic">${d.axis.variable}</text>`;
    for (const v of ticks(d)) {
        const x = position(d, v);
        art += `<path d="M${x} ${m.axisY}v2"/>`;
        if (!labelled(d, v))
            continue;
        const state = d.teaching.labels[labelKey(v)] ?? "value";
        if (state === "value")
            art += numberSvg(displayNumber(d, v), x, m.axisY + 6);
        if (state === "answer-line")
            art += `<path d="M${x - 2.5} ${m.axisY + 6}h5" stroke-dasharray=".4 .7"/>`;
    }
    const s = d.solution;
    if (d.teaching.solutionVisible && s) {
        if (s.kind === "interval")
            art += `<path d="M${position(d, s.lower) + r} ${m.solutionY}H${position(d, s.upper) - r}"/>${circle(s.lower, s.lowerIncluded)}${circle(s.upper, s.upperIncluded)}`;
        if (s.kind === "ray") {
            const dir = s.direction === "left" ? -1 : 1, end = s.stop !== null ? position(d, s.stop) : s.direction === "left" ? m.left - 3 : m.right + 4;
            art += `<path d="M${position(d, s.value) + dir * r} ${m.solutionY}H${end}"/>${circle(s.value, s.included)}`;
            if (s.stop === null)
                art += arrow(end, m.solutionY, dir);
        }
        if (s.kind === "points") {
            for(const line of s.intervals??[]) {
                const a=position(d,s.points.find(p=>p.id===line.from)!.value),b=position(d,s.points.find(p=>p.id===line.to)!.value);
                art+=`<path data-interval="${line.id}" d="M${Math.min(a,b)+r} ${m.solutionY}H${Math.max(a,b)-r}"/>`;
            }
            art += s.points.map(p => circle(p.value, p.included!==false)).join("");
        }
    }
    if (d.teaching.answerVisible && d.teaching.answer)
        art += `<text x="7" y="${m.answerY}">${esc(d.teaching.answer)}</text>`;
    for (let i = 0; i < d.teaching.responseLines; i++)
        art += `<path d="M7 ${m.answerY + (d.teaching.answerVisible && d.teaching.answer ? 8 : 0) + i * 8}H${m.width - 7}" stroke-dasharray=".4 .8"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${m.widthCm}cm" height="${m.heightCm}cm" viewBox="0 0 ${m.width} ${m.height}" role="img" aria-label="${esc(describe(e))}"><style>text{stroke:none}</style><rect width="${m.width}" height="${m.height}" fill="white"/><g fill="#111" stroke="#111" stroke-width=".2" font-family="STIX Two Text" font-size="${FONT}">${art}</g></svg>`;
}
