import * as v from "./v3";
import { denseFixture as oldDense } from "./stress-fixture";
/** A measured admissible maximum structure; all possible line placements need not coexist. */
export function denseFixture(): v.Envelope {
  const e = v.upgrade(oldDense());
  e.document.presentation.unitMm = 10;
  for (const b of e.document.bars) {
    b.name = v.label();
    for (const p of b.parts) {
      p.labels.inside = v.label("1/2", "line");
      // Retain all three independently editable slots, without forcing all maxima together.
      p.labels.below = v.label("x", "hidden");
    }
  }
  // Keeping every top label visible as well would exceed the existing 32M-pixel cap.
  for (const p of e.document.bars.at(-1)!.parts)
    p.labels.above!.state = "hidden";
  return v.validate(e);
}
