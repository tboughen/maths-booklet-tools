import { resourceCopyId } from "./copyDocument";
import {
  lazy,
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
import { SiteHeader } from "./SiteHeader";
import {
  bookletTools,
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

const QuestionBank = lazy(() => import("../bank/QuestionBank"));
const AssessmentPage = lazy(() => import("../assessment/AssessmentPage"));

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

/** Editors mount on first use and remain mounted so drafts and undo survive navigation. */
export default function SiteApp() {
  const [section, setSection] = useState(() => readSection(location.search));
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
      const next = readPage(location.search);
      setSection(readSection(location.search));
      setVisited((previous) =>
        previous.includes(next) ? previous : [...previous, next],
      );
    };
    const remember = () => {
      const next = readSection(location.search);
      remembered.current[next] = location.search + location.hash;
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
    const url = new URL(link.href, location.href);
    const id = url.searchParams.get("tool");
    if (
      url.origin !== location.origin ||
      url.pathname !== location.pathname ||
      !id ||
      readPage(url.search) !== id
    )
      return;
    event.preventDefault();
    remembered.current[readSection(location.search)] =
      location.search + location.hash;
    const next = id as PageId;
    const nextSection = readSection(url.search);
    const sectionLink =
      url.searchParams.size === 1 ||
      (nextSection === "paper-builder" && url.searchParams.size === 2);
    let href =
      sectionLink && !url.hash
        ? (remembered.current[nextSection] ?? url.search)
        : url.search + url.hash;
    if (resourceCopyId) {
      const destination = new URL(href, location.href);
      destination.searchParams.set("resourceCopy", resourceCopyId);
      href = destination.search + destination.hash;
    }
    if (location.search + location.hash !== href)
      window.history.pushState({}, "", location.pathname + href);
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
