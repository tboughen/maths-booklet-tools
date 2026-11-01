import { ArrowRight } from "lucide-react";
import { PageHeading } from "./PageHeading";
import { bookletTools, pageHref, siteSections } from "./registry";
import { useState } from "react";

const searchTerms: Record<string, string> = {
  "bar-model": "ratio sharing fractions amount comparison part whole",
  triangle: "pythagoras trigonometry sine cosine area angles",
  "number-line": "inequality inequalities interval ray",
  graph: "coordinate straight line points axes grid",
  "ratio-table": "proportion scaling unitary fractions",
  "value-table-graph": "table values quadratic parabola plotting",
  cuboids: "volume surface area cubes layers",
  venn: "sets probability shading intersection union",
  "expanding-factorising":
    "algebra brackets multiplication factorise factorize",
};

export function Overview({ home = false }: { home?: boolean }) {
  const [search, setSearch] = useState("");
  const words = search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matching = bookletTools.filter((tool) =>
    words.every((word) =>
      `${tool.name} ${tool.description} ${searchTerms[tool.id]}`
        .toLocaleLowerCase()
        .includes(word),
    ),
  );
  return (
    <main
      className="site-overview"
      id="main-content"
      aria-label={home ? "Home" : undefined}
      tabIndex={-1}
    >
      {home ? (
        <PageHeading
          title="MathsDock"
          description="Reviewed exam questions, paper building, assessment follow-up and diagram tools for maths staff."
        />
      ) : (
        <PageHeading
          title="Booklet tools"
          description="Create clear diagrams for lesson resources, then copy them into Word."
        />
      )}
      {!home && (
        <>
          <div className="tool-search">
            <label>
              Search tools
              <input
                type="search"
                value={search}
                placeholder="Try Pythagoras, inequalities or graph paper"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {search && (
              <button onClick={() => setSearch("")}>Clear search</button>
            )}
          </div>
          {search && (
            <p className="tool-search-status" role="status">
              {matching.length
                ? `${matching.length} ${matching.length === 1 ? "tool" : "tools"} found`
                : "No tools found. Try a teaching topic or clear your search."}
            </p>
          )}
        </>
      )}
      <div
        className={
          home ? "overview-cards" : "overview-cards overview-tool-cards"
        }
      >
        {home
          ? siteSections.map((section) => (
              <a key={section.id} className="overview-card" href={section.href}>
                <span className="overview-icon">
                  <section.icon size={25} aria-hidden="true" />
                </span>
                <h2>{section.name}</h2>
                <p>{section.description}</p>
                <span className="overview-launch">
                  {section.action} <ArrowRight size={18} aria-hidden="true" />
                </span>
              </a>
            ))
          : matching.map((tool) => (
              <a
                key={tool.id}
                className="overview-card overview-tool-card"
                href={pageHref(tool.id)}
              >
                <div className="overview-tool-copy">
                  <span className="overview-icon">
                    <tool.icon size={25} aria-hidden="true" />
                  </span>
                  <h2>{tool.name}</h2>
                  <p>{tool.description}</p>
                  <span className="overview-launch">
                    Open {tool.name} <ArrowRight size={18} aria-hidden="true" />
                  </span>
                </div>
                <img
                  className="overview-tool-preview"
                  src={tool.preview.src}
                  alt={tool.preview.alt}
                  width={320}
                  height={320}
                  decoding="async"
                />
              </a>
            ))}
      </div>
      {!home && (
        <p className="overview-note">
          Your diagrams stay in your browser. Use an editable file to keep a
          copy for later.
        </p>
      )}
    </main>
  );
}
