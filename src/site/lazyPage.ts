import { createElement, lazy, useState, type ComponentType } from "react";

type PageProps = { active: boolean };
type PageModule = { default: ComponentType<PageProps> };

/**
 * A page whose code downloads on first use. `preload` fetches it early; a page
 * whose code is already loaded renders straight away instead of suspending.
 */
export function lazyPage(load: () => Promise<PageModule>) {
  let loaded: ComponentType<PageProps> | undefined;
  let pending: Promise<PageModule> | undefined;
  const preload = () =>
    (pending ??= load().then((module) => {
      loaded = module.default;
      return module;
    }));
  const Suspended = lazy(preload);
  function Page(props: PageProps) {
    // Fixed on mount: switching component type later would reset the editor.
    const [Component] = useState(() => loaded ?? Suspended);
    return createElement(Component, props);
  }
  return Object.assign(Page, { preload });
}
