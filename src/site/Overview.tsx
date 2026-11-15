import { ArrowRight, Settings2 } from "lucide-react";
import { PageHeading } from "./PageHeading";
import { bookletTools, pageHref, siteSections } from "./registry";
import { useEffect, useRef, useState } from "react";
import { setHousePreference, useHousePreference } from "./houseStyle";
import {
  HOUSE_STYLES,
  HOUSE_STYLE_NAMES,
  LINE_WEIGHTS,
  LINE_WEIGHT_NAMES,
  type HouseStyle,
  type LineWeight,
} from "../../packages/envelope-core/src/house-style";

const searchTerms: Record<string, string> = {
  "bar-model": "ratio sharing fractions amount comparison part whole",
  triangle: "pythagoras trigonometry sine cosine area angles",
  "number-line": "inequality inequalities interval ray",
  graph: "coordinate straight line points axes grid",
  "ratio-table": "proportion scaling unitary fractions",
  "value-table-graph": "table values quadratic parabola plotting",
  cuboids: "volume surface area cubes layers",
  charts:
    "statistics bar chart dual comparative composite stacked vertical line chart frequency data",
  venn: "sets probability shading intersection union",
  "probability-tree":
    "probability tree diagram branches replacement independent dependent conditional given that",
  "frequency-tree": "frequency tree probability counts groups statistics",
  construction:
    "constructions loci locus perpendicular bisector angle bisector compasses ruler scale drawing map bearings north GM8",
  elevations:
    "plans elevations plan front side isometric cubes 3D solids views GM8",
  "two-way-table":
    "two-way two way table totals frequency probability statistics fractions",
  area: "area perimeter compound shape rectilinear rectangle triangle parallelogram trapezium circle circumference semicircle quarter sector arc radius diameter pi shaded frame counting squares G16 G17 G18",
  angles:
    "angles straight line point vertically opposite parallel transversal alternate corresponding co-interior polygon interior exterior geometry G3",
  "factor-tree": "factor tree prime factors product of primes index form HCF LCM decomposition number",
  "sample-space": "sample space diagram two dice spinner coin outcomes sum product difference probability listing",
  "expanding-factorising":
    "algebra brackets multiplication factorise factorize",
};

export function Overview({ home = false }: { home?: boolean }) {
  const [search, setSearch] = useState("");
  const house = useHousePreference();
  const menu = useRef<HTMLDetailsElement>(null);
  // The house-style menu closes on Escape or a click elsewhere, like the site menu.
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (menu.current?.open && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    }
    function key(event: KeyboardEvent) {
      if (event.key !== "Escape" || !menu.current?.open) return;
      menu.current.open = false;
      menu.current.querySelector("summary")?.focus();
    }
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", key);
    };
  }, []);
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
      className={home ? "site-overview" : "site-overview site-overview-tools"}
      id="main-content"
      aria-label={home ? "Home" : undefined}
      tabIndex={-1}
    >
      {home ? (
        <PageHeading
          title="MathsDock"
          description="Reviewed GCSE exam questions, practice papers, assessment follow-up and print-ready diagram tools, made for maths department staff."
        />
      ) : (
        <PageHeading
          title="Diagram builder"
          description="Create clear diagrams for lesson resources, then copy them into Word."
        />
      )}
      {!home && (
        <>
          <div className="tool-search-row">
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
            <details ref={menu} className="house-style-menu">
              <summary>
                <Settings2 size={16} aria-hidden="true" />
                House style
              </summary>
              <fieldset className="house-style">
                <legend>House style for new diagrams</legend>
                <label>
                  Text
                  <select
                    value={house.style}
                    onChange={(event) =>
                      setHousePreference({
                        ...house,
                        style: event.target.value as HouseStyle,
                      })
                    }
                  >
                    {HOUSE_STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s === "large"
                          ? `${HOUSE_STYLE_NAMES[s]} (12 pt)`
                          : `${HOUSE_STYLE_NAMES[s]} (11 pt)`}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lines
                  <select
                    value={house.lines}
                    onChange={(event) =>
                      setHousePreference({
                        ...house,
                        lines: event.target.value as LineWeight,
                      })
                    }
                  >
                    {LINE_WEIGHTS.map((w) => (
                      <option key={w} value={w}>
                        {LINE_WEIGHT_NAMES[w]}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Each diagram keeps its own settings, which you can still
                  change in its editor. Saved files do not change.
                </p>
              </fieldset>
            </details>
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
