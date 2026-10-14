import { ArrowRight, BookOpen, Shapes, FileSpreadsheet } from "lucide-react";
import { PageHeading } from "./PageHeading";
import { bookletTools, pageHref } from "./registry";
import assessmentPreview from "../assets/tool-previews/assessment-follow-up.png";

export function Overview({ home = false }: { home?: boolean }) {
  return <main className="site-overview" id="main-content" aria-label={home ? "Home" : undefined} tabIndex={-1}>
    {!home && <PageHeading title="Booklet tools" description="Create clear diagrams for lesson resources, then copy them into Word." />}
    <div className={home ? "overview-cards" : "overview-cards overview-tool-cards"}>
      {home ? <>
        <a className="overview-card" href={pageHref("question-bank")}><span className="overview-icon"><BookOpen size={25} /></span><h2>Question bank</h2><p>Find reviewed exam questions by topic, display them in class and export question papers with mark schemes.</p><span className="overview-launch">Open Question bank <ArrowRight size={18} /></span></a>
        <a className="overview-card" href={pageHref("question-bank")+"&bankView=topics"}><span className="overview-icon"><BookOpen size={25} /></span><h2>Build a paper by topic</h2><p>Tick Sparx codes, review your questions and download a paper with its mark scheme.</p><span className="overview-launch">Build a paper <ArrowRight size={18} /></span></a>
        <a className="overview-card" href={pageHref("assessment-follow-up")}><span className="overview-icon"><FileSpreadsheet size={25} /></span><h2>Assessment follow-up</h2><p>Use question-level results to generate individual practice with upside-down answers and one class PDF.</p><img className="overview-assessment-preview" src={assessmentPreview} alt="An actual A4 practice page with its assessment reference, writing space and upside-down mark scheme." width={420} height={594} /><span className="overview-launch">Create class practice <ArrowRight size={18} /></span></a>
        <a className="overview-card" href={pageHref("booklet-tools")}><span className="overview-icon"><Shapes size={25} /></span><h2>Booklet tools</h2><p>Create graphs, ratio tables and diagrams for your teaching resources.</p><span className="overview-launch">Explore booklet tools <ArrowRight size={18} /></span></a>
      </> : bookletTools.map(tool => <a key={tool.id} className="overview-card overview-tool-card" href={pageHref(tool.id)}>
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
