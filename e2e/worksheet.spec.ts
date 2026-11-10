import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { comparativeBarCharts, treeDiagrams } from "../packages/resource-core/src/fixtures";
import type { Resource } from "../packages/resource-core/src/index";

const key = "maths-booklet-tools:worksheet:v1";
const out = resolve("test-results/worksheet-artifacts");
mkdirSync(out, { recursive: true });

async function boot(page: Page, r?: Resource) {
  if (r) await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(r)]);
  await page.goto("/worksheets");
  await expect(page.getByTestId("worksheet-pages").locator(".ws-art > svg")).toHaveCount(2);
}
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key) as Promise<Resource>;
const question = (page: Page, n: number) => page.locator("details.ws-card", { has: page.locator(".ws-q", { hasText: new RegExp(`^${n}$`) }) });

test("edits wording, saves it, shows it on the sheet and undoes", async ({ page }) => {
  await boot(page);
  await question(page, 1).locator("summary").click();
  const title = page.getByRole("textbox", { name: "Question 1 title" });
  await title.fill("Read the tree diagram");
  await title.press("Enter");
  expect((await saved(page)).document.sides[0].columns[0].cards[0].title).toBe("Read the tree diagram");
  await expect(page.getByTestId("worksheet-pages").locator(".ws-art > svg").first()).toContainText("Read the tree diagram");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.sides[0].columns[0].cards[0].title).toBe(treeDiagrams.document.sides[0].columns[0].cards[0].title);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(title).toHaveValue("Read the tree diagram");
});

test("switches a table cell between given, blank and hidden answer without losing its text", async ({ page }) => {
  await boot(page, comparativeBarCharts);
  await question(page, 3).locator("summary").click();
  const state = page.getByRole("combobox", { name: "Row 1 cell 2 shows" }).first();
  await state.selectOption("hidden");
  let cell = (await saved(page)).document.sides[0].columns[1].cards[0].items.find((i) => i.type === "table");
  expect(cell && cell.type === "table" && cell.rows[0][1]).toEqual({ text: "6", state: "hidden" });
  // Pupils see an empty box; the teacher preview shows the saved answer.
  const side1 = page.getByTestId("worksheet-pages").locator(".ws-art > svg").first();
  await page.getByLabel("Teacher preview: show hidden answers").check();
  await expect(side1.locator('text[fill="#b0125b"]', { hasText: /^6$/ })).toHaveCount(1);
  await page.getByLabel("Teacher preview: show hidden answers").uncheck();
  await expect(side1.locator('text[fill="#b0125b"]')).toHaveCount(0);
  await state.selectOption("blank");
  cell = (await saved(page)).document.sides[0].columns[1].cards[0].items.find((i) => i.type === "table");
  expect(cell && cell.type === "table" && cell.rows[0][1]).toEqual({ text: "6", state: "blank" });
});

test("reports overflow, blocks the PDF and recovers when a question moves", async ({ page }) => {
  await boot(page, treeDiagrams);
  await expect(page.locator(".ws-checks li.problem")).toHaveCount(0);
  await question(page, 4).locator("summary").click();
  const space = page.getByRole("spinbutton", { name: /drawing space/ }).first();
  await space.fill("200");
  await space.press("Enter");
  await expect(page.locator(".ws-checks li.problem")).toContainText("needs");
  await expect(page.getByRole("button", { name: "Pupil PDF" })).toBeDisabled();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".ws-checks li.problem")).toHaveCount(0);
  await page.getByRole("button", { name: "Move question 4 up" }).click();
  const doc = await saved(page);
  expect(doc.document.sides[0].columns[1].cards[0].title).toBe("Draw a tree diagram");
});

test("downloads two-page A3 vector PDFs named by the guide and opens a saved file", async ({ page }) => {
  await boot(page, treeDiagrams);
  const [pupil] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Pupil PDF" }).click()]);
  expect(pupil.suggestedFilename()).toBe("SP7.01_List outcomes of combined events using a tree diagram_A3.pdf");
  const file = resolve(out, "pupil.pdf");
  await pupil.saveAs(file);
  const bytes = readFileSync(file);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo((420 * 72) / 25.4, 1);
  expect(bytes.toString("latin1")).toContain("/FontFile2");
  expect(bytes.toString("latin1")).not.toContain("/Subtype /Image");

  const changed = structuredClone(comparativeBarCharts);
  const upload = resolve(out, "upload.json");
  writeFileSync(upload, JSON.stringify(changed));
  await page.getByRole("button", { name: "File" }).click();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("menuitem", { name: "Open worksheet file" }).click()]);
  await chooser.setFiles(upload);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  expect((await saved(page)).document.title).toBe("Comparative bar charts");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.title).toBe(treeDiagrams.document.title);
});

// The AI maker talks straight to the provider with the teacher's key; here the provider is a recorded-shape stream.
function claudeStream(input: unknown) {
  const json = JSON.stringify(input);
  const ev = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return [
    ev("message_start", { message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 9000, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 20000 } } }),
    ev("content_block_start", { index: 0, content_block: { type: "tool_use", id: "toolu_1", name: "submit_worksheet", input: {} } }),
    ev("content_block_delta", { index: 0, delta: { type: "input_json_delta", partial_json: json } }),
    ev("content_block_stop", { index: 0 }),
    ev("message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 12000 } }),
    ev("message_stop", {}),
  ].join("");
}

test("makes a worksheet from a scheme objective with the teacher's own Claude key, then undoes it", async ({ page }) => {
  const scheme = { schemaVersion: 1, kind: "scheme-of-work", name: "Department scheme", units: [{ code: "SP2", title: "Presentation of data", years: [8], objectives: [{ code: "SP2.06", level: "C", text: "Construct and interpret comparative bar charts" }] }] };
  // A release names the scheme by its immutable object; the page follows the index.
  const object = `bank/assets/sha256/${"a".repeat(64)}.json`;
  await page.route("**/bank/schemes.json", (route) => route.fulfill({ json: { schemaVersion: 1, school: object } }));
  await page.route(`**/${object}`, (route) => route.fulfill({ json: scheme }));
  const sent: { headers: Record<string, string>; body: { messages: { content: string }[]; model: string } }[] = [];
  await page.route("https://api.anthropic.com/**", async (route) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, GET, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    sent.push({ headers: route.request().headers(), body: route.request().postDataJSON() });
    await route.fulfill({ headers: { ...cors, "content-type": "text/event-stream" }, body: claudeStream({ plan: "Read, then complete, then build comparative bar charts.", flags: "Assumed no calculator.", resource: comparativeBarCharts }) });
  });
  await boot(page, treeDiagrams);
  const ai = page.getByRole("region", { name: "Make with AI" });
  await ai.getByLabel("Your API key").fill("sk-ant-api03-test-key-0000000000000000");
  await ai.getByLabel("Unit").selectOption("SP2");
  await ai.getByRole("combobox", { name: /^Objective\b/ }).selectOption("SP2.06");
  await expect(ai.getByLabel("Objective code")).toHaveValue("SP2.06");
  await expect(ai.getByLabel("Year or tier")).toHaveValue("Year 8");
  await ai.getByRole("button", { name: "Make worksheet" }).click();
  await expect(page.locator(".ws-message")).toContainText("New worksheet made by claude-opus-5-5");
  expect((await saved(page)).document.title).toBe("Comparative bar charts");
  expect(sent).toHaveLength(1);
  expect(sent[0].headers.authorization).toBe("Bearer sk-ant-api03-test-key-0000000000000000");
  expect(sent[0].headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  expect(sent[0].body.messages[0].content).toContain("Objective code: SP2.06");
  await ai.getByText("Teacher notes from the AI").click();
  await expect(ai).toContainText("Assumed no calculator.");
  await expect(ai).toContainText("about $0.");
  await expect(ai).toContainText("Spent in this tab: about $0.");
  // The key stays in this tab only, and never in the worksheet.
  const stored = await page.evaluate(() => ({ local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage) }));
  expect(stored.local).not.toContain("sk-ant-api03");
  expect(stored.session).toContain("sk-ant-api03");
  await page.getByRole("button", { name: "Undo" }).click();
  expect((await saved(page)).document.title).toBe(treeDiagrams.document.title);
});

test("makes a worksheet with a Gemini key and keeps a running cost for this tab", async ({ page }) => {
  const sent: { url: string; headers: Record<string, string> }[] = [];
  await page.route("https://generativelanguage.googleapis.com/**", async (route) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, GET, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    sent.push({ url: route.request().url(), headers: route.request().headers() });
    const args = { plan: "Read, then complete, then build.", flags: "", resource: comparativeBarCharts };
    const chunk = { candidates: [{ content: { role: "model", parts: [{ functionCall: { id: "c1", name: "submit_worksheet", args }, thoughtSignature: "s1" }] }, finishReason: "STOP" }], modelVersion: "gemini-3.8-flash", usageMetadata: { promptTokenCount: 20000, cachedContentTokenCount: 0, candidatesTokenCount: 30000, thoughtsTokenCount: 10000 } };
    await route.fulfill({ headers: { ...cors, "content-type": "text/event-stream" }, body: `data: ${JSON.stringify(chunk)}\n\n` });
  });
  await boot(page, treeDiagrams);
  const ai = page.getByRole("region", { name: "Make with AI" });
  await ai.getByLabel("AI provider").selectOption("gemini");
  await ai.getByLabel("Your API key").fill("AIzaSyTest0000000000000000000000000000");
  await ai.getByLabel("Model").fill("gemini-3.8-flash");
  await expect(ai.getByRole("link", { name: "Google AI Studio usage page" })).toBeVisible();
  await ai.getByLabel("Learning objective").fill("Construct and interpret comparative bar charts");
  await ai.getByRole("button", { name: "Make worksheet" }).click();
  await expect(page.locator(".ws-message")).toContainText("New worksheet made by gemini-3.8-flash");
  expect(sent).toHaveLength(1);
  expect(sent[0].url).toContain("gemini-3.8-flash:streamGenerateContent");
  expect(sent[0].headers["x-goog-api-key"]).toBe("AIzaSyTest0000000000000000000000000000");
  // 20k input at $0.75 and 40k output (with thinking) at $3.75 per million tokens.
  await expect(ai).toContainText("Spent in this tab: about $0.17 over 1 AI reply");
  await page.reload();
  await expect(page.getByRole("region", { name: "Make with AI" })).toContainText("about $0.17 over 1 AI reply");
  await page.getByRole("region", { name: "Make with AI" }).getByRole("button", { name: "Reset" }).click();
  await expect(page.getByRole("region", { name: "Make with AI" })).not.toContainText("Spent in this tab");
});
