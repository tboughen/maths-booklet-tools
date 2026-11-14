/** Half the 44 px touch target (U43). */
const TAP_REACH = 22;
/** The tick nearest a tap at (x, dy from the tick buttons' centre line), or null when none is within reach. */
export function nearestTick(ticks: { v: string; x: number }[], x: number, dy: number): string | null {
  if (Math.abs(dy) > TAP_REACH) return null;
  let best: { v: string; gap: number } | null = null;
  for (const t of ticks) {
    const gap = Math.abs(t.x - x);
    if (gap <= TAP_REACH && (!best || gap < best.gap)) best = { v: t.v, gap };
  }
  return best?.v ?? null;
}
