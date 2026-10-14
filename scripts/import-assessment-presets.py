"""Export approved HPP/MM assessment metadata; never update the source database."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sqlite3
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("src/assessment/presets-data.json"))
    args = parser.parse_args()
    workspace = args.workspace.resolve()
    sys.path.insert(0, str(workspace / "src"))
    from maths_bank.sparx_codes import resolve_codes

    manifest_path = workspace / "00 - Maths Paper Bank/Print-ready papers/Year 11 HPPs and mini mocks/build-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    bank = json.loads(Path("public/bank/catalogue.json").read_text(encoding="utf-8"))
    known = {topic["code"] for topic in bank["topics"]}
    connection = sqlite3.connect((workspace / "data/paper_bank.sqlite").as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only=ON")
    presets = []
    exceptions = []
    for entry in manifest:
        paper_id = entry["source_paper_id"]
        items, parts = [], []
        for selected in entry["questions"]:
            number = str(selected["printed_number"])
            question = connection.execute("SELECT id,max_mark FROM questions WHERE paper_id=? AND printed_number=?", (paper_id, number)).fetchone()
            assert question and question["max_mark"] == selected["max_mark"], (entry["paper"], paper_id, number, "Question marks differ")
            part_rows = connection.execute("SELECT id,label,max_mark FROM question_parts WHERE question_id=? ORDER BY order_index", (question["id"],)).fetchall()
            assert sum(part["max_mark"] for part in part_rows) == selected["max_mark"], (paper_id, number, "Part marks differ")
            question_codes = []
            for part in part_rows:
                raw = [r[0] for r in connection.execute("SELECT r.code FROM question_resources qr JOIN resources r ON r.id=qr.resource_id WHERE qr.question_part_id=? AND r.provider='Sparx' ORDER BY r.code", (part["id"],))]
                suffix = part["label"] or ""
                label = number + suffix
                codes, pending, _ = resolve_codes(paper_id, label, raw)
                codes = [code for code in codes if code in known]
                if pending or not codes:
                    exceptions.append({"preset": entry["paper"], "tier": entry["tier"], "question": label, "pending": pending, "unmapped": not codes})
                question_codes.extend(codes)
                parts.append({"label": "Q" + label, "marks": part["max_mark"], "codes": codes, "questionId": question["id"]})
            items.append({"label": "Q" + number, "marks": selected["max_mark"], "codes": list(dict.fromkeys(question_codes)), "questionId": question["id"]})
        assert sum(item["marks"] for item in items) == entry["marks"]
        tier = "H" if entry["tier"] == "Higher" else "F"
        presets.append({"id": entry["paper"] + "_" + tier, "name": entry["paper"] + " — " + entry["tier"], "tier": tier, "group": "HPPs" if entry["paper"].startswith("HPP") else "Mini mocks", "marks": entry["marks"], "sourcePaperId": paper_id, "items": items, "parts": parts})
    connection.close()
    assert len(presets) == 18
    assert next(p for p in presets if p["id"] == "MM1_H")["marks"] == 55
    output = {"schemaVersion": 1, "sourceManifestSHA256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(), "presets": presets, "exceptions": exceptions}
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(presets)} approved presets; {len(exceptions)} mapping exceptions retained; source opened read-only.")


if __name__ == "__main__":
    main()
