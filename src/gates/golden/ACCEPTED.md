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

## 2026-11-14: U95 (Tim chose 'Outside, all Venns' 14 Nov): Venn set labels sit just outside their circle with no break in the outline, schema 1 and 2

- venn: venn-2017: svg 24e2ad6ab0337869 -> 6c4113b19ac5574e
- venn: venn-2017 (worked): svg 9fb35caa438372f6 -> fee58063992b3800
- venn: venn-2017 (worked): pixels e9da8ce30e7c2da1 -> 4c01926c31e67663
- venn: venn-2018: svg 4e31329620515c1a -> b040acbb0b812f9b
- venn: venn-2018: pixels 47b1aabdae565d6a -> 11b7892863068d0f
- venn: venn-2018 (worked): svg 4021069887970a8d -> 0c734e76a48c9c03
- venn: venn-2018 (worked): pixels 9e7817b6a1c67012 -> 6ce03bb5bf190f4f
- venn: venn-2019: svg 23821087a7a58328 -> afa4910dd72f511b
- venn: venn-2019: pixels 28ed287f90e599b0 -> 61b6453ebf5c25be
- venn: venn-2019 (worked): svg 8b2662830d3c5ca4 -> b77e770e9d3081a0
- venn: venn-2019 (worked): pixels 7eb9060b0cc83acd -> 68761d2af482be61
- venn: venn-algebra: svg bf23de182b1a7a92 -> e0db13ce5ccde75d
- venn: venn-algebra: pixels f597c37c81816620 -> fb5491cc9c118894
- venn: venn-algebra (worked): svg bf23de182b1a7a92 -> e0db13ce5ccde75d
- venn: venn-algebra (worked): pixels f597c37c81816620 -> fb5491cc9c118894
- venn: venn-films: svg 92ed00e560700417 -> 8d5a8a5c4fbfdeea
- venn: venn-films: pixels f4c16ce238c0395b -> 9d0f24ab62688138
- venn: venn-films (worked): svg 92ed00e560700417 -> 8d5a8a5c4fbfdeea
- venn: venn-films (worked): pixels f4c16ce238c0395b -> 9d0f24ab62688138
- venn: venn-languages: svg 5da401b77f932c06 -> 7def45e15c0d04b2
- venn: venn-languages: pixels 012dcecaded68fee -> 0060306825449b7b
- venn: venn-languages (worked): svg 6356290375513bfb -> b3f469c9db529b10
- venn: venn-languages (worked): pixels 6dbbd8f84143c3eb -> b624b919b21db4a9
- venn: venn-nested: svg eb87cdac5e7d3d86 -> aa89db0dcb32b68f
- venn: venn-nested: pixels f74393e97539d271 -> f841bd4cb5fdd318
- venn: venn-nested (worked): svg 4eab1c5179506020 -> c57a83c4487a603e
- venn: venn-nested (worked): pixels 5ab5cce368edf6fb -> 24f03672e16a1a80
- venn: venn-one-set: svg 8049feeb468bc058 -> b1718990f727617b
- venn: venn-one-set: pixels a621107fadfb33f3 -> 3637b20b4008f650
- venn: venn-one-set (worked): svg d027c23682f7140a -> ba8fc61532aad215
- venn: venn-one-set (worked): pixels 99ab0182c15911e6 -> feca6e3cabe453b1
- venn: venn-overlap-contrast: svg 598ef0d04c4488c1 -> d2e1299d36668a89
- venn: venn-overlap-contrast: pixels 0f215c9d43162a81 -> 6acc1b1bbd8b2ef4
- venn: venn-overlap-contrast (worked): svg 2b38a4859d81c266 -> 5d4c67bb40645331
- venn: venn-overlap-contrast (worked): pixels 042ec9a3a22aa381 -> ca2cdfb031715e77
- venn: venn-separate: svg 007be83db06a4883 -> c9f8fd87cadbea33
- venn: venn-separate: pixels cbeec5b820433bf1 -> 7402aaa99f537f20
- venn: venn-separate (worked): svg 4648f6e22054eab7 -> 622097d9e440f5e1
- venn: venn-separate (worked): pixels f782587b53446700 -> 775edf1be621d58c
- venn: venn-shading: svg 29c57d29b63f84a4 -> b10cb7359a9e80e7
- venn: venn-shading: pixels 5d1602d4ee8b5f2d -> a0b7c5aa2a4b0bb0
- venn: venn-shading (worked): svg 29c57d29b63f84a4 -> b10cb7359a9e80e7
- venn: venn-shading (worked): pixels 5d1602d4ee8b5f2d -> a0b7c5aa2a4b0bb0
