import { useCallback, useEffect, useRef, useState } from "react";
import { create, validate, parseFile, canonical, decode, editorLink, apply, add, ticks, metrics, position, renderSvg, warnings, labelKey, valueOf, type Envelope, type Operation } from "../../packages/number-line-core/src";
import { examples, example } from "../../packages/number-line-core/src/examples";
import { EditorToolbar } from "../site/EditorToolbar";
import { PageHeading, Panel } from "../site/PageHeading";
import { RatioDialog as ResourceDialog } from "../ratio-table/RatioDialog";
import { copyPngToClipboard, downloadBlob } from "../export/clipboard";
import { copyWord, downloadImage, printPng } from "./export";
import "./number-line.css";
const STORAGE = "maths-booklet-tools:number-line:v1";
function initial() { try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
        try {
            return { envelope: parseFile(raw), recovery: null, error: "" };
        }
        catch {
            return { envelope: create(), recovery: raw, error: "The saved number line needs recovery. Download its original data before starting afresh." };
        }
    }
}
catch {
    return { envelope: create(), recovery: null, error: "Device storage is unavailable. Save an editable file to keep your work." };
} return { envelope: create(), recovery: null, error: "" }; }
type Selection = "axis-min" | "axis-max" | "variable" | "lower" | "upper" | "value" | `tick:${string}` | `point:${string}` | `connection:${string}` | "segment" | null;
function Field({ label, value, onApply, pending, type = "text" }: {
    label: string;
    value: string | number;
    onApply: (v: string) => void;
    pending: (label: string, value: boolean) => void;
    type?: string;
}) { const [draft, setDraft] = useState(String(value)), [error, setError] = useState(""); const committed = useRef(String(value)), skipBlur = useRef(false); useEffect(() => { committed.current = String(value); setDraft(String(value)); setError(""); pending(label, false); }, [value, label, pending]); function applyDraft() { if (draft === committed.current && !error)
    return; try {
    onApply(draft);
    setError("");
    pending(label, false);
}
catch (e) {
    setError(e instanceof Error ? e.message : String(e));
    pending(label, true);
} } return <label className="nl-field">{label}<input aria-label={label} type={type} value={draft} aria-invalid={!!error} data-pending={draft !== committed.current || !!error} onChange={e => { setDraft(e.target.value); pending(label, true); }} onBlur={() => { if (skipBlur.current) {
    skipBlur.current = false;
    return;
} applyDraft(); }} onKeyDown={e => { if (e.key === "Enter") {
    applyDraft();
    e.currentTarget.blur();
} if (e.key === "Escape") {
    skipBlur.current = true;
    setDraft(committed.current);
    setError("");
    pending(label, false);
    e.currentTarget.blur();
} }}/>{error && <span className="nl-error" role="alert">{error}</span>}</label>; }
export default function NumberLinePage({ active = true }: {
    active?: boolean;
}) {
    const [startup] = useState(initial);
    const [history, setHistory] = useState<{
        past: Envelope[];
        present: Envelope;
        future: Envelope[];
    }>({ past: [], present: startup.envelope, future: [] });
    const [message, setMessage] = useState(startup.error), [recovery, setRecovery] = useState<string | null>(startup.recovery), [recoverySaved, setRecoverySaved] = useState(false), [saveState, setSaveState] = useState("Saved on this device");
    const [selection, setSelection] = useState<Selection>(null), [mode, setMode] = useState<"select" | "interval" | "left" | "right" | "point">("select"), [first, setFirst] = useState<string | null>(null), [pending, setPending] = useState<{
        title: string;
        envelope: Envelope;
    } | null>(null), [menu, setMenu] = useState(false), [busy, setBusy] = useState(false), [zoom, setZoom] = useState(1), [dirty, setDirty] = useState<Set<string>>(new Set()), [dragValue, setDragValue] = useState<string | null>(null);
    const file = useRef<HTMLInputElement>(null), white = useRef<HTMLDivElement>(null), expected = useRef<string | null>(null), current = useRef(history.present);
    const [rayDirection,setRayDirection]=useState<"left"|"right">("right");
    const [exampleIndex,setExampleIndex]=useState(0);
    const pointer=useRef<{key:string,x:number,y:number,moved:boolean}|null>(null);
    const suppressClick=useRef<string|null>(null);
    current.current = history.present;
    const inputPending = useCallback((label: string, value: boolean) => setDirty(old => { const n = new Set(old); if (value)
        n.add(label);
    else
        n.delete(label); return old.has(label) === value ? old : n; }), []);
    const d = history.present.document, m = metrics(d), unit = 96 / 25.4 * zoom, blocked = busy || !!recovery || dirty.size > 0;
    function commit(e: Envelope) { if (recovery)
        throw Error("Download recovery data and choose a fresh start first."); const v = validate(e); setHistory(h => canonical(v) === canonical(h.present) ? h : { past: [...h.past, h.present].slice(-60), present: v, future: [] }); setMessage(""); }
    function change(ops: Operation[]) {
        const document=current.current.document;
        // Keep unrelated settings explicit: partial-schema defaults must not reset saved blanks or labels.
        commit(apply(current.current,ops.map(op=>op.op==="set_axis"?{...op,axis:{...document.axis,...op.axis}}:
            op.op==="set_presentation"?{...op,teaching:{...document.teaching,...op.teaching}}:op)));
    }
    function safe(ops: Operation[]) { try {
        change(ops);
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
    } }
    function undo() { if (blocked)
        return; setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h); setSelection(null); }
    function redo() { if (blocked)
        return; setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h); setSelection(null); }
    function replacement(envelope: Envelope, title: string) { if (blocked) {
        setMessage("Apply or cancel unfinished input before replacing this number line.");
        return;
    } setPending({ envelope, title }); }
    useEffect(() => { if (recovery)
        return; try {
        const raw = localStorage.getItem(STORAGE);
        if (expected.current !== null && raw !== expected.current && raw !== canonical(history.present)) {
            setRecovery(raw ?? "");
            setMessage("A newer draft exists in another tab. Download its data before replacing it.");
            return;
        }
        const text = canonical(history.present);
        localStorage.setItem(STORAGE, text);
        expected.current = text;
        setSaveState("Saved on this device");
    }
    catch {
        setSaveState("Save unavailable — download editable file");
    } }, [history.present, recovery]);
    useEffect(() => { const listener = (event: StorageEvent) => { if (event.key === STORAGE && event.newValue !== expected.current) {
        setRecovery(event.newValue ?? "");
        setRecoverySaved(false);
        setMessage("The saved line changed in another tab. Its data is protected.");
    } }; window.addEventListener("storage", listener); return () => window.removeEventListener("storage", listener); }, []);
    useEffect(() => { if (!active)
        return; const handle = () => { const route = new URLSearchParams(location.search).get("tool"); if (route !== "number-line")
        return; const value = new URLSearchParams(location.hash.slice(1)).get("number-line"); if (!value)
        return; try {
        const envelope = decode(value);
        setPending({ envelope, title: "Open the linked number line?" });
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
    } }; handle(); window.addEventListener("hashchange", handle); return () => window.removeEventListener("hashchange", handle); }, [active]);
    useEffect(() => { if (!active)
        return; const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !(e.target instanceof HTMLElement && e.target.closest("input,textarea,select,[role=dialog]"))) {
        setMode("select");
        setFirst(null);
        if(!dirty.size)setSelection(null);
    } if ((e.ctrlKey || e.metaKey) && !(e.target instanceof HTMLElement && e.target.closest("input,textarea,select,[contenteditable]"))) {
        if (e.key.toLowerCase() === "z") {
            e.preventDefault();
            if (e.shiftKey)
                redo();
            else
                undo();
        }
        if (e.key.toLowerCase() === "y") {
            e.preventDefault();
            redo();
        }
    } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); });
    useEffect(() => {
        if(selection !== "variable" && !selection?.startsWith("tick:"))return;
        const label=selection==="variable"?"Variable":"Tick label state";
        document.querySelector<HTMLElement>(`.nl-inspector [aria-label="${label}"]`)?.focus();
    },[selection]);
    function keepDraftVisible(event:React.SyntheticEvent<HTMLDetailsElement>) {
        const details=event.currentTarget;
        if(!details.open && details.querySelector('[data-pending="true"]')) {
            details.open=true;
            setMessage("Apply or cancel unfinished input before closing these settings.");
            details.querySelector<HTMLElement>('[data-pending="true"]')?.focus();
        }
    }
    async function run(action: () => Promise<void>) { if (blocked)
        return; setBusy(true); try {
        await action();
        setMessage("Resource ready.");
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } }
    function axis(key: "minimum" | "maximum" | "step" | "labelEvery" | "variable", v: string) { change([{ op: "set_axis", axis: { [key]: key === "labelEvery" ? Number(v) : v } }]); }
    function endpoint(key: "lower" | "upper" | "value", value?: string, included?: boolean) { if (!d.solution)
        return; change([{ op: "set_endpoint", id: d.solution.id, endpoint: key, ...(value !== undefined ? { value } : {}), ...(included !== undefined ? { included } : {}) }]); }
    function tick(v: string) { if (blocked)
        return; if (mode === "select") {
        setSelection(`tick:${v}`);
        return;
    } if (mode === "point") {
        safe([{ op: "add_point", point: { id: `p-${crypto.randomUUID().slice(0, 8)}`, value: v } }]);
        return;
    } if (mode === "left" || mode === "right") {
        safe([{ op: "set_solution", solution: { kind: "ray", id: "set", value: v, included: false, direction: mode, intentional: false, stop: null } }]);
        setMode("select");
        return;
    } if (!first) {
        setFirst(v);
        return;
    }
    if(d.solution?.kind === "points") {
        const ops:Operation[]=[];
        const endpoints=[first,v].map(value=>{
            const existing=d.solution?.kind==="points"?d.solution.points.find(p=>labelKey(p.value)===labelKey(value)):undefined;
            if(existing) return existing.id;
            const id=`p-${crypto.randomUUID().slice(0,8)}`;
            ops.push({op:"add_point",point:{id,value}});return id;
        });
        if(labelKey(first)===labelKey(v)){setMessage("Choose a different point for the other end of the interval.");return;}
        ops.push({op:"connect_points",interval:{id:`i-${crypto.randomUUID().slice(0,8)}`,from:endpoints[0],to:endpoints[1]}});
        safe(ops);
    } else safe([{ op: "set_solution", solution: { kind: "interval", id: "set", lower: valueOf(first) < valueOf(v) ? first : v, upper: valueOf(first) < valueOf(v) ? v : first, lowerIncluded: true, upperIncluded: false } }]);
    setFirst(null); setMode("select"); }
    function pointerValue(x: number) { const r = white.current!.getBoundingClientRect(), mm = (x - r.left) / r.width * m.width, v = valueOf(d.axis.minimum) + (mm - m.left) / (m.right - m.left) * (valueOf(d.axis.maximum) - valueOf(d.axis.minimum)), t = ticks(d); return t.reduce((a, b) => Math.abs(valueOf(a) - v) < Math.abs(valueOf(b) - v) ? a : b); }
    function endpointIncluded(key:string) {
        const solution=current.current.document.solution;
        if(key.startsWith("point:") && solution?.kind==="points")return solution.points.find(p=>p.id===key.slice(6))?.included!==false;
        if(solution?.kind==="interval")return key==="lower"?solution.lowerIncluded:solution.upperIncluded;
        return solution?.kind==="ray"?solution.included:true;
    }
    function editEndpoint(key:string,value?:string,included?:boolean) {
        if(key.startsWith("point:"))change([{op:"set_point",id:key.slice(6),...(value!==undefined?{value}:{}),...(included!==undefined?{included}:{})}]);
        else endpoint(key as "lower"|"upper"|"value",value,included);
    }
    function endpointButton(v:string,key:"lower"|"upper"|"value"|`point:${string}`) {
        const included=endpointIncluded(key);
        const values=d.solution?.kind==="points"?d.solution.points.map(p=>p.value):d.solution?.kind==="interval"?[d.solution.lower,d.solution.upper]:[v];
        const spacing=Math.min(Infinity,...values.filter(value=>valueOf(value)!==valueOf(v)).map(value=>Math.abs(position(d,value)-position(d,v))*unit));
        return <button key={key} className="nl-hit nl-endpoint" style={{left:position(d,v)*unit,top:m.solutionY*unit,width:Math.min(26,spacing)}}
            aria-label={`Endpoint ${v}, ${included?"filled, included":"hollow, excluded"}. Click to make ${included?"hollow":"filled"}.`}
            title="Click to switch filled / hollow; drag to move"
            onFocus={()=>{if(!blocked && (mode==="select"||mode==="point"))setSelection(key);}}
            onClick={e=>{
                const afterDrag=suppressClick.current===key && e.detail!==0;
                suppressClick.current=null;
                if(afterDrag)return;
                if(blocked)return;
                if(mode==="interval"||mode==="left"||mode==="right"){tick(v);return;}
                try{editEndpoint(key,undefined,!endpointIncluded(key));setSelection(key);}catch(e){setMessage(String(e));}
            }}
            onPointerDown={e=>{
                suppressClick.current=null;
                if(blocked || (mode!=="select"&&mode!=="point"))return;
                pointer.current={key,x:e.clientX,y:e.clientY,moved:false};
                e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={e=>{
                const start=pointer.current;
                if(!start||start.key!==key||!e.currentTarget.hasPointerCapture(e.pointerId))return;
                if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>=5)start.moved=true;
                if(start.moved)setDragValue(pointerValue(e.clientX));
            }}
            onPointerUp={e=>{
                const start=pointer.current;
                if(!start||start.key!==key||!e.currentTarget.hasPointerCapture(e.pointerId))return;
                const moved=start.moved || Math.hypot(e.clientX-start.x,e.clientY-start.y)>=5;
                pointer.current=null;e.currentTarget.releasePointerCapture(e.pointerId);
                if(moved){suppressClick.current=key;const value=pointerValue(e.clientX);if(value!==v){try{editEndpoint(key,value);}catch(error){setMessage(String(error));}}}
                setDragValue(null);
            }}
            onPointerCancel={()=>{pointer.current=null;suppressClick.current=key;setDragValue(null);}}
            onKeyDown={e=>{
                if((e.key==="ArrowLeft"||e.key==="ArrowRight")&&!blocked){e.preventDefault();try{editEndpoint(key,add(v,d.axis.step,e.key==="ArrowLeft"?-1:1));}catch(error){setMessage(String(error));}}
            }}/>
    }
    function lineButton(from:string,to:string,id:string) {
        const left=position(d,from),right=position(d,to);
        return <button key={id} className="nl-line-hit" style={{left:(Math.min(left,right)+2)*unit,top:(m.solutionY*unit)-10,width:Math.max(4,(Math.abs(right-left)-4)*unit)}}
            aria-label={`Select interval from ${from} to ${to}`} onClick={()=>{if(!blocked)setSelection(id==="segment"?"segment":`connection:${id}`);}}/>;
    }
    const field = (label: string, value: string | number, onApply: (v: string) => void) => <Field key={label} label={label} value={value} onApply={onApply} pending={inputPending}/>;
    const s = d.solution;
    const selectedPoint = selection?.startsWith("point:")&&s?.kind==="points"?s.points.find(p=>p.id===selection.slice(6)):undefined;
    const selectedEndpoint=selectedPoint?{key:selection!,label:"Point value",value:selectedPoint.value,included:selectedPoint.included!==false}:
        s?.kind==="interval"&&(selection==="lower"||selection==="upper")?{key:selection,label:selection==="lower"?"Lower endpoint":"Upper endpoint",value:selection==="lower"?s.lower:s.upper,included:selection==="lower"?s.lowerIncluded:s.upperIncluded}:
        s?.kind==="ray"&&selection==="value"?{key:"value",label:"Ray endpoint",value:s.value,included:s.included}:null;
    const connection=selection?.startsWith("connection:")&&s?.kind==="points"?s.intervals?.find(line=>line.id===selection.slice(11)):undefined;
    const chosenExample=examples[exampleIndex];
    function removeSelectedLine() {
        if(connection)safe([{op:"remove_interval",id:connection.id}]);
        else if(s?.kind==="interval")safe([{op:"set_solution",solution:{kind:"points",id:"points",points:[{id:"lower",value:s.lower,included:s.lowerIncluded},{id:"upper",value:s.upper,included:s.upperIncluded}]}}]);
        setSelection(null);
    }
    return <div className="app-shell booklet-editor nl-editor"><main className="main-content" id={active ? "main-content" : undefined} tabIndex={-1}><PageHeading title="Number lines" description="Create exam-style lines, intervals and inequality scaffolds."><span role="status">{saveState}</span></PageHeading><section className="workspace"><Panel className="editor-card"><EditorToolbar canUndo={!blocked && history.past.length > 0} canRedo={!blocked && history.future.length > 0} onUndo={undo} onRedo={redo} onReset={() => replacement(create(), "Reset this number line?")} resetDisabled={blocked} exportDisabled={blocked} busy={busy} onCopy={() => void run(() => copyWord(history.present))} onCopyClipboard={() => void run(() => copyPngToClipboard(() => printPng(history.present)))} menuOpen={menu} onToggleMenu={() => setMenu(!menu)}/>
 {menu && <div className="nl-downloads"><button disabled={blocked} onClick={() => void run(() => downloadImage(history.present, "png"))}>Download PNG (600 ppi)</button><button disabled={blocked} onClick={() => void run(() => downloadImage(history.present, "svg"))}>Download SVG</button><button disabled={blocked} onClick={() => downloadBlob(new Blob([canonical(history.present)], { type: "application/json" }), "maths-number-line.json")}>Save editable file</button><button disabled={blocked} onClick={() => file.current?.click()}>Open editable file</button><button disabled={blocked} onClick={() => { const link = editorLink(history.present, location.origin + location.pathname); if (link)
        void run(() => navigator.clipboard.writeText(link));
    else
        setMessage("This line is too large for a link. Save an editable file."); }}>Copy editor link</button></div>}
 <div className="nl-preview-bar"><label>Preview zoom <select aria-label="Preview zoom" value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[.75, 1, 1.25, 1.5].map(v => <option key={v} value={v}>{v * 100}%</option>)}</select></label><span>{mode === "select" ? "Click a circle to change its type; drag to move it." : mode === "interval" ? (first ? "Choose the other endpoint" : "Choose the first endpoint") : `Choose a tick for ${mode === "point" ? "a point" : `a ${mode} ray`}`}</span>{mode !== "select" && <button onClick={() => { setMode("select"); setFirst(null); }}>Finish drawing</button>}</div>
 <div className="nl-scroll" onClick={e => { if (e.target === e.currentTarget && !blocked)
        setSelection(null); }}><div className="nl-stage" style={{ width: m.width * unit + 144, height: m.height * unit + 32 }}><div ref={white} className="nl-resource" data-testid="number-line-resource" style={{ left: 72, top: 16, width: m.width * unit, height: m.height * unit }} onClick={e => { if (e.target instanceof SVGElement && !blocked)
        setSelection(null); }}><div className="nl-art" dangerouslySetInnerHTML={{ __html: renderSvg(history.present) }}/>
 {ticks(d).map(v => <button key={v} aria-label={`Tick ${v}`} className="nl-hit nl-tick" style={{ left: position(d, v) * unit, top: (m.axisY + 5) * unit }} onClick={() => tick(v)}/>)}
 {d.axis.variable && <button className="nl-hit" aria-label="Edit variable" style={{ left: (m.right + 6) * unit, top: (m.axisY + 2) * unit }} onClick={() => { if (!blocked)
        setSelection("variable"); }}/>}
 {d.teaching.solutionVisible && s?.kind === "interval" && <>{lineButton(s.lower,s.upper,"segment")}{endpointButton(s.lower, "lower")}{endpointButton(s.upper, "upper")}</>}{d.teaching.solutionVisible && s?.kind === "ray" && endpointButton(s.value, "value")}{d.teaching.solutionVisible && s?.kind === "points" && s.intervals?.map(line=>lineButton(s.points.find(p=>p.id===line.from)!.value,s.points.find(p=>p.id===line.to)!.value,line.id))}{d.teaching.solutionVisible && s?.kind === "points" && s.points.map(p => endpointButton(p.value, `point:${p.id}`))}
 {dragValue && <span className="nl-drag" style={{ left: position(d, dragValue) * unit, top: m.solutionY * unit }}>{dragValue}</span>}
 </div>{(["left", "right"] as const).map(side => <div key={side} className={`nl-range nl-${side}`} style={{ top: 16 + m.axisY * unit - 50 }}><button className="axis-button" aria-label={`Extend ${side} range by one tick`} disabled={blocked} onClick={() => safe([{ op: "set_axis", axis: side === "left" ? { minimum: add(d.axis.minimum, d.axis.step, -1) } : { maximum: add(d.axis.maximum, d.axis.step) } }])}>+</button><button className="axis-button" aria-label={`Shorten ${side} range by one tick`} disabled={blocked} onClick={() => safe([{ op: "set_axis", axis: side === "left" ? { minimum: add(d.axis.minimum, d.axis.step) } : { maximum: add(d.axis.maximum, d.axis.step, -1) } }])}>−</button></div>)}</div></div>
 {message && <p role="status" className="nl-message">{message}</p>}{warnings(history.present).map(w => <p key={w} className="nl-message">{w}</p>)}
 {recovery !== null && <div className="nl-recovery"><button onClick={() => { downloadBlob(new Blob([recovery], { type: "application/json" }), "number-line-recovery.json"); setRecoverySaved(true); }}>Download recovery data</button><button disabled={!recoverySaved} onClick={() => { try {
        if (localStorage.getItem(STORAGE) !== (recovery || null))
            throw Error("The saved data changed again. Reload before a fresh start.");
        expected.current = canonical(current.current);
        localStorage.setItem(STORAGE, expected.current);
        setRecovery(null);
        setRecoverySaved(false);
        setMessage("Fresh start. Recovery data remains in your download.");
    }
    catch (e) {
        setMessage(String(e));
    } }}>Start afresh after downloading</button></div>}
 </Panel><aside className="inspector-stack nl-inspector" aria-label="Number line settings">
 <section className="panel-card"><h2>Draw</h2><div className="nl-actions nl-draw-actions">
    <button aria-pressed={mode==="point"} disabled={blocked} onClick={()=>{setMode(mode==="point"?"select":"point");setFirst(null);setSelection(null);}}>Point</button>
    <button aria-pressed={mode==="interval"} disabled={blocked} onClick={()=>{setMode(mode==="interval"?"select":"interval");setFirst(null);setSelection(null);}}>Interval</button>
    <button aria-pressed={mode==="left"||mode==="right"} disabled={blocked} onClick={()=>{setMode(mode==="left"||mode==="right"?"select":rayDirection);setFirst(null);setSelection(null);}}>Ray</button>
 </div>{(mode==="left"||mode==="right")&&<label>Direction <select aria-label="New ray direction" value={rayDirection} disabled={blocked} onChange={e=>{const direction=e.target.value as "left"|"right";setRayDirection(direction);setMode(direction);}}><option value="left">← Left</option><option value="right">Right →</option></select></label>}</section>
 {selection&&<section className="panel-card nl-context" aria-label="Selected item"><h2>{selectedEndpoint?"Endpoint":selection==="segment"||connection?"Interval":"Selected value"}</h2>
 {selectedEndpoint&&<><div className="nl-endpoint-fields">{field(selectedEndpoint.label,selectedEndpoint.value,v=>editEndpoint(selectedEndpoint.key,v))}<label>Type <select aria-label="Endpoint type" value={selectedEndpoint.included?"included":"excluded"} disabled={blocked} onChange={e=>editEndpoint(selectedEndpoint.key,undefined,e.target.value==="included")}><option value="included">● Filled</option><option value="excluded">○ Hollow</option></select></label></div>
 {s?.kind==="ray"&&<label>Direction <select aria-label="Ray direction" disabled={blocked} value={s.direction} onChange={e=>safe([{op:"set_solution",solution:{...s,direction:e.target.value as "left"|"right"}}])}><option value="left">← Left</option><option value="right">Right →</option></select></label>}
 {selectedPoint&&<button disabled={blocked} onClick={()=>{safe([{op:"remove_point",id:selectedPoint.id}]);setSelection(null);}}>{s?.kind==="points"&&s.intervals?.some(line=>line.from===selectedPoint.id||line.to===selectedPoint.id)?"Remove point and attached intervals":"Remove point"}</button>}</>}
 {selection==="variable"&&field("Variable",d.axis.variable,v=>axis("variable",v))}
 {selection.startsWith("tick:")&&<label>Tick {selection.slice(5)} <select aria-label="Tick label state" value={d.teaching.labels[labelKey(selection.slice(5))]??"value"} disabled={blocked} onChange={e=>safe([{op:"set_tick_label",value:selection.slice(5),state:e.target.value as "value"|"hidden"|"answer-line"}])}><option value="value">Show value</option><option value="hidden">Hide value</option><option value="answer-line">Pupil answer space</option></select></label>}
 {(selection==="segment"&&s?.kind==="interval"||connection)&&<><p>{connection&&s?.kind==="points"?`${s.points.find(p=>p.id===connection.from)?.value} to ${s.points.find(p=>p.id===connection.to)?.value}`:s?.kind==="interval"?`${s.lower} to ${s.upper}`:""}</p><button disabled={blocked} onClick={removeSelectedLine}>Remove interval</button></>}
 </section>}
 <section className="panel-card"><h2>Scale</h2><div className="nl-scale-fields">{field("First tick",d.axis.minimum,v=>axis("minimum",v))}{field("Last tick",d.axis.maximum,v=>axis("maximum",v))}{field("Tick step",d.axis.step,v=>axis("step",v))}</div></section>
 <section className="panel-card nl-compact-card"><details onToggle={keepDraftVisible}><summary>More settings</summary><div className="nl-settings-body">
 <details onToggle={keepDraftVisible}><summary>Labels</summary><div className="nl-settings-body">{field("Label every",d.axis.labelEvery,v=>axis("labelEvery",v))}{selection!=="variable"&&field("Variable",d.axis.variable,v=>axis("variable",v))}<label>Number labels <select aria-label="Number label format" value={d.axis.numberFormat} disabled={blocked} onChange={e=>safe([{op:"set_axis",axis:{numberFormat:e.target.value as "decimal"|"fraction"}}])}><option value="decimal">Decimals where exact</option><option value="fraction">Fractions</option></select></label><label><input type="checkbox" disabled={blocked} checked={d.axis.variableBelow} onChange={e=>safe([{op:"set_axis",axis:{variableBelow:e.target.checked}}])}/> Variable below arrow</label></div></details>
 <details onToggle={keepDraftVisible}><summary>Question and answer</summary><div className="nl-settings-body">{field("Prompt (optional)",d.teaching.prompt,v=>change([{op:"set_presentation",teaching:{prompt:v}}]))}{field("Answer text",d.teaching.answer,v=>change([{op:"set_presentation",teaching:{answer:v}}]))}<label><input type="checkbox" disabled={blocked} checked={d.teaching.answerVisible} onChange={e=>safe([{op:"set_presentation",teaching:{answerVisible:e.target.checked}}])}/> Show answer text</label>{field("Response lines",d.teaching.responseLines,v=>change([{op:"set_presentation",teaching:{responseLines:Number(v)}}]))}</div></details>
 <details onToggle={keepDraftVisible}><summary>Print size</summary><div className="nl-settings-body">{field("Width (cm)",d.widthCm,v=>change([{op:"set_print",widthCm:Number(v)}]))}<p>{m.widthCm} × {Number(m.heightCm.toFixed(2))} cm · 600 ppi PNG</p></div></details>
 <details onToggle={keepDraftVisible}><summary>Manage drawing</summary><div className="nl-settings-body">{s?<><label><input type="checkbox" disabled={blocked} checked={d.teaching.solutionVisible} onChange={e=>safe([{op:"set_presentation",teaching:{solutionVisible:e.target.checked}}])}/> Show solution drawing</label><button disabled={blocked} onClick={()=>{safe([{op:"set_solution",solution:null}]);setSelection(null);}}>Remove solution</button>{s.kind==="points"&&s.intervals?.map(line=><button key={line.id} disabled={blocked} onClick={()=>{setSelection(`connection:${line.id}`);}}>Edit interval {s.points.find(p=>p.id===line.from)?.value} to {s.points.find(p=>p.id===line.to)?.value}</button>)}{s.kind==="ray"&&<><label><input type="checkbox" disabled={blocked} checked={s.intentional} onChange={e=>safe([{op:"set_solution",solution:{...s,intentional:e.target.checked,stop:e.target.checked?s.stop:null}}])}/> Deliberately incomplete ray</label>{s.intentional&&field("Drawn stop (blank for arrow)",s.stop??"",v=>change([{op:"set_solution",solution:{...s,stop:v||null}}]))}</>}</>:<p>The axis is blank.</p>}</div></details>
 <details><summary>Help</summary><div className="nl-settings-body"><p>Click circles to switch filled/hollow. Drag to move, or use arrow keys. In Interval mode, click two points or ticks to join them. Escape leaves drawing mode.</p><p>Click a value or variable for its settings. Exact fractions are supported. Undo restores changes. Zoom changes the view only; print size is independent.</p></div></details>
 </div></details></section>
 <section className="panel-card nl-compact-card"><details><summary>Examples</summary><div className="nl-settings-body"><label>Past-paper example <select aria-label="Past-paper example" value={exampleIndex} disabled={blocked} onChange={e=>setExampleIndex(Number(e.target.value))}>{examples.map((x,i)=><option key={`${x.id}-${x.part}`} value={i}>{x.title}</option>)}</select></label><div className="nl-example"><p>{chosenExample.prompt}</p>{chosenExample.adaptation&&<p>{chosenExample.adaptation}</p>}<a href={`https://mathsdock.co.uk/?tool=question-bank&question=${chosenExample.id}`} target="_blank" rel="noreferrer">Open source question</a><div className="nl-actions"><button disabled={blocked} onClick={()=>replacement(example(exampleIndex),`Replace with ${chosenExample.title}?`)}>{chosenExample.shown?"Source drawing":"Blank / scaffold"}</button><button disabled={blocked} onClick={()=>replacement(example(exampleIndex,true),`Replace with worked ${chosenExample.title}?`)}>{exampleIndex===8?"Corrected version":"Worked version"}</button></div></div></div></details></section>
 </aside></section><input ref={file} hidden type="file" accept=".json,application/json" onChange={async (e) => { const f = e.target.files?.[0]; if (!f)
        return; try {
        replacement(parseFile(await f.text()), "Open this editable number line?");
    }
    catch (err) {
        setMessage(String(err));
    } e.target.value = ""; }}/>
 {active && pending && <ResourceDialog title={pending.title} confirmLabel="Open resource" disabled={blocked} onCancel={() => { setPending(null); window.history.replaceState(null, "", location.pathname + location.search); }} onConfirm={() => { commit(pending.envelope); setPending(null); setSelection(null); window.history.replaceState(null, "", location.pathname + location.search); }}><p>This replaces your current resource. You can Undo the replacement.</p></ResourceDialog>}
 </main></div>;
}
