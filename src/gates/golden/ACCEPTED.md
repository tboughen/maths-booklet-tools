# Accepted output goldens

Every change to `outputs.json` is recorded here by the accept command in
`src/gates/goldens.test.ts`, with the reason given. A pull request that accepts goldens is T4 or
higher and waits for Tim (`docs/AUTONOMOUS-LOOP-POLICY.md`).

## 2026-10-31: Initial goldens for every gallery example

- 165 outputs recorded (pupil and worked) across 9 tools; pixels recorded on linux-x64 at 150 ppi.

## 2026-11-08: Add charts and probability trees to the output gates

- charts: chart-dual-transport: added
- charts: chart-dual-transport (worked): added
- charts: chart-composite-sales: added
- charts: chart-composite-sales (worked): added
- charts: chart-vline-cars: added
- charts: chart-vline-cars (worked): added
- charts: chart-bar-draw: added
- charts: chart-bar-draw (worked): added
- probability trees: tree-two-bags: added
- probability trees: tree-two-bags (worked): added
- probability trees: tree-darts: added
- probability trees: tree-darts (worked): added
- probability trees: tree-without-replacement: added
- probability trees: tree-without-replacement (worked): added
- probability trees: tree-unequal: added
- probability trees: tree-unequal (worked): added
- probability trees: tree-given-that: added
- probability trees: tree-given-that (worked): added
- probability trees: tree-three-coins: added
- probability trees: tree-three-coins (worked): added

## 2026-11-10: Add the frequency trees tool's gallery examples (wave 4 lane B, approved by Tim 10 Nov 2026)

- frequency trees: ftree-coffee: added
- frequency trees: ftree-coffee (worked): added
- frequency trees: ftree-lunches: added
- frequency trees: ftree-lunches (worked): added
- frequency trees: ftree-handedness: added
- frequency trees: ftree-handedness (worked): added
- frequency trees: ftree-text-or-email: added
- frequency trees: ftree-text-or-email (worked): added
- frequency trees: ftree-three-years: added
- frequency trees: ftree-three-years (worked): added

## 2026-11-11: Graph axis numbers now print over plotted lines (Tim chose this for every graph, 11 Nov 2026); names use a white outline instead of a box

- graph: graph-1MA1_JUN_2019_2H_Q2: svg d7e524fc018e6637 -> 57e383be780c3676
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): svg 752c0540c44818d4 -> b18cf14f655d949d
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): pixels a3dc0cf80ad7f5a5 -> dc83af7d19c429cd
- graph: graph-1MA1_NOV_2017_3F_Q13: svg 1eb0ebd9e948074d -> b302fb81856bd9c3
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): svg 5031ace1c3c9c836 -> 0b621984c8518128
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): pixels badb0dbfd1e20dc0 -> ed8ac3c567240f31
- graph: graph-1MA1_NOV_2021_1F_Q18: svg 7308b829e8734eab -> 48df159e1eaa672b
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): svg 47e75c878ab5371b -> d7c6def019a98198
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): pixels 515f66453941fb7e -> 68ad6c047e5303ba

## 2026-11-14: U86: cuboid depth labels sit beside the middle of the receding edge, offset at right angles (schema 2 only; schema 1 renderer frozen)

- cuboids: cuboid-1MA1_JUN_2017_3F_Q12: svg 31384e61bad1b541 -> 7a3d6f057d8eaddc
- cuboids: cuboid-1MA1_JUN_2017_3F_Q12: pixels e7707ddf1c843f7f -> 51186a7cccf4b392
- cuboids: cuboid-1MA1_JUN_2017_3F_Q12 (worked): svg 07e8f7735838bcf8 -> 25be1f6370d327d0
- cuboids: cuboid-1MA1_JUN_2017_3F_Q12 (worked): pixels 7d4d19b3f46bb67e -> b49cee6122fa0318
- cuboids: cuboid-1MA1_MOCK_SET_08_3F_Q13: svg 671bf19846dacba1 -> 7b15cbc11e662803
- cuboids: cuboid-1MA1_MOCK_SET_08_3F_Q13: pixels 673cb1969c4078f5 -> 87100dfe39a9459f
- cuboids: cuboid-1MA1_MOCK_SET_08_3F_Q13 (worked): svg ccb41ff341ee992d -> 78934147bceefb99
- cuboids: cuboid-1MA1_MOCK_SET_08_3F_Q13 (worked): pixels f5044524d8e33862 -> c5f42d37655c638c
- cuboids: cuboid-1MA1_NOV_2018_3H_Q8 (worked): svg 09312cdf350786b7 -> cfa1e1b7a78c4fa3
- cuboids: cuboid-1MA1_NOV_2018_3H_Q8 (worked): pixels 5e1ff5edc1e0bc0d -> dc17d26b491ad16c
- cuboids: cuboid-1MA1_NOV_2019_2H_Q9: svg 86fbf3655af61646 -> 093eefb6110e6a8c
- cuboids: cuboid-1MA1_NOV_2019_2H_Q9: pixels ab57e0b81a017947 -> b58233cd6e823a82
- cuboids: cuboid-1MA1_NOV_2019_2H_Q9 (worked): svg 8693362e8de1cab0 -> c99cc038a42d67af
- cuboids: cuboid-1MA1_NOV_2019_2H_Q9 (worked): pixels 17ebe3b154d4b9f4 -> f2d33bd999238bbe
- cuboids: cuboid-1MA1_NOV_2020_2F_Q11: svg e0f7c4537a1bfd7a -> a09a0cfde7ab1033
- cuboids: cuboid-1MA1_NOV_2020_2F_Q11: pixels aabc999e48518c2a -> a52f0e980417dd29
- cuboids: cuboid-1MA1_NOV_2020_2F_Q11 (worked): svg 9f07930511a18589 -> 6522b70503e48504
- cuboids: cuboid-1MA1_NOV_2020_2F_Q11 (worked): pixels 0dddd227ccd47c0e -> 654dd6541ae7940e
- cuboids: cuboid-base-area: svg 0f7ea9b40827f517 -> d5e882e511b23aed
- cuboids: cuboid-base-area: pixels 5311e1cc14d6541c -> 280874f31caf0f01
- cuboids: cuboid-base-area (worked): svg 4cc14a2273e6562f -> ff719532c8116923
- cuboids: cuboid-base-area (worked): pixels b0c2f2dbc11e5d15 -> 5cdf3fcf315094a4
- cuboids: cuboid-cross-section-face: svg b756315f5e3acf3d -> 1ac486b384ef1e15
- cuboids: cuboid-cross-section-face: pixels b3bab496862e4f7c -> cf5c190520169444
- cuboids: cuboid-cross-section-face (worked): svg 728b1756b83dd5f7 -> 0c0525aeb0f3a3b8
- cuboids: cuboid-cross-section-face (worked): pixels ff294d68289d139f -> e320090707e88c97
- cuboids: cuboid-grey-faces: svg ee7696ce0e6f3aa7 -> 52ef36a80327c6fa
- cuboids: cuboid-grey-faces: pixels f6b0c5f571cf19b5 -> 3e4f33df548e3862
- cuboids: cuboid-grey-faces (worked): svg d10afe4c59179b32 -> 117a89f9784ed1d6
- cuboids: cuboid-grey-faces (worked): pixels 7d7d128c8e196e6d -> 7d1f9f14e97adae9
- cuboids: cuboid-layers-1: svg 94bd52ed73c54cc9 -> 6231550ae1213c17
- cuboids: cuboid-layers-1: pixels 8a037a9f9a90b864 -> ba264f761115f2cd
- cuboids: cuboid-layers-1 (worked): svg adcefacbd3fe17ba -> 4a28c18deb0b93f2
- cuboids: cuboid-layers-1 (worked): pixels 8ff6ff1c3b145652 -> 83c91d0eaa93ec2f
- cuboids: cuboid-layers-2: svg fd4703a558137d44 -> 4084ec14055dff94
- cuboids: cuboid-layers-2: pixels 10c4db61fddd4e8c -> 038b612fbef74ae5
- cuboids: cuboid-layers-2 (worked): svg a9625b25c50c8cfb -> 004f718155700b4e
- cuboids: cuboid-layers-2 (worked): pixels 319bd6a36d471125 -> d717535197ad1a1a
- cuboids: cuboid-layers-3: svg 002181269e8d55bb -> f494ac6f128180be
- cuboids: cuboid-layers-3: pixels 2ab1e5f8799cf2d8 -> 5f8112293cf146df
- cuboids: cuboid-layers-3 (worked): svg d3d0a697f5b25f1a -> 44ad90fb415c07b5
- cuboids: cuboid-layers-3 (worked): pixels e34a5818ff9e51e9 -> f0b7cdabb3d1a302
- cuboids: cuboid-missing-height: svg ffe45be39ea0eb86 -> 7d30cb729594c7f8
- cuboids: cuboid-missing-height: pixels 781bd693c3757cfc -> f1e71a06cf3e82f5
- cuboids: cuboid-missing-height (worked): svg 6c6f330c3e68bc43 -> 973ea3dbb9de5544
- cuboids: cuboid-missing-height (worked): pixels dddcccdda6560ff2 -> c86796bc8c78bd8d
## 2026-11-14: U36: triangle SVGs carry an accessible title and aria-label describing what they print; artwork unchanged

- triangles: triangle-base-height: svg 817ce5dd173ba0a0 -> 07ab0d5d9a0a7110
- triangles: triangle-base-height (worked): svg 1b0ca219104d1ac4 -> d20b8b10256820ba
- triangles: triangle-bisector: svg 0cc8121d5ebcbd9b -> 61054d91206c95d1
- triangles: triangle-bisector (worked): svg 0cc8121d5ebcbd9b -> 61054d91206c95d1
- triangles: triangle-cosine-acute: svg bf8b6a627caf2f72 -> 33b3b4d4f499f0c4
- triangles: triangle-cosine-acute (worked): svg 4598cefc95b9752c -> 766efd625f12e401
- triangles: triangle-cosine-obtuse: svg 92612973fb44999c -> 9fcc28ff232b408d
- triangles: triangle-cosine-obtuse (worked): svg 4f5d95c9b8707d8f -> 4fcd4ebb58a202a4
- triangles: triangle-deliberate-error: svg 8b326037585a47f7 -> 64cb37f5a3e26b11
- triangles: triangle-deliberate-error (worked): svg 8b326037585a47f7 -> 64cb37f5a3e26b11
- triangles: triangle-external-height: svg a1aa2c99f806f03f -> 39ba75312b6efebb
- triangles: triangle-external-height (worked): svg a1aa2c99f806f03f -> 39ba75312b6efebb
- triangles: triangle-fractions: svg 8c4a711bc5f30f08 -> 54d92eeaffeba0a0
- triangles: triangle-fractions (worked): svg ad7353f7031afdaf -> 237102bf875d875f
- triangles: triangle-inverse-area: svg 047101d9972f040e -> 56c391b2261a772b
- triangles: triangle-inverse-area (worked): svg 28c24a5b10e1ebdc -> 1e39ea375ffbb0ec
- triangles: triangle-joined-rules: svg d314a332c46a75e1 -> 1f5f422ebac503f1
- triangles: triangle-joined-rules (worked): svg b9531c9ecb82fa02 -> a692225e5bbfdc31
- triangles: triangle-missing-side: svg 1bcf12413aef0b14 -> 3c30eea8e2382fc8
- triangles: triangle-missing-side (worked): svg ec34bdff3aa2cd0a -> d9f226eee8a9dac9
- triangles: triangle-pythagoras-error: svg da03b58d47a4901a -> b2031e9c55827a0d
- triangles: triangle-pythagoras-error (worked): svg 939b3c6a55f8581e -> 63bbf07925ae05cb
- triangles: triangle-right-trig: svg 6ba6bd2db6ce8329 -> 6133d6605b0ddec3
- triangles: triangle-right-trig (worked): svg c56fca6484acf528 -> 99c873fdbb3eda39
- triangles: triangle-sine-angle: svg e64063b6a2f8a274 -> 12548f4a0fc17170
- triangles: triangle-sine-angle (worked): svg dfc1943a8c6e316c -> 118d0700516caf57
- triangles: triangle-sine-side: svg 07609f727607091a -> f013b21958e2018c
- triangles: triangle-sine-side (worked): svg 9d216d1be4bef1b0 -> 3c3046fdce297357
- triangles: triangle-ssa: svg 390583d7e01c2f3c -> f90924d64a3a0a68
- triangles: triangle-ssa (worked): svg 390583d7e01c2f3c -> f90924d64a3a0a68

## 2026-11-14: U36: triangle SVGs carry an accessible title and aria-label describing what they print; artwork unchanged

- triangles: triangle-bisector: svg 61054d91206c95d1 -> fb498307d4ddd652
- triangles: triangle-bisector (worked): svg 61054d91206c95d1 -> fb498307d4ddd652
- triangles: triangle-deliberate-error: svg 64cb37f5a3e26b11 -> 3ae8429f3397f0b1
- triangles: triangle-deliberate-error (worked): svg 64cb37f5a3e26b11 -> 3ae8429f3397f0b1
- triangles: triangle-ssa: svg f90924d64a3a0a68 -> b70863311d864f29
- triangles: triangle-ssa (worked): svg f90924d64a3a0a68 -> b70863311d864f29

## 2026-11-14: U84: fractions in table-of-values equation headings print stacked (Tim, 14 Nov)

- plotting quadratics: quadratic-fractions: svg 5ae4b7a29459f80a -> cf36101557f9172e
- plotting quadratics: quadratic-fractions: mm 141x134 -> 141x136
- plotting quadratics: quadratic-fractions: png600 3331x3165 -> 3331x3213
- plotting quadratics: quadratic-fractions: pixels 6ac55f7fcb3e143d -> 552d38ee876f26eb
- plotting quadratics: quadratic-fractions (worked): svg 1477dd03169c49a3 -> 27d8dde9e4449e9c
- plotting quadratics: quadratic-fractions (worked): mm 141x134 -> 141x136
- plotting quadratics: quadratic-fractions (worked): png600 3331x3165 -> 3331x3213
- plotting quadratics: quadratic-fractions (worked): pixels ff0cb26b711403c8 -> 318a7273a4a13565

## 2026-11-14: U105 numeric grid method examples

- algebra grid: algebra-numeric: added
- algebra grid: algebra-numeric (worked): added
- algebra grid: algebra-decimal: added
- algebra grid: algebra-decimal (worked): added

## 2026-11-14: U105: grid-method working rows at three quarters of the cell size (Tim, 14 Nov)

- algebra grid: algebra-decimal: svg 598e36aef4fea9f4 -> 018682f38cc791e7
- algebra grid: algebra-decimal: mm 39x39 -> 39x31.5
- algebra grid: algebra-decimal: png600 921x921 -> 921x744
- algebra grid: algebra-decimal: pixels cfa32e638ff96393 -> f7a793cbac86c465
- algebra grid: algebra-decimal (worked): svg fda4d7736f154696 -> 61aeb195d4c75711
- algebra grid: algebra-decimal (worked): mm 39x50 -> 39x42.5
- algebra grid: algebra-decimal (worked): png600 921x1181 -> 921x1004
- algebra grid: algebra-decimal (worked): pixels 426475d13f4d69bd -> af1741c5109bd28d
- algebra grid: algebra-numeric: svg 2593502be3e80f12 -> 73f02511b9c8f630
- algebra grid: algebra-numeric: mm 39x39 -> 39x31.5
- algebra grid: algebra-numeric: png600 921x921 -> 921x744
- algebra grid: algebra-numeric: pixels e73c6823809611c9 -> 9baff6f16819fbd1
- algebra grid: algebra-numeric (worked): svg 9296a92abd973de6 -> e8377cee0a7073c4
- algebra grid: algebra-numeric (worked): mm 39x50 -> 39x42.5
- algebra grid: algebra-numeric (worked): png600 921x1181 -> 921x1004
- algebra grid: algebra-numeric (worked): pixels 8cf8d9ec64b8727f -> b202353bba390da8
## 2026-11-14: Add the constructions and plans-and-elevations editor galleries (new outputs only)

- constructions: construction-perpendicular-bisector: added
- constructions: construction-perpendicular-bisector (worked): added
- constructions: construction-angle-bisector: added
- constructions: construction-angle-bisector (worked): added
- constructions: construction-perpendicular-from-point: added
- constructions: construction-perpendicular-from-point (worked): added
- constructions: construction-perpendicular-at-point: added
- constructions: construction-perpendicular-at-point (worked): added
- constructions: construction-locus-segment: added
- constructions: construction-locus-segment (worked): added
- constructions: construction-map-equidistant: added
- constructions: construction-map-equidistant (worked): added
- constructions: construction-bearings-port: added
- constructions: construction-bearings-port (worked): added
- constructions: construction-loci-garden: added
- constructions: construction-loci-garden (worked): added
- plans and elevations: elevations-draw-views: added
- plans and elevations: elevations-draw-views (worked): added
- plans and elevations: elevations-draw-solid: added
- plans and elevations: elevations-draw-solid (worked): added
- plans and elevations: elevations-steps: added
- plans and elevations: elevations-steps (worked): added
- plans and elevations: elevations-scale-2cm: added
- plans and elevations: elevations-scale-2cm (worked): added

## 2026-11-14: U111 ratio tables: fraction parts and operation labels raised to the 10 pt house minimum

- ratio table: ratio-1MA1_NOV_2017_3F_Q12: svg 60188f718366b7a4 -> 16f9d94398285bd1
- ratio table: ratio-1MA1_NOV_2017_3F_Q12: mm 60.17x43 -> 60.51x43
- ratio table: ratio-1MA1_NOV_2017_3F_Q12: png600 1421x1016 -> 1429x1016
- ratio table: ratio-1MA1_NOV_2017_3F_Q12: pixels f16678f297bf3b3f -> 5463f206cc98c6af
- ratio table: ratio-1MA1_NOV_2017_3F_Q12 (worked): svg 38cf7acd1b36509e -> b509105543e20714
- ratio table: ratio-1MA1_NOV_2017_3F_Q12 (worked): mm 60.17x43 -> 60.51x43
- ratio table: ratio-1MA1_NOV_2017_3F_Q12 (worked): png600 1421x1016 -> 1429x1016
- ratio table: ratio-1MA1_NOV_2017_3F_Q12 (worked): pixels 34d4cc8511985507 -> f035e8520288f6be
- ratio table: ratio-1MA1_NOV_2021_1F_Q17: svg 867c06610a133d5f -> d91b53ebcb0ac0e5
- ratio table: ratio-1MA1_NOV_2021_1F_Q17: mm 86.26x33 -> 86.68x33
- ratio table: ratio-1MA1_NOV_2021_1F_Q17: png600 2038x780 -> 2048x780
- ratio table: ratio-1MA1_NOV_2021_1F_Q17: pixels 4cf7986ccd5bde1f -> f189336aef937301
- ratio table: ratio-1MA1_NOV_2021_1F_Q17 (worked): svg 790c5d268e24a6fc -> 3a1c357b97781231
- ratio table: ratio-1MA1_NOV_2021_1F_Q17 (worked): mm 86.26x33 -> 86.68x33
- ratio table: ratio-1MA1_NOV_2021_1F_Q17 (worked): png600 2038x780 -> 2048x780
- ratio table: ratio-1MA1_NOV_2021_1F_Q17 (worked): pixels 4bf474aabe25a1b9 -> 91fa1f673fc2a5be
- ratio table: ratio-fraction: svg 0a6b2545d5f9f533 -> d1ad753a6d7d2117
- ratio table: ratio-fraction: mm 55.15x33 -> 55.29x33
- ratio table: ratio-fraction: png600 1303x780 -> 1306x780
- ratio table: ratio-fraction: pixels 82aa8f321b001059 -> 52a0983a18eba1eb
- ratio table: ratio-fraction (worked): svg 0a6b2545d5f9f533 -> d1ad753a6d7d2117
- ratio table: ratio-fraction (worked): mm 55.15x33 -> 55.29x33
- ratio table: ratio-fraction (worked): png600 1303x780 -> 1306x780
- ratio table: ratio-fraction (worked): pixels 82aa8f321b001059 -> 52a0983a18eba1eb
- ratio table: ratio-worked: svg 2a5440ac897f0648 -> 76641536d2fa3795
- ratio table: ratio-worked: mm 55.15x33 -> 55.29x33
- ratio table: ratio-worked: png600 1303x780 -> 1306x780
- ratio table: ratio-worked: pixels 2dadb68f4b1fe51e -> b1acdfc11b64232f
- ratio table: ratio-worked (worked): svg 2a5440ac897f0648 -> 76641536d2fa3795
- ratio table: ratio-worked (worked): mm 55.15x33 -> 55.29x33
- ratio table: ratio-worked (worked): png600 1303x780 -> 1306x780
- ratio table: ratio-worked (worked): pixels 2dadb68f4b1fe51e -> b1acdfc11b64232f

## 2026-11-14: Cuboids schema 1 removed (no backwards compatibility, Tim 14 Nov): the gallery's cuboid examples now save as schema 2. Saved JSON only; SVG, size and pixels unchanged.

- cuboids: cuboid-1MA1_JUN_2017_3F_Q12: json a6055531febbdf33 -> 5bbeda4788134900
- cuboids: cuboid-1MA1_JUN_2017_3F_Q12 (worked): json 9adf0d0791ea611d -> 8cdfcc61cb1196ad
- cuboids: cuboid-1MA1_MOCK_SET_06_3F_Q15: json 69ffde8c0d2d55b2 -> 172edcba5efc4745
- cuboids: cuboid-1MA1_MOCK_SET_06_3F_Q15 (worked): json 37910f61a8662537 -> 82bf054da26270d4
- cuboids: cuboid-1MA1_MOCK_SET_08_3F_Q13: json 193a25c29eb9c312 -> 8fecb599b6552b50
- cuboids: cuboid-1MA1_MOCK_SET_08_3F_Q13 (worked): json 4344d820e4445022 -> a1359bbfd5aecc2a
- cuboids: cuboid-1MA1_NOV_2018_3H_Q8: json 20e7866e646b7986 -> e6d8863b68ba402f
- cuboids: cuboid-1MA1_NOV_2018_3H_Q8 (worked): json d40b25967cb8e84d -> 525c78c5a56f3ab1
- cuboids: cuboid-1MA1_NOV_2019_2H_Q9: json 128626911144ca1c -> a2c104bcc0c22969
- cuboids: cuboid-1MA1_NOV_2019_2H_Q9 (worked): json 93bbf86d92bef698 -> 3633539d1c61bec1
- cuboids: cuboid-1MA1_NOV_2020_2F_Q11: json 55717b7008ca07c2 -> 835b5cea7322b827
- cuboids: cuboid-1MA1_NOV_2020_2F_Q11 (worked): json 44a19ac8608b5784 -> 68c026b98afd93f6
- cuboids: cuboid-layers-1: json 19346991d2e59c73 -> c6b3800755710b24
- cuboids: cuboid-layers-1 (worked): json aa3104ab978906d3 -> fdb483d8432b27fc
- cuboids: cuboid-layers-2: json ee56c87e747b4c35 -> 8b81c32eff533bc2
- cuboids: cuboid-layers-2 (worked): json ee043095db70c6f3 -> 721cefa2fe2b79bf
- cuboids: cuboid-layers-3: json 36482b30868b091d -> a750c79ee4c136d3
- cuboids: cuboid-layers-3 (worked): json e0288fa7d42ce6e2 -> 81e8162ec17e1bea
- cuboids: cuboid-missing-height: json cbf28198701d6592 -> 9ac2d096435ae454
- cuboids: cuboid-missing-height (worked): json adadcd0214671c7c -> 597993e021c91285

## 2026-11-14: Triangle schema 1 removed (no backwards compatibility): every triangle file is schema 2 / triangle-2; artwork unchanged, only saved JSON version fields differ.

- triangles: triangle-base-height: json f8b0e3121b565ada -> 1e5b05de2d412810
- triangles: triangle-base-height (worked): json 4f7833ceeef29e23 -> 6fa56e5e7948d1d7
- triangles: triangle-bisector: json 284ab73126f0a2c5 -> 34ce82fbabf5852e
- triangles: triangle-bisector (worked): json 284ab73126f0a2c5 -> 34ce82fbabf5852e
- triangles: triangle-cosine-acute: json e1ea50125684988e -> 2d827f969b4bfcfb
- triangles: triangle-cosine-acute (worked): json 94a5c0fe2c8a791f -> f103a81ae566947d
- triangles: triangle-cosine-obtuse: json 3690739189fb5ee8 -> 380d7218941ea6e5
- triangles: triangle-cosine-obtuse (worked): json d3b9d87745e723b7 -> 0c4fe839bca1efa6
- triangles: triangle-deliberate-error: json 0225cee28ded60bf -> faed0a79a1bebb28
- triangles: triangle-deliberate-error (worked): json 0225cee28ded60bf -> faed0a79a1bebb28
- triangles: triangle-external-height: json b84761e0becafae2 -> cb63c50b2dd29dae
- triangles: triangle-external-height (worked): json b84761e0becafae2 -> cb63c50b2dd29dae
- triangles: triangle-fractions: json 5ffd42ae2494e60a -> 4c712865079bd6bb
- triangles: triangle-fractions (worked): json 91fa8170c2505499 -> 681fb555a18652e1
- triangles: triangle-inverse-area: json 5b4d473a032a9eb2 -> 15e3b496d525422c
- triangles: triangle-inverse-area (worked): json 3bcbc0e3d35a5517 -> 095047e2a2394b09
- triangles: triangle-joined-rules: json 0e4da79fb0e46d24 -> d77b656b11d7cb3b
- triangles: triangle-joined-rules (worked): json 9ace52eb9c67e398 -> c7bc7e676f6ec527
- triangles: triangle-missing-side: json a3499072d574f508 -> f89de5a0fc0f7591
- triangles: triangle-missing-side (worked): json c7c3cba19daad58e -> c5e37b49423e426c
- triangles: triangle-pythagoras-error: json 7b712500bad7b1d4 -> 053e22926f6505f9
- triangles: triangle-pythagoras-error (worked): json ac0ee8b8acb8cfed -> 62c34c4027bfdee1
- triangles: triangle-right-trig: json 02a0420a8d3b2ee2 -> 300051273b64c38a
- triangles: triangle-right-trig (worked): json f59ec4c6309ba540 -> e4b785b101f7d8a5
- triangles: triangle-sine-angle: json e4f8dcc112ae6b6a -> a1b0bc9f10b5b6bf
- triangles: triangle-sine-angle (worked): json 5c80a68c49601f93 -> b24a2c4a1b01ee7a
- triangles: triangle-sine-side: json d530efbb15f98dab -> 37ceaae78ac797ea
- triangles: triangle-sine-side (worked): json d3fca6ef29f9c8a7 -> 349d92930e7a9286
- triangles: triangle-ssa: json d90aa08547abd19d -> 090c06f8a3053640
- triangles: triangle-ssa (worked): json d90aa08547abd19d -> 090c06f8a3053640

## 2026-11-14: Ratio-table schema 1 removed (no backwards compatibility): every ratio table is schema 2 / ratio-2; artwork unchanged, only saved JSON version fields differ.

- ratio table: ratio-1MA1_NOV_2017_3F_Q12: json d6c85dd42a56129b -> be402050fe6fbd84
- ratio table: ratio-1MA1_NOV_2017_3F_Q12 (worked): json 3e8113e21671e1bb -> 2833b2975c022512
- ratio table: ratio-fraction: json d3858173690d4d59 -> 534293c99defe67c
- ratio table: ratio-fraction (worked): json d3858173690d4d59 -> 534293c99defe67c
- ratio table: ratio-simple: json 3560c4e3f60144d3 -> dbd0b8e1c472f7ed
- ratio table: ratio-simple (worked): json 3560c4e3f60144d3 -> dbd0b8e1c472f7ed
- ratio table: ratio-worked: json e895ae5f535ef595 -> 501b6d028824888b
- ratio table: ratio-worked (worked): json e895ae5f535ef595 -> 501b6d028824888b

## 2026-11-14: Venn schema 1 removed (no backwards compatibility): examples saved as schema 2; artwork bytes unchanged, only the editable JSON hash moves

- venn: venn-2017: json d8cc264daf26ecb9 -> 4335173964a154f6
- venn: venn-2017 (worked): json 4768bed58a3eaa75 -> 0c647330c5d76cdd
- venn: venn-2018: json 2ede9098b574e600 -> ae67cf8ce155083f
- venn: venn-2018 (worked): json 6aff256ae3368fd0 -> 4f54c797377528e3
- venn: venn-2019: json aefeaf07c3898c9c -> 0da63ac7b83073b3
- venn: venn-2019 (worked): json eb5590ce3a15504a -> a99b404bafe17122
- venn: venn-algebra: json 8afc0f42fafaf13d -> a8817cd6c5575c2f
- venn: venn-algebra (worked): json 8afc0f42fafaf13d -> a8817cd6c5575c2f
- venn: venn-films: json c3d88d3d988240dd -> 9dcff321cc6b230f
- venn: venn-films (worked): json c3d88d3d988240dd -> 9dcff321cc6b230f
- venn: venn-languages: json 4657efc4599f3ea2 -> c2881893f5b7addd
- venn: venn-languages (worked): json 55559d57a9c16e4e -> b9088bbb766cd463
- venn: venn-shading: json 5fa1e9ce8a83057a -> e746bd34238ec502
- venn: venn-shading (worked): json 5fa1e9ce8a83057a -> e746bd34238ec502

## 2026-11-14: Bar models are v3 only (Tim 14 Nov): past-paper examples now use the v3 handwriting layout

- bar model: bar-BM01: json 7b280091b4615306 -> 2bf961cd20c72457
- bar model: bar-BM01: svg f8e747b98445d36d -> 93842b57ddad1688
- bar model: bar-BM01: mm 118x55.05 -> 119.4x38.68
- bar model: bar-BM01: png600 2787x1300 -> 2820x914
- bar model: bar-BM01: pixels 5defa72e983117c4 -> 1b2cf433f86cc3ea
- bar model: bar-BM01 (worked): json 55d2ddb7619a5385 -> d2435ecfe6c3f232
- bar model: bar-BM01 (worked): svg cc9f1b35241fa70e -> 2faa07a62c9fce6c
- bar model: bar-BM01 (worked): mm 118x55.05 -> 119.4x43.76
- bar model: bar-BM01 (worked): png600 2787x1300 -> 2820x1034
- bar model: bar-BM01 (worked): pixels 43e55d451c102b3c -> 86d9e693c54397c1
- bar model: bar-BM02: json d07a386391a51e2f -> a2583c9d44802f65
- bar model: bar-BM02: svg 7e4443d066d6c8ff -> 16c8710f3a36363c
- bar model: bar-BM02: mm 118x55.05 -> 119.4x38.68
- bar model: bar-BM02: png600 2787x1300 -> 2820x914
- bar model: bar-BM02: pixels d7cf5f39242aeb17 -> 1639a3bffa5302f1
- bar model: bar-BM02 (worked): json 55d2ddb7619a5385 -> d2435ecfe6c3f232
- bar model: bar-BM02 (worked): svg cc9f1b35241fa70e -> 2faa07a62c9fce6c
- bar model: bar-BM02 (worked): mm 118x55.05 -> 119.4x43.76
- bar model: bar-BM02 (worked): png600 2787x1300 -> 2820x1034
- bar model: bar-BM02 (worked): pixels 43e55d451c102b3c -> 86d9e693c54397c1
- bar model: bar-BM03: json a99e00ef1679beec -> d20c637b7b8e1687
- bar model: bar-BM03: svg 974ad2975254ff36 -> 10a85c3b38973104
- bar model: bar-BM03: mm 88x73.05 -> 89.4x58.98
- bar model: bar-BM03: png600 2079x1726 -> 2112x1393
- bar model: bar-BM03: pixels c035a16f646fda84 -> 24266b162d5abae9
- bar model: bar-BM03 (worked): json a8696f8ef8540460 -> 810216393bf42eb7
- bar model: bar-BM03 (worked): svg 8175d7d4540065dc -> fb40d0de242bd3fd
- bar model: bar-BM03 (worked): mm 88x73.05 -> 89.4x69.14
- bar model: bar-BM03 (worked): png600 2079x1726 -> 2112x1633
- bar model: bar-BM03 (worked): pixels 76ec8ecc8a66dc56 -> c7b37d65b2338508
- bar model: bar-BM04: json cccfa3fa5d792aae -> c275d6e01180516e
- bar model: bar-BM04: svg 286c405bfa41fa87 -> 3257c6916af476ee
- bar model: bar-BM04: mm 128x67.4 -> 129.4x38.68
- bar model: bar-BM04: png600 3024x1592 -> 3057x914
- bar model: bar-BM04: pixels 0c43787795ec7f3f -> 76a2138f2e9f03d0
- bar model: bar-BM04 (worked): json d6d5624de2ecf260 -> f6f015bc5eefca36
- bar model: bar-BM04 (worked): svg b9ae2c53a80b16a3 -> ecec0157316c6324
- bar model: bar-BM04 (worked): mm 128x67.4 -> 129.4x43.76
- bar model: bar-BM04 (worked): png600 3024x1592 -> 3057x1034
- bar model: bar-BM04 (worked): pixels e1d084e7d2aeef0f -> 440086d403f49d08
- bar model: bar-BM05: json ae9f6f75bf8810c0 -> 41a14539ca795b97
- bar model: bar-BM05: svg 8955e4a69a12f5f2 -> 29a3398ca8083691
- bar model: bar-BM05: mm 118x42.7 -> 119.4x38.68
- bar model: bar-BM05: png600 2787x1009 -> 2820x914
- bar model: bar-BM05: pixels 2e25e745dd44ecee -> 847fd49aa7560e4c
- bar model: bar-BM05 (worked): json d5ebc74a9feff78f -> f86742263c4384f6
- bar model: bar-BM05 (worked): svg b164e8c6d0d26a17 -> 7c38b3c3e5baa556
- bar model: bar-BM05 (worked): mm 118x42.7 -> 119.4x43.76
- bar model: bar-BM05 (worked): png600 2787x1009 -> 2820x1034
- bar model: bar-BM05 (worked): pixels 2c989606492e6e67 -> 736c64242c1b3fff
- bar model: bar-BM06: json c62c6a3ce613c015 -> 7db7a032a591b78b
- bar model: bar-BM06: svg b8afc2a194e90e7c -> 342d6cc61f945555
- bar model: bar-BM06: mm 88x48.35 -> 89.4x43.78
- bar model: bar-BM06: png600 2079x1142 -> 2112x1034
- bar model: bar-BM06: pixels 21708265de3840a0 -> 639e129560f927ec
- bar model: bar-BM06 (worked): json c62c6a3ce613c015 -> 7db7a032a591b78b
- bar model: bar-BM06 (worked): svg b8afc2a194e90e7c -> 342d6cc61f945555
- bar model: bar-BM06 (worked): mm 88x48.35 -> 89.4x43.78
- bar model: bar-BM06 (worked): png600 2079x1142 -> 2112x1034
- bar model: bar-BM06 (worked): pixels 21708265de3840a0 -> 639e129560f927ec
- bar model: bar-BM07: json c3af1a7b2e67f7a6 -> 57b4155b76e25484
- bar model: bar-BM07: svg e47a5eff08776396 -> be63071acf68d59e
- bar model: bar-BM07: mm 118x55.05 -> 119.4x38.68
- bar model: bar-BM07: png600 2787x1300 -> 2820x914
- bar model: bar-BM07: pixels cd02d027eebe4037 -> 917cdfbeee8b5da3
- bar model: bar-BM07 (worked): json ca28a41d3025f563 -> e8b3f153d3c1c9de
- bar model: bar-BM07 (worked): svg 1a98fcb8e366e4c7 -> b0d05e42247d56cf
- bar model: bar-BM07 (worked): mm 118x55.05 -> 119.4x47.34
- bar model: bar-BM07 (worked): png600 2787x1300 -> 2820x1118
- bar model: bar-BM07 (worked): pixels 22c40121c59da882 -> 400693f29bed0eeb
- bar model: bar-BM08: json 0b0e1c9e3fb1a643 -> ef5ed3f749c7a2a6
- bar model: bar-BM08: svg f6868cec3480f6c9 -> 4dc8e79f2d74c4ba
- bar model: bar-BM08: mm 134x37.59 -> 135.4x41.08
- bar model: bar-BM08: png600 3165x888 -> 3198x970
- bar model: bar-BM08: pixels b72e61b8a6ec3507 -> fe201032ce61617d
- bar model: bar-BM08 (worked): json b528ecb58b9c8779 -> 8f404e6d2ab09e70
- bar model: bar-BM08 (worked): svg 35e082ffff542a21 -> d2a2290b48bd7b9c
- bar model: bar-BM08 (worked): mm 134x37.59 -> 135.4x41.08
- bar model: bar-BM08 (worked): png600 3165x888 -> 3198x970
- bar model: bar-BM08 (worked): pixels 123bd35facd8847a -> 04e7d0be2436fb16
- bar model: bar-BM09: json 5e603f02ff7dc8a0 -> 04fecfa88c6d866a
- bar model: bar-BM09: svg eac95fa1c0b4cc11 -> dff32078b92164c6
- bar model: bar-BM09: mm 262x121.4 -> 263.4x107.22
- bar model: bar-BM09: png600 6189x2868 -> 6222x2533
- bar model: bar-BM09: pixels 16939b3f6ed1d138 -> 64dc79e0bf28a19d
- bar model: bar-BM09 (worked): json 5e603f02ff7dc8a0 -> 04fecfa88c6d866a
- bar model: bar-BM09 (worked): svg eac95fa1c0b4cc11 -> dff32078b92164c6
- bar model: bar-BM09 (worked): mm 262x121.4 -> 263.4x107.22
- bar model: bar-BM09 (worked): png600 6189x2868 -> 6222x2533
- bar model: bar-BM09 (worked): pixels 16939b3f6ed1d138 -> 64dc79e0bf28a19d
- bar model: bar-H07: json 0fd995f0d5727f61 -> a735a484a1f1802d
- bar model: bar-H07: svg 1af00f9f99bdd617 -> 8cfc78b75460086b
- bar model: bar-H07: mm 158x67.4 -> 159.4x38.68
- bar model: bar-H07: png600 3732x1592 -> 3765x914
- bar model: bar-H07: pixels 221f2210824a6f67 -> b26f4e7af83347ba
- bar model: bar-H07 (worked): json 50654b1297fed892 -> 25ea9cb5d03f0992
- bar model: bar-H07 (worked): svg baccb628968dcd3e -> bdb915e77d9ad777
- bar model: bar-H07 (worked): mm 158x67.4 -> 159.4x43.76
- bar model: bar-H07 (worked): png600 3732x1592 -> 3765x1034
- bar model: bar-H07 (worked): pixels 4b8956838ac24ba7 -> 24aa960b77768b5d
- bar model: bar-H18: json c410069ca8f4b84d -> 9ce516e5030f0501
- bar model: bar-H18: svg e47a5eff08776396 -> be63071acf68d59e
- bar model: bar-H18: mm 118x55.05 -> 119.4x38.68
- bar model: bar-H18: png600 2787x1300 -> 2820x914
- bar model: bar-H18: pixels cd02d027eebe4037 -> 917cdfbeee8b5da3
- bar model: bar-H18 (worked): json 54ee35a600babe1e -> c294fe2953ed40ef
- bar model: bar-H18 (worked): svg 1a98fcb8e366e4c7 -> b0d05e42247d56cf
- bar model: bar-H18 (worked): mm 118x55.05 -> 119.4x47.34
- bar model: bar-H18 (worked): png600 2787x1300 -> 2820x1118
- bar model: bar-H18 (worked): pixels 22c40121c59da882 -> 400693f29bed0eeb
- bar model: bar-source-sharing: json e1fc3abf9793e38c -> 469b1ef2b9087576
- bar model: bar-source-sharing: svg 05b2d5b3327027bc -> 3790ed69a7e5e4c3
- bar model: bar-source-sharing: mm 138x69.56 -> 139.4x38.84
- bar model: bar-source-sharing: png600 3260x1643 -> 3293x917
- bar model: bar-source-sharing: pixels 041b79680fad294d -> 466edad762c35d8f
- bar model: bar-source-sharing (worked): json a3b08589a03d3dac -> 521b9f377ba58d8d
- bar model: bar-source-sharing (worked): svg 4901f26fe985411d -> 88f5213e7f9ebad9
- bar model: bar-source-sharing (worked): mm 138x69.56 -> 139.4x43.92
- bar model: bar-source-sharing (worked): png600 3260x1643 -> 3293x1037
- bar model: bar-source-sharing (worked): pixels 2ab65c5c0693f6c1 -> b765ced7d4ba0427

## 2026-11-14: Pie charts added to Statistical charts: four new pie example outputs, no existing output changed

- charts: chart-pie-snacks: added
- charts: chart-pie-snacks (worked): added
- charts: chart-pie-complete: added
- charts: chart-pie-complete (worked): added

## 2026-11-14: U35: saved graph envelopes no longer carry the editor's selectedObjectId; artwork unchanged

- graph: graph-1MA1_JUN_2019_2H_Q2: json 169b037986e5a308 -> 75f5e8de89a74165
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): json ffd5a19c341f630a -> 50c48539422503db
- graph: graph-1MA1_NOV_2017_3F_Q13: json 4a79f1e8fd0bde58 -> 05534685d2e9a26e
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): json edd91e3824371975 -> d106633b195329f2
- graph: graph-1MA1_NOV_2021_1F_Q18: json 320cb0f7ac481726 -> 6b1d6f131727bc66
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): json 50094a4dd9cdab15 -> f3131ffaec134c16

## 2026-11-15: Pictograms added to Statistical charts: four new pictogram example outputs, no existing output changed

- charts: chart-pictogram-pictures: added
- charts: chart-pictogram-pictures (worked): added
- charts: chart-pictogram-cycles: added
- charts: chart-pictogram-cycles (worked): added

## 2026-11-15: Scatter graphs added to Statistical charts: four new scatter example outputs, no existing output changed

- charts: chart-scatter-judges: added
- charts: chart-scatter-judges (worked): added
- charts: chart-scatter-plot: added
- charts: chart-scatter-plot (worked): added

## 2026-11-15: New angle diagrams tool: its nine gallery examples, pupil and worked (new outputs only)

- angle diagrams: angles-straight-line: added
- angle diagrams: angles-straight-line (worked): added
- angle diagrams: angles-point: added
- angle diagrams: angles-point (worked): added
- angle diagrams: angles-vertically-opposite: added
- angle diagrams: angles-vertically-opposite (worked): added
- angle diagrams: angles-algebra-line: added
- angle diagrams: angles-algebra-line (worked): added
- angle diagrams: angles-parallel: added
- angle diagrams: angles-parallel (worked): added
- angle diagrams: angles-co-interior: added
- angle diagrams: angles-co-interior (worked): added
- angle diagrams: angles-regular-polygon: added
- angle diagrams: angles-regular-polygon (worked): added
- angle diagrams: angles-exterior-angle: added
- angle diagrams: angles-exterior-angle (worked): added
- angle diagrams: angles-polygon-sum: added
- angle diagrams: angles-polygon-sum (worked): added

## 2026-11-15: New area and perimeter tool: its ten gallery examples, pupil and worked (new outputs only)

- area and perimeter: area-l-shape: added
- area and perimeter: area-l-shape (worked): added
- area and perimeter: area-perimeter: added
- area and perimeter: area-perimeter (worked): added
- area and perimeter: area-trapezium: added
- area and perimeter: area-trapezium (worked): added
- area and perimeter: area-triangle: added
- area and perimeter: area-triangle (worked): added
- area and perimeter: area-rectangle-semicircle: added
- area and perimeter: area-rectangle-semicircle (worked): added
- area and perimeter: area-frame: added
- area and perimeter: area-frame (worked): added
- area and perimeter: area-circle: added
- area and perimeter: area-circle (worked): added
- area and perimeter: area-semicircle: added
- area and perimeter: area-semicircle (worked): added
- area and perimeter: area-sector: added
- area and perimeter: area-sector (worked): added
- area and perimeter: area-grid: added
- area and perimeter: area-grid (worked): added

## 2026-11-15: Scatter graphs: table of values and broken axes (scatter-plot example now prints its table and a broken test-mark axis; scatter-judges only gains stroke-linejoin on the axes and new saved fields, pixels unchanged)

- charts: chart-scatter-judges: json 14388e3ef03afe71 -> 0f15450b2e48c34f
- charts: chart-scatter-judges: svg f6edbb52d9fefa75 -> cf7e1a6dfe560d90
- charts: chart-scatter-judges (worked): json 09e08a8b780fbbbc -> 90a977249513ccf2
- charts: chart-scatter-judges (worked): svg e8f7639c701065b5 -> da548f3d91128bd7
- charts: chart-scatter-plot: json cd620a3b775e721c -> be9354b1adda9767
- charts: chart-scatter-plot: svg b7ee827bac63a7b8 -> 051713d9a0a42216
- charts: chart-scatter-plot: mm 134.9x101.4 -> 165.4x137.3
- charts: chart-scatter-plot: png600 3187x2395 -> 3907x3243
- charts: chart-scatter-plot: pixels c5b9e046fca68e2b -> 385320d90c5cb0f7
- charts: chart-scatter-plot (worked): json 9fe27b663b9830c8 -> ef2b82f371a9122b
- charts: chart-scatter-plot (worked): svg f8f6d3baa56cc905 -> c54aa779f2a81798
- charts: chart-scatter-plot (worked): mm 134.9x101.4 -> 165.4x137.3
- charts: chart-scatter-plot (worked): png600 3187x2395 -> 3907x3243
- charts: chart-scatter-plot (worked): pixels e85f0c821daeeb73 -> 12683f5f6b01c105

## 2026-11-15: Exam parity: Edexcel axis and grid line weights in the Graph tool and the value graph

- graph: graph-1MA1_JUN_2019_2H_Q2: svg 57e383be780c3676 -> bb6a24aebb1bd375
- graph: graph-1MA1_JUN_2019_2H_Q2: pixels 8f04b786f07e2f75 -> b00f5703b13463c2
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): svg b18cf14f655d949d -> aae596df8fd18b82
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): pixels dc83af7d19c429cd -> 2d102c4272954f09
- graph: graph-1MA1_NOV_2017_3F_Q13: svg b302fb81856bd9c3 -> 92c8b17e6313594f
- graph: graph-1MA1_NOV_2017_3F_Q13: pixels b1e3fd71cbaea7be -> 6b7b0a1fb0d5953e
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): svg 0b621984c8518128 -> a7ed04b26376c025
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): pixels ed8ac3c567240f31 -> 04b028771a7be3ae
- graph: graph-1MA1_NOV_2021_1F_Q18: svg 48df159e1eaa672b -> 35614de6117042cb
- graph: graph-1MA1_NOV_2021_1F_Q18: pixels 5a2e2773015f1b66 -> ac8d35ca01ff53c9
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): svg d7c6def019a98198 -> 0e8cdcd13edcf781
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): pixels 68ad6c047e5303ba -> 4ad9169e8a370b33
- plotting quadratics: quadratic-1MA1_JUN_2018_2H_Q5: svg 513612a887963c61 -> 91887f76e7e55555
- plotting quadratics: quadratic-1MA1_JUN_2018_2H_Q5: pixels 5d361414d6270d49 -> 6d05475760d671f1
- plotting quadratics: quadratic-1MA1_JUN_2018_2H_Q5 (worked): svg 9f64c19b4b6b4ed6 -> 40bbefca8a685f34
- plotting quadratics: quadratic-1MA1_JUN_2018_2H_Q5 (worked): pixels 02a0239df428b47f -> bbc81336503f25ad
- plotting quadratics: quadratic-1MA1_MOCK_SET_08_1H_Q13: svg b48362984ef02bdb -> 0bca156862e9d770
- plotting quadratics: quadratic-1MA1_MOCK_SET_08_1H_Q13: pixels ef8d6afe91b6f317 -> 64f6881dae2c03aa
- plotting quadratics: quadratic-1MA1_MOCK_SET_08_1H_Q13 (worked): svg d3d154a3f12ee20b -> 00a5a28da98605c8
- plotting quadratics: quadratic-1MA1_MOCK_SET_08_1H_Q13 (worked): pixels 2908e00a981c8195 -> e0a5e6f55fef3439
- plotting quadratics: quadratic-1MA1_NOV_2017_1H_Q7: svg 9c18032360178a13 -> 875f26c54b7d579b
- plotting quadratics: quadratic-1MA1_NOV_2017_1H_Q7: pixels 1ba8996705ef9ba7 -> ffdcf2785d4a8d7e
- plotting quadratics: quadratic-1MA1_NOV_2017_1H_Q7 (worked): svg 41b426341c083e2b -> 9d1d78f4c8d9d14a
- plotting quadratics: quadratic-1MA1_NOV_2017_1H_Q7 (worked): pixels eb87a77a2d9db346 -> 2bbb31102eea1b6a
- plotting quadratics: quadratic-1MA1_NOV_2018_3H_Q3: svg 4aabbaa2c771ddbd -> 538e9b8d3374e087
- plotting quadratics: quadratic-1MA1_NOV_2018_3H_Q3: pixels 68aa81c36f06a9f4 -> ba1f802676728e5e
- plotting quadratics: quadratic-1MA1_NOV_2018_3H_Q3 (worked): svg 26f0c0537442b62a -> 112ebb5febb48cb3
- plotting quadratics: quadratic-1MA1_NOV_2018_3H_Q3 (worked): pixels fc75288b96314112 -> 146290897cb3d5db
- plotting quadratics: quadratic-1MA1_NOV_2021_2H_Q4: svg 5a99cd13ebb46526 -> 83e65bf042eb02aa
- plotting quadratics: quadratic-1MA1_NOV_2021_2H_Q4: pixels dc2e101a84af5008 -> 524185922ac40e4d
- plotting quadratics: quadratic-1MA1_NOV_2021_2H_Q4 (worked): svg 7ef868d8f57d3b35 -> 834eacff16764842
- plotting quadratics: quadratic-1MA1_NOV_2021_2H_Q4 (worked): pixels b337318eec3ffb34 -> 263df6b79cfb3f3a
- plotting quadratics: quadratic-fractions: svg cf36101557f9172e -> 9dc00e4a104bf8e5
- plotting quadratics: quadratic-fractions: pixels 552d38ee876f26eb -> fc1728774a47f6f9
- plotting quadratics: quadratic-fractions (worked): svg 27d8dde9e4449e9c -> ca50c7501a6b5fad
- plotting quadratics: quadratic-fractions (worked): pixels 318a7273a4a13565 -> 84d999b102f7811d

## 2026-11-15: Exam parity: graphs print an italic O at the origin by default, as Edexcel papers do

- graph: graph-1MA1_JUN_2019_2H_Q2: svg bb6a24aebb1bd375 -> db54a06e0ac7dcf8
- graph: graph-1MA1_JUN_2019_2H_Q2: pixels b00f5703b13463c2 -> 2b18446b7ec3ebef
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): svg aae596df8fd18b82 -> 472d2466e790793c
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): pixels 2d102c4272954f09 -> 86dc7884d2f4fe9c
- graph: graph-1MA1_NOV_2017_3F_Q13: svg 92c8b17e6313594f -> 145cb8c3c0b2d30a
- graph: graph-1MA1_NOV_2017_3F_Q13: pixels 6b7b0a1fb0d5953e -> 9fb33ec5ac4fe5fb
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): svg a7ed04b26376c025 -> 871ac49825d066a6
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): pixels 04b028771a7be3ae -> 1afa69c158c6d99d
- graph: graph-1MA1_NOV_2021_1F_Q18: svg 35614de6117042cb -> 46fbf64b172c8dd9
- graph: graph-1MA1_NOV_2021_1F_Q18: pixels ac8d35ca01ff53c9 -> 3b83e69e52882db4
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): svg 0e8cdcd13edcf781 -> 6471b80a1d3e244f
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): pixels 4ad9169e8a370b33 -> 648a83f51c414026

## 2026-11-15: Angle diagrams extras: three new gallery examples (Z shape, two transversals, polygons meeting), pupil and worked (new outputs only)

- angle diagrams: angles-z-shape: added
- angle diagrams: angles-z-shape (worked): added
- angle diagrams: angles-two-transversals: added
- angle diagrams: angles-two-transversals (worked): added
- angle diagrams: angles-polygons-meeting: added
- angle diagrams: angles-polygons-meeting (worked): added

## 2026-11-15: Graph plot clip reaches half a line width past the grid, so a line on the grid edge prints at full weight (Tim, A7.11 marking, 15 Nov 2026)

- graph: graph-1MA1_JUN_2019_2H_Q2: svg db54a06e0ac7dcf8 -> 7f3517753657ba57
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): svg 472d2466e790793c -> 62cd6d84903ab4df
- graph: graph-1MA1_NOV_2017_3F_Q13: svg 145cb8c3c0b2d30a -> 35766a6554e6e54a
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): svg 871ac49825d066a6 -> 60a5ac6edc9d5f36
- graph: graph-1MA1_NOV_2021_1F_Q18: svg 46fbf64b172c8dd9 -> bad8a5f1b14c9c64
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): svg 6471b80a1d3e244f -> 2dc3563bf945df71

## 2026-11-15: Bold lines get a wider plot clip; polygon fills keep the exact plot clip (review of A7.11 edge-line fix)

- graph: graph-1MA1_JUN_2019_2H_Q2: svg 7f3517753657ba57 -> 12a0af07a17e5f4b
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): svg 62cd6d84903ab4df -> c42d256a343643d5
- graph: graph-1MA1_NOV_2017_3F_Q13: svg 35766a6554e6e54a -> 8e52bc398906fc46
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): svg 60a5ac6edc9d5f36 -> 98467927ce31fcd8
- graph: graph-1MA1_NOV_2021_1F_Q18: svg bad8a5f1b14c9c64 -> 24831fc4b21e9286
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): svg 2dc3563bf945df71 -> 1e4d146e65ced02b

## 2026-11-15: New sample space diagram family (P-3): adds goldens for its gallery examples; no existing output changed

- sample space diagrams: ss-dice-sum: added
- sample space diagrams: ss-dice-sum (worked): added
- sample space diagrams: ss-spinner-product: added
- sample space diagrams: ss-spinner-product (worked): added
- sample space diagrams: ss-coin-dice: added
- sample space diagrams: ss-coin-dice (worked): added
- sample space diagrams: ss-circle-outcomes: added
- sample space diagrams: ss-circle-outcomes (worked): added

## 2026-11-15: New factor tree family (N-5): adds goldens for its gallery examples; no existing output changed

- factor trees: ft-complete-360: added
- factor trees: ft-complete-360 (worked): added
- factor trees: ft-two-ways-84: added
- factor trees: ft-two-ways-84 (worked): added
- factor trees: ft-product-of-primes: added
- factor trees: ft-product-of-primes (worked): added
- factor trees: ft-spot-the-mistake: added
- factor trees: ft-spot-the-mistake (worked): added

## 2026-11-15: Factor trees and sample space: answers-only circles

- sample space diagrams: ss-circle-outcomes: json 6300c8fa508f4393 -> 3039054869113f6b

## 2026-11-15: Factor trees: pupil copy sized from printed numbers only

- factor trees: ft-two-ways-84: svg c601bef7d887ab91 -> df291ccdee269b3c
- factor trees: ft-two-ways-84: pixels 722a3009c5de1ff8 -> 952e895b2024773c

## 2026-11-16: Add function machines (new tool) to the output gates

- function machines: fm-find-output: added
- function machines: fm-find-output (worked): added
- function machines: fm-find-input: added
- function machines: fm-find-input (worked): added
- function machines: fm-missing-operation: added
- function machines: fm-missing-operation (worked): added
- function machines: fm-letters: added
- function machines: fm-letters (worked): added
- function machines: fm-two-machines: added
- function machines: fm-two-machines (worked): added

## 2026-11-16: Statistical charts gain histograms, frequency polygons and cumulative frequency graphs: adds goldens for the four new gallery examples; no existing output changed

- charts: chart-histogram-puzzle: added
- charts: chart-histogram-puzzle (worked): added
- charts: chart-histogram-complete: added
- charts: chart-histogram-complete (worked): added
- charts: chart-polygon-plants: added
- charts: chart-polygon-plants (worked): added
- charts: chart-cumulative-office: added
- charts: chart-cumulative-office (worked): added

## 2026-11-16: Add the nets of 3D shapes tool's gallery examples

- nets: nets-dot-opposite: added
- nets: nets-dot-opposite (worked): added
- nets: nets-opposite-letters: added
- nets: nets-opposite-letters (worked): added
- nets: nets-which-are-nets: added
- nets: nets-which-are-nets (worked): added
- nets: nets-corners-meet: added
- nets: nets-corners-meet (worked): added
- nets: nets-cuboid-lengths: added
- nets: nets-cuboid-lengths (worked): added
- nets: nets-draw-cuboid-net: added
- nets: nets-draw-cuboid-net (worked): added
- nets: nets-complete-cube-net: added
- nets: nets-complete-cube-net (worked): added
- nets: nets-name-the-shape: added
- nets: nets-name-the-shape (worked): added
## 2026-11-16: New written methods tool: column addition and subtraction, long multiplication, short and long division

- written methods: wm-column-add: added
- written methods: wm-column-add (worked): added
- written methods: wm-add-decimals: added
- written methods: wm-add-decimals (worked): added
- written methods: wm-column-subtract: added
- written methods: wm-column-subtract (worked): added
- written methods: wm-long-multiplication: added
- written methods: wm-long-multiplication (worked): added
- written methods: wm-short-division: added
- written methods: wm-short-division (worked): added
- written methods: wm-division-remainder: added
- written methods: wm-division-remainder (worked): added
- written methods: wm-long-division-decimal: added
- written methods: wm-long-division-decimal (worked): added

## 2026-11-16: Box plots become a chart kind: two source-linked examples (Jun 2017 3H Q9, Nov 2017 1H Q12), pupil and answers copies

- charts: chart-boxplot-holiday: added
- charts: chart-boxplot-holiday (worked): added
- charts: chart-boxplot-heights: added
- charts: chart-boxplot-heights (worked): added

## 2026-11-16: Stem-and-leaf diagrams become a chart kind: two source-linked examples (Nov 2017 1F Q10, Jun 2025 1F Q18), pupil and answers copies

- charts: chart-stemleaf-scores: added
- charts: chart-stemleaf-scores (worked): added
- charts: chart-stemleaf-heights: added
- charts: chart-stemleaf-heights (worked): added

## 2026-11-16: Graph tool: plotted lines and points print over the axis-number boxes (Edexcel prints lines straight through numbers), a number moves clear of a cross on its axis, and the y-axis reaches far enough for its arrowhead to clear a number on the top line. Asked for by the A3 worksheets thread for A7.05/A7.06.

- graph: graph-1MA1_JUN_2019_2H_Q2: svg 12a0af07a17e5f4b -> 98f4ff02cf86fcec
- graph: graph-1MA1_JUN_2019_2H_Q2: pixels 2b18446b7ec3ebef -> 7254c79ead91ac5d
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): svg c42d256a343643d5 -> 5aa38713aff81911
- graph: graph-1MA1_JUN_2019_2H_Q2 (worked): pixels 86dc7884d2f4fe9c -> fcc61511fbf81a23
- graph: graph-1MA1_NOV_2017_3F_Q13: svg 8e52bc398906fc46 -> 351f5a82a0d6ecc8
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): svg 98467927ce31fcd8 -> 6e09262450f078fe
- graph: graph-1MA1_NOV_2017_3F_Q13 (worked): pixels 1afa69c158c6d99d -> 856db7c1ff4ec1c5
- graph: graph-1MA1_NOV_2021_1F_Q18: svg 24831fc4b21e9286 -> a4144398a054e0ea
- graph: graph-1MA1_NOV_2021_1F_Q18: pixels 3b83e69e52882db4 -> 73f4b254153f6d45
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): svg 1e4d146e65ced02b -> 17c1b8b9cb919579
- graph: graph-1MA1_NOV_2021_1F_Q18 (worked): pixels 648a83f51c414026 -> 9fa8c511c7cdd661

## 2026-11-16: Time series graphs added to the charts tool and connector text

- charts: chart-timeseries-gas: added
- charts: chart-timeseries-gas (worked): added
- charts: chart-timeseries-quarters: added
- charts: chart-timeseries-quarters (worked): added

## 2026-11-16: Time series quarters example: the £ sign now has its real STIX width (font metrics on main), so the y-axis title Sales (£1000s) fits on one line

- charts: chart-timeseries-quarters: svg 1cda4922d06adbd5 -> 2f5284c6a0283905
- charts: chart-timeseries-quarters: mm 154.6x97.8 -> 161.8x97.8
- charts: chart-timeseries-quarters: png600 3652x2310 -> 3822x2310
- charts: chart-timeseries-quarters: pixels 0efdd88c8745ee60 -> 4a5cd5475972f817
- charts: chart-timeseries-quarters (worked): svg c8d82a838be20375 -> 7ba79046a4fe3632
- charts: chart-timeseries-quarters (worked): mm 154.6x97.8 -> 161.8x97.8
- charts: chart-timeseries-quarters (worked): png600 3652x2310 -> 3822x2310
- charts: chart-timeseries-quarters (worked): pixels 5693cdde1c4f8d23 -> 96a321a6a12978cc

## 2026-11-16: Add algebra tiles (new tool) to the output gates

- algebra tiles: at-collect-two-letters: added
- algebra tiles: at-collect-two-letters (worked): added
- algebra tiles: at-zero-pairs: added
- algebra tiles: at-zero-pairs (worked): added
- algebra tiles: at-squares-and-products: added
- algebra tiles: at-squares-and-products (worked): added
- algebra tiles: at-a2b-ab2: added
- algebra tiles: at-a2b-ab2 (worked): added
- algebra tiles: at-draw-the-tiles: added
- algebra tiles: at-draw-the-tiles (worked): added

## 2026-11-16: Add the new geometry figures family (circle theorems, similar and congruent shapes): new outputs only

- geometry figures: figures-tangent-cyclic: added
- geometry figures: figures-tangent-cyclic (worked): added
- geometry figures: figures-two-tangents: added
- geometry figures: figures-two-tangents (worked): added
- geometry figures: figures-centre-angle: added
- geometry figures: figures-centre-angle (worked): added
- geometry figures: figures-similar-right: added
- geometry figures: figures-similar-right (worked): added
- geometry figures: figures-parallel-in-triangle: added
- geometry figures: figures-parallel-in-triangle (worked): added
- geometry figures: figures-congruent-four: added
- geometry figures: figures-congruent-four (worked): added

## 2026-11-16: Add the bubble method diagram family (A3, A4.08-09, A6, A10)

- bubble method: bm-subject-one-step: added
- bubble method: bm-subject-one-step (worked): added
- bubble method: bm-subject-two-steps: added
- bubble method: bm-subject-two-steps (worked): added
- bubble method: bm-subject-formula: added
- bubble method: bm-subject-formula (worked): added
- bubble method: bm-solve-equation: added
- bubble method: bm-solve-equation (worked): added
- bubble method: bm-inequality: added
- bubble method: bm-inequality (worked): added

## 2026-11-16: New 3D solids family: six examples redrawn from Question Bank questions, one with its mark-scheme working

- 3D solids: solids-triangular-prism: added
- 3D solids: solids-triangular-prism (worked): added
- 3D solids: solids-cuboid-diagonal: added
- 3D solids: solids-cuboid-diagonal (worked): added
- 3D solids: solids-square-pyramid: added
- 3D solids: solids-square-pyramid (worked): added
- 3D solids: solids-cylinder-tank: added
- 3D solids: solids-cylinder-tank (worked): added
- 3D solids: solids-cone-hemisphere: added
- 3D solids: solids-cone-hemisphere (worked): added
- 3D solids: solids-cone-sculpture: added
- 3D solids: solids-cone-sculpture (worked): added

## 2026-11-16: Frequency polygon mistakes and a second polygon, two time series, misleading time series and hidden time labels (SP8 worksheets): four new examples. Existing grouped and time series files gain the new saved fields (json); the time series SVG text changes (round axis join), with pixels unchanged

- charts: chart-cumulative-office: json 4ec2bc817b38838a -> 42c1b12588457e54
- charts: chart-cumulative-office (worked): json a055d989a3b54742 -> b057c669587e9a9f
- charts: chart-histogram-complete: json 1f873519eae3b0a7 -> b9f43a66bbf5a79a
- charts: chart-histogram-complete (worked): json 1dbffbd4e730854f -> b8a64a050e8e7316
- charts: chart-histogram-puzzle: json 57d69dcfdaf2cd39 -> 9a6d5b2806f971d4
- charts: chart-histogram-puzzle (worked): json 286adf8570e21434 -> 59442619f7d048e3
- charts: chart-polygon-plants: json dc30bfbb53f58f11 -> 40a4d8a9be24cdea
- charts: chart-polygon-plants (worked): json 0defc3ef15b5e6b8 -> 9469cf223fadeb7c
- charts: chart-timeseries-gas: json 8698f6bba2c6934e -> 547825a53c0e06f4
- charts: chart-timeseries-gas: svg 323a3cc3aa0ce31f -> b035de1218460e3d
- charts: chart-timeseries-gas (worked): json 8698f6bba2c6934e -> 547825a53c0e06f4
- charts: chart-timeseries-gas (worked): svg 323a3cc3aa0ce31f -> b035de1218460e3d
- charts: chart-timeseries-quarters: json c75dc8e649095815 -> bfc9a3b5b1206906
- charts: chart-timeseries-quarters: svg 2f5284c6a0283905 -> 3fc3a94d4c7a13c1
- charts: chart-timeseries-quarters (worked): json 016e64bad96f4942 -> 76dd45c26a867355
- charts: chart-timeseries-quarters (worked): svg 7ba79046a4fe3632 -> 5eb06f9b866a43f8
- charts: chart-polygon-mistakes: added
- charts: chart-polygon-mistakes (worked): added
- charts: chart-polygon-compare: added
- charts: chart-polygon-compare (worked): added
- charts: chart-timeseries-two: added
- charts: chart-timeseries-two (worked): added
- charts: chart-timeseries-misleading: added
- charts: chart-timeseries-misleading (worked): added

## 2026-11-16: Grouped charts save the new tableBeside setting (false); drawings unchanged

- charts: chart-cumulative-office: json 42c1b12588457e54 -> c20f48b07df67719
- charts: chart-cumulative-office (worked): json b057c669587e9a9f -> 981b649b7fb8ebc3
- charts: chart-histogram-complete: json b9f43a66bbf5a79a -> 4758222b9f198954
- charts: chart-histogram-complete (worked): json b8a64a050e8e7316 -> 6b975935da227919
- charts: chart-histogram-puzzle: json 9a6d5b2806f971d4 -> 599b0c4146ab80ee
- charts: chart-histogram-puzzle (worked): json 59442619f7d048e3 -> 35a02df815be94f7
- charts: chart-polygon-compare: json d88f652574aef1b9 -> b879dcfd4ae97b98
- charts: chart-polygon-compare (worked): json d10a61ac3103d53e -> 72c6b474e4611239
- charts: chart-polygon-mistakes: json 091792e860f25023 -> 1cf9071dd4a2ad35
- charts: chart-polygon-mistakes (worked): json 091792e860f25023 -> 1cf9071dd4a2ad35
- charts: chart-polygon-plants: json 40a4d8a9be24cdea -> 662a9eac4fc732ae
- charts: chart-polygon-plants (worked): json 9469cf223fadeb7c -> e939f4ffdb361fc7

## 2026-11-21: Answer lines became Edexcel dotted lines (Tim, 20 Nov 2026)

- ratio table: ratio-1MA1_NOV_2017_3F_Q12: svg 16f9d94398285bd1 -> c1ada2c1845b1b0e
- ratio table: ratio-1MA1_NOV_2017_3F_Q12: pixels 5463f206cc98c6af -> 80abbc173ec044dc
- ratio table: ratio-1MA1_NOV_2021_1F_Q17: svg d91b53ebcb0ac0e5 -> 03693a177bc2de77
- ratio table: ratio-1MA1_NOV_2021_1F_Q17: pixels f189336aef937301 -> 16e4962608b4e58f
- ratio table: ratio-fraction: svg d1ad753a6d7d2117 -> 09abacd4edcac9fb
- ratio table: ratio-fraction: pixels 52a0983a18eba1eb -> b7c4b3083f4ce09b
- ratio table: ratio-fraction (worked): svg d1ad753a6d7d2117 -> 09abacd4edcac9fb
- ratio table: ratio-fraction (worked): pixels 52a0983a18eba1eb -> b7c4b3083f4ce09b
- ratio table: ratio-simple: svg e020341b730f4615 -> 4ba4be06fdc6dd27
- ratio table: ratio-simple: pixels 857d13d10142a099 -> 67e40f9d218bbaf2
- ratio table: ratio-simple (worked): svg e020341b730f4615 -> 4ba4be06fdc6dd27
- ratio table: ratio-simple (worked): pixels 857d13d10142a099 -> 67e40f9d218bbaf2

## 2026-11-23: Add the eight plain 3D solids shapes (examples first, agreed by Tim 23 Nov 2026); no existing output changed

- 3D solids: solids-plain-cuboid: added
- 3D solids: solids-plain-cuboid (worked): added
- 3D solids: solids-plain-triangular-prism: added
- 3D solids: solids-plain-triangular-prism (worked): added
- 3D solids: solids-plain-roof-prism: added
- 3D solids: solids-plain-roof-prism (worked): added
- 3D solids: solids-plain-cylinder: added
- 3D solids: solids-plain-cylinder (worked): added
- 3D solids: solids-plain-cone: added
- 3D solids: solids-plain-cone (worked): added
- 3D solids: solids-plain-square-pyramid: added
- 3D solids: solids-plain-square-pyramid (worked): added
- 3D solids: solids-plain-sphere: added
- 3D solids: solids-plain-sphere (worked): added
- 3D solids: solids-plain-hemisphere: added
- 3D solids: solids-plain-hemisphere (worked): added
