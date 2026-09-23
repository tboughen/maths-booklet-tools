import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { assetUrl, loadPdf, renderPage } from "./pdf";
import type { BankView } from "./model";
import { overlays, type Overlay } from "./overlays";

interface Props { path: string; view: BankView; scale: number; retryKey: number; onReady?: () => void; overlay?: Overlay; }

export function PdfView({path, view, scale, retryKey, onReady, overlay = "off"}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [localRetry, setLocalRetry] = useState(0);
  const ready = useRef(onReady); ready.current = onReady;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(undefined);
    if (localRetry) void loadPdf(path, true).catch(() => undefined);
    void renderPage(path, view.page, scale * Math.min(window.devicePixelRatio || 1, 3), controller.signal).then(canvas => {
      if (controller.signal.aborted || !host.current) return;
      canvas.style.width = `${view.width * scale}px`;
      canvas.style.height = `${view.height * scale}px`;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", view.description);
      host.current.replaceChildren(canvas);
      setLoading(false); ready.current?.();
    }).catch(() => {
      if (controller.signal.aborted) return;
      setLoading(false); setError("This view could not load. The previous view is kept below, if available.");
    });
    return () => controller.abort();
  }, [path, view.page, view.width, view.height, view.description, scale, retryKey, localRetry]);
  return <div className="qb-pdf" style={{width: view.width * scale, minHeight: view.height * scale}} aria-busy={loading}>
    {loading && <div className="qb-view-status" role="status"><LoaderCircle className="spin" size={18}/> Preparing view…</div>}
    {error && <div className="qb-view-error" role="alert"><p>{error}</p><button className="qb-button" onClick={() => setLocalRetry(x => x + 1)}><RotateCcw size={16}/> Retry</button><a className="qb-button" href={assetUrl(path)} target="_blank" rel="noreferrer">Open PDF</a></div>}
    <div className="qb-canvas-surface"><div ref={host} className="qb-canvas-host"/>{overlay !== "off" && <div className="qb-coloured-overlay" aria-hidden="true" style={{backgroundColor: overlays.find(option => option.value === overlay)?.colour}}/>}</div>
  </div>;
}
