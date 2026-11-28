// Resource library (docs/content/RESOURCE-LIBRARY.md): years, units in teaching order with a ring of
// lesson states, the chosen unit's versions, parts, lessons, history and feedback on the right, a
// search above and a Map view. The list and feedback are served behind staff sign-in, so these checks
// stand in a copy of the list (e2e/fixtures/library.json) and a pretend feedback service.
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "./release-fixtures";

const fixture = readFileSync(new URL("./fixtures/library.json", import.meta.url), "utf8");
type Sent = Record<string, unknown>;
const thread = (over: Sent) => ({ number: 7, year: 9, unit: "A7", version: "Main", lesson: "A7.04", kind: "lesson", queued: false, agreed: false, opened: "2026-11-25T09:00:00Z", comments: [{ who: "Sam Jones", when: "2026-11-25T09:00:00Z", text: "Question 12 needs a whole-number example first." }], ...over });
async function open(page: Page, address = "/library", { threads = [thread({})] as Sent[], canAct = true, feedback = true, list = fixture } = {}) {
  const sent: Sent[] = [], checks: Record<string, Sent> = {};
  await page.route("**/library-data/library.json", (route) => route.fulfill({ contentType: "application/json", body: list }));
  await page.route("**/library-data/files/**", (route) => route.fulfill({ contentType: "application/pdf", body: "%PDF-1.7" }));
  await page.route("**/api/library/feedback", async (route) => {
    if (!feedback) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Feedback isn't switched on yet." }) });
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      sent.push(body);
      if (body.action === "check") checks[body.id] = { updated: body.updated, by: "Tim Boughen", at: "2026-11-25T12:00:00Z" };
      if (body.action === "uncheck") delete checks[body.id];
      return route.fulfill({ contentType: "application/json", body: '{"ok":true}' });
    }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ threads, checks, canAct, me: "Tim Boughen" }) });
  });
  await page.goto(address);
  return { main: page.getByRole("main"), sent };
}

test("a year shows rings in teaching order and a unit shows its parts, versions, lessons and history", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { main } = await open(page);
  await expect(main.getByRole("heading", { level: 1, name: "Resource library" })).toBeVisible();
  await main.getByRole("navigation", { name: "Years" }).getByRole("button", { name: /^Year 9/ }).click();
  const units = main.getByRole("region", { name: "Year 9 units" });
  await expect(units.getByRole("heading", { name: "Autumn term (estimate)" })).toBeVisible();
  await expect(units.locator(".library-unit-code").first()).toHaveText("NP13");
  await expect(units.getByRole("button", { name: /^NP14/ })).toHaveClass(/is-empty/);
  const a7 = units.getByRole("button", { name: /^Now A7/ });
  await expect(a7).toContainText("1 feedback");
  await expect(a7.locator(".library-pills")).toHaveText("Foundation");
  await expect(a7.locator("circle.is-feedback")).toHaveCount(1);
  await expect(units.getByRole("heading", { name: "Also for Year 9" })).toBeVisible();
  await a7.click();
  await expect(page).toHaveURL(/\/library\?year=9&unit=A7$/);
  const detail = main.getByRole("complementary", { name: "Unit resources" });
  await expect(detail.getByRole("heading", { level: 2 })).toHaveText("A7 Algebraic proficiency: visualising");
  await expect(detail.locator(".library-part-head").first()).toContainText("Part 1 · A7.01 to A7.07");
  const answers = detail.getByRole("link", { name: "Answers PDF" }).first();
  expect(await answers.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(176, 18, 91)");
  await expect(answers).toHaveAttribute("href", /^\/library-data\/files\/[a-f0-9]{64}\//);
  const a704 = detail.locator(".library-rows > li").filter({ hasText: "A7.04" });
  await expect(a704).toHaveClass(/is-feedback/);
  await expect(a704.getByRole("group", { name: "Feedback on A7.04" })).toContainText("Sam Jones");
  await a704.getByRole("button", { name: "1 earlier version" }).click();
  await expect(a704.locator(".library-history")).toContainText("First booklet version");
  await expect(detail.locator(".library-part-label")).toHaveText(["Part 1", "Part 2"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  await page.screenshot({ path: test.info().outputPath("library-shelves.png") });

  await detail.getByRole("group", { name: "Versions" }).getByRole("button", { name: "Foundation" }).click();
  await expect(page).toHaveURL(/year=9&unit=A7&version=Foundation$/);
  await expect(detail.locator(".library-rows > li.is-waiting")).toHaveCount(2);
  await expect(detail).toContainText("Each version sits alongside the main one");
  await page.goBack();
  await expect(page).toHaveURL(/\/library\?year=9$/);
  await expect(detail).toContainText("Choose a unit");
  // The open unit closes when clicked again, or when empty space among the units is clicked.
  await a7.click();
  await expect(page).toHaveURL(/year=9&unit=A7$/);
  await a7.click();
  await expect(page).toHaveURL(/\/library\?year=9$/);
  await a7.click();
  await units.getByRole("heading", { name: "Year 9", exact: true }).click();
  await expect(detail).toContainText("Choose a unit");
});

test("staff comment on a lesson and the editor queues it, closes it or brings back an earlier version", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { main, sent } = await open(page, "/library?year=9&unit=A7");
  const detail = main.getByRole("complementary", { name: "Unit resources" });
  const a704 = detail.locator(".library-rows > li").filter({ hasText: "A7.04" });
  const box = a704.getByRole("group", { name: "Feedback on A7.04" });
  await box.getByRole("textbox", { name: "Add a comment" }).fill("Agreed, page 3.");
  await box.getByRole("button", { name: "Send" }).click();
  await expect(box.getByRole("status")).toHaveText("Comment added.");
  await box.getByRole("button", { name: "Queue for tonight" }).click();
  await a704.getByRole("button", { name: "1 earlier version" }).click();
  await a704.getByRole("button", { name: "Make current again" }).click();
  await expect.poll(() => sent.map((s) => s.action)).toEqual(["comment", "queue", "restore"]);
  expect(sent[0]).toMatchObject({ year: 9, unit: "A7", version: "Main", lesson: "A7.04", text: "Agreed, page 3." });
  expect(sent[2]).toMatchObject({ lesson: "A7.04", updated: "2026-11-17" });

  await detail.getByRole("button", { name: "Feedback on this unit" }).click();
  const unitBox = detail.getByRole("group", { name: "Feedback on this unit" });
  await expect(unitBox).toContainText("Unit comments never go in the nightly queue");
  await main.getByRole("button", { name: /Feedback to act on/ }).click();
  const drawer = page.getByRole("dialog", { name: "Feedback to act on" });
  await expect(drawer).toContainText("Y9 · A7.04");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("an editor sets the status switch to Checked and the lesson turns green at once, and Waiting undoes it", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { main, sent } = await open(page, "/library?year=9&unit=A7", { threads: [] });
  const detail = main.getByRole("complementary", { name: "Unit resources" });
  const a700 = detail.locator(".library-rows > li").filter({ hasText: "A7.00" });
  await expect(a700).toHaveClass(/is-waiting/);
  const status = a700.getByRole("group", { name: "Status of A7.00" });
  await expect(status.getByRole("button", { name: "Waiting" })).toHaveAttribute("aria-pressed", "true");
  await status.getByRole("button", { name: "Feedback" }).click();
  await expect(status.getByRole("button", { name: "Feedback" })).toHaveAttribute("aria-pressed", "true");
  await a700.getByRole("button", { name: "Cancel" }).click();
  await expect(status.getByRole("button", { name: "Waiting" })).toHaveAttribute("aria-pressed", "true");
  await expect(a700.getByRole("group", { name: "Feedback on A7.00" })).toHaveCount(0);
  await status.getByRole("button", { name: "Checked" }).click();
  await expect(a700).toHaveClass(/is-ready/);
  await expect(a700).toContainText("Checked by Tim Boughen");
  await expect(status.getByRole("button", { name: "Checked" })).toHaveAttribute("aria-pressed", "true");
  expect(sent[0]).toMatchObject({ action: "check", year: 9, unit: "A7", version: "Main", lesson: "A7.00", id: "y9-a7-00-lesson-booklet", updated: "2026-11-22" });
  await status.getByRole("button", { name: "Waiting" }).click();
  await expect(a700).toHaveClass(/is-waiting/);
  await expect.poll(() => sent.map((s) => s.action)).toEqual(["check", "uncheck"]);
});

test("anyone deletes their own comment with Undo, asks for a lesson not made yet, and a unit booklet has its own switch", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const mine = thread({ comments: [{ id: 5, who: "Tim Boughen", when: "2026-11-25T09:00:00Z", text: "Page 3 typo.", mine: true }, { id: 6, who: "Sam Jones", when: "2026-11-25T09:05:00Z", text: "Agreed." }] });
  const { main, sent } = await open(page, "/library?year=9&unit=A7", { threads: [mine] });
  const detail = main.getByRole("complementary", { name: "Unit resources" });
  const box = detail.getByRole("group", { name: "Feedback on A7.04" });
  await expect(box.getByRole("button", { name: /Delete your comment/ })).toHaveCount(1);
  await box.getByRole("button", { name: /Delete your comment/ }).click();
  await expect(box).toContainText("Comment deleted");
  await box.getByRole("button", { name: "Undo" }).click();
  await expect(box).toContainText("Page 3 typo.");
  await box.getByRole("button", { name: /Delete your comment/ }).click();
  await expect.poll(() => sent.map((s) => s.action), { timeout: 9000 }).toEqual(["delete"]);
  expect(sent[0]).toMatchObject({ lesson: "A7.04", comment: 5 });
  const booklet = detail.locator(".library-row.is-booklet").first();
  await expect(booklet.getByRole("group", { name: /^Status of / })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("library-switch.png") });
  await main.getByRole("navigation", { name: "Years" }).getByRole("button", { name: /^Year 9/ }).click();
  await main.getByRole("region", { name: "Year 9 units" }).getByRole("button", { name: /^NP14/ }).click();
  const none = detail.locator(".library-rows > li").filter({ hasText: "NP14.01" });
  await none.getByRole("button", { name: "Ask for this" }).click();
  await none.getByRole("textbox", { name: "Add a comment" }).fill("9X need it by Friday.");
  await none.getByRole("button", { name: "Send" }).click();
  await expect(none.getByRole("status")).toHaveText("Asked. It shows in Feedback to act on.");
  expect(sent.at(-1)).toMatchObject({ action: "comment", lesson: "NP14.01", text: "9X need it by Friday." });
});

test("colleagues who are not editors can comment but not queue, and feedback that is off says so", async ({ page }) => {
  const { main } = await open(page, "/library?year=9&unit=A7", { canAct: false });
  const detail = main.getByRole("complementary", { name: "Unit resources" });
  const box = detail.getByRole("group", { name: "Feedback on A7.04" });
  await expect(box.getByRole("button", { name: "Send" })).toBeVisible();
  await expect(box.getByRole("button", { name: "Queue for tonight" })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Checked" })).toHaveCount(0);
  await page.unroute("**/api/library/feedback");
  await page.unroute("**/library-data/**");
  const off = await open(page, "/library?year=9&unit=A7", { feedback: false });
  await expect(off.main.getByRole("complementary", { name: "Unit resources" })).toContainText("Feedback isn't switched on yet.");
  await expect(off.main.getByRole("button", { name: /Feedback to act on/ })).toHaveCount(0);
});

test("search finds booklets across years and opens their unit", async ({ page }) => {
  const { main } = await open(page);
  await expect(main.getByRole("heading", { level: 2, name: "Year 7" })).toBeVisible();
  await page.keyboard.press("/");
  const box = main.getByRole("searchbox", { name: "Search the library" });
  await expect(box).toBeFocused();
  await page.keyboard.type("pie charts");
  const results = main.getByRole("region", { name: "Search results" });
  await expect(results).toContainText("SP8.07");
  await expect(results.getByRole("status")).toHaveText(/^\d+ booklets? found$/);
  await results.getByRole("button", { name: /Year 10 · SP8/ }).first().click();
  await expect(page).toHaveURL(/year=10&unit=SP8/);
  await expect(main.getByRole("complementary", { name: "Unit resources" }).getByRole("heading", { level: 2 })).toContainText("SP8");
  await box.fill("zzzz");
  await expect(main.getByRole("status")).toContainText("Nothing matches");
});

test("the Map view shows every unit's lessons as squares, one row per version, and opens a unit", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { main } = await open(page, "/library?view=map");
  const map = main.getByRole("region", { name: "Scheme map" });
  await expect(map.getByRole("heading", { level: 2 })).toHaveText(["Year 7", "Year 8", "Year 9", "Year 10", "Year 11"]);
  const a7 = map.getByRole("button", { name: /^A7 Algebraic proficiency: visualising: \d+ of \d+ ready/ });
  await expect(a7.locator(".library-map-version")).toHaveCount(2);
  await expect(map.getByRole("button", { name: /^NP14 .*: nothing yet$/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("library-map.png") });
  await a7.click();
  await expect(page).toHaveURL(/year=9&unit=A7/);
  await expect(main.getByRole("button", { name: "Shelves" })).toHaveAttribute("aria-pressed", "true");
});

test("a list that cannot be loaded says so, and narrow screens do not spill sideways", async ({ page }) => {
  await page.route("**/library-data/library.json", (route) => route.fulfill({ status: 403, body: "" }));
  await page.goto("/library");
  await expect(page.getByRole("alert")).toHaveText("Sign in again to see the library.");
  await page.unroute("**/library-data/library.json");
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/library?year=9&unit=A7");
  await expect(page.getByRole("complementary", { name: "Unit resources" })).toContainText("A7.03");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("a teacher gives the class, room and date, describes a cover lesson, checks it against the scheme and presses Build now", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const sent: Sent[] = [];
  const log = [{ number: 40, when: new Date(Date.now() - 3600000).toISOString(), year: 9, tier: "Higher", who: "Ann Lee", mine: false, text: "Mock revision for Paper 3.", state: "ready" }];
  await page.route("**/api/library/cover", async (route) => {
    if (route.request().method() === "POST") {
      sent.push(route.request().postDataJSON());
      const b = sent[0] as { className: string; room: string; date: string };
      log.unshift({ number: 41, when: new Date().toISOString(), year: 10, tier: "Foundation", className: b.className, room: b.room, date: b.date, who: "Sam Jones", mine: true, text: "We're on NP17, lesson 3.", state: "building" } as (typeof log)[number]);
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ number: 41, started: true }) });
    }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ requests: log, building: true }) });
  });
  const { main } = await open(page, "/library?view=cover");
  const form = main.locator(".cover-form");
  await expect(form.getByRole("heading", { name: "Create cover booklet" })).toBeVisible();
  await expect(main.locator(".cover-log").getByRole("heading", { name: "Cover library" })).toBeVisible();
  await expect(main.locator(".cover-log")).toContainText("Ann Lee");
  // The date starts on the next weekday.
  const date = form.getByLabel("Date");
  const next = await date.inputValue();
  expect(new Date(`${next}T12:00:00`).getDay()).not.toBe(0);
  expect(new Date(`${next}T12:00:00`).getDay()).not.toBe(6);
  await expect(form.getByRole("button", { name: "Check and build" })).toBeDisabled();
  await form.getByRole("button", { name: "Revise our unit up to a lesson" }).click();
  await expect(form.locator("#cover-text")).toHaveValue("We're on unit … , lesson … . Revise the lessons so far.");
  await form.locator("#cover-text").fill("We're on NP17, lesson 3. Revise the lessons so far.");
  await form.getByRole("radio", { name: "Foundation" }).check();
  await form.getByRole("checkbox", { name: "This is cover work for myself or a colleague." }).check();
  // Class and room are required before it builds.
  await expect(form.getByRole("button", { name: "Check and build" })).toBeDisabled();
  await form.getByLabel("Class (e.g. 10X2)").fill("10X2");
  await expect(form.getByRole("button", { name: "Check and build" })).toBeDisabled();
  await expect(form).toContainText("Give the room.");
  await form.getByLabel("Room (e.g. M4)").fill("M4");
  await form.getByRole("button", { name: "Check and build" }).click();
  const check = form.getByRole("region", { name: "Check before building" });
  await expect(check).toContainText("Year 10 Foundation revising NP17.01 to NP17.03");
  await page.screenshot({ path: test.info().outputPath("library-cover.png") });
  await check.getByRole("button", { name: "Yes, build it" }).click();
  await expect(form.getByRole("status")).toContainText("Building your cover booklet now");
  expect(sent).toEqual([{ year: 10, tier: "Foundation", className: "10X2", room: "M4", date: next, absent: true, text: "We're on NP17, lesson 3. Revise the lessons so far.", plan: expect.stringContaining("NP17.01 to NP17.03"), attachment: null }]);
  const first = main.locator(".cover-log li").first();
  await expect(first).toContainText("Class 10X2 · Room M4");
  await expect(first).toContainText("You");
  await page.screenshot({ path: test.info().outputPath("library-cover-sent.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("cover booklets live only in the Cover library: newest date first, PDFs, a 7-day fold and Delete for editors", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const data = JSON.parse(fixture);
  const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const pdf = (id: string, role: string) => ({ role, format: "pdf", name: `${id}_${role}.pdf`, bytes: 1, href: `library-data/files/${id}_${role}.pdf` });
  const cover = (id: string, title: string, note: string) => ({ id, year: 9, unit: "REVIEW", version: "Main", title, type: "revision-lesson", status: "waiting", updated: day(-1), note, files: [pdf(id, "pupil"), pdf(id, "answers")], history: [] });
  data.resources.push(cover("y9-cover-41", "Cover lesson 41", `Cover request #41. Class 9H1, room M4, ${day(1)}.`), cover("y9-cover-30", "Cover lesson 30", "Cover lesson, 2026-11-01"));
  const log = [{ number: 41, when: new Date().toISOString(), year: 9, tier: "Higher", className: "9H1", room: "M4", date: day(1), who: "Ann Lee", mine: false, text: "Mock revision", state: "ready" },
    { number: 42, when: new Date().toISOString(), year: 10, tier: "Foundation", className: "10X2", room: "S2", date: day(3), who: "Sam Jones", mine: true, text: "NP17", state: "building" }];
  const sent: Sent[] = [];
  let removed: string[] = [];
  await page.route("**/api/library/cover*", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      sent.push(body);
      removed = [...removed, body.id];
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, removed }) });
    }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(new URL(route.request().url()).searchParams.get("only") === "removed" ? { removed, canDelete: true } : { requests: log, building: true }) });
  });
  // Not on the shelf.
  const { main } = await open(page, "/library?year=9&unit=REVIEW", { list: JSON.stringify(data) });
  await expect(main).not.toContainText("Cover lesson 41");
  await expect(main.getByRole("button", { name: /Delete cover/ })).toHaveCount(0);
  await main.getByRole("button", { name: "Request cover booklet" }).click();
  const lib = main.locator(".cover-log");
  const items = lib.locator(":scope > ul > li");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Class 10X2 · Room S2");
  await expect(items.nth(0)).toContainText("Building");
  await expect(items.nth(1)).toContainText("Class 9H1 · Room M4");
  await expect(items.nth(1)).toContainText("Ready");
  await expect(items.nth(1).getByRole("link", { name: "Pupil PDF" })).toHaveAttribute("href", /y9-cover-41_pupil\.pdf$/);
  await expect(items.nth(1).getByRole("link", { name: "Answers PDF" })).toHaveAttribute("href", /y9-cover-41_answers\.pdf$/);
  const older = lib.locator(".cover-older");
  await expect(older.locator("summary")).toHaveText("Older cover booklets (1)");
  await older.locator("summary").click();
  await expect(older).toContainText("Sun 1 Nov");
  await page.screenshot({ path: test.info().outputPath("cover-library.png") });
  await items.nth(1).getByRole("button", { name: "Delete cover booklet" }).click();
  await items.nth(1).getByRole("button", { name: "Yes, delete it" }).click();
  await expect(lib).not.toContainText("Class 9H1");
  expect(sent).toEqual([{ action: "remove", id: "y9-cover-41" }]);
  // Search never finds cover work.
  await main.getByRole("searchbox").fill("Cover lesson 30");
  await expect(main).not.toContainText("Older cover booklets");
  await expect(main).toContainText("Nothing matches “Cover lesson 30”");
});

test("Request cover booklet sits top right in its own colour, apart from Shelves and Map", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route("**/api/library/cover*", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ requests: [], building: false, removed: [], canDelete: false }) }));
  const { main } = await open(page);
  const button = main.getByRole("button", { name: "Request cover booklet" });
  await expect(main.getByRole("group", { name: "View" }).getByRole("button")).toHaveText(["Shelves", "Map"]);
  await expect(button).toHaveCSS("color", "rgb(11, 110, 117)");
  const box = (await button.boundingBox())!, views = (await main.getByRole("group", { name: "View" }).boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(views.y);
  expect(Math.abs(box.x + box.width - (views.x + views.width))).toBeLessThan(4);
  await page.screenshot({ path: test.info().outputPath("library-cover-button.png") });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(main.locator(".cover-form")).toBeVisible();
});

test("the One-offs shelf shows class, day used and who asked, folds past ones away, and the asker deletes theirs", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const data = JSON.parse(fixture);
  const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const pdf = (id: string, role: string) => ({ role, format: "pdf", name: `${id}_${role}.pdf`, bytes: 1, href: `library-data/files/${id}_${role}.pdf` });
  const oneOff = (id: string, title: string, used: string, owner?: string) => ({ id, year: 11, unit: "ONEOFFS", version: "Main", type: "one-off", title, class: "11X2", used, askedBy: "Ann Lee", owner, status: "waiting", updated: day(-2), files: [pdf(id, "pupil"), pdf(id, "answers")], history: [] });
  data.resources.push(oneOff("y11-p1-revision", "Paper 1 revision", day(2), "ann.lee@school.example"), oneOff("y11-old-revision", "Old revision sheet", day(-10)));
  let removed: string[] = [];
  const sent: Sent[] = [];
  await page.route("**/api/library/cover*", async (route) => {
    if (route.request().method() === "POST") { const body = route.request().postDataJSON(); sent.push(body); removed = [...removed, body.id]; return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, removed }) }); }
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ removed, canDelete: false, me: "ann.lee@school.example" }) });
  });
  const { main, sent: feedback } = await open(page, "/library?year=11&unit=ONEOFFS", { list: JSON.stringify(data), threads: [], canAct: true });
  const panel = main.getByRole("complementary", { name: "Unit resources" });
  await expect(panel.getByRole("heading", { name: "One-offs" })).toBeVisible();
  const card = panel.locator("li", { hasText: "Paper 1 revision" });
  await expect(card).toContainText("Class 11X2");
  await expect(card).toContainText("asked for by Ann Lee");
  await expect(card.getByRole("link", { name: "Pupil PDF" })).toBeVisible();
  // Silent starters are kept: they never fold.
  await expect(panel.getByRole("heading", { name: "Kept" })).toBeVisible();
  // Ten days ago is folded away.
  const past = panel.locator("details", { hasText: "Past one-offs (1)" });
  await expect(past.getByText("Old revision sheet")).toBeHidden();
  await past.locator("summary").click();
  await expect(past.getByText("Old revision sheet")).toBeVisible();
  // Not an editor and not the asker: no Delete on the old one.
  await expect(past.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await card.getByRole("button", { name: "Keep as booklet" }).click();
  await expect.poll(() => feedback.find((s) => s.action === "comment")).toMatchObject({ unit: "ONEOFFS", booklet: "y11-p1-revision" });
  await card.getByRole("button", { name: "Delete" }).click();
  await card.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(panel.getByText("Paper 1 revision")).toHaveCount(0);
  expect(sent).toEqual([{ action: "remove", id: "y11-p1-revision" }]);
});
