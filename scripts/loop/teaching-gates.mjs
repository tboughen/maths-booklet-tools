// The one list of non-negotiable teaching gates (teaching-gates.json, improvement list L59).
// A file entry ending in "/" covers everything under that folder.
import { readFileSync } from 'node:fs';

export const GATES = JSON.parse(readFileSync(new URL('./teaching-gates.json', import.meta.url), 'utf8')).gates;

/** The gate a path belongs to, or null. */
export function gateOf(path) {
  return GATES.find(g => g.files.some(f => (f.endsWith('/') ? path.startsWith(f) : path === f))) ?? null;
}

/**
 * Gate files a change edits or deletes, from `git diff --name-status` rows ([status, path]).
 * Added files are allowed: a new test or a new dated corpus only adds protection.
 */
export function changedGates(status) {
  return status.filter(([s, p]) => s !== 'A' && gateOf(p)).map(([, p]) => p);
}
