import { ArrowRight } from "lucide-react";
import { PageHeading } from "./PageHeading";
import { bookletTools, pageHref, siteSections } from "./registry";

export function Overview({ home = false }: { home?: boolean }) {
  return <main className="site-overview" id="main-content" tabIndex={-1}>
    <PageHeading title={home ? "Maths Tools" : "Booklet tools"} description={home ? "Questions and diagrams for your next lesson." : "Create clear diagrams for lesson resources, then copy them into Word."} />
    <div className={home ? "overview-cards overview-home-cards" : "overview-cards"}>
      {home ? siteSections.map(section => <a key={section.id} className="overview-card" href={section.href}>
        <span className="overview-icon"><section.icon size={25} aria-hidden="true" /></span>
        <h2>{section.name}</h2>
        <p>{section.description}</p>
        <span className="overview-launch">{section.action} <ArrowRight size={18} aria-hidden="true" /></span>
      </a>) : bookletTools.map(tool => <a key={tool.id} className={"preview" in tool ? "overview-card overview-tool-card" : "overview-card"} href={pageHref(tool.id)}><span className="overview-icon"><tool.icon size={25} /></span><h2>{tool.name}</h2><p>{tool.description}</p><span className="overview-launch">Open {tool.name} <ArrowRight size={18} /></span>{"preview" in tool && <img className="overview-tool-preview" src={tool.preview.src} alt={tool.preview.alt} width={320} height={320} decoding="async" />}</a>)}
    </div>
    {!home && <p className="overview-note">Your diagrams stay in your browser. Use an editable file to keep a copy for later.</p>}
  </main>;
}
