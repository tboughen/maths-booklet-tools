"""Set the worksheet Inter subsets up for maths: no kerning on numbers, no contextual alternates.

1. Inter kerns for prose: "7." is pulled in by 0.125 em and ".1" by 0.086 em, so 7.1 reads as one blob,
   and "30°." tucks the full stop under the degree sign. This script zeroes every kerning pair in which
   either glyph is in MATHS below. Pairs between letters and ordinary punctuation keep Inter's kerning.
2. Inter's contextual alternates (calt, the subsets' only substitution feature) rewrite maths: "3x2"
   becomes a multiplication sign, "*" beside digits widens, "->" and "=>" become arrows, ":" between
   digits is raised. The script removes the substitution table, so every character prints as itself at
   exactly the advance width metrics.ts measures.

Run from the repository root after any change to the font subsets (needs fontTools and uharfbuzz):

    python3 assets/resource-fonts/maths-spacing.py

It is idempotent (a rerun leaves the files byte-for-byte unchanged), rewrites the three .ttf files in
place, and checks with HarfBuzz that every maths pair has no kerning, every other pair kept exactly the
kerning it had, and every character shapes to its own glyph at its own advance width.
"""

from pathlib import Path

import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otTables
from fontTools.ttLib.tables.otBase import ValueRecord

FILES = ["Inter-Regular.ttf", "Inter-SemiBold.ttf", "Inter-Italic.ttf"]
MATHS = "0123456789¹²³½¼¾°%+−×÷=<>≤≥≠≈±/√π∞→↑"
HERE = Path(__file__).resolve().parent


def kerning(path: Path, chars: list[str]) -> dict[str, int]:
    font = hb.Font(hb.Face(hb.Blob.from_file_path(str(path))))

    def width(s: str, kern: bool) -> int:
        buf = hb.Buffer()
        buf.add_str(s)
        buf.guess_segment_properties()
        hb.shape(font, buf, {"kern": kern, "calt": False})
        return sum(p.x_advance for p in buf.glyph_positions)

    out = {}
    for a in chars:
        for b in chars:
            d = width(a + b, True) - width(a + b, False)
            if d:
                out[(a, b)] = d
    return out


def pair_subtables(gpos):
    for lookup in gpos.LookupList.Lookup:
        for sub in lookup.SubTable:
            if lookup.LookupType == 9:
                sub = sub.ExtSubTable
            if sub.LookupType == 2:
                yield sub


def unkern(font: TTFont) -> None:
    cmap = font.getBestCmap()
    maths = {cmap[ord(c)] for c in MATHS if ord(c) in cmap}
    # Inter's contextual alternates swap in other glyphs (such as a raised plus next to capitals, or
    # an arrow for "=>"), so follow every single substitution from a maths glyph, and every ligature
    # with a maths glyph among its parts, until no new glyph turns up.
    subs = [
        s.ExtSubTable if lookup.LookupType == 7 else s
        for lookup in (font["GSUB"].table.LookupList.Lookup if "GSUB" in font else [])
        for s in lookup.SubTable
    ]
    while True:
        more = set()
        for sub in subs:
            if sub.LookupType == 1:
                more |= {out for src, out in sub.mapping.items() if src in maths}
            elif sub.LookupType == 4:
                for first, ligatures in sub.ligatures.items():
                    for lig in ligatures:
                        if maths & {first, *lig.Component}:
                            more.add(lig.LigGlyph)
        more -= maths
        if not more:
            break
        maths |= more
    for sub in pair_subtables(font["GPOS"].table):
        first = sub.Coverage.glyphs
        if sub.Format == 1:
            keep = [i for i, g in enumerate(first) if g not in maths]
            sub.Coverage.glyphs = [first[i] for i in keep]
            sub.PairSet = [sub.PairSet[i] for i in keep]
            for pairs in sub.PairSet:
                pairs.PairValueRecord = [r for r in pairs.PairValueRecord if r.SecondGlyph not in maths]
                pairs.PairValueCount = len(pairs.PairValueRecord)
            sub.PairSetCount = len(sub.PairSet)
        else:
            sub.Coverage.glyphs = [g for g in first if g not in maths]
            # Give maths glyphs on the second side a class whose values are all zero. (Class 0 is not
            # guaranteed to be zero, and leaving them unclassed would let a later subtable kern them.)
            # A rerun finds the zero class it added before and reuses it.
            classes = sub.ClassDef2.classDefs
            used = {classes[g] for g in maths if g in classes}
            if len(used) == 1 and (zero := used.pop()) and is_zero_class(sub, zero):
                pass
            else:
                zero = sub.Class2Count
                for rec in sub.Class1Record:
                    blank = otTables.Class2Record()
                    if sub.ValueFormat1:
                        blank.Value1 = ValueRecord(sub.ValueFormat1)
                    if sub.ValueFormat2:
                        blank.Value2 = ValueRecord(sub.ValueFormat2)
                    rec.Class2Record.append(blank)
                sub.Class2Count = zero + 1
            for g in maths:
                classes[g] = zero


def is_zero_class(sub, index: int) -> bool:
    values = (getattr(rec.Class2Record[index], attr, None) for rec in sub.Class1Record for attr in ("Value1", "Value2"))
    return all(v is None or not any(getattr(v, f, 0) for f in ("XPlacement", "YPlacement", "XAdvance", "YAdvance")) for v in values)

def plain(path: Path, font: TTFont, chars: list[str]) -> None:
    """Every character, alone and between digits and letters, shapes to its own glyph at its own width."""
    shaper = hb.Font(hb.Face(hb.Blob.from_file_path(str(path))))
    cmap, order, hmtx = font.getBestCmap(), font.getGlyphOrder(), font["hmtx"].metrics
    for c in chars:
        for s in (c, f"3{c}2", f"a{c}b", f"A{c}B"):
            buf = hb.Buffer()
            buf.add_str(s)
            buf.guess_segment_properties()
            hb.shape(shaper, buf, {"kern": False})
            got = [order[i.codepoint] for i in buf.glyph_infos]
            want = [cmap[ord(x)] for x in s]
            assert got == want, f"{path.name}: {s!r} shaped as {got}"
            widths = [p.x_advance for p in buf.glyph_positions]
            assert widths == [hmtx[g][0] for g in want], f"{path.name}: {s!r} widths {widths}"


def main() -> None:
    for name in FILES:
        path = HERE / name
        font = TTFont(path, recalcTimestamp=False)
        chars = sorted(chr(c) for c in font.getBestCmap() if c > 32)
        before = kerning(path, chars)
        unkern(font)
        if "GSUB" in font:
            del font["GSUB"]
        trial = path.with_suffix(".unkerned.tmp")
        font.save(trial)
        after = kerning(trial, chars)
        touches = lambda pair: any(c in MATHS for c in pair[0] + pair[1])
        leftover = {p: d for p, d in after.items() if touches(p)}
        changed = {p for p in set(before) | set(after) if not touches(p) and before.get(p) != after.get(p)}
        assert not leftover, f"{name}: maths pairs still kerned: {leftover}"
        assert not changed, f"{name}: other pairs changed: {sorted(changed)[:20]}"
        plain(trial, font, chars)
        trial.replace(path)
        removed = sum(1 for p in before if touches(p))
        print(f"{name}: removed {removed} maths kerning pairs, kept {len(after)} others; no contextual alternates")


if __name__ == "__main__":
    main()
