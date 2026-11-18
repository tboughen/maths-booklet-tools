// @vitest-environment node
import { expect, it } from "vitest";
import { join } from "node:path";
import { worksheetPdf } from "../../../services/graph-mcp/worksheet-pdf";
import { year8Run, year9Run } from "./starter-fixtures";
import { renderStarterRun, validateStarterRun } from "./index";

// A tiny valid PNG (1 × 1 pixel).
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

it("makes a vector PDF of the A4 sheets and the A5 cards, logo included", async () => {
  const eight = structuredClone(year8Run);
  eight.document.logo = PNG;
  const a = renderStarterRun(validateStarterRun(eight));
  const b = renderStarterRun(validateStarterRun(structuredClone(year9Run)), { view: "answers" });
  const roots = { text: join(process.cwd(), "assets/resource-fonts"), diagrams: join(process.cwd(), "assets/graph-fonts") };
  // worksheetPdf re-opens and audits the PDF (page count and sizes, embedded fonts, nothing rasterised) and throws on a problem.
  const pdf = await worksheetPdf([...a.sheets, ...b.sheets, ...b.cards], "Silent starters", roots);
  expect(pdf.byteLength).toBeGreaterThan(10_000);
}, 60_000);
