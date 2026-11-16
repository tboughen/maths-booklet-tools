import * as at from "../../../algebra-tile-core/src/index";
import * as ai from "../../../algebra-tile-core/src/interchange";
export const atConfig = {
  kind: "algebra-tiles" as const,
  name: "algebra_tiles",
  schema: at.envelopeSchema,
  createInput: ai.createSchema,
  revision: ai.revisionSchema,
  capabilities: {
    schemaVersions: [1],
    rendererVersions: [at.RENDERER_VERSION],
    maximumTerms: at.MAX_TERMS,
    maximumTilesPerTerm: at.MAX_COUNT,
    maximumTiles: at.MAX_TILES,
    letters: "Two letters at most: the long letter (first alphabetically unless letters is given) and the short letter. Not l or o.",
    tiles: "1 (a small square), a (a strip a by 1), a² (a square a by a), ab (a rectangle a by b), b² and b, and blocks for three letters: a³, a²b (a by a by b), ab² (a by b by b), b³. Each kind has its own shape, so unlike terms never look alike.",
    negativeTiles: "Negative tiles are red (positive yellow), hatched, and signed (−a) when labels print, so they read in black and white.",
    arrangements: ["as-written", "grouped"],
    zeroPairs: ["none", "show", "hidden"],
    fills: ["colour", "plain"],
    examples: ai.exampleIds,
    itemStates: ["show", "hidden"],
    maximumRevisionOperations: 40,
    revisionOperations: ai.operationSchema.options.map((o) => o.shape.op.value),
    outputView: "pupil (default) or explicitly requested answer; source JSON and hash keep saved pupil visibility",
    hiddenAnswers: "A hidden term leaves its space empty for pupils (they draw the tiles) and prints in dark pink on the answers copy; a hidden expression or answer prints as a dotted answer line for pupils; zeroPairs hidden rings the zero pairs on the answers copy only. An empty shown expression or answer is a pupil answer line with no saved answer.",
    creation: "spec or envelope; omit both for the tiles of 3x + 2 − x",
  },
  createDescription:
    'Create algebra tiles (the school method for collecting like terms; A1, A2, A4.02). Supply exact envelope OR spec:{example?|tiles?|terms?, letters?, hideTiles?, expression?, answer?, arrangement?, zeroPairs?, labels?, fill?, frame?, intentionalError?, lines?, writeExpression?, collect?, worked?}. example: collect-two-letters, zero-pairs, squares-and-products, a2b-ab2, draw-the-tiles. tiles:"3a + 2b − a + 4" draws the terms as written (never collected); terms:[{term:"a²b",count:2},{term:"ab²",count:-1,hidden:true}] for term-by-term control (count negative = negative tiles; hidden = pupils draw them). letters:{long:"a",short:"b"} fixes the long and short letter. hideTiles:true hides every tile (add frame:true for drawing room). expression and answer print on a line under the tiles ("expression = answer"): text ("" is a pupil answer line) or {text, hidden:true}. arrangement as-written (default) or grouped (like tiles together, positives above negatives); zeroPairs show|hidden rings zero pairs when grouped. writeExpression:true / collect:true explicitly fill the expression / simplified answer as hidden answers ({hidden:false} prints them). intentionalError:true silences teacher notes for a wrong expression or answer. outputView pupil (default) or answer. Never collect or fill otherwise.',
  reviseDescription:
    'Revise algebra tiles atomically using envelope, baseHash:contentHash and max 40 operations. set_tiles {tiles} replaces every term from an expression, as written; set_term {termId,term?,count?,show?}; add_term {term,count,after?}; remove_term {termId}; move_term {termId,by:-1|1}; set_item {item:expression|answer,text?,show?} (adds the line if absent; text "" is a pupil answer line); remove_item {item}; set_letters {letters:{long,short}} renames the letters, tiles keep their shapes; write_expression {hidden?}; collect {hidden?} explicitly fill an empty expression or answer (hidden unless hidden:false); set_settings {settings:{arrangement?,zeroPairs?,labels?,fill?,frame?,intentionalError?,lines?}}. Nothing is collected unless requested. Stable term IDs (t1, t2) come from the returned envelope. outputView pupil|answer affects artwork only.',
};
