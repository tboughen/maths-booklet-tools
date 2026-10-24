"""Reapply explicitly reviewed report data after an enhanced-grid import.

This does not extract PDFs or fit curves. Conflicts require a recorded source
decision in the reviewed supplement rather than an implicit last-write winner.
"""
from copy import deepcopy
import json
import math


def apply_supplements(data, catalogue, paths):
    result = deepcopy(data)
    maxima = {f"{q['paperId']}/{q['number']}": q['marks']
              for q in catalogue['questions']}
    seen = set()
    for path in paths:
        supplement = json.loads(path.read_text(encoding='utf-8'))
        if supplement['schemaVersion'] != 1 or supplement['id'] in seen:
            raise ValueError(f'Invalid or duplicate performance supplement: {path.name}')
        seen.add(supplement['id'])
        counts = supplement['paperQuestionCounts']
        for paper, count in counts.items():
            if type(count) is not int or count < 1:
                raise ValueError(f'Invalid original paper count: {paper}')
            previous = result['paperQuestionCounts'].get(paper)
            if previous is not None and previous != count:
                raise ValueError(f'Conflicting original paper count: {paper}')
        for key, score in supplement['scores'].items():
            paper, number = key.rsplit('/', 1)
            value, marks = score['percentage'], score['marks']
            if (paper not in counts or not number.isdecimal()
                    or not 1 <= int(number) <= counts[paper]
                    or isinstance(value, bool) or not isinstance(value, (float, int))
                    or not math.isfinite(value) or not 0 <= value <= 100
                    or type(marks) is not int or marks < 1
                    or score['source'] != supplement['id']):
                raise ValueError(f'Invalid measured supplement record: {key}')
            if key in maxima and maxima[key] != marks:
                raise ValueError(f'Supplement/catalogue mark mismatch: {key}')
            previous = result['scores'].get(key)
            if previous is not None and previous != score:
                raise ValueError(f'Conflicting measured performance record: {key}')
            result['scores'][key] = deepcopy(score)
        result['paperQuestionCounts'].update(counts)
        source = {**supplement['source'], 'supplement': supplement['id']}
        prior_sources = [s for s in result['sources'] if s.get('supplement') == supplement['id']]
        if prior_sources and prior_sources != [source]:
            raise ValueError(f'Conflicting supplement provenance: {supplement["id"]}')
        if not prior_sources:
            result['sources'].append(source)
    return result
