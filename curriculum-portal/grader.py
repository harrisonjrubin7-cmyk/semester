"""Advisory visible-case feedback. TRUSTED LOCAL CODE ONLY; not a sandbox."""
import argparse, hashlib, json, subprocess, sys, threading
from pathlib import Path

WORKER = """import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('learner',sys.argv[1])
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
suite=json.loads(sys.stdin.read());results=[]
for case in suite['cases']:
    try: results.append({'value':getattr(module,suite['function'])(case['input'])})
    except ValueError: results.append({'exception':'ValueError'})
    except BaseException: results.append({'exception':'ExecutionError'})
print(json.dumps(results,allow_nan=False))
"""

def grade(suite, submission, timeout=5):
    source = Path(submission).read_bytes()
    if len(source) > 65536:
        raise ValueError('Submission exceeds 64 KiB')
    process = subprocess.Popen([sys.executable, '-I', '-B', '-c', WORKER,
                                str(Path(submission).resolve())],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE)
    buffers = [bytearray(), bytearray()]
    overflow = threading.Event()
    def drain(pipe, index):
        while True:
            chunk = pipe.read(4096)
            if not chunk: break
            remaining = max(0, 65536 - len(buffers[index]))
            buffers[index].extend(chunk[:remaining])
            if len(chunk) > remaining:
                overflow.set()
                try: process.kill()
                except ProcessLookupError: pass
                break
    threads = [threading.Thread(target=drain, args=(process.stdout, 0), daemon=True),
               threading.Thread(target=drain, args=(process.stderr, 1), daemon=True)]
    for thread in threads: thread.start()
    failure = None
    try:
        process.stdin.write(json.dumps(suite).encode())
        process.stdin.close()
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        failure = 'timeout'; process.kill(); process.wait()
    except BrokenPipeError:
        failure = 'early_exit'
    finally:
        for thread in threads: thread.join(timeout=1)
    if overflow.is_set(): failure = 'output_limit'
    passed = 0
    if failure is None and process.returncode == 0:
        try:
            results = json.loads(buffers[0])
            if not isinstance(results, list) or len(results) != len(suite['cases']):
                raise ValueError('Invalid result count')
            for result, case in zip(results, suite['cases']):
                expected = case['expected']
                ok = isinstance(result, dict) and (
                    (expected == '!ValueError' and result.get('exception') == 'ValueError') or
                    (expected != '!ValueError' and 'value' in result and result['value'] == expected))
                passed += int(ok)
        except (ValueError, TypeError): failure = 'invalid_output'
    elif failure is None: failure = 'execution_failed'
    total = len(suite['cases'])
    return {'week':suite['week'],'passed':passed,'total':total,
            'correctness_points':round(30*passed/total,2), 'final_grade':None,
            'failure':failure,'submission_sha256':hashlib.sha256(source).hexdigest(),
            'suite_sha256':hashlib.sha256(json.dumps(suite,sort_keys=True).encode()).hexdigest(),
            'assurance':'trusted local feedback only'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--week',type=int,choices=range(1,17),required=True)
    parser.add_argument('--submission',required=True)
    parser.add_argument('--report',required=True)
    args = parser.parse_args()
    suites = json.loads(Path(__file__).with_name('curriculum.json').read_text())
    result = grade(suites[args.week-1],args.submission)
    Path(args.report).write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
    raise SystemExit(0 if result['failure'] is None and result['passed']==result['total'] else 1)
