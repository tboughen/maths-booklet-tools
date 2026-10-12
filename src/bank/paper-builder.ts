import { normalizeCode, questionIdentity, type BankCatalogue, type BankQuestion } from "./model";
import type { Coverage } from "./coverage";
import { compareAccessibility } from "./performance";

export interface PaperDraft { codes: string[]; manual: Record<string,string>; excluded: string[]; order: string[]; version: string; manuallyOrdered?: boolean }
export interface PaperEntry { key: string; question: BankQuestion; matchingCodes: string[]; matchedParts: string[]; otherParts: string[] }
export const emptyDraft = (version = ""): PaperDraft => ({codes: [], manual: {}, excluded: [], order: [], version});
export type DraftAction =
  | {type: "code"; code: string; checked: boolean}
  | {type: "question"; question: BankQuestion; checked: boolean}
  | {type: "add"; questions: BankQuestion[]}
  | {type: "exclude"; key: string}
  | {type: "restore"}
  | {type: "clear"}
  | {type: "remember"; keys: string[]}
  | {type: "move"; key: string; direction: number; visible: string[]}
  | {type: "reconcile"; catalogue: BankCatalogue};

export function draftReducer(state: PaperDraft, action: DraftAction): PaperDraft {
  switch (action.type) {
    case "code": return {...state, codes: action.checked ? [...new Set([...state.codes, action.code])] : state.codes.filter(c => c !== action.code)};
    case "question": {
      const key = questionIdentity(action.question);
      return action.checked ? {...state, manual: {...state.manual, [key]: action.question.id}, excluded: state.excluded.filter(k => k !== key)} : {...state, excluded: [...new Set([...state.excluded, key])]};
    }
    case "add": return action.questions.reduce((s, question) => draftReducer(s, {type: "question", question, checked: true}), state);
    case "exclude": return {...state, excluded: [...new Set([...state.excluded, action.key])]};
    case "restore": return {...state, excluded: []};
    case "clear": return emptyDraft(state.version);
    case "remember": {
      const added = action.keys.filter(key => !state.order.includes(key));
      return added.length ? {...state, order: [...state.order, ...added]} : state;
    }
    case "move": {
      const i = action.visible.indexOf(action.key), target = action.visible[i + action.direction];
      if (!target) return state;
      const order = [...new Set(state.manuallyOrdered ? [...state.order, ...action.visible] : [...action.visible, ...state.order])], a = order.indexOf(action.key), b = order.indexOf(target);
      [order[a],order[b]] = [order[b],order[a]]; return {...state, order, manuallyOrdered: true};
    }
    case "reconcile": {
      const identities = new Set(action.catalogue.questions.map(questionIdentity)), byId = new Map(action.catalogue.questions.map(q => [q.id,q]));
      const topics = new Set(action.catalogue.topics.map(t => t.code));
      const codes = [...new Set(state.codes.map(c => action.catalogue.aliases[normalizeCode(c)] || normalizeCode(c)))].filter(c => topics.has(c));
      const manual: Record<string,string> = {};
      for (const id of Object.values(state.manual)) { const q = byId.get(id); if (q) manual[questionIdentity(q)] = id; }
      return {...state, codes, manual, excluded: state.excluded.filter(k => identities.has(k)), order: state.order.filter(k => identities.has(k)), version: action.catalogue.version};
    }
  }
}

export function draftEntries(coverage: Coverage, state: PaperDraft): PaperEntry[] {
  const entries: PaperEntry[] = [], selected = new Set(state.codes), excluded = new Set(state.excluded);
  const candidates = new Set(Object.keys(state.manual));
  for (const code of state.codes) for (const key of coverage.codes.get(code) || []) candidates.add(key);
  const eligible = [...candidates].filter(key=>coverage.groups.has(key)).sort((a,b)=>{
    const first=coverage.groups.get(a)![0],second=coverage.groups.get(b)![0];
    return first.order-second.order || first.id.localeCompare(second.id);
  });
  for (const key of eligible) {
    const appearances=coverage.groups.get(key)!;
    if (excluded.has(key)) continue;
    const matchingCodes = [...new Set(appearances.flatMap(q => q.codes.filter(c => selected.has(c))))];
    if (!matchingCodes.length && !state.manual[key]) continue;
    const mapped = appearances.filter(q => q.codes.some(c => selected.has(c)));
    const question = appearances.find(q => q.id === state.manual[key]) || mapped[0] || appearances[0];
    const matchedParts = [...new Set(appearances.flatMap(q => q.parts.filter(p => p.codes.some(c => selected.has(c))).map(p => p.label)))];
    entries.push({key, question, matchingCodes, matchedParts, otherParts: matchingCodes.length ? question.parts.filter(p => !matchedParts.includes(p.label)).map(p => p.label) : []});
  }
  const position = new Map(state.order.map((key,i) => [key,i]));
  return entries.sort((a,b) => state.manuallyOrdered
    ? (position.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.key) ?? Number.MAX_SAFE_INTEGER)
    : compareAccessibility(a.question,b.question));
}

export const hasDraftIntent = (state: PaperDraft) => !!(state.codes.length || Object.keys(state.manual).length);
