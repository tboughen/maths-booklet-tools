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
