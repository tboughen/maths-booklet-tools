import type { RatioEnvelope } from "../../packages/ratio-table-core/src/schema";
import { housePreference } from "../site/houseStyle";

/**
 * A new table starts from the house style (U111): bold lines if chosen. Its text is already
 * 12 pt, so both house presets print it at the same size.
 */
export function houseRatio(e: RatioEnvelope): RatioEnvelope {
  if (housePreference().lines === "bold") e.document.lines = "bold";
  return e;
}
