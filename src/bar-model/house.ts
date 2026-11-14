import { houseStyled } from "../site/houseStyle";

/**
 * A new bar model starts from the house style (U111); its own print settings override it.
 * The legacy editor has no Lines control, so it takes only the house text size.
 */
export function houseModel<E extends { document: { presentation: { fontPt: number; lines?: "bold" } } }>(e: E, options: { lines?: boolean } = {}): E {
  const p = e.document.presentation;
  const lines = p.lines;
  houseStyled(p as { fontPt: number; lines?: "bold" | "normal" }, { max: 14 });
  if (options.lines === false) p.lines = lines;
  return e;
}
