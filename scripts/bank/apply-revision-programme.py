#!/usr/bin/env python3
"""Marks the questions from papers in the Year 11 revision programme, so searches leave them out by default.

Usage: python3 -I scripts/bank/apply-revision-programme.py [revision-programme.json] [catalogue.json]

revision-programme.json lists each paper the department keeps for Year 11 (mocks, mini-mocks, half past
papers, study leave, lunchtime revision) with its use. Each question from a listed paper gets `revisionUse`
(the use, for example "Mini-mock MM1"); every other question has the field removed. Papers in the list that
are not in the bank yet are reported and pick up the mark when they are added and this is run again.
To change the programme for a new year, edit the list and run this again.
"""
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    programme_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "revision-programme.json")
    catalogue_path = sys.argv[2] if len(sys.argv) > 2 else "public/bank/catalogue.json"
    programme = json.load(open(programme_path))
    catalogue = json.load(open(catalogue_path))
    papers = programme["papers"]
    marked = 0
    for q in catalogue["questions"]:
        use = papers.get(q["paperId"])
        if use:
            q["revisionUse"] = use
            marked += 1
        else:
            q.pop("revisionUse", None)
    by_id = {q["id"]: q for q in catalogue["questions"]}
    for q in catalogue["questions"]:
        other = by_id.get(q.get("equivalentId", ""))
        if other and bool(q.get("revisionUse")) != bool(other.get("revisionUse")):
            sys.exit(f"apply-revision-programme: {q['id']} and its crossover {other['id']} must both be in the programme or both out; nothing written")
    in_bank = {q["paperId"] for q in catalogue["questions"]}
    missing = sorted(p for p in papers if p not in in_bank)
    questions_json = json.dumps(catalogue["questions"], ensure_ascii=False, separators=(",", ":"))
    prefix = catalogue["version"].rsplit("-", 1)[0]
    catalogue["version"] = f"{prefix}-{hashlib.sha256(questions_json.encode()).hexdigest()[:20]}"
    with open(catalogue_path, "w") as f:
        f.write(json.dumps(catalogue, ensure_ascii=False, separators=(",", ":")))
    print(f"apply-revision-programme: {marked} questions marked from {len(papers) - len(missing)} papers")
    if missing:
        print(f"  not in the bank yet: {', '.join(missing)}")


if __name__ == "__main__":
    main()
