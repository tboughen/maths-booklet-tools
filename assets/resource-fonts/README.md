Inter 4 (Regular 400, SemiBold 600, Italic 400; optical size 14) from github.com/google/fonts (ofl/inter),
instanced from the variable fonts with `fontTools.varLib.instancer`, subset to Latin-1 plus the maths symbols
worksheets use (− × ÷ ² ³ ° θ π ≤ ≥ ≠ √ ½ → ↑ and typographic quotes) and saved as TrueType (so the PDF writer can subset them) with
`pyftsubset --unicodes=... --layout-features=kern,liga,calt`. Inter is the MathsDock website's
interface font. Licensed under the included SIL Open Font License.
`packages/resource-core/src/metrics.ts` holds the advance widths generated from these files.
Diagrams keep their own STIX Two fonts (`assets/graph-fonts`).
