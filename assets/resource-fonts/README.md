Lato 2.0 (Regular, Bold, Italic) from github.com/google/fonts (ofl/lato), subset to Latin-1 plus the
maths symbols worksheets use (− × ÷ ² ³ ° θ π ≤ ≥ ≠ √ ½ → ↑ and typographic quotes) and saved as WOFF2 with
`pyftsubset --unicodes=... --flavor=woff2 --layout-features=kern,liga`. Licensed under the included SIL Open
Font License. `packages/resource-core/src/metrics.ts` holds the advance widths generated from these files.
Diagrams keep their own STIX Two fonts (`assets/graph-fonts`).
