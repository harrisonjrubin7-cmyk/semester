"""Local feedback only. Executes trusted code; not a security sandbox."""
import argparse, importlib.util, json
from pathlib import Path

def same(a, b):
    """Type-strict equality: 0 is not False, 1 is not True, "!ValueError" is not an exception."""
    if type(a) is not type(b):
        return False
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    if isinstance(a, list):
        return len(a) == len(b) and all(same(x, y) for x, y in zip(a, b))
    return a == b


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lab', type=int, choices=range(1, 17), required=True)
    parser.add_argument('--submission', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    base = Path(__file__).resolve().parent
    suite = json.loads((base/'labs'/f'week_{args.lab:02d}'/'tests.json').read_text())
    passed = 0
    results = []
    spec = importlib.util.spec_from_file_location('submission', args.submission)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for case in suite['cases']:
        try:
            value = getattr(module, suite['function'])(case['input'])
            ok = case['expected'] != '!ValueError' and same(value, case['expected'])
        except Exception as error:
            ok = case['expected'] == '!ValueError' and type(error) is ValueError
        passed += int(ok)
        results.append({'passed': bool(ok)})
    report = {'lab': args.lab, 'passed': passed, 'total': len(results),
              'correctness_points': round(30 * passed / len(results), 2),
              'manual_points_available': 70, 'final_grade': None,
              'results': results, 'assurance': 'trusted local feedback only'}
    Path(args.report).write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
    return 0 if passed == len(results) else 1

if __name__ == '__main__':
    raise SystemExit(main())
