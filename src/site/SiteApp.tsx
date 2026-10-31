import { resourceCopyId } from "./copyDocument";
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import "./pageStyles";
import { Overview } from "./Overview";
import { NotFound } from "./NotFound";
import { SiteHeader } from "./SiteHeader";
import { upgradeLegacyLink } from "./routes";
import {
  AssessmentPage,
  bookletTools,
  QuestionBank,
  sectionName,
  readPage,
  readSection,
  type PageId,
  type SectionId,
} from "./registry";
import "./site.css";
import "./resource-utilities.css";
import "./usability.css";
import "./refinement.css";

/** Each page downloads on first visit; `onReady` runs once its code has loaded and mounted. */
function LazyPage({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady: () => void;
}) {
  return (
    <Suspense
      fallback={
        <p className="site-page-loading" role="status">
          Loading…
        </p>
      }
    >
      {children}
      <Ready onReady={onReady} />
    </Suspense>
  );
}
/** Focuses the visible page's heading; false when its code has not loaded yet. */
function focusVisiblePage(host: HTMLElement | null) {
  const visible = host?.querySelector(".site-page:not([hidden])");
  const focusTarget =
    visible?.querySelector<HTMLElement>("h1") ??
    visible?.querySelector<HTMLElement>("#main-content");
  focusTarget?.focus({ preventScroll: true });
  return Boolean(focusTarget);
}
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

/** The current address within the site: path, query and hash. */
const here = () => location.pathname + location.search + location.hash;

/** Editors mount on first use and remain mounted so drafts and undo survive navigation. */
export default function SiteApp() {
  const [section, setSection] = useState(() => readSection());
  const page: PageId = section === "paper-builder" ? "question-bank" : section;
  const [visited, setVisited] = useState<PageId[]>([page]);
  const remembered = useRef<Partial<Record<SectionId, string>>>({});
  const host = useRef<HTMLDivElement>(null);
  const firstPage = useRef(true);
  // Set when navigation lands on a page whose code is still downloading.
  const focusPending = useRef(false);
  const pageReady = useCallback(() => {
    if (
      !focusPending.current ||
      host.current?.querySelector(".site-page:not([hidden]) [aria-modal=true]")
    )
      return;
    focusPending.current = !focusVisiblePage(host.current);
  }, []);
  useEffect(() => {
    const back = () => {
      const next = readPage();
      setSection(readSection());
      setVisited((previous) =>
        previous.includes(next) ? previous : [...previous, next],
      );
    };
    const remember = () => {
      const next = readSection();
      remembered.current[next] = here();
      setSection(next);
    };
    window.addEventListener("maths-tools:route", remember);
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("popstate", back);
      window.removeEventListener("maths-tools:route", remember);
    };
  }, []);
  useEffect(() => {
    document.title = `${sectionName(section)} · Maths Dock`;
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    if (
      host.current?.querySelector(".site-page:not([hidden]) [aria-modal=true]")
    )
      return;
    focusPending.current = !focusVisiblePage(host.current);
  }, [page, section]);
  function navigate(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
      "a[href]",
    );
    if (!link || link.target || link.hasAttribute("download")) return;
    if (link.classList.contains("site-skip")) {
      event.preventDefault();
      host.current?.querySelector<HTMLElement>("#main-content")?.focus();
      return;
    }
    const clicked = new URL(link.href, location.href).href;
    const url = new URL(upgradeLegacyLink(clicked) ?? clicked);
    const next = readPage(url);
    if (
      url.origin !== location.origin ||
      next === "not-found" ||
      // Same-page anchors keep the browser's own behaviour.
      (url.hash &&
        url.pathname === location.pathname &&
        url.search === location.search)
    )
      return;
    event.preventDefault();
    remembered.current[readSection()] = here();
    const nextSection = readSection(url);
    const sectionLink =
      url.searchParams.size === 0 ||
      (nextSection === "paper-builder" && url.searchParams.size === 1);
    let href =
      sectionLink && !url.hash
        ? (remembered.current[nextSection] ?? url.pathname + url.search)
        : url.pathname + url.search + url.hash;
    if (resourceCopyId) {
      const destination = new URL(href, location.href);
      destination.searchParams.set("resourceCopy", resourceCopyId);
      href = destination.pathname + destination.search + destination.hash;
    }
    if (here() !== href) window.history.pushState({}, "", href);
    setVisited((previous) =>
      previous.includes(next) ? previous : [...previous, next],
    );
    setSection(nextSection);
    // Existing question and diagram routes already listen for these browser events.
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  return (
    <div className="site-app" ref={host} onClick={navigate}>
      <a className="site-skip" href="#main-content">
        Skip to content
      </a>
      <SiteHeader key={section} page={page} section={section} />
      {page === "not-found" && (
        <div className="site-page">
          <NotFound />
        </div>
      )}
      {(page === "home" || page === "booklet-tools") && (
        <div className="site-page">
          <Overview home={page === "home"} />
        </div>
      )}
      {bookletTools.map(
        (tool) =>
          visited.includes(tool.id) && (
            <div key={tool.id} className="site-page" hidden={page !== tool.id}>
              <LazyPage onReady={pageReady}>
                <tool.component active={page === tool.id} />
              </LazyPage>
            </div>
          ),
      )}
      {visited.includes("question-bank") && (
        <div className="site-page" hidden={page !== "question-bank"}>
          <LazyPage onReady={pageReady}>
            <QuestionBank active={page === "question-bank"} />
          </LazyPage>
        </div>
      )}
      {visited.includes("assessment-follow-up") && (
        <div className="site-page" hidden={page !== "assessment-follow-up"}>
          <LazyPage onReady={pageReady}>
            <AssessmentPage active={page === "assessment-follow-up"} />
          </LazyPage>
        </div>
      )}
    </div>
  );
}
