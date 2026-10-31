# Past-paper examples in Graph tool and Ratio tables

These are editable teaching resources based on published questions, rather than copies of the complete question. Source links open the original question in a separate tab so the editor stays available. Each replacement is confirmed and undoable. Scaffolds preserve blank grids or answer lines; worked output is a separate, explicit choice. Existing generic ratio examples remain available.

| Tool | Published question | Teaching resource | Checked worked values |
| --- | --- | --- | --- |
| Graph | [June 2019 Higher 2 Q2](https://mathsdock.co.uk/?tool=question-bank&question=1MA1_JUN_2019_2H_Q2) | y = 2x − 3, −2 ≤ x ≤ 4; half-unit x squares and unit y squares | Segment from (−2, −7) to (4, 5) |
| Graph | [November 2017 Foundation 3 Q13](https://mathsdock.co.uk/?tool=question-bank&question=1MA1_NOV_2017_3F_Q13) | y = ½x − 1, −2 ≤ x ≤ 3; half-unit scales | Segment from (−2, −2) to (3, ½) |
| Graph | [November 2021 Foundation 1 Q18](https://mathsdock.co.uk/?tool=question-bank&question=1MA1_NOV_2021_1F_Q18) | y = 2x − 2, −2 ≤ x ≤ 3; half-unit x squares and unit y squares | Segment from (−2, −6) to (3, 4) |
| Ratio | [November 2017 Foundation 3 Q12](https://mathsdock.co.uk/?tool=question-bank&question=1MA1_NOV_2017_3F_Q12) | 2.5 kg of apples costs £3.60; unit-price scaffold, then 3.5 kg | £1.44 per kg; £5.04 for 3.5 kg |
| Ratio | [November 2021 Foundation 1 Q17](https://mathsdock.co.uk/?tool=question-bank&question=1MA1_NOV_2021_1F_Q17) | Recipe for 12 biscuits: 125 g butter, 200 g flour, 50 g sugar. Three-column scaffold for one biscuit | 125/12 g butter, 50/3 g flour, 25/6 g sugar |

Graph grids keep the tool's 1 cm square convention and source bounds/scales. The original fine grid, table and full prompt remain in the source question. Worked segments stop at the source's requested x domain. The recipe table supports the unit-quantity step of a larger limiting-ingredient question; it does not put available stock into a falsely proportional row or silently supply the final answer.

The question images and complete relevant official mark-scheme rows were personally inspected. The primary equation and coordinate table were used for November 2021 Q18; an additional-guidance example point (0.5, 0) in the original scheme is inconsistent with y = 2x − 2. The correct zero is x = 1. The source assets remain unchanged.

Values and variants live in `src/examples/sourceExamples.ts`; the shared inspector panel is `src/examples/PastPaperExamples.tsx`. Tests cover reviewed catalogue membership, source links, mathematics, blank/answer-line states, confirmation/cancellation/Undo, actual SVG/600 ppi PNG outputs and narrow-screen usability. Future examples should use the same source-verification and scaffold/worked distinction.
