import argparse, json, subprocess, sys, tempfile
from pathlib import Path
p=argparse.ArgumentParser(description="LOCAL TRUSTED CODE ONLY. This is not a security sandbox.")
p.add_argument('--lab',type=int,required=True,choices=range(1,17))
p.add_argument('--submission',required=True)
p.add_argument('--report',required=True)
a=p.parse_args()
root=Path(__file__).resolve().parent
spec=json.loads((root/'labs'/f'week_{a.lab:02d}'/'tests.json').read_text())
source=Path(a.submission).read_text()
runner="""import json,sys
ns={}
exec(compile(sys.stdin.readline(),'<submission>','exec'),ns)
spec=json.loads(sys.stdin.read())
results=[]
for case in spec['cases']:
    try:
        actual=ns[spec['function']](case['input'])
        passed=actual==case['expected']
    except Exception as e:
        passed=case['expected']=='!ValueError' and type(e) is ValueError
    results.append(bool(passed))
print(json.dumps(results))
"""
# JSON-encoded source avoids multiline transport ambiguity.
runner=runner.replace("exec(compile(sys.stdin.readline(),", "exec(compile(json.loads(sys.stdin.readline()),")
try:
    run=subprocess.run([sys.executable,'-I','-c',runner],input=json.dumps(source)+'\n'+json.dumps(spec),text=True,capture_output=True,timeout=10)
    results=json.loads(run.stdout) if run.returncode==0 else []
    passed=sum(x is True for x in results)
    error=None if run.returncode==0 else 'Execution failed'
except (subprocess.TimeoutExpired,json.JSONDecodeError):
    passed=0; results=[]; error='Timeout or invalid output'
total=len(spec['cases'])
report={'lab':a.lab,'passed':passed,'total':total,'correctness_points':round(30*passed/total,2),'manual_points_available':70,'final_grade':None,'error':error,'warning':'Trusted local code only; not isolated from host files/network. Production requires an isolated runner.'}
Path(a.report).write_text(json.dumps(report,indent=2))
print(json.dumps(report))
sys.exit(0 if passed==total else 1)
