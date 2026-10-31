# Judge rubrics

The judge panel (`docs/AUTONOMOUS-LOOP-POLICY.md`, wave 2) reviews each pull request with three
judges that share no context with each other or with the author. Each judge reads the same project
guidance (`AGENTS.md`, `CLAUDE.md`, the policy, the Maths Resource Design Guide and the Tool
Creation Guide), the risk tier, the pull request text and the diff, and scores the change against
its own rubric below.

The panel runs in **shadow mode**: it reports in the job summary and decides nothing. Its verdicts
are compared with Tim's decisions and the seeded calibration set (`review/calibration/`) before any
phase lets it gate a merge.

Each judge returns `pass`, `concerns` or `fail`, a confidence, and findings tagged `blocker`,
`major` or `minor` with the rubric item they break. A judge that cannot see enough of the change
to decide says so with `concerns` and low confidence; it never guesses a pass.

Changing a rubric changes what the panel accepts, so rubric files are guidance (tier T7).
