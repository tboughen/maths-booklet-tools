"""Import Pearson marks without changing questions or Sparx mappings.

Run with the bundled Python runtime and openpyxl. Pass Higher and Foundation
workbooks, then optionally --catalogue and --output when rebuilding the bank.
"""
import argparse
import collections
import hashlib
import json
import math
import re
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]

def series_id(value):
    if hasattr(value, 'strftime'):
        return value.strftime('%b_%Y').upper()
    words = str(value).strip().split()
    return f'{words[0][:3]}_{words[1]}'.upper()

def fit_curve(points):
    # Weighted isotonic regression: accessibility never rises with position.
    bands = [[] for _ in range(10)]
    for position, score in points:
        bands[min(9, int(position * 10))].append(score)
    blocks = []
    for i, values in enumerate(bands):
        if not values:
            continue
        blocks.append([i, i, sum(values), len(values)])
        while len(blocks) > 1 and blocks[-2][2]/blocks[-2][3] < blocks[-1][2]/blocks[-1][3]:
            b = blocks.pop(); a = blocks.pop()
            blocks.append([a[0], b[1], a[2]+b[2], a[3]+b[3]])
    result = []
    for lo, hi, total, count in blocks:
        for i in range(lo, hi+1):
            result.append({'position': (i+.5)/10, 'percentage': total/count})
    return result

def read_grid(path, tier):
    sheet_name = 'Higher Questions' if tier == 'H' else 'Foundation Questions'
    sheet = openpyxl.load_workbook(path, read_only=True, data_only=True)[sheet_name]
    mean_col, marks_col = (11, 12) if tier == 'H' else (12, 13)
    groups = collections.defaultdict(list)
    lengths = {}
    for row_number, row in enumerate(sheet.iter_rows(min_row=4, values_only=True), 4):
        if row[1] is None or not isinstance(row[5], str):
            continue
        match = re.fullmatch(r'Q0*(\d+)([a-z]*|[ivx]*)', row[5].strip(), re.I)
        if not match:
            continue
        paper = f'1MA1_{series_id(row[1])}_{str(row[2]).strip().upper()}'
        number = int(match[1]); key = f'{paper}/{number}'
        lengths[paper] = max(number, lengths.get(paper, 0))
        groups[key].append({'label': row[5].strip(), 'mean': row[mean_col], 'marks': row[marks_col], 'row': row_number})
    scores, exceptions = {}, []
    for key, rows in groups.items():
        valid = all(isinstance(r['mean'], (int, float)) and isinstance(r['marks'], (int, float))
                    and math.isfinite(r['mean']) and math.isfinite(r['marks'])
                    and r['marks'] > 0 and 0 <= r['mean'] <= r['marks'] for r in rows)
        labels = [r['label'].lower() for r in rows]
        whole = any(re.fullmatch(r'q\d+', x) for x in labels)
        if not valid or len(set(labels)) != len(labels) or (whole and len(rows) > 1):
            exceptions.append({'key': key, 'reason': 'Invalid or overlapping source rows', 'sheet': sheet_name, 'rows': rows})
            continue
        marks = sum(r['marks'] for r in rows)
        scores[key] = {'percentage': 100*sum(r['mean'] for r in rows)/marks, 'marks': marks,
                       'rows': [r['row'] for r in rows], 'tier': tier}
    return scores, lengths, exceptions

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('higher', type=Path); parser.add_argument('foundation', type=Path)
    parser.add_argument('--catalogue', type=Path, default=ROOT/'public/bank/catalogue.json')
    parser.add_argument('--output', type=Path, default=ROOT/'src/bank/performance-data.json')
    parser.add_argument('--report', type=Path, default=ROOT/'docs/performance-import-report.json')
    args = parser.parse_args()
    catalogue = json.loads(args.catalogue.read_text(encoding='utf-8'))
    scores, lengths, exceptions, sources = {}, {}, [], []
    for path, tier in [(args.higher, 'H'), (args.foundation, 'F')]:
        s, n, e = read_grid(path, tier); scores.update(s); lengths.update(n); exceptions.extend(e)
        sources.append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'tier': tier})
    # Published papers are complete in this baseline. Retain their original
    # lengths in generated metadata; future partial uploads must supply a count.
    for q in catalogue['questions']:
        if re.match(r'^mock', q['collection'], re.I):
            lengths[q['paperId']] = max(q['number'], lengths.get(q['paperId'], 0))
    mismatches, measured, estimated = [], 0, 0
    invalid_keys = set()
    for q in catalogue['questions']:
        key = f"{q['paperId']}/{q['number']}"; source = scores.get(key)
        if source and source['marks'] != q['marks']:
            invalid_keys.add(key)
            mismatches.append({'id': q['id'], 'catalogueMarks': q['marks'], 'sourceMarks': source['marks'], 'rows': source['rows']})
    for key in invalid_keys:
        del scores[key]
    curves = {}
    for tier in ['F', 'H']:
        points = []
        for key, s in scores.items():
            if s['tier'] != tier: continue
            paper, number = key.rsplit('/', 1); count = lengths[paper]
            points.append(((int(number)-1)/(count-1) if count > 1 else .5, s['percentage']))
        curves[tier] = fit_curve(points)
    for q in catalogue['questions']:
        if f"{q['paperId']}/{q['number']}" in scores: measured += 1
        elif q['paperId'] in lengths: estimated += 1
    data = {'version': 'pearson-enhanced-2026-v1', 'sources': sources, 'scores': scores,
            'paperQuestionCounts': lengths, 'curves': curves}
    report = {'sources': sources, 'sourceQuestions': len(scores), 'measuredAppearances': measured,
              'estimatedAppearances': estimated, 'unavailableAppearances': len(catalogue['questions'])-measured-estimated,
              'exceptions': exceptions, 'markMismatches': mismatches, 'curves': curves}
    args.output.parent.mkdir(parents=True, exist_ok=True); args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
    args.report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ['sources', 'exceptions', 'markMismatches', 'curves']}))
    print('Source exceptions:', len(exceptions), 'Catalogue mark mismatches:', len(mismatches))

if __name__ == '__main__': main()
