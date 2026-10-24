import json
from pathlib import Path
import unittest
from performance_supplements import apply_supplements

ROOT = Path(__file__).resolve().parents[1]


class PerformanceSupplements(unittest.TestCase):
    def setUp(self):
        self.paths = sorted((ROOT/'scripts/performance-supplements').glob('*.json'))
        self.catalogue = json.loads((ROOT/'public/bank/catalogue.json').read_text(encoding='utf-8'))
        self.data = {'scores': {'unrelated/1': {'marks': 2, 'percentage': 50}},
                     'paperQuestionCounts': {}, 'sources': [],
                     'curves': {'F': [{'position': .5, 'percentage': 42}], 'H': []}}

    def test_repeated_import_retains_all_checked_mock_values_and_curves(self):
        first = apply_supplements(self.data, self.catalogue, self.paths)
        second = apply_supplements(first, self.catalogue, self.paths)
        self.assertEqual(first, second)
        self.assertEqual(len(first['scores']), 147)
        self.assertEqual(first['scores']['unrelated/1'], self.data['scores']['unrelated/1'])
        self.assertEqual(first['curves'], self.data['curves'])
        self.assertAlmostEqual(first['scores']['1MA1_MOCK_SET_01_1F/10']['percentage'], 29)
        self.assertEqual(first['scores']['1MA1_MOCK_SET_01_3H/3']['percentage'], 38)
        self.assertAlmostEqual(first['scores']['1MA1_MOCK_SET_01_3H/19']['percentage'], 5.6)

    def test_conflicting_grid_value_is_not_overwritten(self):
        self.data['scores']['1MA1_MOCK_SET_01_1F/1'] = {'marks': 1, 'percentage': 1}
        with self.assertRaisesRegex(ValueError, 'Conflicting measured'):
            apply_supplements(self.data, self.catalogue, self.paths)

    def test_wrong_catalogue_marks_are_rejected(self):
        self.catalogue['questions'].append({'paperId': '1MA1_MOCK_SET_01_1F', 'number': 1, 'marks': 2})
        with self.assertRaisesRegex(ValueError, 'mark mismatch'):
            apply_supplements(self.data, self.catalogue, self.paths)

    def test_conflicting_count_is_rejected(self):
        self.data['paperQuestionCounts']['1MA1_MOCK_SET_01_1F'] = 99
        with self.assertRaisesRegex(ValueError, 'Conflicting original paper count'):
            apply_supplements(self.data, self.catalogue, self.paths)


if __name__ == '__main__':
    unittest.main()
