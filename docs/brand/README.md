# Maths Dock branding

Tim approved `approved-draft.png` on 11 October 2026. The SVG masters trace its
full-size symbol and lettering rather than substituting a typeface. The M has
straight geometric edges. Contours are simplified and smoothed slightly during
vector conversion; the draft remains the reference for visual review.

## Assets

- `public/brand/mathsdock-logo.svg`: full navy/blue logo, transparent background.
- `public/brand/mathsdock-logo-inverse.svg`: white/light-blue logo for navy grounds.
- `public/brand/mathsdock-icon.svg`: standalone symbol.
- `public/brand/mathsdock-icon-inverse.svg`: inverted standalone symbol.
- `public/brand/mathsdock-icon-mono.svg`: symbol using `currentColor` throughout.
- `public/favicon.svg`: full symbol on a white square, readable against either
  browser theme. PNG fallbacks are 16, 32 and 48 pixels.
- `public/brand/icon-180.png`, `icon-192.png`, `icon-512.png`: mobile icons.
- `public/brand/mathsdock-social.png`: 1200 × 630 sharing image.
- `review-board.svg` and `review-board.png`: vector conversion review, including
  inverse, standalone and actual-size favicon examples.

The SVGs contain paths only; they need no external font or raster image.
Standard colours: navy `#173c65`, blue `#0f62fe`; inverse water `#2bb8ff`.
The wall outline, four bollards, three rope spans, convex left shoulder and
three downward joints below the middle/right bollards follow the approved draft.
Fine stonework and rope detail naturally reduces at favicon sizes.

## Rebuild

From the repository root with Python (numpy/Pillow) and Node available:

```text
python scripts/brand/trace-master.py docs/brand/approved-draft.png
node scripts/brand/render-assets.mjs
```

The website uses the full SVG in the header with an accessible home-link label.
Page titles, metadata and question-bank PDF creator use “Maths Dock”. The
homepage starts directly with its cards; its separate heading/tagline are
removed at Tim's request. Existing storage keys, routes and section names are preserved.
Brand assets are included in both the Cloudflare and GitHub Pages builds.

Review the preview before publishing the branding to the production domain.
Social metadata uses the production image URL; it will work after production
publication. GitHub Pages remains the retained migration fallback.
