import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { assetUrl, loadPdf, renderPage } from "./pdf";
import type { BankView } from "./model";
import { overlays, type Overlay } from "./overlays";
import { AnnotationLayer, type AnnotationSettings } from "./AnnotationLayer";
import type { Stroke } from "./annotations";

/** Screen-only ink for this view; the layer never reaches exports. */
export interface ViewAnnotation { strokes: Stroke[]; active: boolean; settings: AnnotationSettings; onCommit: (strokes: Stroke[]) => void; }
interface Props { path: string; view: BankView; scale: number; retryKey: number; onReady?: () => void; overlay?: Overlay; label?: string; annotation?: ViewAnnotation; }

export function PdfView(props: Props) {
  return <ResourcePdf key={`${props.path}|${props.view.page}|${props.view.width}|${props.view.height}|${props.retryKey}`} {...props}/>;
}

function ResourcePdf({path, view, scale, retryKey, onReady, overlay = "off", label = "Question", annotation}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [localRetry, setLocalRetry] = useState(0);
  const ready = useRef(onReady); ready.current = onReady;
  // A zoom change keeps the current picture, stretched to the new size, until the sharp one is drawn.
  // A change of resource (or a retry) still removes the old picture at once so an answer never lingers.
  const identity = `${view.description}|${retryKey}|${localRetry}`;
  const shown = useRef("");
  useLayoutEffect(() => {
    const canvas = host.current?.querySelector("canvas");
    if (!canvas || shown.current !== identity) return;
    canvas.style.width = `${view.width * scale}px`;
    canvas.style.height = `${view.height * scale}px`;
  }, [identity, view.width, view.height, scale]);
  useEffect(() => {
    const controller = new AbortController();
    const keep = shown.current === identity && !!host.current?.querySelector("canvas");
    if (!keep) { setLoading(true); host.current?.replaceChildren(); shown.current = ""; }
    setError(undefined);
    if (localRetry) void loadPdf(path, true).catch(() => undefined);
    // While a pinch or wheel zoom is still moving, wait for it to settle before redrawing.
    const draw = () => void renderPage(path, view.page, scale * Math.min(window.devicePixelRatio || 1, 3), controller.signal).then(canvas => {
      if (controller.signal.aborted || !host.current) return;
      canvas.style.width = `${view.width * scale}px`;
      canvas.style.height = `${view.height * scale}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", view.description);
      host.current.replaceChildren(canvas); shown.current = identity;
      setLoading(false); ready.current?.();
    }).catch(() => {
      if (controller.signal.aborted) return;
      setLoading(false); setError(`${label} could not load.`);
    });
    const timer = keep ? window.setTimeout(draw, 140) : undefined;
    if (!keep) draw();
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [path, view.page, view.width, view.height, view.description, scale, retryKey, localRetry, label, identity]);
  return <div className="qb-pdf" style={{width: view.width * scale, minHeight: view.height * scale}} aria-busy={loading}>
    {loading && <div className="qb-view-status" role="status"><LoaderCircle className="spin" size={18}/> Preparing view…</div>}
    {error && <div className="qb-view-error" role="alert"><p>{error}</p><button className="qb-button" onClick={() => setLocalRetry(x => x + 1)}><RotateCcw size={16}/> Retry</button><a className="qb-button" href={assetUrl(path)} target="_blank" rel="noreferrer">Open PDF</a></div>}
    <div className="qb-canvas-surface"><div ref={host} className="qb-canvas-host"/>{overlay !== "off" && <div className="qb-coloured-overlay" aria-hidden="true" style={{backgroundColor: overlays.find(option => option.value === overlay)?.colour}}/>}{annotation && !loading && !error && <AnnotationLayer {...annotation} width={view.width} height={view.height} scale={scale}/>}</div>
  </div>;
}
