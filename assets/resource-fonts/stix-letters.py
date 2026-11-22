"""Make STIXTwoText-Italic-letters.ttf: the maths-letter font for Word files.

Maths letters print in STIX Two Text Italic (Tim, 22 Nov 2026: x must never look like ×). The PDF and
pages use assets/graph-fonts/STIXTwoText-Italic.otf, but Word embeds only TrueType outlines and the full
font is 380 kB, so Word files embed this copy instead: the 52 Latin letters only, converted from CFF to
TrueType curves, no layout features, with the same advance widths and names (family "STIX Two Text",
style Italic). Run from the repository root after changing the source font (needs fontTools):

    python3 assets/resource-fonts/stix-letters.py
"""

from pathlib import Path

from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont, newTable

SOURCE = Path("assets/graph-fonts/STIXTwoText-Italic.otf")
TARGET = Path("assets/resource-fonts/STIXTwoText-Italic-letters.ttf")
LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

font = TTFont(SOURCE)
options = Options()
options.name_IDs = ["*"]
options.notdef_outline = True
options.layout_features = []
subsetter = Subsetter(options)
subsetter.populate(text=LETTERS)
subsetter.subset(font)

glyphs, order = font.getGlyphSet(), font.getGlyphOrder()
outlines = {}
for name in order:
    pen = TTGlyphPen(glyphs)
    glyphs[name].draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
    outlines[name] = pen.glyph()
font["loca"] = newTable("loca")
font["glyf"] = newTable("glyf")
font["glyf"].glyphOrder = order
font["glyf"].glyphs = outlines
del font["CFF "]
maxp = font["maxp"] = newTable("maxp")
maxp.tableVersion = 0x00010000
for field in ("maxPoints", "maxContours", "maxCompositePoints", "maxCompositeContours", "maxTwilightPoints", "maxStorage",
              "maxFunctionDefs", "maxInstructionDefs", "maxStackElements", "maxSizeOfInstructions", "maxComponentElements",
              "maxComponentDepth"):
    setattr(maxp, field, 0)
maxp.maxZones = 1
maxp.numGlyphs = len(order)
font["head"].glyphDataFormat = 0
font["post"].formatType = 2.0
font["post"].extraNames = []
font["post"].mapping = {}
font.sfntVersion = "\x00\x01\x00\x00"
font.save(TARGET)
print(f"{TARGET}: {len(order)} glyphs, {TARGET.stat().st_size} bytes")
