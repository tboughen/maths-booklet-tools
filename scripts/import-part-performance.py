"""Import Pearson success rates per question PART, with AO, common-question
flag and the average for candidates at each grade.

Reads the same Enhanced Skills Mapping Grids as import-performance.py and
writes public/bank/performance-parts.json. That file is fetched on demand,
never bundled, so the app's JavaScript size is unchanged.

Usage: python scripts/import-part-performance.py HIGHER.xlsx FOUNDATION.xlsx
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]

def series_id(value):
    if hasattr(value, 'strftime'):
        return value.strftime('%b_%Y').upper()
    words = str(value).strip().split()
    return f'{words[0][:3]}_{words[1]}'.upper()

def part_key(label):
    """'Q03bii' -> 'bii'; '7(a)(i)' -> 'ai'; 'Q01' or '1' -> ''."""
    return re.sub(r'[^a-z]', '', re.sub(r'^q?\s*\d+', '', label.strip().lower()))

def read_grid(path, tier):
    sheet = openpyxl.load_workbook(path, read_only=True, data_only=True)['Higher Questions' if tier == 'H' else 'Foundation Questions']
    rows = sheet.iter_rows(min_row=1, values_only=True)
    next(rows); head = next(rows); sub = next(rows)
    col = {name: i for i, name in enumerate(head) if isinstance(name, str)}
    q_col, ao_col, common_col = col['Question'], col['AO'], col['Common Question']
    mean_col, max_col = col['Mean score'], col['Max score']
    all_col = sub.index('ALL')
    # Grade columns come in (score, score %) pairs after ALL / ALL (%).
    grades, i = [], all_col + 2
    while i + 1 < len(sub) and sub[i] is not None and str(sub[i + 1]).strip() == f'{sub[i]} (%)':
        grades.append((str(sub[i]), i)); i += 2
    papers, skipped = {}, 0
    for row in rows:
        if row[1] is None or not isinstance(row[q_col], str):
            continue
        match = re.fullmatch(r'Q0*(\d+)([a-z]*|[ivx]*)', row[q_col].strip(), re.I)
        mean, marks = row[mean_col], row[max_col]
        if not match or not isinstance(mean, (int, float)) or not isinstance(marks, (int, float)) or marks <= 0 or not 0 <= mean <= marks:
            skipped += 1; continue
        key = f"1MA1_{series_id(row[1])}_{str(row[2]).strip().upper()}/{int(match[1])}"
        by_grade = {}
        for grade, i in grades:
            value = row[i]
            if isinstance(value, (int, float)) and 0 <= value <= marks:
                by_grade[grade] = round(100 * value / marks, 1)
        papers.setdefault(key, {})[part_key(row[q_col])] = {
            'label': row[q_col].strip(), 'marks': marks, 'percentage': round(100 * mean / marks, 1),
            'ao': row[ao_col] if isinstance(row[ao_col], int) else None,
            'common': str(row[common_col]).strip().lower() == 'yes',
            'grades': by_grade,
        }
    return papers, [g for g, _ in grades], skipped

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('higher', type=Path); parser.add_argument('foundation', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT/'public/bank/performance-parts.json')
    args = parser.parse_args()
    data = {'version': 'pearson-enhanced-parts-2026-v1', 'sources': [], 'grades': {}, 'questions': {}}
    for path, tier in [(args.higher, 'H'), (args.foundation, 'F')]:
        papers, grades, skipped = read_grid(path, tier)
        data['questions'].update(papers); data['grades'][tier] = grades
        data['sources'].append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'tier': tier, 'skippedRows': skipped})
    args.output.write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'questions': len(data['questions']), 'parts': sum(len(v) for v in data['questions'].values()), 'grades': data['grades'], 'sources': data['sources']}))

if __name__ == '__main__': main()
