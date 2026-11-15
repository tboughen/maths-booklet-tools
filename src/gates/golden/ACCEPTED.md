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
