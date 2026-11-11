// Word layout probe: a one-page .docx of small, labelled test tables that isolate how desktop
// Word sizes table rows (cell margins, borders, the paragraph after a nested table) and draws
// nested-table borders. Open it with word-to-pdf.ps1 and measure Word's PDF against the "spec"
// in each label. Arial is used, so nothing depends on embedded fonts.
//
//   node scripts/word/probe.mjs output/word-probe/probe.docx
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { strToU8, zipSync } from "fflate";

const out = process.argv[2] ?? "output/word-probe/probe.docx";
const tw = (mm) => Math.round((mm * 1440) / 25.4);
const b8 = (mm) => Math.max(2, Math.round((mm / 0.3528) * 8));
const SIDES = ["top", "left", "bottom", "right"];

const para = (text, mm, extra = "") =>
  `<w:p><w:pPr>${extra}<w:spacing w:before="0" w:after="0" w:line="${tw(mm)}" w:lineRule="exact"/></w:pPr>${text ? `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>` : ""}</w:p>`;
const gap = (mm) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${tw(mm)}" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>`;
function cell(content, { width, borders = {}, margin, vAlign } = {}) {
  const b = SIDES.map((s) => (borders[s] ? `<w:${s} w:val="single" w:sz="${b8(borders[s])}" w:space="0" w:color="000000"/>` : `<w:${s} w:val="nil"/>`)).join("");
  const m = margin ? `<w:tcMar>${SIDES.map((s) => `<w:${s} w:w="${tw(margin[s] ?? 0)}" w:type="dxa"/>`).join("")}</w:tcMar>` : "";
  const v = vAlign ? `<w:vAlign w:val="${vAlign}"/>` : "";
  const body = content.endsWith("</w:p>") ? content : content + gap(0.36);
  return `<w:tc><w:tcPr><w:tcW w:w="${tw(width)}" w:type="dxa"/><w:tcBorders>${b}</w:tcBorders>${m}${v}</w:tcPr>${body}</w:tc>`;
}
const row = (cells, mm, rule = "atLeast") => `<w:tr><w:trPr><w:trHeight w:val="${tw(mm)}" w:hRule="${rule}"/></w:trPr>${cells.join("")}</w:tr>`;
const table = (grid, rows, indent = 0) =>
  `<w:tbl><w:tblPr><w:tblW w:w="${tw(grid.reduce((a, b) => a + b, 0))}" w:type="dxa"/><w:tblInd w:w="${tw(indent)}" w:type="dxa"/>` +
  `<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>` +
  `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
  `<w:tblGrid>${grid.map((g) => `<w:gridCol w:w="${tw(g)}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`;

const W = 100;
const box = { top: 0.45, left: 0.45, bottom: 0.45, right: 0.45 };
const thin = { top: 0.14, left: 0.14, bottom: 0.14, right: 0.14 };
const inner = (mm) => table([W - 10], [row([cell(gap(0.36), { width: W - 10 })], mm, "exact")]);
const answer = (rows) => {
  const line = { bottom: 0.3 };
  return table(
    [20, 60],
    rows.map(([mm, withText, margin]) =>
      row(
        [
          cell(withText ? para("y =", 5.43) : gap(0.36), { width: 20, vAlign: "bottom", margin: { bottom: margin } }),
          cell(withText ? para("7", 5.43) : gap(0.36), { width: 60, vAlign: "bottom", borders: withText ? line : {}, margin: { left: 2, bottom: margin } }),
        ],
        mm,
        "exact",
      ),
    ),
  );
};

const probes = [
  ["P1 atLeast 30, no margins. Spec 30.", table([W], [row([cell(para("text", 5), { width: W, borders: box })], 30)])],
  ["P2 atLeast 30, margins 3 top 3 bottom. Spec 30.", table([W], [row([cell(para("text", 5), { width: W, borders: box, margin: { top: 3, bottom: 3 } })], 30)])],
  ["P3 exact 30, margins 3 top 3 bottom. Spec 30.", table([W], [row([cell(para("text", 5), { width: W, borders: box, margin: { top: 3, bottom: 3 } })], 30, "exact")])],
  ["P4 atLeast 10; nested exact 20 then a 3 mm paragraph. Spec 23.", table([W], [row([cell(inner(20) + gap(3), { width: W, borders: box })], 10)])],
  ["P5 atLeast 10; nested exact 20 then 1.5 + 1.5 mm paragraphs. Spec 23.", table([W], [row([cell(inner(20) + gap(1.5) + gap(1.5), { width: W, borders: box })], 10)])],
  ["P6 atLeast 10; 3 mm paragraph, nested exact 20, 3 mm paragraph. Spec 26.", table([W], [row([cell(gap(3) + inner(20) + gap(3), { width: W, borders: box })], 10)])],
  [
    "P7 answer row: exact 9, bottom margin 0.9, line = bottom border 0.3. Spec: box 19, line 14 below box top.",
    table([W], [row([cell(para("top", 5) + answer([[9, true, 0.9]]) + para("end", 5), { width: W, borders: thin })], 1)]),
  ],
  [
    "P8 answer row: exact 6.9 no margin + exact 1.8 row. Spec: box 19 (18.7 if borders add nothing), line 12.05-12.2 below box top.",
    table([W], [row([cell(para("top", 5) + answer([[6.9, true, 0], [1.8, false, 0]]) + para("end", 5), { width: W, borders: thin })], 1)]),
  ],
];
// P9/P10: two bordered cards in one column cell, as on a worksheet side (column, gutter, column).
const column = (indent, width) => {
  const card = (mm) => table([width], [row([cell(para("card", 5), { width, borders: box })], mm)], indent);
  return table(
    [W, 5, W],
    [row([cell(card(15) + gap(3) + card(15), { width: W }), cell(gap(0.36), { width: 5 }), cell(card(15) + gap(3) + card(15), { width: W })], 40)],
  );
};
probes.push(["P9 two cards per column, cards exactly as wide as the column. Do both cards show all four borders?", column(0, W)]);
probes.push(["P10 the same with cards 0.3 mm narrower, indented 0.15 mm. Do both cards show all four borders?", column(0.15, W - 0.3)]);

const body = probes.map(([label, xml]) => para(label, 6) + xml + gap(6)).join("");
const sect = `<w:sectPr><w:pgSz w:w="${tw(297)}" w:h="${tw(420)}"/><w:pgMar w:top="${tw(10)}" w:right="${tw(10)}" w:bottom="${tw(10)}" w:left="${tw(10)}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const doc = `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}${sect}</w:body></w:document>`;
const styles = `${XML}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
const settings = `${XML}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const files = {
  "[Content_Types].xml": strToU8(
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>`,
  ),
  "_rels/.rels": strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`),
  "word/_rels/document.xml.rels": strToU8(
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="${REL}/settings" Target="settings.xml"/></Relationships>`,
  ),
  "word/document.xml": strToU8(doc),
  "word/styles.xml": strToU8(styles),
  "word/settings.xml": strToU8(settings),
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, zipSync(files));
console.log(`Wrote ${out}: ${probes.length} probes`);
