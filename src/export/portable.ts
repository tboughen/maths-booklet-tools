import regularUrl from "../../assets/graph-fonts/STIXTwoText-Regular.otf?url";
import italicUrl from "../../assets/graph-fonts/STIXTwoText-Italic.otf?url";
import mathUrl from "../../assets/graph-fonts/STIXTwoMath-Regular.otf?url";
import subsetterUrl from "harfbuzzjs/dist/harfbuzz-subset.wasm?url";
import fontLicense from "../../assets/graph-fonts/OFL.txt?raw";
import { loadSubsetter, subsetFont, svgCodepoints } from "./font-subset";
import { tidySvgRoot } from "../../packages/envelope-core/src/svg-root";

type Subsetter = Awaited<ReturnType<typeof loadSubsetter>>;
let fonts: Promise<Uint8Array[]> | undefined;
let subsetter: Promise<Subsetter | null> | undefined;

function loadFonts(): Promise<Uint8Array[]> {
  fonts ??= Promise.all(
    [regularUrl, italicUrl, mathUrl].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok)
        throw Error("The portable print font could not be loaded.");
      return new Uint8Array(await response.arrayBuffer());
    }),
  ).catch((error) => {
    fonts = undefined;
    throw error;
  });
  return fonts;
}

// The subsetter only makes files smaller. If it cannot load, exports keep the whole fonts.
function loadFontSubsetter(): Promise<Subsetter | null> {
  subsetter ??= fetch(subsetterUrl)
    .then((response) => {
      if (!response.ok) throw Error("The font subsetter could not be loaded.");
      return response.arrayBuffer();
    })
    .then(loadSubsetter)
    .catch(() => {
      subsetter = undefined;
      return null;
    });
  return subsetter;
}

/**
 * Starts fetching the print fonts and the subsetter as soon as a teacher shows an intent to export
 * (pointer over, or focus on, Copy image, Copy for Word or File), so the first copy does not wait
 * for about 1.5 MB of fonts (improvement item U57). Both stay cached for the page's lifetime; a
 * failed preload is forgotten and the export itself reports any error.
 */
export function preloadPortableFonts(): void {
  void loadFonts().catch(() => undefined);
  void loadFontSubsetter();
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

/**
 * Embeds the STIX fonts the SVG needs, so it prints the same anywhere. Each font is cut down to the
 * characters the SVG shows (U31), which takes a typical export from about 2 MB to tens of kB.
 */
export async function embedPortableFonts(svg: string): Promise<string> {
  const [full, hb] = await Promise.all([loadFonts(), loadFontSubsetter()]);
  const codepoints = svgCodepoints(svg);
  const [regular, italic, math] = full.map((font) => {
    try {
      return base64((hb && subsetFont(hb, font, codepoints)) || font);
    } catch {
      return base64(font);
    }
  });
  const style = `<style>@font-face{font-family:'STIX Two Text';font-style:normal;src:url(data:font/otf;base64,${regular})}@font-face{font-family:'STIX Two Text';font-style:italic;src:url(data:font/otf;base64,${italic})}@font-face{font-family:'STIX Two Math';src:url(data:font/otf;base64,${math})}</style>`;
  const notice =
    "<!-- Bundled STIX fonts, subset to the characters in this file: " +
    fontLicense.replaceAll("--", "—") +
    " -->";
  return tidySvgRoot(svg).replace(/(<svg\b[^>]*>)/, `$1${notice}${style}`);
}
