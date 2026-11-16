import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Copy, Download, Eye, EyeOff, FileDown, List, Maximize2, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { flushSync } from "react-dom";
import { PdfView } from "./PdfView";
import { WorkedSurface } from "./WorkedSurface";
import { addedHeight, loadWorked, workedImageBlob, workedPlan, type WorkedShown } from "./worked";
import type { SurfaceOverlay } from "../../packages/worked-core/src/index";
import { ZoomControls, ZoomOverview } from "./ZoomControls";
import { useStageZoom } from "./useStageZoom";
import { stepZoom } from "./zoom";
import { AnnotationBar } from "./AnnotationBar";
import { annotationReducer, readAnnotationPreferences, saveAnnotationPreferences, withTool, type AnnotationPreferences, hasInk, HIGHLIGHTER_COLOURS, layerOf, PEN_COLOURS, SIZES, toolCursor, type AnnotationTool, type Stroke } from "./annotations";
import type { AnnotationSettings } from "./AnnotationLayer";
import { OverlayControls } from "./OverlayControls";
import { overlayPreference, overlays, type Overlay } from "./overlays";
import { assetUrl, downloadBlob, preloadQuestion, questionImage, stackImage } from "./pdf";
import { catalogueCoverage } from "./coverage";
import { questionResource } from "./resources";
import { addedNote, servedParts } from "./cuts";
import { draftEntries, draftReducer, hasDraftIntent } from "./paper-builder";
import { loadPaperDraft, paperSummary, savePaperDraft } from "./paper-storage";
import { forgetWork, noteWork } from "../site/recentWork";
import { TopicPaperBuilder } from "./TopicPaperBuilder";
import { PaperSummary } from "./PaperSummary";
import { PaperReviewDialog } from "./PaperReviewDialog";
import { emptyReason, emptyRoute, filterQuestions, matchingParts, normalizeCode, questionIdentity, readRoute, routeQuery, type BankListQuestion, type BankQuestion, type BankRoute, type BankView, type RoomLayout, type ViewRole } from "./model";
import { createDetailLoader, fetchCatalogueIndex, type BankIndex } from "./catalogueLoader";
import { withPerformance } from "./performance";
import { PerformanceBadge } from "./PerformanceBadge";
import "./question-bank.css";
import { pageHref, readPage } from "../site/routes";
import { formatCount } from "./format";

type WebContext = {registerTool: (tool: {name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
/** The bank page's path and query for a route. */
const bankAddress = (route: BankRoute) => pageHref("question-bank") + routeQuery(route);
/** What one step of the viewer shows: a question page, or a part stacked under its stem and the parts it needs. */
interface Slide {items: {pdf: string; view: BankView; worked?: boolean; overlay?: SurfaceOverlay}[]; width: number; height: number; label: string; repeatedContext?: string}
/** The gap between stacked cuts, in points. */
const STACK_GAP = 12;
const roomPreference = ():RoomLayout => {try {const v=localStorage.getItem("qb-room");return v==="single"||v==="two"?v:"auto";}catch{return "auto";}};

export default function QuestionBank({ active = true }: { active?: boolean }) {
  const activePage=useRef(active);activePage.current=active;
  const [catalogue,setCatalogue]=useState<BankIndex>();
  // Views, PDFs and worked solutions arrive one paper at a time (bankCatalogueSplit.ts).
  const [details,setDetails]=useState<Record<string,BankQuestion>>({});
  const [detailError,setDetailError]=useState("");
  const loader=useMemo(()=>catalogue?createDetailLoader(catalogue):undefined,[catalogue]);
  const loadDetails=useCallback(async<Q extends BankListQuestion>(questions:Q[])=>{if(!loader)throw new Error("The question bank is still loading.");const full=await loader.load(questions);setDetails(previous=>full.every(q=>previous[q.id])?previous:{...previous,...Object.fromEntries(full.map(q=>[q.id,q]))});return full;},[loader]);
  const [loadError,setLoadError]=useState("");
  const [reload,setReload]=useState(0);
  const [route,setRoute]=useState<BankRoute>(()=>readRoute(location.search));
  const [search,setSearch]=useState(route.code);
  const [notice,setNotice]=useState("");
  const [mode,setMode]=useState<{id:string;role:ViewRole;view:number}>({id:"",role:"question",view:0});
  const [zoom,setZoom]=useState(1);
  const [fit,setFit]=useState<"page"|"width">("page");
  const [room,setRoom]=useState<RoomLayout>(roomPreference);
  const [overlay,setOverlay]=useState<Overlay>(overlayPreference);
  useEffect(()=>{try{localStorage.setItem("qb-overlay",overlay);}catch{/* Optional device preference. */}},[overlay]);
  const [display,setDisplay]=useState(false);
  // Screen-only annotations: in memory for this visit, one layer per view, never saved, linked or exported.
  const [ink,dispatchInk]=useReducer(annotationReducer,{});
  const [annotating,setAnnotating]=useState(false);
  const [annotatePrefs,setAnnotatePrefs]=useState<AnnotationPreferences>(readAnnotationPreferences);
  useEffect(()=>saveAnnotationPreferences(annotatePrefs),[annotatePrefs]);
  // Read by the key handler, so quick key presses never see a stale tool.
  const annotateNow=useRef({annotating,tool:annotatePrefs.tool});annotateNow.current={annotating,tool:annotatePrefs.tool};
  const undoKeys=useRef<string[]>([]);const redoKeys=useRef<string[]>([]);
  const [showPerformance,setShowPerformance]=useState(false);
  const [listOpen,setListOpen]=useState(false);
  const [draft,dispatchDraft]=useReducer(draftReducer,undefined,()=>loadPaperDraft());
  // Home's "Carry on" row lists the paper once the teacher changes what is in it, and drops it when it is cleared.
  const paperChoice=useRef<string|undefined>(undefined);
  useEffect(()=>{
    savePaperDraft(draft);
    const choice=JSON.stringify([draft.codes,draft.manual,draft.excluded]);
    if(paperChoice.current!==undefined&&paperChoice.current!==choice){if(hasDraftIntent(draft))noteWork("paper-builder",paperSummary(draft));else forgetWork("paper-builder");}
    paperChoice.current=choice;
  },[draft]);
  const draftRef=useRef(draft);draftRef.current=draft;
  const [reviewOpen,setReviewOpen]=useState(false);
  const [imageBusy,setImageBusy]=useState(false);
  const [wholeImage,setWholeImage]=useState(false);
  // With a topic open, a question cut into parts shows only its matching parts unless the teacher asks for the whole question.
  const [partsView,setPartsView]=useState(true);
  const [stageSize,setStageSize]=useState({width:900,height:500});
  const stage=useRef<HTMLDivElement>(null);
  const searchInput=useRef<HTMLInputElement>(null);
  // The question view a teacher had zoomed into before showing its mark scheme or worked solution.
  const questionView=useRef<{id:string;zoom:number;scroll:{left:number;top:number}}|undefined>(undefined);
  const app=useRef<HTMLDivElement>(null);
  // A route read from a link may carry viewError (the link named a view that does not exist); it is
  // shown once as the notice and never kept on the route, so later route changes do not repeat it.
  const go=useCallback(({viewError,...next}:BankRoute,replace=false)=>{
    const address=bankAddress(next);
    if(activePage.current && location.pathname+location.search!==address) history[replace?"replaceState":"pushState"]({},"",address);
    if(activePage.current)window.dispatchEvent(new Event("maths-tools:route"));
    setReviewOpen(false);if(next.bankView==="topics")setDisplay(false);setRoute(next);setSearch(next.code);setMode({id:"",role:"question",view:0});setZoom(1);setNotice(viewError??"");
  },[]);
  useEffect(()=>{
    const controller=new AbortController();setLoadError("");const initialSearch=location.search;
    fetchCatalogueIndex(controller.signal).then(data=>{const c=withPerformance(data);setDetails({});setDetailError("");setCatalogue(c);const old=draftRef.current;dispatchDraft({type:"reconcile",catalogue:c});go(readRoute(activePage.current?location.search:initialSearch,c),true);if(old.version&&old.version!==c.version){const reconciled="The question bank was updated. Your paper has been reconciled with the current catalogue; review it before exporting.";setNotice(previous=>previous?`${previous} ${reconciled}`:reconciled);}}).catch(error=>{if(!controller.signal.aborted)setLoadError(error instanceof Error?error.message:"Could not load the catalogue.");});
    return ()=>controller.abort();
  },[reload,go]);
  useEffect(()=>{const back=()=>{if(readPage()!=="question-bank")return;const {viewError,...next}=readRoute(location.search,catalogue);setMode(previous=>previous.role==="worked-solution"?{id:"",role:"question",view:0}:previous);if(viewError){history.replaceState(history.state,"",bankAddress(next));setNotice(viewError);}if(JSON.stringify(next)===JSON.stringify(route))return;setReviewOpen(false);setDisplay(false);setRoute(next);setSearch(readRoute(location.search,catalogue).code);setZoom(1);};window.addEventListener("popstate",back);return()=>window.removeEventListener("popstate",back);},[catalogue,route]);
  useEffect(()=>{try{localStorage.setItem("qb-room",room);}catch{/* Optional device preference. */}},[room]);
  // The Filters panel and question options menu close when a teacher clicks, taps or tabs anywhere else, or presses Escape.
  useEffect(()=>{const menus=()=>Array.from(app.current?.querySelectorAll<HTMLDetailsElement>("details.qb-filters[open], details.qb-more[open]")??[]);const outside=(event:Event)=>{for(const menu of menus())if(!menu.contains(event.target as Node))menu.open=false;};const escape=(event:KeyboardEvent)=>{if(event.key!=="Escape")return;const menu=menus().find(m=>m.contains(document.activeElement));if(!menu)return;event.preventDefault();event.stopPropagation();menu.open=false;menu.querySelector("summary")?.focus();};document.addEventListener("pointerdown",outside);document.addEventListener("focusin",outside);document.addEventListener("keydown",escape,true);return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("focusin",outside);document.removeEventListener("keydown",escape,true);};},[]);
  useEffect(()=>{if(!stage.current)return;const el=stage.current;const resize=()=>setStageSize({width:el.clientWidth,height:el.clientHeight});const observer=new ResizeObserver(resize);observer.observe(el);resize();return()=>observer.disconnect();},[catalogue,display,listOpen,route.bankView]);


  const filters=useMemo(()=>({tier:route.tier,calculator:route.calculator,collection:route.collection,crossover:route.crossover,revision:route.revision}),[route.tier,route.calculator,route.collection,route.crossover,route.revision]);
  const coverage=useMemo(()=>catalogue?catalogueCoverage(catalogue,filters):undefined,[catalogue,filters]);
  const overall=useMemo(()=>catalogue?catalogueCoverage(catalogue,{...emptyRoute,revision:"include"}):undefined,[catalogue]);
  const entries=useMemo(()=>coverage?draftEntries(coverage,draft):[],[coverage,draft]);
  // Questions already in the paper that the hidden Year 11 revision papers now leave out.
  const revisionDropped=useMemo(()=>catalogue&&route.revision==="hide"?draftEntries(catalogueCoverage(catalogue,{...filters,revision:"include"}),draft).length-entries.length:0,[catalogue,route.revision,filters,draft,entries]);
  const included=useMemo(()=>new Set(entries.map(e=>e.key)),[entries]);
  const topicsMode=route.bankView==="topics";
  useEffect(()=>{dispatchDraft({type:"remember",keys:entries.map(e=>e.key)});},[entries]);
  useEffect(()=>{if(!active)setReviewOpen(false);},[active]);
  const results=useMemo(()=>catalogue?filterQuestions(catalogue,route):[],[catalogue,route]);
  const revisionHidden=useMemo(()=>catalogue&&route.revision==="hide"?filterQuestions(catalogue,{...route,revision:"include"}).length-results.length:0,[catalogue,route,results]);
  const questionIndex=Math.max(0,results.findIndex(q=>q.id===route.question));
  const listed=results[questionIndex] as BankListQuestion|undefined;
  const question=listed?details[listed.id]:undefined;
  const following=results[questionIndex+1] as BankListQuestion|undefined;
  useEffect(()=>{if(!listed||topicsMode)return;let current=true;setDetailError("");loadDetails(following&&active?[listed,following]:[listed]).catch(error=>{if(current)setDetailError(error instanceof Error?error.message:"This question could not be loaded.");});return()=>{current=false;};},[listed,following,topicsMode,active,loadDetails,reload]);
  const role=mode.id===question?.id?mode.role:"question";
  const resource=question?questionResource(question,role):undefined;
  const topic=catalogue?.topics.find(t=>t.code===route.code);
  const match=question?matchingParts(question,route.code):undefined;
  const served=useMemo(()=>question&&route.code&&match?servedParts(question,match.labels):undefined,[question,route.code,match]);
  const partMode=role!=="scheme"&&!!served&&partsView;
  // Keyed on what it shows, not on `served`, which is rebuilt on every render.
  const planKey=question&&role==="worked-solution"&&question.workedSolution?`${question.id}|${question.revision}|${question.workedSolution.revision}|${partMode&&served?served.cuts.map(c=>c.cut.id).join(","):"whole"}`:"";
  const planInputs=useRef({question,partMode,served});planInputs.current={question,partMode,served};
  const solutionPlan=useMemo(()=>{const {question:q,partMode:parts,served:s}=planInputs.current;return planKey&&q?workedPlan(q,parts?s:undefined):undefined;},[planKey]);
  const [worked,setWorked]=useState<{plan:unknown;shown?:WorkedShown;error?:string}>();
  const [workedRetry,setWorkedRetry]=useState(0);
  useEffect(()=>{
    if(!question||!solutionPlan)return;
    let current=true;setWorked({plan:solutionPlan});
    loadWorked(question,solutionPlan).then(shown=>{if(current){setWorked({plan:solutionPlan,shown});if(shown.issues.length)console.warn(`Worked solution ${question.id}:`,shown.issues);}},error=>{if(current)setWorked({plan:solutionPlan,error:error instanceof Error?error.message:"The worked solution could not load."});});
    return()=>{current=false;};
  },[question,solutionPlan,workedRetry]);
  const workedShown=worked?.plan===solutionPlan?worked:undefined;
  // Mark notes (on for teachers, off for a pupil copy) and step by step; both only hide parts of the working.
  const [workedMarks,setWorkedMarks]=useState(()=>{try{return localStorage.getItem("qb-worked-marks")!=="off";}catch{return true;}});
  const [stepMode,setStepMode]=useState(false);
  const [stepsShown,setStepsShown]=useState(0);
  const shownSteps=useMemo(()=>workedShown?.shown?.shownSteps??[],[workedShown]);
  useEffect(()=>{setStepsShown(0);},[planKey]);
  const upTo=stepMode?(stepsShown?shownSteps[stepsShown-1]:0):undefined;
  const chooseMarks=(on:boolean)=>{setWorkedMarks(on);try{localStorage.setItem("qb-worked-marks",on?"on":"off");}catch{/* Kept for this visit only. */}};
  const views=useMemo<Slide[]>(()=>{
    if(role==="worked-solution"){
      const items=workedShown?.shown?.items;
      if(!items?.length)return [];
      return [{items:items.map(item=>({...item,worked:true})),width:Math.max(...items.map(i=>i.view.width)),height:items.reduce((n,i)=>n+i.view.height+addedHeight(i.overlay),0)+STACK_GAP*(items.length-1),label:partMode&&served?`Worked solution · ${served.title}`:"Worked solution"}];
    }
    if(partMode&&served){const items=served.cuts.flatMap(s=>s.cut.views.map(view=>({pdf:s.cut.pdf,view})));return [{items,width:Math.max(...items.map(i=>i.view.width)),height:items.reduce((n,i)=>n+i.view.height,0)+STACK_GAP*(items.length-1),label:served.title}];}
    return (resource?.views||[]).map(view=>({items:[{pdf:resource!.pdf,view}],width:view.width,height:view.height,label:view.label,repeatedContext:view.repeatedContext}));
  },[partMode,served,resource,role,workedShown]);
  const viewIndex=Math.min(Math.max(0,role!=="question"?mode.view:route.view),Math.max(0,views.length-1));
  const view=views[viewIndex];
  const suggestions=catalogue?.topics.filter(t=>search.trim()?`${t.code} ${t.title}`.toLowerCase().includes(search.trim().toLowerCase()):catalogue.pilotCodes.includes(t.code)).slice(0,30)||[];
  const availablePair=views.slice(viewIndex,viewIndex+2);
  const pairScale=availablePair.length===2?Math.min((stageSize.width-48)/availablePair.reduce((n,v)=>n+v.width,0),(stageSize.height-32)/Math.max(...availablePair.map(v=>v.height))):0;
  const two=availablePair.length===2&&(room==="two"||(room==="auto"&&stageSize.width>=1500&&pairScale>=1.3));
  const visibleViews=two?availablePair:view?[view]:[];
  const widthScale=visibleViews.length?(stageSize.width-32-(two?16:0))/visibleViews.reduce((n,v)=>n+v.width,0):1;
  const fitScale=visibleViews.length?Math.min(widthScale,(stageSize.height-32)/Math.max(...visibleViews.map(v=>v.height))):1;
  const scale=Math.max(.01,(fit==="width"?widthScale:fitScale)*zoom);
  const reason=catalogue?emptyReason(catalogue,route):null;
  const previous=!!listed&&(questionIndex>0||viewIndex>0);
  const next=!!listed&&(questionIndex<results.length-1||viewIndex+visibleViews.length<views.length);

  const move=useCallback((direction:number)=>{
    if(!listed)return;const newView=viewIndex+direction*(two?2:1);
    if(question&&newView>=0&&newView<views.length){if(role!=="question")setMode({id:question.id,role,view:newView});else{const updated={...route,question:question.id,view:newView};history.pushState({},"",bankAddress(updated));window.dispatchEvent(new Event("maths-tools:route"));setRoute(updated);}}
    else{const target=results[questionIndex+direction];if(target)go({...route,question:target.id,view:direction<0?Math.max(0,(target.questionViewCount??1)-1):0});}
  },[listed,question,viewIndex,two,views.length,role,route,results,questionIndex,go]);
  const pannable=visibleViews.reduce((n,v)=>n+v.width*scale,0)+(two?16:0)+32>stageSize.width+1||Math.max(0,...visibleViews.map(v=>v.height*scale))+32>stageSize.height+1;
  const {requestZoom,restoreScroll,panBy}=useStageZoom({stage,zoom,scale,setZoom,onSwipe:move,layoutKey:`${question?.id}|${role}|${viewIndex}|${two}|${partMode}`,enabled:!!question&&!topicsMode,drawing:annotating&&annotatePrefs.tool!=="hand"});
  const zoomStep=useCallback((direction:1|-1)=>requestZoom(stepZoom(zoom,direction)),[requestZoom,zoom]);
  const zoomFit=useCallback(()=>requestZoom(1),[requestZoom]);
  const inkKey=useCallback((item:{pdf:string;view:{page:number}})=>question?`${question.id}|${question.revision}|${role}|${item.pdf}|${item.view.page}`:"",[question,role]);
  const visibleKeys=visibleViews.flatMap(v=>v.items).map(inkKey).filter(Boolean);
  const visibleKeysRef=useRef(visibleKeys);visibleKeysRef.current=visibleKeys;
  const inkRef=useRef(ink);inkRef.current=ink;
  const commitInk=useCallback((key:string,strokes:Stroke[])=>{undoKeys.current.push(key);redoKeys.current=[];dispatchInk({type:"set",key,strokes});},[]);
  // Undo and redo follow the order of changes across the views on screen (two views can be visible).
  const undoInk=useCallback(()=>{const keys=undoKeys.current;for(let i=keys.length-1;i>=0;i--){const key=keys[i];if(visibleKeysRef.current.includes(key)&&layerOf(inkRef.current,key).past.length){keys.splice(i,1);redoKeys.current.push(key);dispatchInk({type:"undo",key});return;}}},[]);
  const redoInk=useCallback(()=>{const keys=redoKeys.current;for(let i=keys.length-1;i>=0;i--){const key=keys[i];if(visibleKeysRef.current.includes(key)&&layerOf(inkRef.current,key).future.length){keys.splice(i,1);undoKeys.current.push(key);dispatchInk({type:"redo",key});return;}}},[]);
  const clearInk=()=>{for(const key of visibleKeys)if(layerOf(ink,key).strokes.length)commitInk(key,[]);};
  const clearAllInk=()=>{for(const [key,layer] of Object.entries(ink))if(layer.strokes.length)undoKeys.current.push(key);redoKeys.current=[];dispatchInk({type:"clearAll"});};
  const viewHasInk=visibleKeys.some(key=>layerOf(ink,key).strokes.length>0);
  const penSize=SIZES.find(size=>size.value===annotatePrefs.penSize)!.pen,highlighterSize=SIZES.find(size=>size.value===annotatePrefs.highlighterSize)!.highlighter;
  const stageCursor=annotating?toolCursor(annotatePrefs.tool,annotatePrefs.tool==="highlighter"?annotatePrefs.highlighterColour:annotatePrefs.penColour,annotatePrefs.tool==="highlighter"?highlighterSize:penSize,scale):undefined;
  const inkSettings=useMemo<AnnotationSettings>(()=>({tool:annotatePrefs.tool,penColour:annotatePrefs.penColour,highlighterColour:annotatePrefs.highlighterColour,penSize,highlighterSize,straight:annotatePrefs.straight}),[annotatePrefs,penSize,highlighterSize]);
  const chooseTool=useCallback((tool:AnnotationTool)=>{annotateNow.current={annotating:true,tool};setAnnotatePrefs(p=>withTool(p,tool));setAnnotating(true);},[]);
  // Answers open at fit; going back to the question restores the zoom and position the teacher left.
  const switchRole=useCallback((next:ViewRole)=>{
    if(!question)return;
    if(role==="question"&&stage.current)questionView.current={id:question.id,zoom,scroll:{left:stage.current.scrollLeft,top:stage.current.scrollTop}};
    setMode({id:question.id,role:next,view:0});
    const saved=questionView.current;
    if(next==="question"&&saved?.id===question.id){setZoom(saved.zoom);restoreScroll(saved.scroll);}else setZoom(1);
  },[question,role,zoom,restoreScroll]);
  const reveal=useCallback(()=>switchRole(role==="scheme"?"question":"scheme"),[switchRole,role]);
  const revealSolution=()=>{if(question?.workedSolution)switchRole(role==="worked-solution"?"question":"worked-solution");};
  const leaveDisplay=useCallback(()=>{setDisplay(false);if(document.fullscreenElement)void document.exitFullscreen().catch(()=>undefined);},[]);
  useEffect(()=>{
    if(!active||topicsMode)return;
    const key=(e:KeyboardEvent)=>{
      // Escape puts the pen down first, so a second press is needed to leave Display.
      if(e.key==="Escape"){if(annotateNow.current.annotating){annotateNow.current.annotating=false;setAnnotating(false);return;}leaveDisplay();return;}
      if((e.target as HTMLElement)?.closest("input,select,textarea,dialog,[contenteditable=true]")||reviewOpen)return;
      const k=e.key.toLowerCase();
      if(annotateNow.current.annotating&&(e.ctrlKey||e.metaKey)&&!e.altKey&&(k==="z"||k==="y")){e.preventDefault();if(k==="y"||e.shiftKey)redoInk();else undoInk();return;}
      if(!e.ctrlKey&&!e.metaKey&&!e.altKey){
        if(k==="p"){e.preventDefault();if(annotateNow.current.annotating&&annotateNow.current.tool==="pen"){annotateNow.current.annotating=false;setAnnotating(false);}else chooseTool("pen");return;}
        if(annotateNow.current.annotating){
          const tool=({h:"highlighter",e:"eraser",l:"laser",v:"hand"} as Record<string,AnnotationTool>)[k];
          if(tool){e.preventDefault();chooseTool(tool);return;}
          const n=Number.parseInt(e.key,10);
          if(n>=1&&n<=PEN_COLOURS.length){const colours=annotateNow.current.tool==="highlighter"?HIGHLIGHTER_COLOURS:PEN_COLOURS;const c=colours[n-1];if(c){e.preventDefault();setAnnotatePrefs(p=>p.tool==="highlighter"?{...p,highlighterColour:c.value}:{...withTool(p,"pen"),penColour:c.value});return;}}
        }
      }
      if(e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.startsWith("Arrow")){
        // Shift + arrows pan a zoomed view; plain arrows still change question (presentation clickers).
        e.preventDefault();panBy(e.key==="ArrowLeft"?-.15:e.key==="ArrowRight"?.15:0,e.key==="ArrowUp"?-.15:e.key==="ArrowDown"?.15:0);return;
      }
      if(!e.ctrlKey&&!e.metaKey&&!e.altKey){
        if(e.key==="+"||e.key==="="){e.preventDefault();zoomStep(1);return;}
        if(e.key==="-"||e.key==="_"){e.preventDefault();zoomStep(-1);return;}
        if(e.key==="0"){e.preventDefault();zoomFit();return;}
      }
      if(["ArrowRight","PageDown"].includes(e.key)){e.preventDefault();move(1);}
      if(["ArrowLeft","PageUp"].includes(e.key)){e.preventDefault();move(-1);}
      if(e.key.toLowerCase()==="m"){e.preventDefault();reveal();}
    };
    const fullscreen=()=>{if(!document.fullscreenElement)setDisplay(false);};
    window.addEventListener("keydown",key);document.addEventListener("fullscreenchange",fullscreen);
    return()=>{window.removeEventListener("keydown",key);document.removeEventListener("fullscreenchange",fullscreen);};
  },[active,topicsMode,move,reveal,leaveDisplay,reviewOpen,panBy,zoomStep,zoomFit,chooseTool,undoInk,redoInk]);
  useEffect(()=>{const q=!topicsMode&&active&&following?details[following.id]:undefined;if(q)void preloadQuestion(q).catch(()=>undefined);},[following,details,topicsMode,active]);

  const actions=useRef({catalogue,route,listed,role,viewIndex,go});actions.current={catalogue,route,listed,role,viewIndex,go};
  useEffect(()=>{
    if(!active)return;
    const context=(document as Document&{modelContext?:WebContext}).modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=(tool:Parameters<WebContext["registerTool"]>[0])=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>undefined);}catch{/* Optional browser capability. */}};
    register({name:"question_bank_read_state",description:"Read the visible topic, question, view and whether its mark scheme or authored worked solution is visible.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>{const a=actions.current;return{code:a.route.code,question:a.listed?.id,role:a.role,view:a.viewIndex+1,version:a.catalogue?.version};}});
    register({name:"question_bank_open_topic",description:"Open a current Sparx topic in the visible viewer, hide its answers and reset the view.",inputSchema:{type:"object",properties:{code:{type:"string"}},required:["code"],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input)=>{const a=actions.current;const raw=(input as{code?:unknown})?.code;if(typeof raw!=="string")throw new Error("A Sparx code is required.");const code=a.catalogue?.aliases[normalizeCode(raw)]||normalizeCode(raw);if(!a.catalogue?.topics.some(t=>t.code===code))throw new Error("Unknown Sparx code.");flushSync(()=>a.go({...emptyRoute,code}));return{code,questions:filterQuestions(a.catalogue,{...emptyRoute,code}).length};}});
    return()=>lifecycle.abort();
  },[active]);

  function submitSearch(e:FormEvent){e.preventDefault();const code=normalizeCode(search),alias=catalogue?.aliases[code]||code;const exact=catalogue?.topics.find(t=>t.title.toLowerCase()===search.trim().toLowerCase());const candidate=exact?.code||(/^U\d+$/.test(alias)?alias:suggestions[0]?.code);if(candidate)go({...route,code:candidate,question:"",view:0});else setNotice("Choose a topic from the list or enter a Sparx code.");}
  function isSelected(id:string){const q=catalogue?.questions.find(q=>q.id===id);return !!q&&included.has(questionIdentity(q));}
  function selectQuestion(id:string,checked:boolean){const q=catalogue?.questions.find(q=>q.id===id);if(q)dispatchDraft({type:"question",question:q,checked});}
  function startExport(){if(!hasDraftIntent(draft))dispatchDraft({type:"add",questions:results});setReviewOpen(true);}
  async function imageExport(copy:boolean){if(!question||!view)return;setImageBusy(true);try{const pending=role==="worked-solution"&&solutionPlan?workedImageBlob(question,wholeImage?workedPlan(question,undefined):solutionPlan,{marks:workedMarks,upTo:wholeImage?undefined:upTo},`${question.source} · Worked solution${!wholeImage&&partMode&&served?` · ${served.title}`:""}${!wholeImage&&stepMode?` · step ${stepsShown} of ${shownSteps.length}`:""}${workedMarks?"":" · pupil copy"}`):partMode&&!wholeImage?stackImage(view.items,`${question.source} · ${view.label}`):questionImage(question,role,view.items[0].view,wholeImage);if(copy&&navigator.clipboard?.write&&typeof ClipboardItem!=="undefined"){try{await navigator.clipboard.write([new ClipboardItem({"image/png":pending})]);setNotice("Image copied. Paste it into Word or PowerPoint.");return;}catch{/* Download fallback. */}}downloadBlob(await pending,`${question.id}-${role}-${wholeImage?"whole":partMode&&served?`part-${served.parts.join("-")}`:viewIndex+1}.png`);setNotice(copy?"Clipboard access was unavailable. The image was downloaded instead.":"Image downloaded with its source reference.");}catch(error){setNotice(error instanceof Error?error.message:"The image could not be exported.");}finally{setImageBusy(false);}}
  const countText=`${formatCount(results.length)} ${results.length===1?"question":"questions"}`;
  const rangeText=view?`View ${viewIndex+1}${two?`–${viewIndex+2}`:""} of ${views.length}`:"";
  const displayNotes=display?[...(question?.sourceErrata||[]).map(item=>item.note),...(role==="scheme"&&question?.schemeSourceNote?[question.schemeSourceNote]:[])]:[];

  const annotateButton=<button className={`qb-button qb-annotate-toggle${annotating?" qb-answer-active":""}`} aria-pressed={annotating} title="Annotate on screen · P" onClick={()=>annotating?setAnnotating(false):chooseTool(annotatePrefs.tool==="hand"?"pen":annotatePrefs.tool)}><Pencil size={16}/>Annotate{viewHasInk&&<span className="qb-ink-dot" aria-label="(this view has annotations)"/>}</button>;
  const answerControls=question&&<>
    <button className={`qb-button${role==="scheme"?" qb-answer-active":""}`} aria-pressed={role==="scheme"} onClick={reveal}>{role==="scheme"?<EyeOff size={18}/>:<Eye size={18}/>} {role==="scheme"?"Hide mark scheme":"Show mark scheme"}</button>
    <div className="qb-solution-action"><button className={`qb-button${role==="worked-solution"?" qb-answer-active":""}`} aria-pressed={role==="worked-solution"} disabled={!question.workedSolution} onClick={revealSolution}>{role==="worked-solution"?<EyeOff size={18}/>:<Eye size={18}/>} {role==="worked-solution"?"Hide worked solution":"Show worked solution"}</button>{!question.workedSolution&&<small>Not available yet</small>}</div>
    {role==="worked-solution"&&workedShown?.shown&&<div className="qb-worked-options" role="group" aria-label="Worked solution options">
      <label><input type="checkbox" checked={workedMarks} onChange={e=>chooseMarks(e.target.checked)}/> Mark notes</label>
      <button className={`qb-button${stepMode?" qb-answer-active":""}`} aria-pressed={stepMode} onClick={()=>{setStepMode(!stepMode);setStepsShown(0);}}>Step by step</button>
      {stepMode&&<><button className="qb-button" aria-label="Previous step" aria-disabled={stepsShown<=0} onClick={()=>setStepsShown(n=>Math.max(0,n-1))}><ArrowLeft size={16}/></button>
        <span className="qb-step-count" aria-live="polite">Step {stepsShown} of {shownSteps.length}</span>
        <button className="qb-button" aria-label="Next step" aria-disabled={stepsShown>=shownSteps.length} onClick={()=>setStepsShown(n=>Math.min(shownSteps.length,n+1))}><ArrowRight size={16}/></button></>}
    </div>}
  </>;

  return <div ref={app} className={`qb-app${topicsMode?" qb-topics-mode":""}${display?" qb-display":""}`}>
    <main className="qb-main" id={active ? "main-content" : undefined} tabIndex={-1}>
      {!topicsMode&&<><div className="qb-toolbar">
        <div className="qb-topic">
          {route.code&&<span className="qb-code">{route.code}</span>}
          <div><h1 tabIndex={-1}>{topic?.title||(route.code?"Find a topic":catalogue?.publication?.heading||"Reviewed practice questions")}</h1><span className="qb-scope">{topic?`${formatCount(topic.bankCount)} matched in full bank · ${formatCount(topic.availableCount??topic.pilotCount)} ${catalogue?.publication?"available":"in this pilot"}${revisionHidden?` · ${formatCount(revisionHidden)} Year 11 revision hidden`:""}`:catalogue?.publication?.description||(catalogue?`${formatCount(catalogue.questions.length)} reviewed questions`:"")}</span></div>
        </div>
        <div className="qb-toolbar-actions">
          <label className="qb-performance-toggle"><input type="checkbox" checked={showPerformance} onChange={e=>setShowPerformance(e.target.checked)}/> Show average marks achieved</label>
          <button className="qb-button" aria-expanded={listOpen} onClick={()=>setListOpen(!listOpen)}><List size={18}/>{countText}</button>
          <details className="qb-filters"><summary><SlidersHorizontal size={16}/> Filters{route.tier!=="all"||route.calculator!=="all"||route.collection!=="all"||route.crossover!=="all"||route.revision!=="hide"?" · active":""}</summary><div><label>Tier <select value={route.tier} onChange={e=>go({...route,tier:e.target.value as BankRoute["tier"],question:"",view:0})}><option value="all">Both tiers</option><option value="F">Foundation</option><option value="H">Higher</option></select></label><label>Calculator <select value={route.calculator} onChange={e=>go({...route,calculator:e.target.value as BankRoute["calculator"],question:"",view:0})}><option value="all">Either</option><option value="yes">Calculator</option><option value="no">Non-calculator</option></select></label><label>Collection <select value={route.collection} onChange={e=>go({...route,collection:e.target.value as BankRoute["collection"],question:"",view:0})}><option value="all">All sources</option><option value="past">Past papers</option><option value="mock">Mock papers</option></select></label><label>Crossover <select value={route.crossover} onChange={e=>go({...route,crossover:e.target.value as BankRoute["crossover"],question:"",view:0})}><option value="all">All questions</option><option value="only">On both tiers only</option></select></label><label>Year 11 revision papers <select value={route.revision} onChange={e=>go({...route,revision:e.target.value as BankRoute["revision"],question:"",view:0})}><option value="hide">Hidden</option><option value="include">Included</option></select></label><button className="qb-text-button" onClick={()=>go({...route,tier:"all",calculator:"all",collection:"all",crossover:"all",revision:"hide",question:"",view:0})}>Clear filters</button></div></details>
          <button className="qb-button" disabled={hasDraftIntent(draft)?!entries.length:!results.length} onClick={startExport}><FileDown size={18}/>{hasDraftIntent(draft)?`Review paper (${formatCount(entries.length)})`:"Export matching questions"}</button>
          <button className="qb-button qb-primary" disabled={!question} onClick={()=>{setDisplay(true);(document.activeElement as HTMLElement)?.blur();}}><Maximize2 size={18}/> Display</button>
        </div>
      </div>
<div className="qb-page-search">
      <form onSubmit={submitSearch} className="qb-search-form">
        <label className="qb-search"><Search size={18}/><input ref={searchInput} aria-label="Sparx code or topic" value={search} list="qb-topics" onChange={e=>setSearch(e.target.value)} placeholder="Sparx code or topic" autoComplete="off"/></label>
        <datalist id="qb-topics">{suggestions.map(t=><option key={t.code} value={t.code}>{t.title} · {t.availableCount??t.pilotCount} available</option>)}</datalist>
        <button className="qb-button qb-primary" type="submit">Find</button>
      </form>
      <span className="qb-pilot">{catalogue?.publication?.label||"Question bank"}</span>
      </div>
            </>}
      {notice&&<div className="qb-notice" role="status">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice("")}><X size={16}/></button></div>}
      <div hidden={!topicsMode} className="qb-topics-host">{topicsMode&&<div className="page-heading"><div><h1 tabIndex={-1}>Paper builder</h1><p>Tick Sparx codes, review your questions and download a paper with its mark scheme.</p></div></div>}{catalogue&&coverage&&overall?<TopicPaperBuilder catalogue={catalogue} coverage={coverage} overall={overall} filters={filters} draft={draft} entries={entries} onCode={(code,checked)=>dispatchDraft({type:"code",code,checked})} onFilters={next=>go({...route,...next,question:"",view:0})} onBrowse={code=>go({...route,bankView:"questions",code,question:"",view:0})}/>:loadError?<p role="alert">{loadError} <button className="qb-button" onClick={()=>setReload(v=>v+1)}>Try again</button></p>:<p role="status">Loading topics…</p>}</div>{!topicsMode&&<div className={`qb-workspace${listOpen?" qb-with-list":""}`}>
        {listOpen&&<aside className="qb-results" aria-label="Matching questions"><div className="qb-results-heading"><strong>{countText}</strong><button className="qb-text-button" onClick={()=>dispatchDraft({type:"add",questions:results})}>Add all matching questions</button><button className="qb-text-button" onClick={()=>dispatchDraft({type:"clear"})}>Clear paper</button></div>{results.map((q,i)=><div key={q.id} className={`qb-result${listed?.id===q.id?" active":""}`}><input type="checkbox" aria-label={`Select ${q.source}`} checked={isSelected(q.id)} onChange={e=>selectQuestion(q.id,e.target.checked)}/><button onClick={()=>go({...route,question:q.id,view:0})}><b>{i+1}. {q.source}</b><span>{q.description}</span>{showPerformance&&<PerformanceBadge question={q} catalogue={catalogue} tier={route.tier}/>}<small>{q.marks} mark{q.marks===1?"":"s"} · {q.tier==="H"?"Higher":"Foundation"}</small>{q.revisionUse&&<small className="qb-revision-tag">Year 11 revision: {q.revisionUse}</small>}</button></div>)}</aside>}
        <section className="qb-question-card" aria-label="Question viewer">
          <div className="qb-source">
            <div className="qb-source-copy"><div className="qb-source-heading"><strong>{question?.source||"Topic results"}</strong>{question&&<span>{question.tier==="H"?"Higher":"Foundation"} · {question.calculator?"Calculator":"Non-calculator"} · {question.marks} mark{question.marks===1?"":"s"}</span>}{question?.revisionUse&&<span className="qb-revision-tag">Year 11 revision: {question.revisionUse}</span>}</div>
              {question&&showPerformance&&<PerformanceBadge question={question} catalogue={catalogue} tier={route.tier}/>}
              {question&&<div className="qb-view-info"><span>{role!=="question"?resource?.label:view?.label}{view?.repeatedContext?" · Context repeated":""}</span>{route.code&&match&&<span>Matched parts: {match.labels.join(", ")} · {match.marks} of {question.marks} mark{question.marks===1?"":"s"}</span>}{served&&role!=="scheme"&&<span className="qb-parts-view">{partMode?<>{served.cuts.some(c=>c.role==="context")?"Shown under its stem. ":""}{addedNote(served)} {served.marks} mark{served.marks===1?"":"s"}. </>:null}<button className="qb-text-button" aria-pressed={!partMode} onClick={()=>setPartsView(!partsView)}>{partMode?"Show whole question":`Show only ${served.title.toLowerCase()}`}</button></span>}</div>}
              {question?.sourceErrata?.map((erratum,i)=><p className="qb-erratum" key={i}>{erratum.note}</p>)}
              {role==="scheme"&&question?.schemeSourceNote&&<p className="qb-erratum">{question.schemeSourceNote}</p>}
            </div>
            {question&&<div className="qb-source-actions">
              <button className="qb-text-button" onClick={()=>selectQuestion(question.id,!isSelected(question.id))}>{isSelected(question.id)?<Check size={16}/>:<Plus size={16}/>} {isSelected(question.id)?"Selected":"Select question"}</button>
              {answerControls}
              <details className="qb-more"><summary aria-label="Question options" title="Question options"><MoreHorizontal size={20}/></summary><div className="qb-more-menu">
                <a href={assetUrl(question.printPdf)} target="_blank" rel="noreferrer">Source question PDF</a>
                <button onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}${bankAddress({...route,question:question.id,view:role==="question"?viewIndex:route.view})}`);setNotice("Question link copied.");}catch{setNotice("Copy the question link from your browser address bar.");}}}>Copy link</button>
                <button onClick={()=>{downloadBlob(new Blob([JSON.stringify({question:question.id,source:question.source,code:route.code,view:viewIndex+1,role,version:catalogue?.version,issue:"Describe the correction here."},null,2)],{type:"application/json"}),`question-feedback-${question.id}.json`);setNotice("Feedback details downloaded. Add a description and keep it with your question-bank notes.");}}>Report a problem</button>
                {question.equivalentSource&&<p>Also appears as {question.equivalentSource}.</p>}
                <p>← / → or Page Up / Down: navigate<br/>M: mark scheme · Escape: exit Display<br/>+ / −: zoom · 0: fit · Shift + arrows: pan<br/>Ctrl + wheel or pinch to zoom, drag to pan.<br/>Double-click or double-tap: zoom in or fit.<br/>Swipe to navigate at fit on a touch screen.</p>
              </div></details>
            </div>}
          </div>
          {display&&<div className="qb-display-actions" role="group" aria-label="Answer views"><span>{resource?.label}</span>{answerControls}</div>}
          {question?.scaleSensitive&&<p className="qb-scale-note">Scale drawing: print the PDF at Actual size / 100%.</p>}
          {displayNotes.length>0&&<div className="qb-display-notes" role="note" aria-label="Source notes">{displayNotes.map((note,i)=><p className="qb-erratum" key={i}>{note}</p>)}</div>}
          <div className="qb-stage-frame"><div ref={stage} style={{backgroundColor:overlay === "off" ? undefined : overlays.find(option=>option.value===overlay)?.colour,cursor:stageCursor}} className={`qb-stage${role==="scheme"?" qb-scheme-stage":""}${question&&pannable?" qb-pannable":""}`}>
            {loadError?<div className="qb-empty" role="alert"><h2>Could not load the question bank</h2><p>{loadError} Check your connection and try again.</p><button className="qb-button" onClick={()=>setReload(v=>v+1)}>Try again</button></div>:!catalogue?<p role="status">Loading questions…</p>:listed&&!question?(detailError?<div className="qb-empty" role="alert"><h2>Could not load this question</h2><p>{detailError}</p><button className="qb-button" onClick={()=>setReload(v=>v+1)}>Try again</button></div>:<p role="status">Loading question…</p>):question?<div className="qb-view-group" style={{minWidth:visibleViews.reduce((n,v)=>n+v.width*scale,0)+(two?16:0),minHeight:visibleViews.length?Math.max(...visibleViews.map(v=>v.height*scale)):0}}>{role==="worked-solution"&&!workedShown?.shown&&(workedShown?.error?<div className="qb-empty" role="alert"><h2>Could not load the worked solution</h2><p>{workedShown.error}</p><button className="qb-button" onClick={()=>setWorkedRetry(v=>v+1)}>Try again</button></div>:<p role="status">Loading worked solution…</p>)}{visibleViews.map(v=><div className="qb-view-stack" style={{gap:STACK_GAP*scale}} key={v.items.map(i=>`${i.pdf}|${i.view.page}`).join("+")}>{v.items.map(item=>item.worked?<WorkedSurface key={`${question.id}|${question.revision}|${question.workedSolution?.revision||""}|${item.pdf}|${item.view.page}|${item.view.id}`} pdf={item.pdf} view={item.view} overlay={item.overlay} scale={scale} retryKey={reload} colour={overlay} marks={workedMarks} upTo={upTo}/>:<PdfView key={`${question.id}|${question.revision}|${role}|${item.pdf}|${item.view.page}`} path={item.pdf} label={resource!.label} view={item.view} scale={scale} retryKey={reload} overlay={overlay} annotation={{strokes:layerOf(ink,inkKey(item)).strokes,active:annotating,settings:inkSettings,onCommit:strokes=>commitInk(inkKey(item),strokes)}}/>)}</div>)}</div>:<div className="qb-empty"><BookOpen size={32}/><h2>{reason==="unknown"?"That Sparx code was not found":reason==="filtered"?"No questions match these filters":reason==="revision"?"Only Year 11 revision papers have this topic":reason==="no-bank-match"?"No matching question in the bank":"This topic is not yet available"}</h2><p>{reason==="no-bank-match"?`${route.code} is a valid current topic. The agreed bank contains no mapped question for it.`:reason==="not-in-pilot"?`${formatCount(topic?.bankCount||0)} questions are mapped in the full bank. None is available for this topic yet; ${formatCount(catalogue.questions.length)} reviewed questions are available overall.`:reason==="filtered"?"Clear the filters to see the available questions for this topic.":reason==="revision"?"Its questions come from papers kept for the Year 11 revision programme, which are hidden. Include them only if pupils will not meet these questions later.":"Search by current Sparx code or topic title."}</p><button className="qb-button" onClick={()=>{if(reason==="filtered")go({...route,tier:"all",calculator:"all",collection:"all",crossover:"all",revision:"hide"});else if(reason==="revision")go({...route,revision:"include",question:"",view:0});else{searchInput.current?.focus();searchInput.current?.select();}}}>{reason==="filtered"?"Clear filters":reason==="revision"?"Include Year 11 revision papers":"Search another topic"}</button></div>}
          </div>
          {question&&<ZoomOverview stage={stage} active={pannable&&zoom>1.001} redrawKey={`${question.id}|${role}|${viewIndex}|${scale}|${overlay}|${partMode}`}/>}
          {question&&annotating&&<AnnotationBar preferences={annotatePrefs} onChange={setAnnotatePrefs} canUndo={visibleKeys.some(key=>layerOf(ink,key).past.length>0)} canRedo={visibleKeys.some(key=>layerOf(ink,key).future.length>0)} hasInk={viewHasInk} anyInk={hasInk(ink)} onUndo={undoInk} onRedo={redoInk} onClear={clearInk} onClearAll={clearAllInk} onClose={()=>setAnnotating(false)}/>}
          {question&&display&&<div className="qb-display-dock">{annotateButton}<ZoomControls floating zoom={zoom} onStep={zoomStep} onFit={zoomFit}/></div>}
          </div>
          <footer className="qb-footer">
          <nav className="qb-navigation" aria-label="Question navigation"><button className="qb-button" disabled={!previous} onClick={()=>move(-1)} title="Previous · Left arrow"><ArrowLeft size={18}/><span>Previous</span></button><div><strong>{listed?`Question ${formatCount(questionIndex+1)} of ${formatCount(results.length)}`:"0 questions"}</strong><span>{rangeText}</span></div><button className="qb-button" disabled={!next} onClick={()=>move(1)} title="Next · Right arrow"><span>Next</span><ArrowRight size={18}/></button></nav>
          {question&&<div className="qb-controls"><ZoomControls zoom={zoom} onStep={zoomStep} onFit={()=>{setFit("page");zoomFit();}} fitMode={{value:fit,onChange:value=>{setFit(value);setZoom(1);}}}/><OverlayControls value={overlay} onChange={setOverlay} room={room} onRoomChange={setRoom}/><div className="qb-image-actions"><label><input type="checkbox" checked={wholeImage} onChange={e=>setWholeImage(e.target.checked)}/> Whole question</label><button className="qb-button" disabled={imageBusy} onClick={()=>void imageExport(true)}><Copy size={16}/>Copy image</button><button className="qb-button" disabled={imageBusy} onClick={()=>void imageExport(false)}><Download size={16}/>PNG</button></div>{annotateButton}</div>}
          </footer>
        </section>
      </div>}
      {!display&&(topicsMode||hasDraftIntent(draft))&&<PaperSummary draft={draft} entries={entries} revisionHidden={revisionDropped} onIncludeRevision={()=>go({...route,revision:"include"})} onUntick={code=>dispatchDraft({type:"code",code,checked:false})} onClear={()=>dispatchDraft({type:"clear"})} onReview={()=>setReviewOpen(true)}/>}
    </main>
    {display&&<button className="qb-exit-display qb-button" onClick={leaveDisplay}><X size={18}/> Exit Display <kbd>Esc</kbd></button>}
    <PaperReviewDialog loadDetails={loadDetails} open={reviewOpen} active={active} entries={entries} version={catalogue?.version||""} showPerformance={showPerformance} onShowPerformance={setShowPerformance} catalogue={catalogue} tier={route.tier} excluded={draft.excluded.length} partsOnly={!!draft.partsOnly} onPartsOnly={value=>dispatchDraft({type:"partsOnly",value})} onClose={()=>setReviewOpen(false)} onRemove={key=>dispatchDraft({type:"exclude",key})} onMove={(key,direction)=>dispatchDraft({type:"move",key,direction,visible:entries.map(e=>e.key)})} onRestore={()=>dispatchDraft({type:"restore"})}/>

  </div>;
}
