"""Advisory visible-case feedback. TRUSTED LOCAL CODE ONLY; not a sandbox."""
import argparse, base64, hashlib, json, subprocess, sys, threading
from pathlib import Path

WORKER = """import base64,copy,json,os,sys,types
RESULT=os.dup(1);os.dup2(2,1);sys.stdout=sys.stderr
payload=json.loads(sys.stdin.read());suite=payload['suite']
module=types.ModuleType('learner');sys.modules['learner']=module
exec(compile(base64.b64decode(payload['source']),'learner.py','exec'),module.__dict__)
def shape(v):
    if isinstance(v,dict): return {k:shape(x) for k,x in v.items()}
    if isinstance(v,(list,tuple)): return [type(v).__name__]+[shape(x) for x in v]
    return type(v).__name__
results=[]
for case in suite['cases']:
    before=copy.deepcopy(case['input'])
    try:
        outcome={'value':getattr(module,suite['function'])(case['input'])}
        outcome['shape']=shape(outcome['value'])
    except ValueError: outcome={'exception':'ValueError'}
    except BaseException: outcome={'exception':'ExecutionError'}
    outcome['mutated']=case['input']!=before
    try: json.dumps(outcome,allow_nan=False)
    except (TypeError,ValueError): outcome={'value':None,'shape':'unserializable','mutated':outcome['mutated']}
    results.append(outcome)
with os.fdopen(RESULT,'w') as out: out.write(json.dumps(results,allow_nan=False)+'\\n')
"""

def shape(v):
    if isinstance(v, dict): return {k: shape(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)): return [type(v).__name__] + [shape(x) for x in v]
    return type(v).__name__

def grade(suite, submission, timeout=5):
    with open(submission, 'rb') as handle:
        source = handle.read(65537)
    if len(source) > 65536:
        raise ValueError('Submission exceeds 64 KiB')
    process = subprocess.Popen([sys.executable, '-I', '-B', '-c', WORKER],
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
        process.stdin.write(json.dumps({'suite': suite, 'source': base64.b64encode(source).decode()}).encode())
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
    learner_errors = 0
    if failure is None and process.returncode == 0:
        try:
            results = json.loads(buffers[0])
            if not isinstance(results, list) or len(results) != len(suite['cases']):
                raise ValueError('Invalid result count')
            for result, case in zip(results, suite['cases']):
                expected = case['expected']
                if not isinstance(result, dict): raise ValueError('Invalid result')
                unexpected = result.get('exception') == 'ExecutionError' or (
                    result.get('exception') == 'ValueError' and expected != '!ValueError')
                if unexpected: learner_errors += 1
                # 0 == False and 1 == True, and JSON turns tuples into lists, so the worker reports the native shape.
                value_ok = 'value' in result and result['value'] == expected and result.get('shape') == shape(expected)
                # Only contracts that forbid mutation (suite 'immutable') penalise it.
                ok = (not suite.get('immutable') or result.get('mutated') is False) and (
                    (expected == '!ValueError' and result.get('exception') == 'ValueError') or
                    (expected != '!ValueError' and value_ok))
                passed += int(ok)
            if learner_errors: failure = 'learner_exception'
        except (ValueError, TypeError): failure = 'invalid_output'
    elif failure is None: failure = 'execution_failed'
    total = len(suite['cases'])
    return {'week':suite['week'],'passed':passed,'total':total,'learner_errors':learner_errors,
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
