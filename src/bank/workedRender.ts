// The worked-solution renderer as the bank page loads it on demand (see worked.ts).
import handFont from "../assets/fonts/ShantellSans-Worked.woff2?url";
import { HAND_FAMILY, layoutWorked, parseWorked, type WorkedData } from "../../packages/worked-core/src/index";
import type { BankQuestion } from "./model";
import { assetUrl } from "./pdf";
import type { WorkedOptions, WorkedPlan, WorkedShown } from "./worked";

let font: Promise<void> | undefined;
/** The handwriting font, added to the page once. Working still lays out correctly without it. */
export function loadHandFont(): Promise<void> {
  font ??= typeof FontFace === "undefined" ? Promise.resolve() : new FontFace(HAND_FAMILY, `url(${handFont}) format("woff2")`, { display: "block" })
    .load().then(face => { document.fonts.add(face); }).catch(() => undefined);
  return font;
}

const files = new Map<string, Promise<WorkedData>>();
async function sha256(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}

/** A question's steps file, checked against the catalogue's hash and question revision. */
export function fetchWorked(question: BankQuestion): Promise<WorkedData> {
  const solution = question.workedSolution;
  if (!solution || solution.basedOnQuestionRevision !== question.revision) return Promise.reject(new Error("Worked solution is not available for this question revision."));
  const key = `${solution.data}|${solution.dataSha256}`;
  let pending = files.get(key);
  if (!pending) {
    pending = fetch(assetUrl(solution.data)).then(async response => {
      if (!response.ok) throw new Error("The worked solution could not load.");
      const bytes = await response.arrayBuffer();
      if (await sha256(bytes) !== solution.dataSha256) throw new Error("The worked solution file has changed since the catalogue was built. Reload the page.");
      const data = parseWorked(JSON.parse(new TextDecoder().decode(bytes)));
      if (data.questionId !== question.id || data.questionRevision !== question.revision) throw new Error("The worked solution was written for a different question.");
      return data;
    });
    pending.catch(() => files.delete(key));
    files.set(key, pending);
  }
  return pending;
}

export async function layoutQuestionWorked(question: BankQuestion, plan: WorkedPlan, options: WorkedOptions): Promise<WorkedShown> {
  const [data] = await Promise.all([fetchWorked(question), loadHandFont()]);
  const surfaces = plan.items.map(item => ({ id: item.view.id, width: item.view.width, height: item.view.height }));
  const layout = layoutWorked(data, surfaces, { parts: surfaces.map(s => s.id), total: plan.total, marks: options.marks, upTo: options.upTo });
  return {
    items: plan.items.map(item => ({ ...item, overlay: layout.overlays.get(item.view.id) })),
    steps: layout.steps,
    issues: layout.issues.map(issue => `${issue.surface}: ${issue.message}`),
  };
}
