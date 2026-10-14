import { ExternalLink } from "lucide-react";
import { sourceQuestionHref, type SourceExample } from "./sourceExamples";

export function SourceExamples<T>({
  examples,
  onUse,
  disabled = false,
  graph = false,
}: {
  examples: SourceExample<T>[];
  onUse: (resource: T, title: string) => void;
  disabled?: boolean;
  graph?: boolean;
}) {
  return (
    <section className="panel-card">
      <details className="source-examples">
        <summary>Past-paper examples</summary>
        <p className="panel-note">
          Editable teaching resources based on published questions. Use a
          scaffold to keep pupils’ answers blank, or choose worked output
          explicitly.
        </p>
        {graph && (
          <p className="panel-note">
            Grids use the Graph tool’s 1 cm squares, with bounds and scales from
            the source.
          </p>
        )}
        {examples.map((example) => (
          <article
            key={example.id}
            className="source-example"
            aria-label={example.title}
          >
            <h3>{example.title}</h3>
            <p>{example.source}</p>
            <p className="panel-note">{example.description}</p>
            <a
              href={sourceQuestionHref(example.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              View source question <ExternalLink size={13} aria-hidden="true" />
            </a>
            <div className="source-example-actions">
              <button
                disabled={disabled}
                onClick={() => onUse(example.create(false), example.title)}
              >
                {graph ? "Use blank grid" : "Use scaffold"}
              </button>
              <button
                disabled={disabled}
                onClick={() => onUse(example.create(true), example.title)}
              >
                {graph ? "Use worked graph" : "Use worked table"}
              </button>
            </div>
          </article>
        ))}
      </details>
    </section>
  );
}
