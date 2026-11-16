Inter 4 (Regular 400, SemiBold 600, Italic 400; optical size 14) from github.com/google/fonts (ofl/inter),
instanced from the variable fonts with `fontTools.varLib.instancer`, subset to Latin-1 plus the maths symbols
worksheets use (− × ÷ ² ³ ° θ π ≤ ≥ ≠ √ ½ → ↑ □ ○ ● ξ ∅ ≈ ∞, the set notation below, and typographic quotes; □ is the empty box for missing-number questions, ○ and ● the open and filled circles of inequality questions) and saved as TrueType (so the PDF writer can subset them) with
`pyftsubset --unicodes=... --layout-features=kern,liga,calt`. Inter is the MathsDock website's
interface font. Licensed under the included SIL Open Font License.

The set-notation glyphs ∈ ∉ ∩ ∪ ≡ ⊂ ⊃ ⊆ ⊇ (which Inter does not have) are copied into all three files from
Noto Sans Math Regular (github.com/google/fonts, ofl/notosansmath; copyright 2022 The Noto Project Authors,
SIL Open Font License 1.1, see `NotoSansMath-OFL.txt`), scaled so ≤ matches Inter's ≤ and centred on Inter's
maths axis, with the operator advance of Inter (wider where the glyph needs it). They are upright in the italic
file, as maths symbols are.
Kerning is removed from every pair that involves a digit or a maths sign (0-9, ¹ ² ³, ½ ¼ ¾, ° % + − × ÷ = < > ≤ ≥ ≠ ≈ ±
/ √ π ∞, and the contextual alternates Inter swaps in for them) by `python3 assets/resource-fonts/unkern-maths.py`
(needs fontTools and uharfbuzz; rerun it after any change to the subsets). Inter's prose kerning pulled "7." in by
0.125 em and ".1" by 0.086 em, so 7.1 read as one shape; numbers now print at exactly the advance widths below, in the
PDF, PNG, website preview and Word files alike. Kerning between letters and ordinary punctuation is kept.
`packages/resource-core/src/metrics.ts` holds the advance widths generated from these files.
Diagrams keep their own STIX Two fonts (`assets/graph-fonts`).
