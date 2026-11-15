import { ArrowRight } from "lucide-react";
import { PageHeading } from "./PageHeading";
import { siteSections } from "./registry";

/** Home lists the six main pages. */
export function Overview() {
  return (
    <main className="site-overview" id="main-content" aria-label="Home" tabIndex={-1}>
      <PageHeading
        title="MathsDock"
        description="Reviewed GCSE exam questions, practice papers, assessment follow-up and print-ready diagram tools, made for maths department staff."
      />
      <div className="overview-cards">
        {siteSections.map((section) => (
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
        ))}
      </div>
    </main>
  );
}
