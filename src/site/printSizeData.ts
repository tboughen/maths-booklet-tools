/** A bank card (ISO/IEC 7810 ID-1) is 85.6 mm wide: something every teacher has to hand. */
export const BANK_CARD_MM = 85.6;
const KEY = "mathsdock.print-size.device-px-per-mm";

/** CSS pixels per millimetre as browsers assume them: 96 to the inch. */
export const nominalPxPerMm = () => 96 / 25.4;
const ratio = () => (typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

/**
 * The saved calibration, as CSS pixels per millimetre now, or null when this device has none. It is
 * stored in device pixels, so it still holds after the teacher zooms the browser.
 */
export function readCalibration(): number | null {
  try {
    const v = Number(window.localStorage.getItem(KEY));
    return v > 0 && Number.isFinite(v) ? v / ratio() : null;
  } catch {
    return null;
  }
}

/** Save (or with null, forget) the calibration; returns what is now in force. */
export function writeCalibration(pxPerMm: number | null): number | null {
  try {
    if (pxPerMm === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, String(pxPerMm * ratio()));
  } catch {
    // Storage may be blocked; the setting then lasts only while the page is open.
  }
  return pxPerMm;
}
