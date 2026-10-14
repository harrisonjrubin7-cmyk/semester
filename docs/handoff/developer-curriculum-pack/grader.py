"""Lab grader — LOCAL, TRUSTED CODE ONLY. This is not a sandbox: a submission can read files and use the network.
Production grading must use an isolated runner (no network, no secrets, resource limits, hidden tests).

v2 changes (see original in git history / the uploaded pack):
  * Strict comparison: results are compared as canonical JSON, so returning 1 for True, or a tuple for a list, fails.
    The original used ==, where True == 1 passed.
  * A learner's print() no longer breaks grading: results come back on one sentinel-prefixed line.
  * Per-case results (pass/fail and why) are in the report, so feedback says which rule failed.
  * The expected-ValueError check also fails a case that returns normally, and a case that raises another type.
"""
import argparse, json, subprocess, sys
from pathlib import Path

SENTINEL = '__SEMESTER_GRADER_RESULTS__'
RUNNER = r"""
import json, sys
src = json.loads(sys.stdin.readline())
spec = json.loads(sys.stdin.read())
ns = {}
exec(compile(src, '<submission>', 'exec'), ns)
def canon(v):
    return json.dumps(v, sort_keys=True, separators=(',', ':'))
out = []
for case in spec['cases']:
    want = case['expected']
    try:
        got = ns[spec['function']](case['input'])
        if want == '!ValueError':
            out.append({'passed': False, 'why': 'expected ValueError, returned normally'})
        else:
            try:
                ok = canon(got) == canon(want)
            except TypeError:
                ok = False
            out.append({'passed': ok, 'why': None if ok else 'returned ' + repr(got)[:120] + ', expected ' + canon(want)[:120]})
    except Exception as e:
        ok = want == '!ValueError' and type(e) is ValueError
        out.append({'passed': ok, 'why': None if ok else 'raised ' + type(e).__name__})
print('__SEMESTER_GRADER_RESULTS__' + json.dumps(out))
"""

p = argparse.ArgumentParser(description='LOCAL TRUSTED CODE ONLY. This is not a security sandbox.')
p.add_argument('--lab', type=int, required=True, choices=range(1, 17))
p.add_argument('--submission', required=True)
p.add_argument('--report', required=True)
a = p.parse_args()
root = Path(__file__).resolve().parent
spec = json.loads((root / 'labs' / f'week_{a.lab:02d}' / 'tests.json').read_text())
source = Path(a.submission).read_text()
results, error = [], None
try:
    run = subprocess.run([sys.executable, '-I', '-c', RUNNER], input=json.dumps(source) + '\n' + json.dumps(spec),
                         text=True, capture_output=True, timeout=10)
    line = next((l for l in reversed(run.stdout.splitlines()) if l.startswith(SENTINEL)), None)
    if run.returncode != 0 or line is None:
        error = 'Submission failed to load: ' + (run.stderr.strip().splitlines() or ['no output'])[-1][:200]
    else:
        results = json.loads(line[len(SENTINEL):])
except subprocess.TimeoutExpired:
    error = 'Timed out after 10 seconds'
total = len(spec['cases'])
passed = sum(1 for r in results if r.get('passed') is True)
report = {'lab': a.lab, 'passed': passed, 'total': total, 'correctness_points': round(30 * passed / total, 2),
          'manual_points_available': 70, 'final_grade': None, 'error': error,
          'cases': [{'case': i + 1, **r} for i, r in enumerate(results)],
          'warning': 'Trusted local code only; not isolated from host files or network. Production requires an isolated runner. The instructor decides the grade.'}
Path(a.report).write_text(json.dumps(report, indent=2))
print(json.dumps({k: report[k] for k in ('lab', 'passed', 'total', 'error')}))
sys.exit(0 if passed == total else 1)
