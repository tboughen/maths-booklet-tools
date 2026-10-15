import { quadraticSources } from "./examples";

export function QuadraticExamples({
  disabled,
  onUse,
  onWorked,
}: {
  disabled: boolean;
  onUse: (name: string) => void;
  onWorked: (name: string) => void;
}) {
  return (
    <div className="quadratic-examples">
      <p>
        Editable resources based on verified questions. Scaffolds keep pupil
        blanks; worked copies open separately.
      </p>
      <h3>Past-paper examples</h3>
      {quadraticSources.map((example) => (
        <article
          key={example.id}
          className="source-example"
          aria-label={example.source}
        >
          <h3>{example.source}</h3>
          <p className="panel-note">{example.description}</p>
          <a
            href={`https://mathsdock.co.uk/?tool=question-bank&question=${example.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View source question
          </a>
          <div className="source-example-actions">
            <button disabled={disabled} onClick={() => onUse(example.name)}>
              {"intentional" in example
                ? "Use intentional error"
                : "Use scaffold"}
            </button>
            <button disabled={disabled} onClick={() => onWorked(example.name)}>
              {"intentional" in example
                ? "Open corrected copy"
                : "Open worked copy"}
            </button>
          </div>
        </article>
      ))}
      <h3>Teaching example</h3>
      <article className="source-example">
        <h3>Fractions</h3>
        <p className="panel-note">
          A generic exact-fraction example, with an answer supplied at x = 0 and
          other cells left blank.
        </p>
        <div className="source-example-actions">
          <button disabled={disabled} onClick={() => onUse("Fractions")}>
            Use fraction scaffold
          </button>
          <button disabled={disabled} onClick={() => onWorked("Fractions")}>
            Open fraction worked copy
          </button>
        </div>
      </article>
    </div>
  );
}
