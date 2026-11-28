#!/usr/bin/env python3
"""Adds a year of KS2 maths tests (Standards and Testing Agency) to the catalogue as collection "ks2".

Usage: python3 -I scripts/bank/add-ks2.py <ks2-questions.json> <bank-checkout> [catalogue.json]

<ks2-questions.json> is written with the KS2 cutter and lists, for one year:
  {"folder": "ks2-2026",
   "questions": [{"id", "paperId", "number", "set", "source", "marks", "description", "sourcePage",
                  "parts": [{"label", "marks", "sta": [content domain refs], "on": [objectives],
                             "needs": [objectives], "status"}],
                  "cuts": [{"id", "kind", "label", "parts", "context", "requiresAnswerTo"}]}]}

KS2 parts are tagged with school scheme objectives (Tim's review), not Sparx topics. Each part keeps
them as `objectives` (the objective it practises) and `needsUpTo` (the most advanced lesson it needs in
each strand), with the STA content domain refs as `sourceCodes`. Its `codes` are the Sparx topics that
the bank scheme (bank-checkout/schemes/school.json) links to its `objectives`, so it is listed beside
the GCSE questions on the same topic. A part whose objective links to no catalogue topic gets no codes:
it is still found through its paper and the KS2 collection filter.

KS2 questions are non-calculator and stored as tier "F"; the site shows them as KS2. Files come from
bank-checkout/<folder>/<id>/ in the QUESTION-CUTS.md layout. Topic counts, the scope, the publication
note and the version are recomputed for the whole catalogue.

It fails, writing nothing, if an id is already in the catalogue, a file is missing, marks do not add
up, an objective is not in the scheme, or a cut does not cover the parts exactly once.
"""
import hashlib
import json
import os
import sys

import pymupdf


def fail(message):
    sys.exit(f"add-ks2: {message}")


def pages(path):
    with pymupdf.open(path) as doc:
        return [{"width": round(p.rect.width, 2), "height": round(p.rect.height, 2)} for p in doc]


def main():
    spec = json.load(open(sys.argv[1]))
    bank = sys.argv[2]
    catalogue_path = sys.argv[3] if len(sys.argv) > 3 else "public/bank/catalogue.json"
    catalogue = json.load(open(catalogue_path))
    questions = catalogue["questions"]
    known = {q["id"] for q in questions}
    topics = {t["code"] for t in catalogue["topics"]}
    scheme = json.load(open(os.path.join(bank, "schemes", "school.json")))
    objectives = {o["code"]: o for u in scheme["units"] for o in u["objectives"]}
    folder = spec["folder"]

    def asset(qid, name):
        full = os.path.join(bank, folder, qid, name)
        if not os.path.isfile(full):
            fail(f"missing bank file {folder}/{qid}/{name}")
        return f"bank/assets/{folder}/{qid}/{name}", full

    def views(qid, stem, role_label, id_prefix, sizes, source, description, source_pages):
        out = []
        for i, size in enumerate(sizes, start=1):
            preview, _ = asset(qid, f"{stem}-{i}.png")
            label = role_label if len(sizes) == 1 else f"{role_label}, page {i} of {len(sizes)}"
            out.append({"description": f"{source}. {label}. {description}", "height": size["height"], "id": f"{id_prefix}-{i}",
                        "label": label, "page": i, "preview": preview, "repeatedContext": "", "sourcePages": source_pages,
                        "width": size["width"]})
        return out

    order = max(q["order"] for q in questions) + 1
    added = []
    for a in spec["questions"]:
        qid, number, source, description = a["id"], a["number"], a["source"], a["description"]
        if qid in known:
            fail(f"{qid} is already in the catalogue")
        if sum(p["marks"] for p in a["parts"]) != a["marks"]:
            fail(f"{qid} part marks do not add up to {a['marks']}")
        parts = []
        for p in a["parts"]:
            for code in p["on"] + p["needs"]:
                if code not in objectives:
                    fail(f"{qid} part {p['label'] or number} uses {code}, which is not in the scheme")
            if not p["on"]:
                fail(f"{qid} part {p['label'] or number} has no objective")
            codes = list(dict.fromkeys(c for o in p["on"] for c in objectives[o].get("sparx", []) if c in topics))
            parts.append({"codes": codes, "label": f"{number}{p['label']}", "mappingStatus": p["status"], "marks": p["marks"],
                          "needsUpTo": p["needs"], "notes": [], "objectives": p["on"], "sourceCodes": p["sta"]})
        question_pdf, question_full = asset(qid, "question.pdf")
        print_pdf, print_full = asset(qid, "print.pdf")
        scheme_pdf, scheme_full = asset(qid, "scheme.pdf")
        page = [a["sourcePage"]]
        q = {
            "calculator": False,
            "codes": list(dict.fromkeys(c for p in parts for c in p["codes"])),
            "collection": "ks2",
            "description": description,
            "id": qid,
            "marks": a["marks"],
            "number": number,
            "order": order,
            "paperId": a["paperId"],
            "parts": parts,
            "printPages": pages(print_full),
            "printPdf": print_pdf,
            "questionPdf": question_pdf,
            "questionViews": views(qid, "question", f"Question {number}", "question", pages(question_full), source, description, page),
            "review": "reviewed",
            "revision": hashlib.sha256(open(question_full, "rb").read()).hexdigest()[:16],
            "scaleSensitive": False,
            "schemePdf": scheme_pdf,
            "schemeViews": views(qid, "scheme", f"Mark scheme for question {number}", "scheme", pages(scheme_full), source, description, []),
            "set": a["set"],
            "source": source,
            "tier": "F",
            "writingSpacePolicy": "source",
        }
        cuts = []
        labels = [p["label"] for p in parts]
        for c in a["cuts"]:
            pdf, pdf_full = asset(qid, f"{'stem' if c['kind'] == 'stem' else 'part-' + c['id']}.pdf")
            stem = "stem" if c["kind"] == "stem" else f"part-{c['id']}"
            role = f"Question {number} stem" if c["kind"] == "stem" else f"Part {c['label']}"
            cuts.append({"id": c["id"], "kind": c["kind"], "label": c["label"], "parts": [f"{number}{x}" for x in c["parts"]], "pdf": pdf,
                         "views": views(qid, stem, role, c["id"], pages(pdf_full), source, description, page),
                         "context": c["context"], "requiresAnswerTo": c["requiresAnswerTo"]})
        if cuts:
            covered = [x for c in cuts for x in c["parts"]]
            ids = {c["id"] for c in cuts}
            if sorted(covered) != sorted(labels):
                fail(f"{qid} cuts cover {sorted(covered)}, parts are {sorted(labels)}")
            if any(r == c["id"] or r not in ids for c in cuts for r in c["context"] + c["requiresAnswerTo"]):
                fail(f"{qid} has a cut link to a cut that does not exist")
            q["cuts"] = cuts
        questions.append(q)
        added.append(q)
        known.add(qid)
        order += 1

    # Counts as add-papers.py: bankCount counts every paper appearance; availableCount a crossover pair once.
    for t in catalogue["topics"]:
        mapped = [q for q in questions if t["code"] in q["codes"]]
        t["bankCount"] = len(mapped)
        t["availableCount"] = len({"|".join(sorted([q["id"], q["equivalentId"]])) if q.get("equivalentId") else q["id"] for q in mapped})
    papers = {q["paperId"] for q in questions}
    sets = {q["paperId"].rsplit("_", 1)[0] for q in questions}
    catalogue["scope"] = {"sets": len(sets), "papers": len(papers), "sourceQuestions": len(questions), "publishedQuestions": len(questions)}
    if catalogue.get("publication"):
        catalogue["publication"]["description"] = f"{len(questions)} reviewed questions are available."
    questions_json = json.dumps(questions, ensure_ascii=False, separators=(",", ":"))
    catalogue["version"] = f"{folder}-" + hashlib.sha256(questions_json.encode()).hexdigest()[:20]
    with open(catalogue_path, "w") as f:
        f.write(json.dumps(catalogue, ensure_ascii=False, separators=(",", ":")))
    print(f"add-ks2: added {len(added)} questions ({sum(len(q['parts']) for q in added)} parts) from {len({q['paperId'] for q in added})} papers; "
          f"{sum(1 for q in added for p in q['parts'] if not p['codes'])} parts have no Sparx topic; {len(questions)} in all")


if __name__ == "__main__":
    main()
