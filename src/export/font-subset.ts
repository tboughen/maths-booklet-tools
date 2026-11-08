/**
 * Font subsetting for exported SVGs (improvement list U31).
 *
 * Every SVG used to embed the whole of STIX Two Text Regular, Italic and STIX Two Math (about
 * 2 MB as base64), even for a 3 cm ratio table. HarfBuzz's subsetter (harfbuzzjs, a standalone
 * WebAssembly module with no imports) keeps only the glyphs for the characters the SVG actually
 * shows, plus the glyphs their default OpenType features (ligatures, MATH variants) can reach.
 * Every font is cut down to the same character set, so the browser's per-character fallback from
 * STIX Two Text to STIX Two Math, and therefore the printed output, is unchanged.
 */

interface SubsetExports {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(pointer: number): void;
  hb_blob_create(data: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_data(blob: number, length: number): number;
  hb_blob_get_length(blob: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_set_add(set: number, codepoint: number): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_unicode_set(input: number): number;
  hb_subset_or_fail(face: number, input: number): number;
}

const HB_MEMORY_MODE_WRITABLE = 2;

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** The characters an SVG can draw: its text content, without markup, comments or styles. */
export function svgCodepoints(svg: string): Set<number> {
  const text = svg
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) =>
      name[0] === "#"
        ? String.fromCodePoint(name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)))
        : entities[name.toLowerCase()] ?? match,
    );
  const codepoints = new Set<number>([0x20]);
  for (const char of text) {
    const codepoint = char.codePointAt(0)!;
    if (codepoint > 0x20) codepoints.add(codepoint);
  }
  return codepoints;
}

/** Instantiates the subsetter from its WebAssembly bytes. */
export async function loadSubsetter(wasm: BufferSource): Promise<SubsetExports> {
  const { instance } = await WebAssembly.instantiate(wasm, {});
  return instance.exports as unknown as SubsetExports;
}

/**
 * The font cut down to `codepoints`, or null if HarfBuzz cannot subset it (the caller then keeps
 * the whole font, so an export never loses a glyph).
 */
export function subsetFont(hb: SubsetExports, font: Uint8Array, codepoints: Iterable<number>): Uint8Array | null {
  const pointer = hb.malloc(font.byteLength);
  if (!pointer) return null;
  new Uint8Array(hb.memory.buffer, pointer, font.byteLength).set(font);
  const blob = hb.hb_blob_create(pointer, font.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0);
  const face = hb.hb_face_create(blob, 0);
  hb.hb_blob_destroy(blob);
  const input = hb.hb_subset_input_create_or_fail();
  try {
    if (!input) return null;
    const set = hb.hb_subset_input_unicode_set(input);
    for (const codepoint of codepoints) hb.hb_set_add(set, codepoint);
    const subset = hb.hb_subset_or_fail(face, input);
    if (!subset) return null;
    const result = hb.hb_face_reference_blob(subset);
    const length = hb.hb_blob_get_length(result);
    const data = hb.hb_blob_get_data(result, 0);
    const bytes = length && data ? new Uint8Array(hb.memory.buffer, data, length).slice() : null;
    hb.hb_blob_destroy(result);
    hb.hb_face_destroy(subset);
    return bytes;
  } finally {
    if (input) hb.hb_subset_input_destroy(input);
    hb.hb_face_destroy(face);
    hb.free(pointer);
  }
}
