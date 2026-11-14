import { useId, useRef, useState } from "react";
import { useMenuDialog } from "./menuDialog";
import { BANK_CARD_MM, nominalPxPerMm } from "./printSizeData";

/** Match the bar to a real bank card: it is then exactly BANK_CARD_MM long on this screen. */
export function CalibrateDialog(props: { pxPerMm: number; onCancel: () => void; onSave: (pxPerMm: number | null) => void }) {
  const [scale, setScale] = useState(props.pxPerMm);
  const box = useRef<HTMLElement>(null);
  const id = useId();
  useMenuDialog(box, props.onCancel);
  const nominal = nominalPxPerMm();
  const clamp = (v: number) => Math.min(nominal * 1.6, Math.max(nominal * 0.6, v));
  const step = (k: number) => setScale(clamp(scale * k));
  return (
    <div className="word-help-backdrop">
      <section ref={box} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-help`} className="word-help-dialog title-note-dialog calibrate-dialog">
        <h2 id={`${id}-heading`}>Calibrate actual size</h2>
        <p id={`${id}-help`} className="title-note-help">
          Hold a bank card (or anything {BANK_CARD_MM} mm long) against the screen, then make the bar exactly as long as the card. This is saved on this
          device only and never changes what prints.
        </p>
        <div className="calibrate-bar" data-testid="calibrate-bar" style={{ width: `${BANK_CARD_MM * scale}px` }}>
          <span>{BANK_CARD_MM} mm</span>
        </div>
        <label className="calibrate-range">
          Bar length
          <input type="range" min={nominal * 0.6} max={nominal * 1.6} step={0.001} value={scale} onChange={(event) => setScale(Number(event.target.value))} />
        </label>
        <div className="title-note-actions">
          <button type="button" className="tool-button" onClick={() => step(1 / 1.005)} aria-label="Shorter">
            −
          </button>
          <button type="button" className="tool-button" onClick={() => step(1.005)} aria-label="Longer">
            +
          </button>
          <button type="button" className="tool-button" onClick={() => props.onSave(null)}>
            Reset
          </button>
          <button type="button" className="tool-button" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="button" className="tool-button primary" onClick={() => props.onSave(scale)}>
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
