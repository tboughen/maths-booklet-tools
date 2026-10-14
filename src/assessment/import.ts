import { normalizeCode, type BankCatalogue } from "../bank/model";
import type { AssessmentItem, ImportResult, Pupil, TableSheet } from "./types";
import { presetSourceIds } from "./presets";

const header = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
export const questionLabel = (value: string) => value.trim().toUpperCase().replace(/^QUESTION\s*/i, "Q").replace(/^Q?\s*(\d+)/, "Q$1").replace(/[\s()._-]/g, "");
export const MAX_ROWS = 500;
export function parseDelimited(text: string): string[][] {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0];
  const separator = first.includes("\t") ? "\t" : first.includes(",") ? "," : ";";
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else if (quoted || !cell) quoted = !quoted; else cell += c; }
    else if (!quoted && c === separator) { row.push(cell.trim()); cell = ""; }
    else if (!quoted && (c === "\n" || c === "\r")) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell.trim()); if (row.some(Boolean) || row.length > 1) rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (quoted) throw new Error("An opening quote is missing its closing quote.");
  row.push(cell.trim()); if (row.some(Boolean) || row.length > 1) rows.push(row);
  if (rows.length > MAX_ROWS + 1 || rows.some(r => r.length > 300)) throw new Error("Use at most 500 rows and 300 columns per sheet.");
  return rows;
}
const xml = (text: string) => {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.getElementsByTagName("parsererror").length) throw new Error("This workbook contains invalid XML.");
  return document;
};
// XLSX is a ZIP of XML parts. Native decompression keeps all processing on device,
// requires no remote parser, and never executes formulas or external relationships.
async function unzip(bytes: Uint8Array): Promise<Map<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0 || end < bytes.length - 65557) throw new Error("This is not a supported Excel workbook.");
  const count = view.getUint16(end + 10, true); let offset = view.getUint32(end + 16, true), total = 0;
  if (count > 10000) throw new Error("This workbook is too complex. Export the relevant sheet as CSV.");
  const result = new Map<string, string>(); const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error("The workbook archive is incomplete.");
    const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true), size = view.getUint32(offset + 20, true), expanded = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true), local = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)); offset += 46 + nameLength + extra + comment;
    if (!/^xl\/(workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/[^/]+\.xml)$/.test(name)) continue;
    total += expanded;
    if (flags & 1 || expanded > 20_000_000 || total > 50_000_000 || local + 30 > bytes.length) throw new Error("Use an unencrypted workbook with smaller sheets, or export as CSV.");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + size > bytes.length) throw new Error("The workbook archive is incomplete.");
    const compressed = bytes.slice(start, start + size);
    let output: Uint8Array;
    if (method === 0) output = compressed;
    else if (method === 8) {
      if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open XLSX. Paste the cells or upload CSV instead.");
      const reader = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > expanded || length > 20_000_000) { await reader.cancel(); throw new Error("The workbook exceeded its declared size."); } chunks.push(part.value); }
      output = new Uint8Array(length); let p = 0; for (const chunk of chunks) { output.set(chunk, p); p += chunk.length; }
    } else throw new Error("Unsupported workbook compression. Export as CSV.");
    if (output.length !== expanded) throw new Error("The workbook archive is incomplete.");
    result.set(name, decoder.decode(output));
  }
  return result;
}
export async function readSpreadsheet(file: File): Promise<TableSheet[]> {
  if (file.size > 15_000_000) throw new Error("Use a file smaller than 15 MB.");
  if (!/\.xlsx$/i.test(file.name)) {
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) throw new Error("Upload XLSX, CSV or TSV. Save older XLS files as XLSX first.");
    return [{ name: "Sheet", rows: parseDelimited(await file.text()) }];
  }
  const files = await unzip(new Uint8Array(await file.arrayBuffer()));
  const workbook = xml(files.get("xl/workbook.xml") || ""), relationships = xml(files.get("xl/_rels/workbook.xml.rels") || "");
  const targets = new Map(Array.from(relationships.getElementsByTagName("Relationship")).filter(r => r.getAttribute("TargetMode") !== "External").map(r => [r.getAttribute("Id"), r.getAttribute("Target") || ""]));
  const strings = files.has("xl/sharedStrings.xml") ? Array.from(xml(files.get("xl/sharedStrings.xml")!).getElementsByTagName("si")).map(si => Array.from(si.getElementsByTagName("t")).map(t => t.textContent || "").join("")) : [];
  return Array.from(workbook.getElementsByTagName("sheet")).map(sheet => {
    const target = targets.get(sheet.getAttribute("r:id")) || "";
    const path = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
    const content = files.get(path); if (!content) throw new Error("A workbook sheet could not be read. Export that sheet as CSV.");
    const rows = Array.from(xml(content).getElementsByTagName("row")).map(r => {
      const values: string[] = [];
      for (const c of Array.from(r.getElementsByTagName("c"))) {
        const address = c.getAttribute("r") || ""; const letters = address.match(/^[A-Z]+/i)?.[0];
        if (!letters) continue; const column = Array.from(letters.toUpperCase()).reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) - 1;
        if (column >= 300) throw new Error("Use at most 300 columns per sheet.");
        const value = c.getElementsByTagName("v")[0]?.textContent || "";
        if (c.getElementsByTagName("f").length) { values[column] = ""; continue; }
        values[column] = c.getAttribute("t") === "s" ? strings[Number(value)] || "" : c.getAttribute("t") === "inlineStr" ? Array.from(c.getElementsByTagName("t")).map(t => t.textContent || "").join("") : value;
      }
      return Array.from({ length: values.length }, (_, i) => values[i] || "");
    }).filter(r => r.some(Boolean));
    if (rows.length > MAX_ROWS + 1) throw new Error("Use at most 500 rows per sheet.");
    return { name: sheet.getAttribute("name") || "Sheet", rows };
  });
}

export function importMappings(table: string[][], catalogue: BankCatalogue): ImportResult<AssessmentItem> {
  const warnings: string[] = [], rows: AssessmentItem[] = [], seen = new Set<string>();
  const columns = (table[0] || []).map(header);
  const find = (...names: string[]) => columns.findIndex(c => names.includes(c));
  const labelColumn = find("question", "questionpart", "label"), marksColumn = find("marks", "maxmarks", "maximummarks"), codesColumn = find("codes", "sparx", "sparxcodes", "sparxcode"), idColumn = find("questionid", "mathsdockid", "sourceid");
  if (labelColumn < 0 || marksColumn < 0 || codesColumn < 0) throw new Error("Mapping headers must include Question, Max marks and Sparx codes.");
  const knownCodes = new Set(catalogue.topics.map(t => t.code)), questions = new Map(catalogue.questions.map(q => [q.id, q]));
  for (const [index, row] of table.slice(1).entries()) {
    const label = row[labelColumn]?.trim() || "", key = questionLabel(label), marks = Number(row[marksColumn]);
    if (!label || !row[marksColumn]?.trim() || !Number.isInteger(marks) || marks < 1 || marks > 100 || seen.has(key)) { warnings.push(`Mapping row ${index + 2}: missing, duplicate or invalid question/marks; skipped.`); continue; }
    const rawCodes = (row[codesColumn] || "").split(/[\s,;|/]+/).filter(Boolean).map(normalizeCode);
    const codes = [...new Set(rawCodes.map(code => catalogue.aliases[code] || code).filter(code => knownCodes.has(code)))];
    if (codes.length !== new Set(rawCodes.map(code => catalogue.aliases[code] || code)).size) warnings.push(`Mapping row ${index + 2}: unknown Sparx codes ignored.`);
    if (!codes.length) { warnings.push(`Mapping row ${index + 2}: no recognised Sparx code; skipped.`); continue; }
    const id = row[idColumn]?.trim();
    if (id && !questions.has(id) && !presetSourceIds.has(id)) warnings.push(`Mapping row ${index + 2}: source question ID not recognised; skipped.`);
    if (id && !questions.has(id) && !presetSourceIds.has(id)) continue;
    seen.add(key); rows.push({ label, marks, codes, questionId: id || undefined });
  }
  return { rows, warnings };
}
export function paperMappings(catalogue: BankCatalogue, paper: string, parts = false): AssessmentItem[] {
  return catalogue.questions.filter(q => q.paperId === paper).sort((a, b) => a.number - b.number).flatMap(q => parts ? q.parts.map(p => ({ label: `Q${q.number}${p.label === "whole" || p.label === "" ? "" : p.label.replace(/^Q?\d+/, "")}`, marks: p.marks, codes: p.codes, questionId: q.id })) : [{ label: `Q${q.number}`, marks: q.marks, codes: q.codes, questionId: q.id }]);
}
export interface ResultOptions { headers?: "auto" | "yes" | "no"; identifier?: "auto" | "none" | number; firstQuestionColumn?: number }
export interface Detection { hasHeaders: boolean; identifierColumn: number | null; matchedQuestions: number; missingResults: number; ignoredColumns: number; firstQuestionColumn: number }
export interface PupilImport extends ImportResult<Pupil> { detection: Detection }
const identifierHeaders = ["studentidentifier", "identifier", "studentid", "pupilid", "id", "name", "studentname", "pupilname", "student", "pupil", "candidatenumber"];
const missingScore = (value: string) => !value || /^(absent|missing|na|n\/a|-|a)$/i.test(value);
export function importPupils(input: string[][], mappings: AssessmentItem[], options: ResultOptions | number = {}): PupilImport {
  const settings: ResultOptions = typeof options === "number" ? { identifier: options } : options;
  const explicitQuestions = (input[0] || []).filter(value => /[a-z]/i.test(value) && mappings.some(item => questionLabel(value) === questionLabel(item.label))).length;
  const namedHeader = (input[0] || []).some(value => identifierHeaders.includes(header(value)) || ["year", "yeargroup", "tier", "strength"].includes(header(value)));
  const numericValues = (input[0] || []).some(value => value.trim() && Number.isFinite(Number(value)));
  const hasHeaders = settings.headers === "yes" || settings.headers !== "no" && (namedHeader || !numericValues && explicitQuestions >= Math.min(2, mappings.length));
  const data = hasHeaders ? input.slice(1) : input;
  const width = Math.max(input[0]?.length || 0, ...data.map(row => row.length));
  let identifierColumn: number | null;
  if (typeof settings.identifier === "number") identifierColumn = settings.identifier;
  else if (settings.identifier === "none") identifierColumn = null;
  else if (hasHeaders) {
    const found = (input[0] || []).findIndex(value => identifierHeaders.includes(header(value)));
    identifierColumn = found >= 0 ? found : null;
  } else {
    const nonBlank = data.map(row => row[0]?.trim() || "").filter(Boolean);
    const textIdentifiers = nonBlank.length > 0 && nonBlank.every(value => !missingScore(value) && !Number.isFinite(Number(value)));
    identifierColumn = width === mappings.length + 1 || textIdentifiers ? 0 : null;
  }
  const firstQuestionColumn = settings.firstQuestionColumn ?? (identifierColumn === 0 ? 1 : 0);
  const table = hasHeaders && settings.firstQuestionColumn === undefined ? input : [Array.from({ length: width }, (_, i) => {
    if (i === identifierColumn) return "Student identifier";
    const item = mappings[i - firstQuestionColumn]; return item ? item.label : `Unused column ${i + 1}`;
  }), ...data];
  const columns = (table[0] || []).map(header), warnings: string[] = [], rows: Pupil[] = [], identifiers = new Set<string>();
  const detection: Detection = { hasHeaders, identifierColumn, firstQuestionColumn, matchedQuestions: 0, missingResults: 0, ignoredColumns: 0 };
  if (!input.length) return { rows, warnings, detection };
  const mappedColumns = mappings.map(item => {
    const exact = table[0].findIndex(c => questionLabel(c) === questionLabel(item.label));
    return { item, column: exact };
  });
  if (!mappedColumns.some(c => c.column >= 0)) throw new Error("No result columns match your assessment labels. Use the supplied results template.");
  detection.matchedQuestions = mappedColumns.filter(c => c.column >= 0).length;
  detection.firstQuestionColumn = Math.min(...mappedColumns.filter(c => c.column >= 0).map(c => c.column));
  const usedColumns = new Set(mappedColumns.map(c => c.column).filter(c => c >= 0));
  if (identifierColumn !== null) usedColumns.add(identifierColumn);
  const yearColumn = columns.findIndex(c => ["year", "yeargroup"].includes(c)), tierColumn = columns.findIndex(c => ["tier", "examinationtier"].includes(c)), strengthColumn = columns.findIndex(c => c === "strength");
  for (const column of [yearColumn, tierColumn, strengthColumn]) if (column >= 0) usedColumns.add(column);
  detection.ignoredColumns = Math.max(0, width - usedColumns.size);
  if (detection.ignoredColumns) warnings.push(`${detection.ignoredColumns} extra column(s) were ignored. Use Adjust import if they contain question marks.`);
  for (const [index, row] of table.slice(1).entries()) {
    if (!row.some(Boolean) && row.length <= 1) continue;
    const rowNumber = index + (hasHeaders ? 2 : 1);
    let identifier = identifierColumn === null ? "" : row[identifierColumn]?.trim() || "";
    identifier ||= `S${String(index + 1).padStart(3, "0")}`;
    if (identifiers.has(identifier)) { const base = identifier; let suffix = index + 1; do { identifier = `${base} (${suffix++})`; } while (identifiers.has(identifier)); warnings.push(`Results row ${rowNumber}: duplicate identifier disambiguated.`); } identifiers.add(identifier);
    const scores: Pupil["scores"] = {};
    for (const { item, column } of mappedColumns) {
      const raw = row[column]?.trim() || "", number = Number(raw);
      scores[questionLabel(item.label)] = missingScore(raw) ? null : Number.isFinite(number) && number >= 0 && number <= item.marks ? number : null;
      if (scores[questionLabel(item.label)] === null) detection.missingResults++;
      if (!missingScore(raw) && scores[questionLabel(item.label)] === null) warnings.push(`Results row ${rowNumber}: invalid score for ${item.label}; treated as missing.`);
    }
    const profile: Pupil["profile"] = {};
    const year = row[yearColumn]?.trim(), tier = row[tierColumn]?.trim().toUpperCase(), strength = row[strengthColumn]?.trim().toLowerCase();
    if (year) { const number = Number(year); if (Number.isInteger(number) && number >= 7 && number <= 13) profile.year = number; else warnings.push(`Results row ${rowNumber}: invalid year; class default used.`); }
    if (tier) { if (["F", "FOUNDATION", "H", "HIGHER"].includes(tier)) profile.tier = tier.startsWith("F") ? "F" : "H"; else warnings.push(`Results row ${rowNumber}: invalid tier; class default used.`); }
    if (strength) { if (strength === "developing" || strength === "secure" || strength === "strong") profile.strength = strength; else warnings.push(`Results row ${rowNumber}: invalid strength; class default used.`); }
    rows.push({ key: `row-${index + 1}`, identifier, scores, profile });
  }
  return { rows, warnings, detection };
}
export const mappingsCsv = (items: AssessmentItem[]) => [["Question", "Max marks", "Sparx codes", "Question ID"], ...items.map(item => [item.label, String(item.marks), item.codes.join(" "), item.questionId || ""])].map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n");
export const resultsCsv = (items: AssessmentItem[]) => [["Student identifier", "Year", "Tier", "Strength", ...items.map(i => i.label)], ["S001", "", "", "", ...items.map(() => "")]].map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n");
