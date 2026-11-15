import { createContext, useSyncExternalStore } from "react";
import { lazyPage } from "./lazyPage";
import type { ToolId } from "./routes";
import type { ToolSwitcher } from "./ToolSwitcher";

/** The diagram tool whose page is being drawn, so its heading can offer the tool switcher. */
export const ToolPageContext = createContext<ToolId | null>(null);

let switcher: typeof ToolSwitcher | undefined;
let pending: Promise<void> | undefined;
const waiting = new Set<() => void>();
/**
 * The switcher's code, styles and search words arrive with a diagram tool's page, not with the
 * site's first load. If they cannot be fetched the page still opens, with a plain heading, and
 * the next tool page to load asks for them again.
 */
export const loadToolSwitcher = () =>
  (pending ??= import("./ToolSwitcher").then(
    (module) => {
      switcher = module.ToolSwitcher;
      waiting.forEach((draw) => draw());
    },
    () => {
      pending = undefined;
    },
  ));
/** A diagram tool's page for the registry: the tool switcher on its name loads with it. */
export const toolPage = (load: Parameters<typeof lazyPage>[0]) =>
  Object.assign(lazyPage(() => Promise.all([load(), loadToolSwitcher()]).then(([page]) => page)), { withToolSwitcher: true as const });
const subscribe = (draw: () => void) => {
  waiting.add(draw);
  return () => void waiting.delete(draw);
};
/** The switcher, or nothing if it has not loaded. A heading redraws when it lands. */
export const useToolSwitcher = () => useSyncExternalStore(subscribe, () => switcher, () => undefined);
export function resetToolSwitcherForTests() {
  switcher = undefined;
  pending = undefined;
}
