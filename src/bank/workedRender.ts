// The worked-solution renderer as the bank page loads it on demand (see worked.ts).
import handFont from "../assets/fonts/ShantellSans-Worked.woff2?url";
import uiFont from "../assets/fonts/Inter-Variable-Latin.woff2?url";
import stixFont from "../assets/fonts/STIXTwoText-Regular.woff2?url";
import stixItalicFont from "../assets/fonts/STIXTwoText-Italic.woff2?url";
import { HAND_FAMILY, layoutWorked, parseWorked, slices, type WorkedData } from "../../packages/worked-core/src/index";
import type { BankQuestion } from "./model";
import { assetUrl, renderPage, stackCanvases } from "./pdf";
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
    shownSteps: layout.shownSteps,
    issues: layout.issues.map(issue => `${issue.surface}: ${issue.message}`),
  };
}

let embedded: Promise<string> | undefined;
/** The fonts the working uses, as data URLs, for a picture: an SVG drawn as an image cannot see the page's fonts. */
function embeddedFonts(): Promise<string> {
  const face = async (family: string, url: string, style = "normal", weight = "400") => {
    const response = await fetch(url);
    // A signed-out session answers with a sign-in page: never embed that as a font.
    if (!response.ok || /html|text/.test(response.headers.get("content-type") ?? "")) throw new Error("The fonts for the image could not load. Reload the page and try again.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${btoa(binary)}) format("woff2")}`;
  };
  embedded ??= Promise.all([face(HAND_FAMILY, handFont), face("MathsDock UI", uiFont, "normal", "100 900"), face("STIX Two Text", stixFont), face("STIX Two Text", stixItalicFont, "italic")]).then(faces => faces.join(""));
  embedded.catch(() => { embedded = undefined; });
  return embedded;
}

async function svgImage(svg: string, width: number, height: number): Promise<HTMLImageElement> {
  const fonts = await embeddedFonts();
  const sized = svg.replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${width}" height="${height}"`).replace(/^(<svg[^>]*>)/, `$1<style>${fonts}</style>`);
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally { URL.revokeObjectURL(url); }
}

/** A PNG of the worked solution as shown: each cut at 300 dpi, split where room is added, with its working. */
export async function workedImage(question: BankQuestion, plan: WorkedPlan, options: WorkedOptions, caption: string): Promise<Blob> {
  const shown = await layoutQuestionWorked(question, plan, options);
  const pages: HTMLCanvasElement[] = [];
  for (const item of shown.items) {
    const page = await renderPage(item.pdf, item.view.page, 300 / 72);
    const k = page.width / item.view.width;
    const overlay = item.overlay;
    const height = item.view.height + (overlay ? overlay.bands.reduce((n, b) => n + b.size, 0) + overlay.footer : 0);
    const canvas = document.createElement("canvas");
    canvas.width = page.width; canvas.height = Math.ceil(height * k);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is unavailable.");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    for (const slice of slices({ height: item.view.height, bands: overlay?.bands ?? [] })) {
      const h = Math.min(page.height - slice.from * k, (slice.to - slice.from) * k);
      if (h > 0) context.drawImage(page, 0, slice.from * k, page.width, h, 0, slice.y * k, page.width, h);
    }
    if (overlay) context.drawImage(await svgImage(overlay.svg, canvas.width, canvas.height), 0, 0, canvas.width, canvas.height);
    pages.push(canvas);
  }
  return stackCanvases(pages, caption);
}
