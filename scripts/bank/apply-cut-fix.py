#!/usr/bin/env python3
"""Points the catalogue at re-cut whole-question files after the lost-lines fix of 17 Nov 2026.

Usage: python3 -I scripts/bank/apply-cut-fix.py <bank-checkout> <QID> [QID ...]

The first vector cut (cuts-2026-11) dropped some lines and letters: MuPDF's line-art redaction
removed whole paths that only touched the crop edge or a mask. The re-cut question.pdf of each named
question is the same size and page count as before, so only its revision changes (first 16 hex digits
of the SHA-256 of question.pdf). A worked solution registered on the old revision is removed, as
WORKED-SOLUTION-REGISTRATION.md requires: it stays hidden until it is checked against the re-cut and
registered again. Part and stem cuts keep their paths, so they need no catalogue change.

It fails, writing nothing, if a file is missing or a page size or page count changed.
"""
import hashlib
import json
import os
import sys

import pymupdf

FOLDER = "cuts-2026-11"


def fail(message):
    sys.exit(f"apply-cut-fix: {message}")


def main():
    bank, qids = sys.argv[1], sys.argv[2:]
    path = "public/bank/catalogue.json"
    catalogue = json.load(open(path, encoding="utf-8"))
    questions = {q["id"]: q for q in catalogue["questions"]}
    removed = []
    for qid in qids:
        q = questions.get(qid) or fail(f"{qid} is not in the catalogue")
        if q["questionPdf"] != f"bank/assets/{FOLDER}/{qid}/question.pdf":
            fail(f"{qid} does not use the {FOLDER} cut")
        full = os.path.join(bank, FOLDER, qid, "question.pdf")
        if not os.path.isfile(full):
            fail(f"missing {full}")
        doc = pymupdf.open(full)
        sizes = [(round(p.rect.width, 2), round(p.rect.height, 2)) for p in doc]
        if [(v["width"], v["height"]) for v in q["questionViews"]] != sizes:
            fail(f"{qid} question.pdf pages {sizes} differ from its views")
        q["revision"] = hashlib.sha256(open(full, "rb").read()).hexdigest()[:16]
        ws = q.get("workedSolution")
        if ws is not None and ws["basedOnQuestionRevision"] != q["revision"]:
            del q["workedSolution"]
            removed.append(qid)
    catalogue["version"] = "cut-fix-" + hashlib.sha256(
        json.dumps(catalogue["questions"], separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()[:20]
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(catalogue, separators=(",", ":"), ensure_ascii=False))
    print(f"{len(qids)} revisions updated; worked solutions hidden until re-registered: {', '.join(removed) or 'none'}")


if __name__ == "__main__":
    main()
