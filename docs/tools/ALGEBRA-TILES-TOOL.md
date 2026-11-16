# Algebra tiles

`/tools/algebra-tiles` draws algebra tiles, the school's Common Approaches method for collecting like terms
(`docs` METHODS row "Collecting like terms": tiles grouped by kind, then counted). Built 16 November 2026 for the
Year 8 A4.02 worksheet ("Simplify an expression involving terms with combinations of variables, e.g.
3a²b + 4ab² + 2a² − a²b"), and for A1 and A2. Tim asked for tiles beyond 1, x and x², especially a²b and ab².
Algebra strand.

Code: `packages/algebra-tile-core` (schema, expression reading, explicit collecting, layout, SVG, examples),
`src/algebra-tiles` (editor). Labels use the shared maths-text helper from function machines (STIX Two, italic
letters, true minus). MCP access is the `algebra-tiles` kind of the generic connector tools
(`diagram_capabilities`, `create_diagram`, `revise_diagram`), adapted by `interchange.ts`. Tiles can also be
placed in worksheets and booklets.

## The tiles

Each kind of term has its own shape, so unlike terms never look alike. Two letters at most per diagram: the long
letter (17 mm) and the short letter (11 mm); the unit is 7 mm.

| Term | Tile |
|---|---|
| 1 | a 7 mm square |
| a, b | an upright strip, 7 mm wide and a (or b) tall |
| a², ab, b² | a square a by a, a rectangle a by b, a square b by b |
| a³, a²b, ab², b³ | a block in cabinet projection: a²b is a by a by b, ab² is a by b by b |

Three-letter terms are blocks because a²b is a × a × b: a volume, not an area. That is what lets pupils see that
a²b and ab² (the A4.02 misconception) are different shapes. Degree 4 and higher is refused.

Negative tiles follow the counters convention (METHODS: yellow positive, red negative). Because worksheets are often
printed in black and white, a negative tile is also hatched and its label carries the sign (−a). `fill: "plain"`
prints white tiles; negatives stay hatched and signed.

## Document

- `letters {long, short}`: single lower-case letters, not l or o. Renaming them keeps every tile's shape.
- `terms` (1 to 16), each `{ id, count, long, short, show }`: `count` is the number of tiles and their sign
  (−12 to 12, never 0); `long` and `short` are the powers of the two letters. At most 60 tiles in all.
- `arrangement`: `as-written` (the terms in order, wrapping before a term that does not fit 180 mm) or `grouped`
  (like tiles together, in the order each kind first appears, positive tiles in a row above negative ones).
- `zeroPairs`: `none`, `show` or `hidden` (answers copy only). Rings each positive tile with the negative tile
  under it, in the grouped arrangement only.
- `labels`, `fill`, `frame` (a dashed frame round the tiles: room for pupils to draw them), `intentionalError`,
  `lines`.
- `expression` and `answer`: `{text, show}` items or null, printed on one line under the tiles as
  "expression = answer". Empty text is a pupil answer line (dotted). A hidden item is a saved answer: pupils see
  the answer line, the answers copy prints it in dark pink. Both copies keep the same size.
- A hidden term leaves its space empty on the pupil copy and prints in dark pink on the answers copy.

## Explicit actions only

The **Tiles for** field reads an expression as written ("3a + 2b − a + ab^2") and never collects it. **Write the
expression** and **Collect like terms** fill an empty expression or answer line from the tiles (hidden by
default); a written line is never changed. Collected terms keep the order each kind first appears; a total of
nothing is 0.

## Teacher notes

Never printed, never corrected: an expression or answer that does not match the tiles, an answer that still has
like terms to collect, text that cannot be read, and zero pairs asked for without grouping. A deliberate error
turns the matching notes off.
