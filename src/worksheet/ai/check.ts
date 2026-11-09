import { renderResource, type Issue, type Resource } from "../../../packages/resource-core/src/index";
import { parseSubmission, SubmissionError, type Submission } from "./brief";

export type Checked = { ok: true; submission: Submission; resource: Resource } | { ok: false; feedback: string; submission?: Submission; issues?: Issue[] };

const where = (i: Issue) => [i.side && `side ${i.side}`, i.column && `column ${i.column}`, i.question && `question ${i.question}`].filter(Boolean).join(", ");

/** The same checks the editor and MCP tool apply: schema first, then the fixed A3 layout. */
export function checkSubmission(input: unknown): Checked {
  let submission: Submission;
  try {
    submission = parseSubmission(input);
  } catch (e) {
    const detail = e instanceof SubmissionError ? e.message : String(e);
    return { ok: false, feedback: `The worksheet does not match the schema. Fix these and submit again:\n${detail}` };
  }
  const { issues } = renderResource(submission.resource, { view: "pupil" });
  if (issues.length) {
    const list = issues.map((i) => `- ${where(i) ? `${where(i)}: ` : ""}${i.message}`).join("\n");
    return {
      ok: false,
      submission,
      issues,
      feedback: `The worksheet does not fit two A3 sides yet. Text never shrinks. Move a card to a column with room, trim wording or reduce working space, keeping every planned question, then submit again:\n${list}`,
    };
  }
  return { ok: true, submission, resource: submission.resource };
}
