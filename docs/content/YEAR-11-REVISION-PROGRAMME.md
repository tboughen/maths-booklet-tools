# Year 11 revision programme papers

The department keeps some Edexcel papers for the Year 11 revision programme: the November mocks,
mini-mocks (done in class under test conditions), half past papers (homework) and study-leave papers. Pupils must not meet those questions earlier, so the bank holds them but leaves them
out of searches by default.

- `scripts/bank/revision-programme.json` lists each paper (Foundation and Higher) with its use, taken
  from the department's Year 11 Revision Paper Plan (paper register). Unallocated papers and the
  lunchtime revision papers are not part of the programme, so they are not listed and stay visible.
- `python3 -I scripts/bank/apply-revision-programme.py` sets `revisionUse` (for example "Mini-mock MM1")
  on every question from a listed paper and removes it from every other question. Listed papers that are
  not in the bank yet are reported and are marked when they are added and the script is run again.
- The script stops if a Foundation/Higher crossover pair would be marked on one side only.
- Question Bank, Paper Builder and Assessment Follow-Up leave these questions out unless the teacher sets
  **Year 11 revision papers** to **Included**. The choice resets to Hidden on each visit; the Question
  Bank keeps `revision=include` in the address while it is on. Marked questions show their use in orange.

For a new school year, update the list from the new plan and run the script.

A link to a marked question opens it with revision papers included. A topic whose only questions are
marked says so and offers to include them, and Paper Builder says how many chosen questions are left out.
