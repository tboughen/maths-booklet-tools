#!/usr/bin/env python3
"""Adds newly cut papers to the catalogue, ready for scripts/bank/apply-recut.py to point them at their files.

Usage: python3 -I scripts/bank/add-papers.py <additions.json> [catalogue.json]

<additions.json> is written by the paper cutter for papers that are not yet in the bank:
  {"topics": [{"code", "title", "strand"}],
   "questions": [{"id", "paperId", "number", "set", "source", "tier", "calculator", "marks", "description",
                  "scaleSensitive", "equivalentId"?, "parts": [{"label", "marks", "codes", "sourceCodes",
                  "mappingStatus", "notes"}], "scheme": [{"width", "height", "sourcePage"}]}]}

Each question is added with its mark-scheme pages in the recut folder (cuts-2026-11/<id>/scheme-N.png) and
placeholder question views; apply-recut.py then sets the question files, sizes, revision and cuts from the
cut manifests. Topic counts, the scope and the publication note are recomputed for the whole catalogue.

It fails, writing nothing, if a question id is already in the catalogue, a part's marks do not add up, a code
is not a topic or a crossover link is not reciprocal.
"""
import json
import sys

FOLDER = "cuts-2026-11"


def fail(message):
    sys.exit(f"add-papers: {message}")


def main():
    additions = json.load(open(sys.argv[1]))
    catalogue_path = sys.argv[2] if len(sys.argv) > 2 else "public/bank/catalogue.json"
    catalogue = json.load(open(catalogue_path))
    questions = catalogue["questions"]
    known = {q["id"] for q in questions}
    topics = {t["code"]: t for t in catalogue["topics"]}
    for t in additions.get("topics", []):
        if t["code"] not in topics:
            topics[t["code"]] = {"availableCount": 0, "bankCount": 0, "code": t["code"], "pilotCount": 0,
                                 "strand": t["strand"], "title": t["title"]}
            catalogue["topics"].append(topics[t["code"]])

    order = max(q["order"] for q in questions) + 1
    added = []
    for a in additions["questions"]:
        qid = a["id"]
        if qid in known:
            fail(f"{qid} is already in the catalogue")
        if sum(p["marks"] for p in a["parts"]) != a["marks"]:
            fail(f"{qid} part marks do not add up to {a['marks']}")
        codes = list(dict.fromkeys(c for p in a["parts"] for c in p["codes"]))
        missing = [c for c in codes if c not in topics]
        if missing:
            fail(f"{qid} uses codes that are not topics: {missing}")
        folder = f"bank/assets/{FOLDER}/{qid}"
        label = f"Mark scheme for question {a['number']}"
        q = {
            "calculator": a["calculator"],
            "codes": codes,
            "collection": "past",
            "description": a["description"],
            "id": qid,
            "marks": a["marks"],
            "number": a["number"],
            "order": order,
            "paperId": a["paperId"],
            "parts": [{"codes": p["codes"], "label": p["label"], "mappingStatus": p["mappingStatus"], "marks": p["marks"],
                       "notes": p.get("notes", []), "sourceCodes": p["sourceCodes"]} for p in a["parts"]],
            "printPages": [],
            "printPdf": f"{folder}/print.pdf",
            "questionPdf": f"{folder}/question.pdf",
            "questionViews": [],
            "review": "reviewed",
            "revision": "",
            "scaleSensitive": a["scaleSensitive"],
            "schemePdf": f"{folder}/scheme.pdf",
            "schemeViews": [{
                "description": f"{a['source']}. {label if len(a['scheme']) == 1 else f'{label}, page {i} of {len(a['scheme'])}'}. {a['description']}",
                "height": s["height"],
                "id": f"scheme-{i}",
                "label": label if len(a["scheme"]) == 1 else f"{label}, page {i} of {len(a['scheme'])}",
                "page": i,
                "preview": f"{folder}/scheme-{i}.png",
                "repeatedContext": "",
                "sourcePages": [s["sourcePage"]],
                "width": s["width"],
            } for i, s in enumerate(a["scheme"], start=1)],
            "set": a["set"],
            "source": a["source"],
            "tier": a["tier"],
            "writingSpacePolicy": "source",
        }
        if a.get("equivalentId"):
            q["equivalentId"] = a["equivalentId"]
        if not q["schemeViews"]:
            fail(f"{qid} has no mark-scheme pages")
        questions.append(q)
        added.append(q)
        known.add(qid)
        order += 1

    by_id = {q["id"]: q for q in questions}
    for q in added:
        other = by_id.get(q.get("equivalentId", ""))
        if q.get("equivalentId"):
            if not other or other.get("equivalentId") != q["id"]:
                fail(f"{q['id']} crossover link to {q['equivalentId']} is not reciprocal")
            q["equivalentSource"] = other["source"]

    # Counts: bankCount counts every paper appearance; availableCount counts a crossover pair once.
    for t in catalogue["topics"]:
        mapped = [q for q in questions if t["code"] in q["codes"]]
        t["bankCount"] = len(mapped)
        t["availableCount"] = len({"|".join(sorted([q["id"], q["equivalentId"]])) if q.get("equivalentId") else q["id"] for q in mapped})
    papers = {q["paperId"] for q in questions}
    sets = {q["paperId"].rsplit("_", 1)[0] for q in questions}
    catalogue["scope"] = {"sets": len(sets), "papers": len(papers), "sourceQuestions": len(questions), "publishedQuestions": len(questions)}
    if catalogue.get("publication"):
        catalogue["publication"]["description"] = f"{len(questions)} reviewed questions are available."
        catalogue["publication"]["status"] = "complete"
    with open(catalogue_path, "w") as f:
        f.write(json.dumps(catalogue, ensure_ascii=False, separators=(",", ":")))
    print(f"add-papers: added {len(added)} questions from {len({q['paperId'] for q in added})} papers; {len(questions)} in all")


if __name__ == "__main__":
    main()
