"""Verify actual MCP downloads, not previews; assemble a vector A3 specimen.

Run after service-dist/verify-consumption.js has collected returned files.
Dependencies belong to the consumer test environment, not the MCP service.
"""
import argparse
import json
import os
import subprocess
import sys
from io import BytesIO
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from importlib.metadata import version

# Supports the bundled Windows runtime without system-wide installation.
if os.name == "nt":
    for directory in os.environ.get("CAIROCFFI_DLL_DIRECTORIES", "").split(os.pathsep):
        if directory:
            os.add_dll_directory(directory)
import cairosvg
from PIL import Image, ImageChops
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import ContentStream
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=Path)
args = parser.parse_args()
root = args.directory
evidence = json.loads((root / "retrieval.json").read_text())
items = evidence["items"]

def check_vectors(reader):
    visited = set()
    counts = {"paths": 0, "forms": 0, "images": 0}
    def inspect(content, resources):
        if hasattr(resources, "get_object"):
            resources = resources.get_object()
        if content is not None:
            for operands, operator in ContentStream(content, reader).operations:
                assert operator not in (b"INLINE IMAGE", b"BI"), "inline raster diagram"
                if operator in (b"m", b"l", b"c", b"re"):
                    counts["paths"] += 1
        xobjects = resources.get("/XObject", {})
        if hasattr(xobjects, "get_object"):
            xobjects = xobjects.get_object()
        for ref in xobjects.values():
            obj = ref.get_object()
            assert obj.get("/Subtype") != "/Image", "raster image in vector specimen"
            identity = (getattr(ref, "idnum", id(obj)), getattr(ref, "generation", 0))
            if identity in visited:
                continue
            visited.add(identity)
            if obj.get("/Subtype") == "/Form":
                counts["forms"] += 1
                inspect(obj, obj.get("/Resources", resources))
    for page in reader.pages:
        inspect(page.get_contents(), page.get("/Resources", {}))
    assert counts["paths"] > 20, "no substantive vector artwork"
    return counts

# Prove the checker rejects raster hidden inside a Form XObject, independently
# of the converter's current tendency to flatten vector paths into page streams.
bad_pdf = BytesIO()
bad = canvas.Canvas(bad_pdf)
bad.beginForm("raster-form")
bad.drawInlineImage(Image.new("RGB", (2, 2), "black"), 0, 0, 10, 10)
bad.endForm(); bad.doForm("raster-form"); bad.save()
try:
    check_vectors(PdfReader(BytesIO(bad_pdf.getvalue())))
    raise RuntimeError("recursive vector checker accepted a nested raster")
except AssertionError as error:
    assert "raster" in str(error)

for name in items:
    svg = root / f"{name}.svg"
    tree = ET.fromstring(svg.read_bytes())
    assert not any(node.tag.rsplit("}", 1)[-1] in {"image", "script", "foreignObject", "text"} for node in tree.iter())
    assert not re.search(r'(?:href|src)="(?:https?:|data:image)', svg.read_text())
    physical = items[name]["physicalSizeCm"]
    component = root / f"{name}.component.pdf"
    cairosvg.svg2pdf(bytestring=svg.read_bytes(), write_to=str(component))
    r = PdfReader(component)
    for actual, expected in zip([r.pages[0].mediabox.width, r.pages[0].mediabox.height], [physical["width"] * 10 * mm, physical["height"] * 10 * mm]):
        assert abs(float(actual) - expected) < 0.1 * mm, (name, actual, expected)
    check_vectors(r)

# Independent visual locality check: the sole graph label moves by 40 mm.
# Use the actual SVGs, rasterised identically for measurement, never for PDF assembly.
for name in ["label-before", "label-after"]:
    cairosvg.svg2png(bytestring=(root / f"{name}.svg").read_bytes(), write_to=str(root / f"{name}.comparison.png"), scale=2)
before = Image.open(root / "label-before.comparison.png").convert("RGB")
after = Image.open(root / "label-after.comparison.png").convert("RGB")
assert before.size == after.size
diff = ImageChops.difference(before, after)
bbox = diff.getbbox()
assert bbox is not None, "label movement had no visible effect"
# The unchanged graph contains no other moving marks. Two disconnected small
# patches in the upper plot must contain all differences, 40 mm apart.
mask = diff.convert("L").point(lambda p: 255 if p > 8 else 0)
pixels = mask.load()
active_x = [x for x in range(mask.width) if any(pixels[x, y] for y in range(mask.height))]
groups = []
for x in active_x:
    if not groups or x > groups[-1][-1] + 1:
        groups.append([x])
    else:
        groups[-1].append(x)
# Outlined characters create internal gaps; split at the large gap between labels.
split = [(b - a, a, b) for a, b in zip(active_x, active_x[1:])]
gap, left_end, right_start = max(split)
assert gap > 10, "label revision changed a broad region"
left = [x for x in active_x if x <= left_end]
right = [x for x in active_x if x >= right_start]
assert abs((right[0] - left[0]) / (2 * 96 / 25.4) - 40) < 0.5, "label did not move by its mathematical scale"
assert (bbox[3] - bbox[1]) / (2 * 96 / 25.4) < 10, "unrelated vertical artwork changed"

# One A3 qualification artifact: graph/ratio pair, then two quadratic variants.
background = root / "specimen-background.pdf"
c = canvas.Canvas(str(background), pagesize=(297 * mm, 420 * mm))
titles = ["MCP diagram print qualification", "Quadratic scaffold and deliberate plotting error", "Quadratic graph-only output", "Cuboids and number-line pupil resources", "Venn pupil scaffold and explicit answer output"]
for title in titles:
    c.setFont("Helvetica-Bold", 17); c.drawString(20 * mm, 397 * mm, title)
    c.setFont("Helvetica", 10); c.drawString(20 * mm, 388 * mm, "Actual MCP downloads placed at native size. Print at Actual size / 100%.")
    c.line(20 * mm, 40 * mm, 120 * mm, 40 * mm)
    c.drawString(20 * mm, 35 * mm, "Calibration line: 100 mm")
    c.showPage()
c.save()
writer = PdfWriter()
for page in PdfReader(background).pages:
    writer.add_page(page)
placements = [(0, "graph", 20, 350), (0, "ratio", 150, 350), (1, "quadratic-combined", 20, 350), (2, "quadratic-graph", 20, 350), (3, "cuboids-revised", 20, 350), (3, "number-line-revised", 20, 230), (4, "venn-revised", 20, 350), (4, "venn-answer", 150, 350)]
for page_number, name, x_mm, top_mm in placements:
    component = PdfReader(root / f"{name}.component.pdf").pages[0]
    height = float(component.mediabox.height)
    assert x_mm * mm + float(component.mediabox.width) <= 277 * mm
    assert top_mm * mm - height > 60 * mm
    writer.pages[page_number].merge_transformed_page(component, Transformation().translate(x_mm * mm, top_mm * mm - height))
writer.add_metadata({"/Title": "MathsDock MCP vector consumption qualification"})
with (root / "a3-diagram-consumption.pdf").open("wb") as f:
    writer.write(f)
final = PdfReader(root / "a3-diagram-consumption.pdf")
assert len(final.pages) == 5
for p in final.pages:
    assert abs(float(p.mediabox.width) - 297 * mm) < 0.1 * mm
    assert abs(float(p.mediabox.height) - 420 * mm) < 0.1 * mm
counts = check_vectors(final)
shading_cases = json.loads((root / "shading.json").read_text())
shading_samples = 0
for case in shading_cases:
    native = Image.open(root / f'{case["name"]}.png').convert("RGB")
    converted = Image.open(BytesIO(cairosvg.svg2png(bytestring=(root / f'{case["name"]}.svg').read_bytes(), output_width=native.width, output_height=native.height))).convert("RGB")
    box = case["box"]
    sample_count = 0
    for iy in range(int(box["y"] + 3), int(box["y"] + box["height"] - 2), 3):
        for ix in range(int(box["x"] + 3), int(box["x"] + box["width"] - 2), 3):
            membership = 0
            safe = True
            for bit, circle in enumerate(case["circles"]):
                q = ((ix-circle["x"])/circle["rx"])**2 + ((iy-circle["y"])/circle["ry"])**2
                if abs(q-1) < .15:
                    safe = False
                if q < 1:
                    membership |= 1 << bit
            if not safe:
                continue
            expected = 216 if membership == case["mask"] else 255
            point = (round(ix / (case["physicalSizeCm"]["width"]*10) * native.width), round(iy / (case["physicalSizeCm"]["height"]*10) * native.height))
            for label, image in [("native PNG", native), ("independent SVG consumer", converted)]:
                actual = image.getpixel(point)
                assert all(abs(channel-expected) <= 2 for channel in actual), (case["name"], label, point, membership, actual, expected)
            sample_count += 1
    assert sample_count > 20, (case["name"], "insufficient shading samples")
    shading_samples += sample_count
report = {"passed": True, "converter": f"CairoSVG {version('CairoSVG')}", "pages": 5, "a3Mm": [297, 420], "nativePlacement": True, "recursiveVectorChecks": counts, "nestedRasterRejected": True, "shadingCases": len(shading_cases), "shadingSamples": shading_samples, "qualifiedComponents": list(items), "labelRevisionLocality": list(bbox), "physicalPrinterCheck": "not performed"}
(root / "vector-proof.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report))
if (root / "svg-delivery-proof.json").exists():
    subprocess.run([sys.executable, str(Path(__file__).with_name("verify-direct-svg-consumption.py")), str(root)], check=True)
