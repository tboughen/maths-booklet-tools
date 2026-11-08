# Website copies of the STIX fonts

WOFF2 versions of the STIX 2.0.2 fonts in `assets/graph-fonts/`, for the website only (S42).
They hold the same tables, Brotli-compressed, and every raw table decompresses byte-identical to
the OTF. Made with fontTools 4.60.1: `fonttools ttLib.woff2 compress -o X.woff2 X.otf`.
They live here, not in `assets/graph-fonts/`, so the MCP service package does not change.
Exports keep embedding subsets of the OTF files. Licence: `assets/graph-fonts/OFL.txt`.

- STIXTwoText-Regular.woff2: 52f2d52bdbfb159cf6d43f57b55e92571f1303d447486c7cef17062f8bab51ab
- STIXTwoText-Italic.woff2: 323137a4fab6f4be8f3d2a84b1ab2ec41333db9136b4b77a3eed15137bdbc488
- STIXTwoMath-Regular.woff2: 288816502520c6613feffc8264d92e7ee33f1937bd91010f285017719392e2ae
