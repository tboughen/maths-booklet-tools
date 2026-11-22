import { normalizeCode, questionIdentity, type BankCatalogue, type BankListQuestion } from "./model";
import type { Coverage } from "./coverage";
import { compareAccessibility } from "./performance";

/** `partsOnly`: print only the parts that match the ticked codes (with the parts and stems they need), not whole questions. */
export interface PaperDraft { codes: string[]; manual: Record<string,string>; excluded: string[]; order: string[]; version: string; manuallyOrdered?: boolean; partsOnly?: boolean }
export interface PaperEntry<Q extends BankListQuestion = BankListQuestion> { key: string; question: Q; matchingCodes: string[]; matchedParts: string[]; otherParts: string[] }
export const emptyDraft = (version = ""): PaperDraft => ({codes: [], manual: {}, excluded: [], order: [], version});
export type DraftAction =
  | {type: "code"; code: string; checked: boolean}
  | {type: "question"; question: BankListQuestion; checked: boolean}
  | {type: "add"; questions: BankListQuestion[]}
  /** Adds a whole paper in its own question order: those questions go first, as if ordered by hand. */
  | {type: "paper"; questions: BankListQuestion[]; visible: string[]}
  | {type: "exclude"; key: string}
  | {type: "restore"}
  | {type: "partsOnly"; value: boolean}
  | {type: "clear"}
  | {type: "remember"; keys: string[]}
  | {type: "move"; key: string; direction: number; visible: string[]}
  | {type: "reconcile"; catalogue: BankCatalogue<BankListQuestion>};

export function draftReducer(state: PaperDraft, action: DraftAction): PaperDraft {
  switch (action.type) {
    case "code": return {...state, codes: action.checked ? [...new Set([...state.codes, action.code])] : state.codes.filter(c => c !== action.code)};
    case "question": {
      const key = questionIdentity(action.question);
      return action.checked ? {...state, manual: {...state.manual, [key]: action.question.id}, excluded: state.excluded.filter(k => k !== key)} : {...state, excluded: [...new Set([...state.excluded, key])]};
    }
    case "add": return action.questions.reduce((s, question) => draftReducer(s, {type: "question", question, checked: true}), state);
    case "paper": {
      const added = draftReducer(state, {type: "add", questions: action.questions}), keys = [...new Set(action.questions.map(questionIdentity))];
      // Anything already on the paper keeps the order it has on screen (`visible`), after the paper's questions.
      const rest = [...action.visible, ...state.order];
      return {...added, order: [...keys, ...rest.filter(k => !keys.includes(k))], manuallyOrdered: true};
    }
    case "exclude": return {...state, excluded: [...new Set([...state.excluded, action.key])]};
    case "restore": return {...state, excluded: []};
    case "partsOnly": { const {partsOnly: _old, ...rest} = state; void _old; return action.value ? {...rest, partsOnly: true} : rest; }
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

export function draftEntries<Q extends BankListQuestion>(coverage: Coverage<Q>, state: PaperDraft): PaperEntry<Q>[] {
  const entries: PaperEntry<Q>[] = [], selected = new Set(state.codes), excluded = new Set(state.excluded);
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
    // A crossover pair labels its parts differently ("21a" on one tier, "a" on the other), so a part
    // matched on either appearance is named by the chosen question's label in the same position.
    const matchedAt = new Set(appearances.flatMap(q => q.parts.length === question.parts.length ? q.parts.flatMap((p, i) => p.codes.some(c => selected.has(c)) ? [i] : []) : []));
    const matchedParts = question.parts.filter((p, i) => matchedAt.has(i) || p.codes.some(c => selected.has(c))).map(p => p.label);
    entries.push({key, question, matchingCodes, matchedParts, otherParts: matchingCodes.length ? question.parts.filter(p => !matchedParts.includes(p.label)).map(p => p.label) : []});
  }
  const position = new Map(state.order.map((key,i) => [key,i]));
  return entries.sort((a,b) => state.manuallyOrdered
    ? (position.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.key) ?? Number.MAX_SAFE_INTEGER)
    : compareAccessibility(a.question,b.question));
}

export const hasDraftIntent = (state: PaperDraft) => !!(state.codes.length || Object.keys(state.manual).length);

/** The catalogue parts of each entry that would print on their own: only entries matched by code with other parts left over. */
export function entryParts(entries: PaperEntry[]): Record<string, string[]> {
  return Object.fromEntries(entries.filter(e=>e.matchingCodes.length&&e.otherParts.length).map(e=>[e.question.id,e.matchedParts.filter(l=>e.question.parts.some(p=>p.label===l))]).filter(([,labels])=>labels.length));
}
