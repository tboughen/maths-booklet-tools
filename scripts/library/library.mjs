// The Resource library list (docs/content/RESOURCE-LIBRARY.md).
// The source list, library/library.json in the private bank repository, names each file by its path
// beside the list. Publishing turns it into the served list, which names each file by its SHA-256.
// Version 2: booklets only. A unit lists its planned lessons and any parts; a resource belongs to a
// version of its unit ("Main" unless named) and keeps every replaced version in its history.
// One-offs (Tim, 28 Nov): mock revision, follow-up sheets, silent starters and other non-unit material sit
// on each year's One-offs shelf with a class, the date used and who asked; no versions, no lesson codes.
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { join, basename } from 'node:path';

export const sourceSchema = 'mathsdock-library/2';
export const servedSchema = 'mathsdock-library-served/2';
export const types = ['unit-booklet', 'lesson-booklet', 'revision-lesson', 'one-off'];
export const oneOffShelf = 'ONEOFFS';
const shortText = /^[^\p{Cc}<>]{1,60}$/u;
const emailText = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
export const statuses = ['ready', 'waiting'];
export const roles = ['pupil', 'answers'];
const lessonCode = /^[A-Z]{1,3}\d+(\.\d+[a-z]?)?$/;
const versionName = /^[A-Za-z0-9][A-Za-z0-9 ()+&,'-]{0,39}$/;
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
export const formats = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const fileName = /^[a-z0-9][a-z0-9._-]{0,150}\.(pdf|docx)$/;
const safePath = /^y(7|8|9|10|11)\/[A-Za-z0-9_-]+\/[a-z0-9][a-z0-9._-]{0,150}\.(pdf|docx)$/;

/** Every problem with a source list, as sentences; empty when it is sound. */
export function checkLibrary(list, root) {
  const problems = [];
  if (list?.schema !== sourceSchema) return [`The list must start with "schema": "${sourceSchema}".`];
  if (!Array.isArray(list.years) || !list.years.length || !Array.isArray(list.resources)) return ['The list needs a "years" list and a "resources" list.'];
  const units = new Map();
  for (const year of list.years) {
    if (!Array.isArray(year.sections) || year.sections.some(s => !Array.isArray(s.units))) { problems.push(`Year ${year.year} needs sections, each with a units list.`); continue; }
    if (![7, 8, 9, 10, 11].includes(year.year)) problems.push(`Year ${year.year} is not Year 7 to 11.`);
    for (const section of year.sections) {
      if (!section.name) problems.push(`A Year ${year.year} section has no name.`);
      for (const unit of section.units) {
        if (!unit.code || !unit.title) problems.push(`A Year ${year.year} unit needs a code and a title.`);
        if (units.has(`${year.year}/${unit.code}`)) problems.push(`Year ${year.year} lists ${unit.code} twice.`);
        units.set(`${year.year}/${unit.code}`, unit);
        const at = `Year ${year.year} ${unit.code}`, codes = (unit.lessons ?? []).map(l => l.code);
        if (unit.lessons !== undefined && (!Array.isArray(unit.lessons) || unit.lessons.some(l => !lessonCode.test(l?.code ?? '') || !l.title?.trim()))) problems.push(`${at}: each planned lesson needs a code such as A7.03 and a title.`);
        if (new Set(codes).size !== codes.length) problems.push(`${at}: a planned lesson is listed twice.`);
        for (const part of unit.parts ?? []) {
          if (!part.name?.trim() || !codes.includes(part.from) || !codes.includes(part.to) || codes.indexOf(part.from) > codes.indexOf(part.to)) problems.push(`${at}: part ${part.name ?? '(no name)'} must run from one planned lesson to a later one.`);
        }
      }
    }
  }
  for (const year of list.years) if (year.now !== undefined && !units.has(`${year.year}/${year.now}`)) problems.push(`Year ${year.year}: the unit taught now, ${year.now}, is not listed.`);
  const ids = new Set();
  for (const r of list.resources ?? []) {
    const at = `Resource ${r.id ?? '(no id)'}`;
    if (!/^[a-z0-9-]+$/.test(r.id ?? '')) problems.push(`${at}: the id must be lower-case letters, digits and hyphens.`);
    if (ids.has(r.id)) problems.push(`${at}: the id is used twice.`);
    ids.add(r.id);
    if (!units.has(`${r.year}/${r.unit}`)) problems.push(`${at}: unit ${r.unit} is not listed for Year ${r.year}.`);
    if (!types.includes(r.type)) problems.push(`${at}: type must be one of ${types.join(', ')}.`);
    if (!statuses.includes(r.status)) problems.push(`${at}: status must be ready or waiting.`);
    if (!r.title?.trim()) problems.push(`${at}: it needs a title.`);
    if (!isDate(r.updated)) problems.push(`${at}: updated must be a date such as 2026-11-24.`);
    if (r.lesson !== undefined && !lessonCode.test(r.lesson)) problems.push(`${at}: lesson ${r.lesson} is not a code such as A7.03.`);
    if (r.version !== undefined && !versionName.test(r.version)) problems.push(`${at}: version ${r.version} must be a short name such as Foundation.`);
    if (r.part !== undefined && !(units.get(`${r.year}/${r.unit}`)?.parts ?? []).some(p => p.name === r.part)) problems.push(`${at}: part ${r.part} is not a part of ${r.unit}.`);
    if (r.note !== undefined && typeof r.note !== 'string') problems.push(`${at}: the note must be a sentence.`);
    if (r.type === 'one-off') checkOneOff(at, r, problems);
    else if (r.unit === oneOffShelf || ['class', 'used', 'askedBy', 'owner', 'kept'].some(k => r[k] !== undefined)) problems.push(`${at}: only a one-off sits on the ${oneOffShelf} shelf or has a class, used date, askedBy, owner or kept.`);
    checkFiles(at, r, r.files, root, problems);
    if (r.history !== undefined && !Array.isArray(r.history)) problems.push(`${at}: history must be a list.`);
    for (const old of Array.isArray(r.history) ? r.history : []) {
      if (!isDate(old.updated)) problems.push(`${at}: each earlier version needs an updated date.`);
      checkFiles(`${at}, version of ${old.updated}`, r, old.files, root, problems);
    }
  }
  const versions = new Set(list.resources.map(r => `${r.year}/${r.unit}/${r.version ?? 'Main'}/${r.type === 'unit-booklet' ? `unit/${r.part ?? ''}` : r.lesson ?? r.id}`));
  if (versions.size !== list.resources.length) problems.push('Two resources are the same booklet of the same unit, version and lesson (one lesson has one booklet).');
  return problems;
}

/** A one-off: its shelf, a used date (unless kept), and no lesson, part or version. */
function checkOneOff(at, r, problems) {
  if (r.unit !== oneOffShelf) problems.push(`${at}: a one-off sits on the ${oneOffShelf} shelf.`);
  if (r.lesson !== undefined || r.part !== undefined || (r.version ?? 'Main') !== 'Main') problems.push(`${at}: a one-off has no lesson code, part or version.`);
  if (r.kept !== undefined && r.kept !== true) problems.push(`${at}: kept is true or left out.`);
  if (r.used !== undefined ? !isDate(r.used) : r.kept !== true) problems.push(`${at}: a one-off needs the date it is used, such as 2026-11-30 (a kept one may leave it out).`);
  if (r.class !== undefined && !shortText.test(r.class)) problems.push(`${at}: class must be a short name such as 9Y4.`);
  if (r.askedBy !== undefined && !shortText.test(r.askedBy)) problems.push(`${at}: askedBy must be a name such as Tim.`);
  if (r.owner !== undefined && !emailText.test(r.owner)) problems.push(`${at}: owner must be the lower-case school email of the person who asked.`);
}

function checkFiles(at, r, files, root, problems) {
  if (!files?.length) problems.push(`${at}: it has no files.`);
  const seen = new Set();
  for (const f of files ?? []) {
    if (!roles.includes(f.role) || !(f.format in formats)) { problems.push(`${at}: a file has role ${f.role} and format ${f.format}.`); continue; }
    if (seen.has(`${f.role}.${f.format}`)) problems.push(`${at}: two ${f.role} ${f.format} files.`);
    seen.add(`${f.role}.${f.format}`);
    if (!safePath.test(f.path ?? '') || !f.path.endsWith(`.${f.format}`)) problems.push(`${at}: ${f.path} must look like y9/A7/name.${f.format} (lower-case file name).`);
    // A one-off's files stay wherever they were first filed in the year (STARTERS, MOCK), so none move.
    else if (!f.path.startsWith(r.type === 'one-off' ? `y${r.year}/` : `y${r.year}/${r.unit}/`)) problems.push(`${at}: ${f.path} must sit in y${r.year}/${r.type === 'one-off' ? '' : `${r.unit}/`}.`);
    else if (root && !regularFile(root, f.path)) problems.push(`${at}: files/${f.path} is missing or is not a plain file.`);
  }
}

/** True for a plain file inside <root>/files: no links out of the folder. */
function regularFile(root, path) {
  try {
    const base = realpathSync(join(root, 'files')), full = join(root, 'files', path);
    return lstatSync(full).isFile() && realpathSync(full).startsWith(base + '/');
  } catch { return false; }
}

/** The served list and the files to upload. */
export function servedLibrary(list, root, published = new Date().toISOString()) {
  const uploads = new Map();
  const serve = files => files.map(f => {
    if (!regularFile(root, f.path)) throw new Error(`Not a plain file: ${f.path}`);
    const path = join(root, 'files', f.path), data = readFileSync(path), name = basename(f.path);
    if (!fileName.test(name)) throw new Error(`Unsafe file name: ${name}`);
    const sha256 = createHash('sha256').update(data).digest('hex');
    const key = `library/files/${sha256}/${name}`;
    uploads.set(key, { key, path, bytes: data.length, sha256, md5: createHash('md5').update(data).digest('hex'), contentType: formats[f.format] });
    return { role: f.role, format: f.format, name, bytes: data.length, href: key.replace(/^library\//, 'library-data/') };
  });
  const resources = list.resources.map(r => ({ ...r, version: r.version ?? 'Main', files: serve(r.files), history: (r.history ?? []).map(old => ({ ...old, files: serve(old.files) })) }));
  return { list: { schema: servedSchema, published, years: list.years, resources }, uploads: [...uploads.values()] };
}
