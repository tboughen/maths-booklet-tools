import { ArrowRight } from "lucide-react";
import { PageHeading } from "./PageHeading";
import { bookletTools, pageHref, siteSections } from "./registry";

export function Overview({ home = false }: { home?: boolean }) {
  return <main className="site-overview" id="main-content" aria-label={home ? "Home" : undefined} tabIndex={-1}>
    {!home && <PageHeading title="Booklet tools" description="Create clear diagrams for lesson resources, then copy them into Word." />}
    <div className={home ? "overview-cards" : "overview-cards overview-tool-cards"}>
      {home ? siteSections.map(section => <a key={section.id} className="overview-card" href={section.href}>
        <span className="overview-icon"><section.icon size={25} aria-hidden="true" /></span>
        <h2>{section.name}</h2>
        <p>{section.description}</p>
        <span className="overview-launch">{section.action} <ArrowRight size={18} aria-hidden="true" /></span>
      </a>) : bookletTools.map(tool => <a key={tool.id} className="overview-card overview-tool-card" href={pageHref(tool.id)}>
        <div className="overview-tool-copy">
          <span className="overview-icon"><tool.icon size={25} aria-hidden="true" /></span>
          <h2>{tool.name}</h2>
          <p>{tool.description}</p>
          <span className="overview-launch">Open {tool.name} <ArrowRight size={18} aria-hidden="true" /></span>
        </div>
        <img className="overview-tool-preview" src={tool.preview.src} alt={tool.preview.alt} width={320} height={320} decoding="async" />
      </a>)}
    </div>
    {!home && <p className="overview-note">Your diagrams stay in your browser. Use an editable file to keep a copy for later.</p>}
  </main>;
}
