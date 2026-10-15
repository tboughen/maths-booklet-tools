import { cloneDefaultDocument } from "./diagram";
/** Browser new-document policy. Existing/core/service defaults retain their meaning. */
export function newBrowserGraph() {
  return { ...cloneDefaultDocument(), styleProfile: "portable-v1" as const };
}
