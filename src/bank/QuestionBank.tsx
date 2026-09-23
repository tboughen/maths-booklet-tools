import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, Copy, Download, Eye, EyeOff, FileDown, List, Maximize2, Minus, MoreHorizontal, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { flushSync } from "react-dom";
import { PdfView } from "./PdfView";
import { assetUrl, downloadBlob, preloadQuestion, questionImage } from "./pdf";
import { makePapers, type ExportProgress, type ExportResult } from "./export";
import { emptyReason, emptyRoute, exportSelection, filterQuestions, matchingParts, normalizeCode, readRoute, routeQuery, verifyCatalogue, type BankCatalogue, type BankRoute, type RoomLayout, type ViewRole } from "./model";
import "./question-bank.css";

type WebContext = {registerTool: (tool: {name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
const roomPreference = ():RoomLayout => {try {const v=localStorage.getItem("qb-room");return v==="single"||v==="two"?v:"auto";}catch{return "auto";}};

export default function QuestionBank() {
  const [catalogue,setCatalogue]=useState<BankCatalogue>();
  const [loadError,setLoadError]=useState("");
  const [reload,setReload]=useState(0);
  const [route,setRoute]=useState<BankRoute>(()=>readRoute(location.search));
  const [search,setSearch]=useState(route.code);
  const [notice,setNotice]=useState("");
  const [mode,setMode]=useState<{id:string;role:ViewRole;view:number}>({id:"",role:"question",view:0});
  const [zoom,setZoom]=useState(1);
  const [fit,setFit]=useState<"page"|"width">("page");
  const [room,setRoom]=useState<RoomLayout>(roomPreference);
  const [display,setDisplay]=useState(false);
  const [listOpen,setListOpen]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const [exportOpen,setExportOpen]=useState(false);
  const [exportIds,setExportIds]=useState<string[]>([]);
  const [preset,setPreset]=useState<"compact"|"writing">("compact");
  const [progress,setProgress]=useState<ExportProgress>();
  const [exportResult,setExportResult]=useState<ExportResult>();
  const [exportError,setExportError]=useState("");
  const [imageBusy,setImageBusy]=useState(false);
  const [wholeImage,setWholeImage]=useState(false);
  const [stageSize,setStageSize]=useState({width:900,height:500});
  const stage=useRef<HTMLDivElement>(null);
  const searchInput=useRef<HTMLInputElement>(null);
  const exportDialog=useRef<HTMLDialogElement>(null);
  const exportAbort=useRef<AbortController|undefined>(undefined);
  const touchStart=useRef<{x:number;y:number}|undefined>(undefined);
  const app=useRef<HTMLDivElement>(null);
  const go=useCallback((next:BankRoute,replace=false)=>{
    const query=routeQuery(next);
    if(location.search!==query) history[replace?"replaceState":"pushState"]({},"",`${location.pathname}${query}`);
    setRoute(next);setSearch(next.code);setMode({id:"",role:"question",view:0});setZoom(1);setNotice("");
  },[]);
  useEffect(()=>{
    const controller=new AbortController();setLoadError("");
    fetch(assetUrl("bank/catalogue.json"),{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error("Could not load the catalogue.");return r.json();}).then(data=>{const c=verifyCatalogue(data);setCatalogue(c);go(readRoute(location.search,c),true);}).catch(error=>{if(!controller.signal.aborted)setLoadError(error instanceof Error?error.message:"Could not load the catalogue.");});
    return ()=>controller.abort();
  },[reload,go]);
  useEffect(()=>{const back=()=>{setRoute(readRoute(location.search,catalogue));setSearch(readRoute(location.search,catalogue).code);setMode({id:"",role:"question",view:0});setZoom(1);};window.addEventListener("popstate",back);return()=>window.removeEventListener("popstate",back);},[catalogue]);
  useEffect(()=>{try{localStorage.setItem("qb-room",room);}catch{/* Optional device preference. */}},[room]);
  useEffect(()=>{if(!stage.current)return;const el=stage.current;const resize=()=>setStageSize({width:el.clientWidth,height:el.clientHeight});const observer=new ResizeObserver(resize);observer.observe(el);resize();return()=>observer.disconnect();},[catalogue,display,listOpen]);
  useEffect(()=>{if(exportOpen)exportDialog.current?.showModal();else exportDialog.current?.close();},[exportOpen]);
  useEffect(()=>()=>exportAbort.current?.abort(),[]);

  const results=useMemo(()=>catalogue?filterQuestions(catalogue,route):[],[catalogue,route]);
  const questionIndex=Math.max(0,results.findIndex(q=>q.id===route.question));
  const question=results[questionIndex];
  const role=mode.id===question?.id?mode.role:"question";
  const views=question?(role==="scheme"?question.schemeViews:question.questionViews):[];
  const viewIndex=Math.min(Math.max(0,role==="scheme"?mode.view:route.view),Math.max(0,views.length-1));
  const view=views[viewIndex];
  const topic=catalogue?.topics.find(t=>t.code===route.code);
  const match=question?matchingParts(question,route.code):undefined;
  const suggestions=catalogue?.topics.filter(t=>search.trim()?`${t.code} ${t.title}`.toLowerCase().includes(search.trim().toLowerCase()):catalogue.pilotCodes.includes(t.code)).slice(0,30)||[];
  const availablePair=views.slice(viewIndex,viewIndex+2);
  const pairScale=availablePair.length===2?Math.min((stageSize.width-48)/availablePair.reduce((n,v)=>n+v.width,0),(stageSize.height-32)/Math.max(...availablePair.map(v=>v.height))):0;
  const two=availablePair.length===2&&(room==="two"||(room==="auto"&&stageSize.width>=1500&&pairScale>=1.3));
  const visibleViews=two?availablePair:view?[view]:[];
  const widthScale=visibleViews.length?(stageSize.width-32-(two?16:0))/visibleViews.reduce((n,v)=>n+v.width,0):1;
  const fitScale=visibleViews.length?Math.min(widthScale,(stageSize.height-32)/Math.max(...visibleViews.map(v=>v.height))):1;
  const scale=Math.max(.01,(fit==="width"?widthScale:fitScale)*zoom);
  const exportSnapshot=catalogue&&exportIds.length?exportSelection(catalogue,exportIds):undefined;
  const reason=catalogue?emptyReason(catalogue,route):null;
  const previous=!!question&&(questionIndex>0||viewIndex>0);
  const next=!!question&&(questionIndex<results.length-1||viewIndex+visibleViews.length<views.length);

  const move=useCallback((direction:number)=>{
    if(!question)return;const newView=viewIndex+direction*(two?2:1);
    if(newView>=0&&newView<views.length){if(role==="scheme")setMode({id:question.id,role,view:newView});else{const updated={...route,question:question.id,view:newView};history.pushState({},"",`${location.pathname}${routeQuery(updated)}`);setRoute(updated);}}
    else{const target=results[questionIndex+direction];if(target)go({...route,question:target.id,view:direction<0?target.questionViews.length-1:0});}
  },[question,viewIndex,two,views.length,role,route,results,questionIndex,go]);
  const reveal=useCallback(()=>{if(question)setMode({id:question.id,role:role==="question"?"scheme":"question",view:0});},[question,role]);
  const leaveDisplay=useCallback(()=>{setDisplay(false);if(document.fullscreenElement)void document.exitFullscreen().catch(()=>undefined);},[]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){leaveDisplay();return;}
      if((e.target as HTMLElement)?.closest("input,select,textarea,dialog,[contenteditable=true]")||exportOpen)return;
      if(["ArrowRight","PageDown"].includes(e.key)){e.preventDefault();move(1);}
      if(["ArrowLeft","PageUp"].includes(e.key)){e.preventDefault();move(-1);}
      if(e.key.toLowerCase()==="m"){e.preventDefault();reveal();}
    };
    const fullscreen=()=>{if(!document.fullscreenElement)setDisplay(false);};
    window.addEventListener("keydown",key);document.addEventListener("fullscreenchange",fullscreen);
    return()=>{window.removeEventListener("keydown",key);document.removeEventListener("fullscreenchange",fullscreen);};
  },[move,reveal,leaveDisplay,exportOpen]);
  useEffect(()=>{const q=results[questionIndex+1];if(q)void preloadQuestion(q).catch(()=>undefined);},[results,questionIndex]);

  const actions=useRef({catalogue,route,question,role,viewIndex,go});actions.current={catalogue,route,question,role,viewIndex,go};
  useEffect(()=>{
    const context=(document as Document&{modelContext?:WebContext}).modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=(tool:Parameters<WebContext["registerTool"]>[0])=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>undefined);}catch{/* Optional browser capability. */}};
    register({name:"question_bank_read_state",description:"Read the visible topic, question, view and whether its mark scheme is visible.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>{const a=actions.current;return{code:a.route.code,question:a.question?.id,role:a.role,view:a.viewIndex+1,version:a.catalogue?.version};}});
    register({name:"question_bank_open_topic",description:"Open a current Sparx topic in the visible viewer, hide its mark scheme and reset the view.",inputSchema:{type:"object",properties:{code:{type:"string"}},required:["code"],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input)=>{const a=actions.current;const raw=(input as{code?:unknown})?.code;if(typeof raw!=="string")throw new Error("A Sparx code is required.");const code=a.catalogue?.aliases[normalizeCode(raw)]||normalizeCode(raw);if(!a.catalogue?.topics.some(t=>t.code===code))throw new Error("Unknown Sparx code.");flushSync(()=>a.go({...emptyRoute,code}));return{code,questions:filterQuestions(a.catalogue,{...emptyRoute,code}).length};}});
    return()=>lifecycle.abort();
  },[]);

  function submitSearch(e:FormEvent){e.preventDefault();const code=normalizeCode(search),alias=catalogue?.aliases[code]||code;const exact=catalogue?.topics.find(t=>t.title.toLowerCase()===search.trim().toLowerCase());const candidate=exact?.code||(/^U\d+$/.test(alias)?alias:suggestions[0]?.code);if(candidate)go({...route,code:candidate,question:"",view:0});else setNotice("Choose a topic from the list or enter a Sparx code.");}
  function startExport(ids:string[]){setExportIds([...new Set(ids)]);setExportError("");setExportResult(undefined);setProgress(undefined);setExportOpen(true);}
  async function prepareExport(){if(!exportSnapshot)return;const controller=new AbortController();exportAbort.current=controller;setExportError("");setExportResult(undefined);try{setExportResult(await makePapers(exportSnapshot.questions,exportSnapshot.version,preset,setProgress,controller.signal));}catch(error){setExportError(controller.signal.aborted?"Export cancelled. Your selection is unchanged.":error instanceof Error?error.message:"Export failed. Please try again.");}finally{setProgress(undefined);}}
  function closeExport(){exportAbort.current?.abort();setExportOpen(false);}
  async function imageExport(copy:boolean){if(!question||!view)return;setImageBusy(true);try{const pending=questionImage(question,role,view,wholeImage);if(copy&&navigator.clipboard?.write&&typeof ClipboardItem!=="undefined"){try{await navigator.clipboard.write([new ClipboardItem({"image/png":pending})]);setNotice("Image copied. Paste it into Word or PowerPoint.");return;}catch{/* Download fallback. */}}downloadBlob(await pending,`${question.id}-${role}-${wholeImage?"whole":viewIndex+1}.png`);setNotice(copy?"Clipboard access was unavailable. The image was downloaded instead.":"Image downloaded with its source reference.");}catch(error){setNotice(error instanceof Error?error.message:"The image could not be exported.");}finally{setImageBusy(false);}}
  const countText=`${results.length} ${results.length===1?"question":"questions"}`;
  const rangeText=view?`View ${viewIndex+1}${two?`–${viewIndex+2}`:""} of ${views.length}`:"";
  const displayNotes=display?[...(question?.sourceErrata||[]).map(item=>item.note),...(role==="scheme"&&question?.schemeSourceNote?[question.schemeSourceNote]:[])]:[];

  return <div ref={app} className={`qb-app${display?" qb-display":""}`}>
    <header className="qb-header">
      <a className="qb-brand" href="?tool=graph"><span className="qb-brand-icon"><BookOpen size={22}/></span><span>Maths Tools<strong>Question bank</strong></span></a>
      <form onSubmit={submitSearch} className="qb-search-form">
        <label className="qb-search"><Search size={18}/><input ref={searchInput} aria-label="Sparx code or topic" value={search} list="qb-topics" onChange={e=>setSearch(e.target.value)} placeholder="Sparx code or topic" autoComplete="off"/></label>
        <datalist id="qb-topics">{suggestions.map(t=><option key={t.code} value={t.code}>{t.title} · {t.availableCount??t.pilotCount} available</option>)}</datalist>
        <button className="qb-button qb-primary" type="submit">Find</button>
      </form>
      <span className="qb-pilot">{catalogue?.publication?.label||"Question bank"}</span>
      <a className="qb-tools" href="?tool=graph">Graph tool <ArrowRight size={16}/></a>
    </header>
    <main className="qb-main">
      <div className="qb-toolbar">
        <div className="qb-topic">
          {route.code&&<span className="qb-code">{route.code}</span>}
          <div><h1>{topic?.title||(route.code?"Find a topic":catalogue?.publication?.heading||"Reviewed practice questions")}</h1><span className="qb-scope">{topic?`${topic.bankCount} matched in full bank · ${topic.availableCount??topic.pilotCount} ${catalogue?.publication?"available":"in this pilot"}`:catalogue?.publication?.description||(catalogue?`${catalogue.questions.length} reviewed questions`:"")}</span></div>
        </div>
        <div className="qb-toolbar-actions">
          <button className="qb-button" aria-expanded={listOpen} onClick={()=>setListOpen(!listOpen)}><List size={18}/>{countText}</button>
          <details className="qb-filters"><summary><SlidersHorizontal size={16}/> Filters{route.tier!=="all"||route.calculator!=="all"||route.collection!=="all"?" · active":""}</summary><div><label>Tier <select value={route.tier} onChange={e=>go({...route,tier:e.target.value as BankRoute["tier"],question:"",view:0})}><option value="all">Both tiers</option><option value="F">Foundation</option><option value="H">Higher</option></select></label><label>Calculator <select value={route.calculator} onChange={e=>go({...route,calculator:e.target.value as BankRoute["calculator"],question:"",view:0})}><option value="all">Either</option><option value="yes">Calculator</option><option value="no">Non-calculator</option></select></label><label>Collection <select value={route.collection} onChange={e=>go({...route,collection:e.target.value as BankRoute["collection"],question:"",view:0})}><option value="all">All sources</option><option value="past">Past papers</option><option value="mock">Mock papers</option></select></label><button className="qb-text-button" onClick={()=>go({...route,tier:"all",calculator:"all",collection:"all",question:"",view:0})}>Clear filters</button></div></details>
          <button className="qb-button" disabled={!results.length} onClick={()=>startExport(selected.length?selected:results.map(q=>q.id))}><FileDown size={18}/>Export PDFs{selected.length?` (${selected.length})`:""}</button>
          <button className="qb-button qb-primary" disabled={!question} onClick={()=>{setDisplay(true);(document.activeElement as HTMLElement)?.blur();}}><Maximize2 size={18}/> Display</button>
        </div>
      </div>
      {notice&&<div className="qb-notice" role="status">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice("")}><X size={16}/></button></div>}
      <div className={`qb-workspace${listOpen?" qb-with-list":""}`}>
        {listOpen&&<aside className="qb-results" aria-label="Matching questions"><div className="qb-results-heading"><strong>{countText}</strong><button className="qb-text-button" onClick={()=>setSelected(results.map(q=>q.id))}>Select all</button><button className="qb-text-button" onClick={()=>setSelected([])}>Clear</button></div>{results.map((q,i)=><div key={q.id} className={`qb-result${question?.id===q.id?" active":""}`}><input type="checkbox" aria-label={`Select ${q.source}`} checked={selected.includes(q.id)} onChange={e=>setSelected(s=>e.target.checked?[...s,q.id]:s.filter(id=>id!==q.id))}/><button onClick={()=>go({...route,question:q.id,view:0})}><b>{i+1}. {q.source}</b><span>{q.description}</span><small>{q.marks} mark{q.marks===1?"":"s"} · {q.tier==="H"?"Higher":"Foundation"}</small></button></div>)}</aside>}
        <section className="qb-question-card" aria-label="Question viewer">
          <div className="qb-source">
            <div className="qb-source-copy"><div className="qb-source-heading"><strong>{question?.source||"Topic results"}</strong>{question&&<span>{question.tier==="H"?"Higher":"Foundation"} · {question.calculator?"Calculator":"Non-calculator"} · {question.marks} mark{question.marks===1?"":"s"}</span>}</div>
              {question&&<div className="qb-view-info"><span>{role==="scheme"?"Mark scheme":view?.label}{view?.repeatedContext?" · Context repeated":""}</span>{route.code&&match&&<span>Matched parts: {match.labels.join(", ")} · {match.marks} of {question.marks} mark{question.marks===1?"":"s"}</span>}</div>}
              {question?.sourceErrata?.map((erratum,i)=><p className="qb-erratum" key={i}>{erratum.note}</p>)}
              {role==="scheme"&&question?.schemeSourceNote&&<p className="qb-erratum">{question.schemeSourceNote}</p>}
            </div>
            {question&&<div className="qb-source-actions">
              <button className="qb-text-button" onClick={()=>setSelected(s=>s.includes(question.id)?s.filter(id=>id!==question.id):[...s,question.id])}>{selected.includes(question.id)?<Check size={16}/>:<Plus size={16}/>} {selected.includes(question.id)?"Selected":"Select question"}</button>
              <button className={`qb-button${role==="scheme"?" qb-answer-active":""}`} aria-pressed={role==="scheme"} onClick={reveal}>{role==="scheme"?<EyeOff size={18}/>:<Eye size={18}/>} {role==="scheme"?"Hide mark scheme":"Show mark scheme"}</button>
              <details className="qb-more"><summary aria-label="Question options" title="Question options"><MoreHorizontal size={20}/></summary><div className="qb-more-menu">
                <a href={assetUrl(question.printPdf)} target="_blank" rel="noreferrer">Source question PDF</a>
                <button onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}${location.pathname}${routeQuery({...route,question:question.id,view:viewIndex})}`);setNotice("Question link copied.");}catch{setNotice("Copy the question link from your browser address bar.");}}}>Copy link</button>
                <button onClick={()=>{downloadBlob(new Blob([JSON.stringify({question:question.id,source:question.source,code:route.code,view:viewIndex+1,role,version:catalogue?.version,issue:"Describe the correction here."},null,2)],{type:"application/json"}),`question-feedback-${question.id}.json`);setNotice("Feedback details downloaded. Add a description and keep it with your question-bank notes.");}}>Report a problem</button>
                {question.equivalentSource&&<p>Also appears as {question.equivalentSource}.</p>}
                <p>← / → or Page Up / Down: navigate<br/>M: mark scheme · Escape: exit Display<br/>Swipe to navigate on a touch screen.</p>
              </div></details>
            </div>}
          </div>
          {question?.scaleSensitive&&<p className="qb-scale-note">Scale drawing: print the PDF at Actual size / 100%.</p>}
          {displayNotes.length>0&&<div className="qb-display-notes" role="note" aria-label="Source notes">{displayNotes.map((note,i)=><p className="qb-erratum" key={i}>{note}</p>)}</div>}
          <div ref={stage} className={`qb-stage${role==="scheme"?" qb-scheme-stage":""}`} onTouchStart={e=>{touchStart.current={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};}} onTouchEnd={e=>{const t=touchStart.current;if(!t||zoom!==1)return;const dx=e.changedTouches[0].clientX-t.x,dy=e.changedTouches[0].clientY-t.y;if(Math.abs(dx)>90&&Math.abs(dy)<60)move(dx<0?1:-1);touchStart.current=undefined;}}>
            {loadError?<div className="qb-empty" role="alert"><h2>Could not load the question bank</h2><p>{loadError} Check your connection and try again.</p><button className="qb-button" onClick={()=>setReload(v=>v+1)}>Try again</button></div>:!catalogue?<p role="status">Loading questions…</p>:question?<div className="qb-view-group" style={{minWidth:visibleViews.reduce((n,v)=>n+v.width*scale,0)+(two?16:0),minHeight:Math.max(...visibleViews.map(v=>v.height*scale))}}>{visibleViews.map((v,i)=><PdfView key={role+"-"+i} path={role==="scheme"?question.schemePdf:question.questionPdf} view={v} scale={scale} retryKey={reload}/>)}</div>:<div className="qb-empty"><BookOpen size={32}/><h2>{reason==="unknown"?"That Sparx code was not found":reason==="filtered"?"No questions match these filters":reason==="no-bank-match"?"No matching question in the 12-set bank":"This topic is not yet available"}</h2><p>{reason==="no-bank-match"?`${route.code} is a valid current topic. The agreed bank contains no mapped question for it.`:reason==="not-in-pilot"?`${topic?.bankCount||0} questions are mapped in the full bank. None is available for this topic yet; ${catalogue.questions.length} reviewed questions are available overall.`:reason==="filtered"?"Clear the filters to see the available questions for this topic.":"Search by current Sparx code or topic title."}</p><button className="qb-button" onClick={()=>{if(reason==="filtered")go({...route,tier:"all",calculator:"all",collection:"all"});else{searchInput.current?.focus();searchInput.current?.select();}}}>{reason==="filtered"?"Clear filters":"Search another topic"}</button></div>}
          </div>
          <footer className="qb-footer">
          <nav className="qb-navigation" aria-label="Question navigation"><button className="qb-button" disabled={!previous} onClick={()=>move(-1)} title="Previous · Left arrow"><ArrowLeft size={18}/><span>Previous</span></button><div><strong>{question?`Question ${questionIndex+1} of ${results.length}`:"0 questions"}</strong><span>{rangeText}</span></div><button className="qb-button" disabled={!next} onClick={()=>move(1)} title="Next · Right arrow"><span>Next</span><ArrowRight size={18}/></button></nav>
          {question&&<div className="qb-controls"><div className="qb-zoom"><button className="qb-button qb-icon" aria-label="Zoom out" disabled={zoom<=.5} onClick={()=>setZoom(z=>Math.max(.5,z-.25))}><Minus size={16}/></button><output>{Math.round(zoom*100)}%</output><button className="qb-button qb-icon" aria-label="Zoom in" disabled={zoom>=3} onClick={()=>setZoom(z=>Math.min(3,z+.25))}><Plus size={16}/></button><select aria-label="Fit mode" value={fit} onChange={e=>{setFit(e.target.value as typeof fit);setZoom(1);}}><option value="page">Fit view</option><option value="width">Fit width</option></select><button className="qb-text-button" onClick={()=>{setZoom(1);setFit("page");}}>Reset</button></div><label className="qb-layout">Room <select aria-label="Room layout" value={room} onChange={e=>setRoom(e.target.value as RoomLayout)}><option value="auto">Auto</option><option value="single">Single view</option><option value="two">Two views</option></select></label><div className="qb-image-actions"><label><input type="checkbox" checked={wholeImage} onChange={e=>setWholeImage(e.target.checked)}/> Whole question</label><button className="qb-button" disabled={imageBusy} onClick={()=>void imageExport(true)}><Copy size={16}/>Copy image</button><button className="qb-button" disabled={imageBusy} onClick={()=>void imageExport(false)}><Download size={16}/>PNG</button></div></div>}
          </footer>
        </section>
      </div>
    </main>
    {display&&<button className="qb-exit-display qb-button" onClick={leaveDisplay}><X size={18}/> Exit Display <kbd>Esc</kbd></button>}
    <dialog ref={exportDialog} className="qb-dialog" onCancel={e=>{e.preventDefault();closeExport();}} onClose={()=>setExportOpen(false)}><div className="qb-dialog-heading"><h2>Build a practice paper</h2><button className="qb-button qb-icon" aria-label="Close export" onClick={closeExport}><X size={20}/></button></div><p><strong>{exportSnapshot?.questions.length||0} complete questions · {exportSnapshot?.marks||0} mark{exportSnapshot?.marks===1?"":"s"}</strong></p><p>Questions and mark schemes are separate PDFs, in the order below. All parts are included, including parts mapped to other topics.</p><ol className="qb-export-list">{exportSnapshot?.questions.map((q,i)=><li key={q.id}><span>{q.source}<small>{q.marks} mark{q.marks===1?"":"s"}{q.equivalentId&&exportIds.includes(q.equivalentId)?" · duplicate across tiers selected":""}{q.scaleSensitive?" · original scale retained":""}</small></span><button className="qb-button qb-icon" aria-label={`Move ${q.source} up`} disabled={!!progress||i===0} onClick={()=>{const ids=[...exportIds];[ids[i-1],ids[i]]=[ids[i],ids[i-1]];setExportIds(ids);setExportResult(undefined);}}><ArrowUp size={16}/></button><button className="qb-button qb-icon" aria-label={`Move ${q.source} down`} disabled={!!progress||i===exportIds.length-1} onClick={()=>{const ids=[...exportIds];[ids[i],ids[i+1]]=[ids[i+1],ids[i]];setExportIds(ids);setExportResult(undefined);}}><ArrowDown size={16}/></button><button className="qb-button qb-icon" aria-label={`Remove ${q.source}`} disabled={!!progress||exportIds.length===1} onClick={()=>{setExportIds(exportIds.filter(id=>id!==q.id));setExportResult(undefined);}}><X size={16}/></button></li>)}</ol><fieldset disabled={!!progress}><legend>Page layout</legend><label><input type="radio" name="preset" checked={preset==="compact"} onChange={()=>{setPreset("compact");setExportResult(undefined);}}/> Compact practice — reviewed classroom crops</label><label><input type="radio" name="preset" checked={preset==="writing"} onChange={()=>{setPreset("writing");setExportResult(undefined);}}/> Writing space — original regions plus working lines</label></fieldset>{exportError&&<p role="alert" className="qb-export-error">{exportError}</p>}{progress&&<div role="status"><p>{progress.message}</p><progress value={progress.done} max={progress.total}/></div>}{exportResult?<div className="qb-export-ready" role="status"><strong>Both PDFs are ready</strong><button className="qb-button qb-primary" onClick={()=>downloadBlob(exportResult.questions,"practice-questions.pdf")}><Download size={16}/>Questions PDF</button><button className="qb-button" onClick={()=>downloadBlob(exportResult.schemes,"practice-mark-schemes.pdf")}><Download size={16}/>Mark schemes PDF</button></div>:<div className="qb-dialog-actions"><button className="qb-button" onClick={progress?()=>exportAbort.current?.abort():closeExport}>{progress?"Cancel export":"Cancel"}</button><button className="qb-button qb-primary" disabled={!!progress||!exportSnapshot} onClick={()=>void prepareExport()}><FileDown size={18}/>Prepare both PDFs</button></div>}<p className="qb-small">The original exam question numbers remain visible beneath the new paper numbering. This custom paper has no official grade boundaries.</p></dialog>
  </div>;
}
