#!/usr/bin/env python3
"""Points the catalogue at the November 2026 recut of every question (bank folder cuts-2026-11).

Usage: python3 -I scripts/bank/apply-recut.py <manifest-dir> <bank-checkout> [catalogue.json]

<manifest-dir> holds one <paperId>.units.json per paper, written by the paper cutter. Each lists the
whole question, its separately served parts and its shared stem, with the files cut for each, the
context a part is shown with and the earlier parts whose answers it needs.

For each question this sets:
  - questionPdf, printPdf, schemePdf and their previews to the new folder;
  - questionViews (one per page of the whole question) and printPages from the real PDF page sizes;
  - revision to the first 16 hex digits of the SHA-256 of the new question.pdf;
  - cuts: the part and stem cuts, with labels as printed, the catalogue parts each covers, context
    and needs-answer links;
  - no worked solution: each was drawn on the old image, so it stays hidden until it is redrawn
    for the recut (Tim's decision of 15 Nov 2026, "hide until redrawn"). The files stay in the bank.

It fails, writing nothing, if any file is missing, any part label does not match the catalogue or
any link points at a cut that does not exist.
"""
import hashlib
import json
import os
import re
import sys

import pymupdf

FOLDER = "cuts-2026-11"
ROMAN = ("iv", "iii", "ii", "i")


def canon(label, number):
    """'6bi', '(b)(i)', 'b(i)' and 'bi' all become 'bi'; the bare question number becomes ''."""
    text = str(label).strip()
    num = str(number)
    if text == num:
        return ""
    if text.startswith(num) and len(text) > len(num) and not text[len(num)].isdigit():
        text = text[len(num):]
    return re.sub(r"[\s()+]", "", text).lower()


def split(c):
    """'bi' -> ('b', 'i'); 'ii' -> ('', 'ii'); 'a' -> ('a', '')."""
    for r in ROMAN:
        if c == r:
            return "", r
        if c.endswith(r) and len(c) == len(r) + 1:
            return c[0], r
    return c, ""


def printed(members):
    """The label as the paper prints it: ['b'] -> '(b)', ['bi', 'bii'] -> '(b)(i) and (ii)'."""
    pieces = [split(m) for m in members]
    out = []
    last_letter = None
    for letter, roman in pieces:
        text = ""
        if letter and letter != last_letter:
            text += f"({letter})"
        if roman:
            text += f"({roman})"
        out.append(text)
        last_letter = letter or last_letter
    return out[0] if len(out) == 1 else ", ".join(out[:-1]) + " and " + out[-1]


def sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def pages(path):
    with pymupdf.open(path) as doc:
        return [{"width": round(p.rect.width, 2), "height": round(p.rect.height, 2)} for p in doc]


def fail(message):
    sys.exit(f"apply-recut: {message}")


def main():
    manifest_dir, bank = sys.argv[1], sys.argv[2]
    catalogue_path = sys.argv[3] if len(sys.argv) > 3 else "public/bank/catalogue.json"
    catalogue = json.load(open(catalogue_path))
    questions = {q["id"]: q for q in catalogue["questions"]}
    units = {}
    for name in sorted(os.listdir(manifest_dir)):
        if name.endswith(".units.json"):
            units[name[: -len(".units.json")]] = json.load(open(os.path.join(manifest_dir, name)))

    def asset(rel):
        full = os.path.join(bank, FOLDER, rel)
        if not os.path.isfile(full):
            fail(f"missing bank file {FOLDER}/{rel}")
        return f"bank/assets/{FOLDER}/{rel}", full

    done = set()
    for paper_id, paper_units in units.items():
        by_q = {}
        for u in paper_units:
            by_q.setdefault(u["q"], []).append(u)
        for number, group in by_q.items():
            qid = f"{paper_id}_Q{number}"
            q = questions.get(qid)
            if not q:
                fail(f"{qid} is in the cut manifest but not the catalogue")
            whole = [u for u in group if u["kind"] == "question"]
            if len(whole) != 1:
                fail(f"{qid} has {len(whole)} whole-question cuts")
            whole = whole[0]
            folder = os.path.dirname(whole["pdf"])
            question_pdf, question_full = asset(f"{folder}/question.pdf")
            print_pdf, print_full = asset(f"{folder}/print.pdf")
            scheme_pdf, _ = asset(f"{folder}/scheme.pdf")
            revision = sha256(question_full)[:16]
            page_sizes = pages(question_full)
            if len(page_sizes) != len(whole["views"]):
                fail(f"{qid} question.pdf has {len(page_sizes)} pages but {len(whole['views'])} previews")

            def views(unit, role_label, id_prefix, sizes):
                out = []
                count = len(unit["views"])
                for i, (v, size) in enumerate(zip(unit["views"], sizes), start=1):
                    preview, _ = asset(v["png"])
                    label = role_label if count == 1 else f"{role_label}, page {i} of {count}"
                    out.append({
                        "description": f"{q['source']}. {label}. {q['description']}".strip(),
                        "height": size["height"],
                        "id": f"{id_prefix}-{i}",
                        "label": label,
                        "page": i,
                        "preview": preview,
                        "repeatedContext": "",
                        "sourcePages": [v["sourcePage"]],
                        "width": size["width"],
                    })
                return out

            q["questionPdf"], q["printPdf"], q["schemePdf"] = question_pdf, print_pdf, scheme_pdf
            q["questionViews"] = views(whole, f"Question {number}", "question", page_sizes)
            q["printPages"] = pages(print_full)
            for i, view in enumerate(q["schemeViews"], start=1):
                view["preview"], _ = asset(f"{folder}/scheme-{i}.png")
            old_revision = q["revision"]
            q["revision"] = revision
            ws = q.pop("workedSolution", None)
            if ws is not None and ws.get("basedOnQuestionRevision") not in (old_revision, revision):
                fail(f"{qid} worked solution was not on the current question revision")

            # Part and stem cuts.
            catalogue_parts = {canon(p["label"], number): p for p in q["parts"]}
            cuts = []
            ids = {}
            covered = []
            for u in group:
                if u["kind"] == "question":
                    continue
                if u["kind"] == "stem":
                    cut_id, label, members = "stem", "Stem", []
                else:
                    members = [canon(m, number) for m in (u["members"] or [])]
                    if not members or any(m not in catalogue_parts for m in members):
                        fail(f"{qid} part cut {u['label']} covers {u['members']}, not catalogue parts {sorted(catalogue_parts)}")
                    covered += members
                    cut_id, label = "-".join(members), printed(members)
                ids[canon(u["label"], number) if u["kind"] == "part" else "stem"] = cut_id
                pdf, pdf_full = asset(u["pdf"])
                sizes = pages(pdf_full)
                if len(sizes) != len(u["views"]):
                    fail(f"{qid} {u['pdf']} has {len(sizes)} pages but {len(u['views'])} previews")
                cuts.append({
                    "id": cut_id,
                    "kind": u["kind"],
                    "label": label,
                    "parts": [catalogue_parts[m]["label"] for m in members],
                    "pdf": pdf,
                    "views": views(u, f"Part {label}" if u["kind"] == "part" else f"Question {number} stem", f"{cut_id}", sizes),
                    "context": u["context"],
                    "requiresAnswerTo": u["requires_answer_to"],
                })
            # Resolve the links, written as printed labels, to cut ids.
            for cut in cuts:
                for key in ("context", "requiresAnswerTo"):
                    resolved = []
                    for ref in cut[key]:
                        c = "stem" if ref == "stem" else canon(ref, number)
                        target = ids.get(c) or next((cid for k, cid in ids.items() if c and k != "stem" and c in k.split("-")), None)
                        if not target or target == cut["id"]:
                            fail(f"{qid} cut {cut['id']} links to {ref}, which is not another cut of this question")
                        resolved.append(target)
                    cut[key] = list(dict.fromkeys(resolved))
                if any(r not in cut["context"] for r in cut["requiresAnswerTo"]):
                    cut["context"] = list(dict.fromkeys(cut["context"] + cut["requiresAnswerTo"]))
            if cuts:
                parts_only = [c for c in cuts if c["kind"] == "part"]
                if sorted(covered) != sorted(catalogue_parts) or len(covered) != len(set(covered)):
                    fail(f"{qid} part cuts cover {sorted(covered)}, catalogue parts are {sorted(catalogue_parts)}")
                if not parts_only:
                    fail(f"{qid} has a stem but no part cuts")
                q["cuts"] = cuts
            else:
                q.pop("cuts", None)
            done.add(qid)

    missing = sorted(set(questions) - done)
    if missing:
        fail(f"{len(missing)} catalogue questions have no cut, e.g. {missing[:3]}")
    with open(catalogue_path, "w") as f:
        f.write(json.dumps(catalogue, ensure_ascii=False, separators=(",", ":")))
    n_cuts = sum(len(q.get("cuts", [])) for q in catalogue["questions"])
    print(f"apply-recut: {len(done)} questions, {n_cuts} part and stem cuts")


if __name__ == "__main__":
    main()
