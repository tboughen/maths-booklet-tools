

## Approved right M leg widening — 15 October 2026

The right M leg is 20% wider at matching heights, extending its outer/right
edge. The inner edge, other M strokes and original projection calibration
stay fixed. The curved foot retains its 7px waterline clearance. The wall,
reduced bollard, restored rope, water and wordmark are unchanged.
Tim reviewed comparison.png and authorised publication through the main
qualified-artifact workflow. Website/favicon/mobile/sharing variants use
the same master; cached artwork links carry the new content version.
Editable settings: scripts/brand/wrapped_monogram.py. Release evidence:
reports/mathsdock-right-leg-publish-2026-10-15. Earlier entries are historical.


Rebuild the editable artwork from the repository root with Python (numpy/Pillow)
and the app Node dependencies:

```text
python scripts/brand/trace-master.py docs/brand/approved-draft.png
node scripts/brand/render-assets.mjs
```
The retained raster is read only; the reviewed M is a projected vector path.
