import { ArrowRight, BookOpen, Shapes } from "lucide-react";
import { PageHeading } from "./PageHeading";
import { bookletTools, pageHref } from "./registry";

export function Overview({ home = false }: { home?: boolean }) {
  return <main className="site-overview" id="main-content" aria-label={home ? "Home" : undefined} tabIndex={-1}>
    {!home && <PageHeading title="Booklet tools" description="Create clear diagrams for lesson resources, then copy them into Word." />}
    <div className="overview-cards">
      {home ? <>
        <a className="overview-card" href={pageHref("question-bank")}><span className="overview-icon"><BookOpen size={25} /></span><h2>Question bank</h2><p>Find reviewed exam questions by topic, display them in class and export question papers with mark schemes.</p><span className="overview-launch">Open Question bank <ArrowRight size={18} /></span></a>
        <a className="overview-card" href={pageHref("question-bank")+"&bankView=topics"}><span className="overview-icon"><BookOpen size={25} /></span><h2>Build a paper by topic</h2><p>Tick Sparx codes, review your questions and download a paper with its mark scheme.</p><span className="overview-launch">Build a paper <ArrowRight size={18} /></span></a>
        <a className="overview-card" href={pageHref("booklet-tools")}><span className="overview-icon"><Shapes size={25} /></span><h2>Booklet tools</h2><p>Create graphs, ratio tables and diagrams for your teaching resources.</p><span className="overview-launch">Explore booklet tools <ArrowRight size={18} /></span></a>
      </> : bookletTools.map(tool => <a key={tool.id} className="overview-card" href={pageHref(tool.id)}><span className="overview-icon"><tool.icon size={25} /></span><h2>{tool.name}</h2><p>{tool.description}</p><span className="overview-launch">Open {tool.name} <ArrowRight size={18} /></span></a>)}
    </div>
    {!home && <p className="overview-note">Your diagrams stay in your browser. Use an editable file to keep a copy for later.</p>}
  </main>;
}
