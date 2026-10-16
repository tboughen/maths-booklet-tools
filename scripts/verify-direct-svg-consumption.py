"""Independent vector-PDF proof from the exact SVGs reconstructed through MCP.

Uses the existing diagram-consumption test dependencies; no service dependency.
Restrictions in the collector are simulated, not actual ChatGPT acceptance.
"""
import hashlib
import json
import os
from io import BytesIO
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

if os.name == "nt":
    for directory in os.environ.get("CAIROCFFI_DLL_DIRECTORIES", "").split(os.pathsep):
        if directory:
            os.add_dll_directory(directory)
import cairosvg
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import ContentStream
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

root = Path(sys.argv[1])
proof = json.loads((root / "svg-delivery-proof.json").read_text())
assert proof["passed"] and proof["actualChatGPTAcceptance"] is False
assert proof["files"], "no original SVG delivered"
writer = PdfWriter()
counts = {"paths": 0, "images": 0}

def inspect(reader, content, resources, visited):
    resources = resources.get_object()
    for _, operator in ContentStream(content, reader).operations:
        assert operator not in (b"INLINE IMAGE", b"BI"), "raster in original vector PDF"
        if operator in (b"m", b"l", b"c", b"re"):
            counts["paths"] += 1
    for ref in resources.get("/XObject", {}).get_object().values() if "/XObject" in resources else []:
        obj = ref.get_object()
        assert obj.get("/Subtype") != "/Image", "raster image in original vector PDF"
        key = (getattr(ref, "idnum", id(obj)), getattr(ref, "generation", 0))
        if obj.get("/Subtype") == "/Form" and key not in visited:
            visited.add(key)
            inspect(reader, obj, obj.get("/Resources", resources), visited)

for entry in proof["files"]:
    name = entry["name"]
    data = (root / "direct-svg" / f"{name}.svg").read_bytes()
    assert len(data) == entry["totalBytes"]
    assert hashlib.sha256(data).hexdigest() == entry["svgSha256"]
    offset = 0
    for chunk in entry["chunks"]:
        assert offset == chunk["offsetBytes"]
        part = data[offset:offset + chunk["chunkBytes"]]
        assert hashlib.sha256(part).hexdigest() == chunk["chunkSha256"]
        offset += len(part)
        assert chunk["nextOffsetBytes"] == (offset if offset < len(data) else None)
    assert offset == len(data) and entry["matchesControl"] and entry["unchangedSource"]
    tree = ET.fromstring(data)
    assert not any(n.tag.rsplit("}", 1)[-1] in {"image", "text", "script", "foreignObject"} for n in tree.iter())
    component = PdfReader(BytesIO(cairosvg.svg2pdf(bytestring=data)))
    page = component.pages[0]
    size = entry["physicalSizeCm"]
    assert abs(float(page.mediabox.width) - size["width"] * 10 * mm) < .1 * mm
    assert abs(float(page.mediabox.height) - size["height"] * 10 * mm) < .1 * mm
    background = BytesIO()
    c = canvas.Canvas(background, pagesize=(297 * mm, 420 * mm))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(20 * mm, 397 * mm, f"Original MCP SVG: {name}")
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, 386 * mm, "Reconstructed and checksum verified; placed at native size.")
    c.line(20 * mm, 40 * mm, 120 * mm, 40 * mm)
    c.drawString(20 * mm, 35 * mm, "100 mm calibration; print at Actual size / 100%.")
    c.showPage(); c.save()
    target = writer.add_page(PdfReader(BytesIO(background.getvalue())).pages[0])
    assert float(page.mediabox.width) <= 257 * mm and float(page.mediabox.height) < 285 * mm
    target.merge_transformed_page(page, Transformation().translate(20 * mm, 360 * mm - float(page.mediabox.height)))

path = root / "direct-svg-vector-proof.pdf"
with path.open("wb") as handle:
    writer.write(handle)
saved = PdfReader(path)
for page in saved.pages:
    inspect(saved, page.get_contents(), page.get("/Resources", {}), set())
assert counts["paths"] > 20
result = {"passed": True, "pages": len(saved.pages), "nativePlacement": True,
          "recursiveVectorChecks": counts, "files": [e["name"] for e in proof["files"]],
          "actualChatGPTAcceptance": False, "physicalPrinterCheck": "not performed"}
(root / "direct-svg-vector-proof.json").write_text(json.dumps(result, indent=2))
print(json.dumps(result))
