# Website copies of the STIX fonts

WOFF2 versions of the STIX 2.0.2 fonts in `assets/graph-fonts/`, for the website only (S42).
They hold the same tables, Brotli-compressed, and every raw table decompresses byte-identical to
the OTF. Made with fontTools 4.60.1: `fonttools ttLib.woff2 compress -o X.woff2 X.otf`.
They live here, not in `assets/graph-fonts/`, so the MCP service package does not change.
Exports keep embedding subsets of the OTF files. Licence: `assets/graph-fonts/OFL.txt`.

- STIXTwoText-Regular.woff2: 52f2d52bdbfb159cf6d43f57b55e92571f1303d447486c7cef17062f8bab51ab
- STIXTwoText-Italic.woff2: 323137a4fab6f4be8f3d2a84b1ab2ec41333db9136b4b77a3eed15137bdbc488
- STIXTwoMath-Regular.woff2: 288816502520c6613feffc8264d92e7ee33f1937bd91010f285017719392e2ae

# The app's interface font

Inter as two variable WOFF2 files (weights 100 to 900, Latin subset), loaded by
`src/site/house-style.css` as the family "MathsDock UI". Copied unchanged from the npm package
`@fontsource-variable/inter` 5.3.0 (`inter-latin-wght-normal.woff2` and
`inter-latin-wght-italic.woff2`). They are for the website's own controls and text only:
diagrams keep STIX Two, and worksheets and booklets keep the Inter files in `assets/resource-fonts/`.
Licence: `assets/resource-fonts/OFL.txt`.

- Inter-Variable-Latin.woff2: 3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62
- Inter-Variable-Latin-Italic.woff2: 7291b5970da2237441273c03b424a504b70b18f09791473fab99687dcc314720
