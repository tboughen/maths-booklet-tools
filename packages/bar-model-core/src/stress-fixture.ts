import * as v from "./v3";
import dense from "./stress-fixture.json" with { type: "json" };
/** A measured admissible maximum structure; all possible line placements need not coexist. */
export const denseFixture = (): v.Envelope => v.validate(structuredClone(dense));
