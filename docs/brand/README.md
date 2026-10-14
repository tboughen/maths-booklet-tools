# Maths Dock — wrapped M revision

Prepared on 14 October 2026 from the approved artwork source at
commit `0f4ab4d74f70de149e9f291e26387a49f8f1a599`, branch
`codex/layout-cloudflare`. The release integrates onto the newer quadratic production baseline `c4af3139aef4a1278cc6e73de11cfe2c78382471`. Tim approved these assets for website publication, including the favicon.
Release evidence is retained in reports/mathsdock-wrapped-logo-2026-10-14.

The M uses the rounded L-shaped wall and camera from Tim's 3D reference image.
Its upright strokes remain straight in 3D, while the letter follows the two
perpendicular faces and their rounded corner. The top and base are level in
the model. The letter height is fitted optically inside the existing logo;
the base is lowered to sit close above the water line, with a clear ink gap.

Following Tim's second reference, both lower stems now extend to a curved cut
parallel to the logo's existing waterline, leaving a 7px vertical clearance at
native symbol size. The lower ends are no longer flat. The upper M and its
corner wrap remain unchanged. `waterline_profile.py` preserves the existing
SVG contour used to construct those bottom edges.

The rightmost bollard is now scaled to 85% of its previous width and height,
anchored at the centre of its sloping wall base. The adjoining rope controls
reconnect to the smaller post at their original heights, preserving the rope's
thickness (5px at the attachment) rather than scaling it with the post.
The approved wrapped M, other three bollards,
wall/stone detail, water and outlined wordmark are unchanged from the preceding
review draft. The retained approved raster and reference images are unmodified.

The assets include normal/inverse full logos, normal/inverse/monochrome symbols,
SVG/PNG favicons, mobile icons and social image. The SVGs use vector paths only,
with no font or raster-image dependency. `review-board.png` shows the revision;
`comparison.png` shows the pinched rope before correction and the restored rope
at full and small sizes. The smaller bollard is retained in both.

## Rebuild

From the package root with numpy/Pillow and the app's Node dependencies:

```text
python scripts/brand/trace-master.py docs/brand/approved-draft.png
node scripts/brand/render-assets.mjs
```

`scripts/brand/wrapped_monogram.py` contains the editable surface, camera and
optical placement settings. `--output-root <directory>` on the tracer generates
separate candidate masters. Use the current production repository baseline for
a future release; do not deploy an older Cloudflare checkout.

`scripts/brand/bollard_perspective.py` contains the 0.85 scale and base anchor.
