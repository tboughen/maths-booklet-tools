import { useLayoutEffect, useRef } from "react";
import { slices } from "../../packages/worked-core/src/slices";
import type { SurfaceOverlay } from "../../packages/worked-core/src/index";
import { PdfView } from "./PdfView";
import type { BankView } from "./model";
import type { Overlay } from "./overlays";

interface Props {
  pdf: string; view: BankView; overlay?: SurfaceOverlay; scale: number; retryKey: number; colour?: Overlay;
  /** False hides the mark codes and "Also scores" lines (a pupil copy); nothing else moves. */
  marks?: boolean;
  /** Step by step: steps after this number are hidden. */
  upTo?: number;
}

/**
 * One cut with its working drawn over it at true size. Where the working needs more room than the
 * printed space, the cut is drawn in slices with plain paper between them: nothing is shrunk.
 */
export function WorkedSurface({ pdf, view, overlay, scale, retryKey, colour, marks = true, upTo }: Props) {
  const ink = useRef<HTMLDivElement>(null);
  // The working is laid out once; the switches only hide parts of it, so nothing moves.
  useLayoutEffect(() => {
    for (const group of ink.current?.querySelectorAll<SVGGElement>("[data-step]") ?? []) {
      group.style.display = upTo !== undefined && Number(group.dataset.step) > upTo ? "none" : "";
    }
  }, [upTo, overlay]);
  const parts = slices({ height: view.height, bands: overlay?.bands ?? [] });
  const height = view.height + (overlay ? overlay.bands.reduce((n, b) => n + b.size, 0) + overlay.footer : 0);
  return <div className={`qb-worked-surface${marks ? "" : " qb-worked-pupil"}`} style={{ width: view.width * scale, height: height * scale }}>
    {parts.map(part => <div className="qb-worked-slice" key={part.from} style={{ top: part.y * scale, height: (part.to - part.from) * scale }}>
      <div style={{ marginTop: -part.from * scale }}><PdfView path={pdf} view={view} scale={scale} retryKey={retryKey} label="Worked solution" overlay={colour}/></div>
    </div>)}
    {/* Built by packages/worked-core from checked data: every text is escaped there. */}
    {overlay && <div ref={ink} className="qb-worked-ink" aria-hidden="true" dangerouslySetInnerHTML={{ __html: overlay.svg }}/>}
  </div>;
}
