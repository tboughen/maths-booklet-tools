import { useEffect, useState } from "react";
import { CalibrateDialog } from "./PrintSize";
import { nominalPxPerMm, readCalibration, writeCalibration } from "./printSizeData";

/**
 * Pages at their intended print size (W31): "Actual size" shows each page as wide on screen as it
 * prints, so a teacher can judge type and writing space as pupils will see them. Browsers assume
 * 96 pixels to the inch, which is rarely true of a real screen, so "Calibrate…" lets the teacher
 * match an on-screen bar to a bank card once on each device. It never changes what prints.
 */
export function usePrintSize() {
  const [actual, setActual] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  // Read on every render: the calibration is kept in device pixels, so a browser zoom (which fires
  // resize and changes devicePixelRatio) changes the CSS pixels it needs.
  const [, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener("resize", refresh);
    return () => window.removeEventListener("resize", refresh);
  }, []);
  const saved = readCalibration();
  const pxPerMm = saved ?? nominalPxPerMm();
  return {
    actual,
    pxPerMm,
    /** The page's on-screen width while shown at actual size, else undefined (fit the column). */
    width: (pageMm: number) => (actual ? `${Math.round(pageMm * pxPerMm * 100) / 100}px` : undefined),
    controls: (
      <span className="print-size">
        <button type="button" className="tool-button" aria-pressed={actual} onClick={() => setActual(!actual)}>
          Actual size
        </button>
        <button type="button" className="tool-button" onClick={() => setCalibrating(true)}>
          Calibrate…
        </button>
        {actual && <span className="print-size-note">{saved === null ? "Not calibrated on this device, so sizes may be a little off." : "Calibrated for this device."}</span>}
        {calibrating && (
          <CalibrateDialog
            pxPerMm={pxPerMm}
            onCancel={() => setCalibrating(false)}
            onSave={(next) => {
              writeCalibration(next);
              setCalibrating(false);
              setVersion((v) => v + 1);
            }}
          />
        )}
      </span>
    ),
  };
}

