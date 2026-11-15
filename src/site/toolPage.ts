import { createContext, useEffect, useSyncExternalStore } from "react";
import { lazyPage } from "./lazyPage";
import type { ToolId } from "./routes";
import type { ToolSwitcher } from "./ToolSwitcher";

/** The diagram tool whose page is being drawn, so its heading can offer the tool switcher. */
export const ToolPageContext = createContext<ToolId | null>(null);

let switcher: typeof ToolSwitcher | undefined;
const waiting = new Set<() => void>();
/**
 * The switcher's code, styles and search words arrive with a diagram tool's page
 * (src/site/registry.ts), not with the site's first load. If they cannot be fetched the page
 * still opens, with a plain heading.
 */
export const loadToolSwitcher = () =>
  import("./ToolSwitcher").then(
    (module) => {
      switcher = module.ToolSwitcher;
      waiting.forEach((draw) => draw());
    },
    () => undefined,
  );
/** A diagram tool's page for the registry: the tool switcher on its name loads with it. */
export const toolPage = (load: Parameters<typeof lazyPage>[0]) =>
  Object.assign(lazyPage(() => Promise.all([load(), loadToolSwitcher()]).then(([page]) => page)), { withToolSwitcher: true as const });
const subscribe = (draw: () => void) => {
  waiting.add(draw);
  return () => void waiting.delete(draw);
};
/** The switcher once it has loaded. A heading drawn before then asks for it and redraws. */
export function useToolSwitcher(wanted: boolean) {
  const loaded = useSyncExternalStore(subscribe, () => switcher, () => undefined);
  useEffect(() => {
    if (wanted && !loaded) void loadToolSwitcher();
  }, [wanted, loaded]);
  return loaded;
}
export function resetToolSwitcherForTests() {
  switcher = undefined;
}
