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
