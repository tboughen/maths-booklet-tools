// The Resource library list (docs/content/RESOURCE-LIBRARY.md).
// The source list, library/library.json in the private bank repository, names each file by its path
// beside the list. Publishing turns it into the served list, which names each file by its SHA-256.
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { join, basename } from 'node:path';

export const sourceSchema = 'mathsdock-library/1';
export const servedSchema = 'mathsdock-library-served/1';
export const types = ['unit-booklet', 'lesson-booklet', 'a3-worksheet', 'revision-lesson', 'starter', 'skill-sheet'];
export const statuses = ['ready', 'waiting'];
export const roles = ['pupil', 'answers', 'teacher-notes'];
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
        units.set(`${year.year}/${unit.code}`, unit);
      }
    }
  }
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.updated ?? '')) problems.push(`${at}: updated must be a date such as 2026-11-24.`);
    if (r.lesson !== undefined && !/^[A-Z]{1,3}\d+(\.\d+[a-z]?)?$/.test(r.lesson)) problems.push(`${at}: lesson ${r.lesson} is not a code such as A7.03.`);
    if (!r.files?.length) problems.push(`${at}: it has no files.`);
    const seen = new Set();
    for (const f of r.files ?? []) {
      if (!roles.includes(f.role) || !(f.format in formats)) { problems.push(`${at}: a file has role ${f.role} and format ${f.format}.`); continue; }
      if (seen.has(`${f.role}.${f.format}`)) problems.push(`${at}: two ${f.role} ${f.format} files.`);
      seen.add(`${f.role}.${f.format}`);
      if (!safePath.test(f.path ?? '') || !f.path.endsWith(`.${f.format}`)) problems.push(`${at}: ${f.path} must look like y9/A7/name.${f.format} (lower-case file name).`);
      else if (!f.path.startsWith(`y${r.year}/${r.unit}/`)) problems.push(`${at}: ${f.path} must sit in y${r.year}/${r.unit}/.`);
      else if (root && !regularFile(root, f.path)) problems.push(`${at}: files/${f.path} is missing or is not a plain file.`);
    }
  }
  return problems;
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
  const resources = list.resources.map(r => ({ ...r, files: r.files.map(f => {
    if (!regularFile(root, f.path)) throw new Error(`Not a plain file: ${f.path}`);
    const path = join(root, 'files', f.path), data = readFileSync(path), name = basename(f.path);
    if (!fileName.test(name)) throw new Error(`Unsafe file name: ${name}`);
    const sha256 = createHash('sha256').update(data).digest('hex');
    const key = `library/files/${sha256}/${name}`;
    uploads.set(key, { key, path, bytes: data.length, sha256, md5: createHash('md5').update(data).digest('hex'), contentType: formats[f.format] });
    return { role: f.role, format: f.format, name, bytes: data.length, href: key.replace(/^library\//, 'library-data/') };
  }) }));
  return { list: { schema: servedSchema, published, years: list.years, resources }, uploads: [...uploads.values()] };
}
