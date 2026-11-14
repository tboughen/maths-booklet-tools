import { cloneDefaultDocument } from "./diagram";
import { housePreference } from "../site/houseStyle";
import type { GraphDocument } from "./graphAbout";
/** Browser new-document policy. Existing/core/service defaults retain their meaning. A new graph starts from the house style's lines (U111). */
export function newBrowserGraph(): GraphDocument {
  const document: GraphDocument = { ...cloneDefaultDocument(), styleProfile: "portable-v1" as const };
  if (housePreference().lines === "bold") document.lines = "bold";
  return document;
}
