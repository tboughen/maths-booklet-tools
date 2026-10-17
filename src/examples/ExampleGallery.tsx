import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GalleryExample } from "./galleryCatalogue";

const previews = import.meta.glob<string>("../assets/example-previews/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

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
      <div className="example-launch">
        <button
          ref={trigger}
          disabled={disabled}
          className="example-launch-button"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          Start from an example
        </button>
        <button
          className="editor-diagram-link"
          onClick={(event) => {
            const card = event.currentTarget
              .closest(".workspace")
              ?.querySelector<HTMLElement>(".editor-card");
            if (card) {
              card.tabIndex = -1;
              card.focus();
              card.scrollIntoView({ block: "start" });
            }
          }}
        >
          ↑ Return to diagram
        </button>
      </div>
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
                <p>Choose a pupil resource or a worked version.</p>
              </div>
              <button onClick={() => close()}>Close</button>
            </header>
            {[
              {
                title: "Teaching examples",
                items: examples.filter((item) => !item.sourceHref),
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
                            previews[
                              `../assets/example-previews/${example.id}.svg`
                            ]
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
                              {example.openLabel ?? "Open scaffold"}
                            </button>
                            {example.worked !== false ? (
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
