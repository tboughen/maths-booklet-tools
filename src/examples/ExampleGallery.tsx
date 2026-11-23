import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid } from "lucide-react";
import type { GalleryExample } from "./galleryCatalogue";
import { EXAMPLE_PARAM, previewUrl } from "./examplePreviews";


/**
 * First in the settings column. Out of sight beside the diagram until a keyboard reaches it; on a
 * stacked page it is the way back up.
 */
export function ReturnToDiagram() {
  return (
    <button
      type="button"
      className="editor-diagram-link"
      onClick={(event) => {
        const card = event.currentTarget.closest(".workspace")?.querySelector<HTMLElement>(".editor-card");
        if (card) {
          card.tabIndex = -1;
          card.focus();
          card.scrollIntoView({ block: "start" });
        }
      }}
    >
      ↑ Return to diagram
    </button>
  );
}

/** The "Examples" button of the action bar and the gallery it opens. */
export function ExampleGallery<T>({
  examples,
  active,
  disabled,
  onUse,
  onWorked,
}: {
  examples: GalleryExample<T>[];
  active: boolean;
  disabled: boolean;
  onUse: (resource: T, title: string) => void;
  onWorked: (resource: T, title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  // A link such as /tools/solids?example=solids-plain-cylinder (from the Diagram builder search)
  // opens that example through the page's own "Use this example", so its usual checks and undo apply.
  const latest = useRef({ examples, onUse, disabled });
  latest.current = { examples, onUse, disabled };
  useEffect(() => {
    if (!active) return;
    const url = new URL(location.href);
    const id = url.searchParams.get(EXAMPLE_PARAM);
    if (!id) return;
    const { examples: list, onUse: use, disabled: blocked } = latest.current;
    const example = list.find((item) => item.id === id);
    if (!example || blocked) return;
    url.searchParams.delete(EXAMPLE_PARAM);
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    try {
      use(example.make(false), example.title);
    } catch {
      /* A broken example leaves the page as it was; the gallery shows the same error when chosen. */
    }
  }, [active]);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (open && active) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open, active]);
  function close(restore = true) {
    dialog.current?.close();
    setOpen(false);
    if (restore && active) trigger.current?.focus();
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        className="tool-button example-launch-button"
        aria-label="Examples"
        title="Start from an example"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <LayoutGrid size={17} aria-hidden="true" />
        <span>Examples</span>
      </button>
      {active &&
        open &&
        createPortal(
          <dialog
            ref={dialog}
            className="example-gallery"
            aria-labelledby={titleId}
            aria-modal="true"
            onKeyDown={(event) => event.stopPropagation()}
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
          >
            <header>
              <div>
                <h2 id={titleId}>Start from an example</h2>
                <p>
                  {examples.some((item) => item.plain)
                    ? "Plain shapes first, then exam-style examples. Each opens ready to change."
                    : "Choose a pupil resource or a worked version."}
                </p>
              </div>
              <button onClick={() => close()}>Close</button>
            </header>
            {[
              {
                title: "Plain shapes",
                items: examples.filter((item) => item.plain),
              },
              {
                title: examples.some((item) => item.plain) ? "Exam-style examples" : "Teaching examples",
                items: examples.filter((item) => !item.sourceHref && !item.plain),
              },
              {
                title: "Past-paper examples",
                items: examples.filter((item) => item.sourceHref),
              },
            ]
              .filter((group) => group.items.length)
              .map((group) => (
                <section
                  key={group.title}
                  className="example-gallery-group"
                  aria-label={group.title}
                >
                  <h3 className="example-gallery-group-title">{group.title}</h3>
                  <div className="example-gallery-grid">
                    {group.items.map((example) => (
                      <article
                        key={example.id}
                        className="example-card"
                        data-example-id={example.id}
                        aria-label={example.title}
                      >
                        <img
                          src={
                            previewUrl(example.id)
                          }
                          alt={
                            example.alt ??
                            `${example.title}: pupil resource preview`
                          }
                          width={320}
                          height={220}
                          loading="lazy"
                        />
                        <div className="example-card-copy">
                          <h3>{example.title}</h3>
                          <p>
                            {example.description.split(". ")[0]}
                            {example.description.includes(". ") ? "." : ""}
                          </p>
                          <details>
                            <summary>
                              Details{example.sourceHref ? " and source" : ""}
                            </summary>
                            <p>{example.description}</p>
                            {example.sourceHref && (
                              <a
                                href={example.sourceHref}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View source question
                              </a>
                            )}
                          </details>
                          <div className="example-card-actions">
                            <button
                              disabled={disabled}
                              onClick={() => {
                                try {
                                  const resource = example.make(false);
                                  close(false);
                                  onUse(resource, example.title);
                                } catch (cause) {
                                  setError(
                                    cause instanceof Error
                                      ? cause.message
                                      : String(cause),
                                  );
                                }
                              }}
                            >
                              {example.plain ? "Use this shape" : "Use this example"}
                            </button>
                            {example.plain ? null : example.worked !== false ? (
                              <button
                                disabled={disabled}
                                onClick={() => {
                                  try {
                                    const resource = example.make(true);
                                    onWorked(resource, example.title);
                                    setError("");
                                    close();
                                  } catch (cause) {
                                    setError(
                                      cause instanceof Error
                                        ? cause.message
                                        : String(cause),
                                    );
                                  }
                                }}
                              >
                                {example.workedLabel ?? "Use worked version"}
                              </button>
                            ) : (
                              <p className="example-unavailable">
                                {example.workedReason ??
                                  "No automatic worked copy for this teaching example."}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            {error && (
              <footer aria-live="polite">
                {error && <p role="alert">{error}</p>}
              </footer>
            )}
          </dialog>,
          document.body,
        )}
    </>
  );
}
