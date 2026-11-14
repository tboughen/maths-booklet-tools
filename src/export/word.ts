import interUrl from "../../assets/resource-fonts/Inter-Regular.ttf?url";
import interSemiBoldUrl from "../../assets/resource-fonts/Inter-SemiBold.ttf?url";
import interItalicUrl from "../../assets/resource-fonts/Inter-Italic.ttf?url";
import stixUrl from "../../assets/graph-fonts/STIXTwoText-Regular.otf?url";
import stixItalicUrl from "../../assets/graph-fonts/STIXTwoText-Italic.otf?url";
import stixMathUrl from "../../assets/graph-fonts/STIXTwoMath-Regular.otf?url";
import resvgWasmUrl from "@resvg/resvg-wasm/index_bg.wasm?url";
import type { DocxFonts, DocxPicture, DocxPictureMaker } from "../../packages/resource-core/src/docx";

/**
 * Word files written in the browser, with the same writer and the same picture rules as the
 * MathsDock connector (services/graph-mcp/worksheet-docx.ts): Inter embedded, each diagram an SVG
 * with its text as outlines plus a 300 ppi PNG. resvg (the same version, compiled to WebAssembly)
 * makes the pictures; it loads only when a Word file is first asked for.
 */

/** PNG fallback resolution for Word versions without SVG support, as in the connector. */
const PNG_PPI = 300;

type Kit = { fonts: DocxFonts; picture: DocxPictureMaker };
let kit: Promise<Kit> | null = null;

async function bytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw Error("A file the Word download needs could not be loaded. Check the connection and try again.");
  return new Uint8Array(await r.arrayBuffer());
}

function load(): Promise<Kit> {
  kit ??= (async () => {
    const [resvg, regular, semiBold, italic, stix, stixItalic, stixMath] = await Promise.all([
      import("@resvg/resvg-wasm").then(async (m) => {
        await m.initWasm(fetch(resvgWasmUrl));
        return m;
      }),
      ...[interUrl, interSemiBoldUrl, interItalicUrl, stixUrl, stixItalicUrl, stixMathUrl].map(bytes),
    ]);
    const font = { fontBuffers: [stix, stixItalic, stixMath, regular, semiBold, italic], defaultFontFamily: "STIX Two Text" };
    const picture = (svg: string, widthMm: number, heightMm: number): DocxPicture => {
      const px = Math.round((widthMm / 25.4) * PNG_PPI);
      const raster = new resvg.Resvg(svg, { background: "white", font, fitTo: { mode: "width", value: px } });
      const png = raster.render().asPng();
      raster.free();
      const vector = new resvg.Resvg(svg, { font });
      let outlined = vector.toString();
      vector.free();
      // resvg states pixel dimensions; restore the printed size so Word places it at its true size.
      outlined = outlined.replace(/(<svg\b[^>]*?)\swidth="[^"]+"/, `$1 width="${widthMm}mm"`).replace(/(<svg\b[^>]*?)\sheight="[^"]+"/, `$1 height="${heightMm}mm"`);
      return { svg: outlined, png };
    };
    return { fonts: { regular, semiBold, italic }, picture };
  })();
  kit.catch(() => (kit = null));
  return kit;
}

/** The fonts and picture maker the Word writers need, loaded once. */
export const wordKit = load;

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
