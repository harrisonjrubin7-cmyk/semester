"""Containerized visible-case feedback. Not trusted official assessment."""
import argparse,hashlib,json,os,re,subprocess,tempfile,threading,uuid
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--lab',type=int,required=True,choices=range(1,17))
p.add_argument('--submission',required=True)
p.add_argument('--report',required=True)
p.add_argument('--image',default=os.environ.get('GRADER_IMAGE',''))
a=p.parse_args()
if not re.fullmatch(r'[^\s]+@sha256:[0-9a-f]{64}',a.image):
    p.error('A reviewed immutable GRADER_IMAGE digest is required')
base=Path(__file__).resolve().parent
suite=json.loads((base/'curriculum'/'labs'/f'week_{a.lab:02d}'/'tests.json').read_text())
source_path=Path(a.submission)
if source_path.is_symlink() or not source_path.is_file() or source_path.stat().st_size>65536:
    p.error('Require a regular nonsymlink file <=64 KiB')
source=source_path.read_bytes();name='semester-grade-'+uuid.uuid4().hex
buffers={'stdout':bytearray(),'stderr':bytearray()};overflow=threading.Event()
def drain(pipe,key):
    while True:
        data=pipe.read(4096)
        if not data: break
        available=max(0,1048576-len(buffers[key]));buffers[key].extend(data[:available])
        if len(data)>available:
            overflow.set()
            try: proc.kill()
            except ProcessLookupError: pass
            break
with tempfile.TemporaryDirectory() as temp:
    stage=Path(temp);stage.chmod(0o755)
    (stage/'starter.py').write_bytes(source);(stage/'starter.py').chmod(0o444)
    command=['docker','run','--rm','--pull=never','--name',name,'--network=none',
        '--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
        '--pids-limit=32','--memory=128m','--memory-swap=128m','--cpus=0.5',
        '--user=65534:65534','--ulimit','nofile=64:64','--log-driver=none',
        '--tmpfs','/tmp:rw,noexec,nosuid,size=8m',
        '--mount',f'type=bind,src={stage},dst=/submission,readonly',
        '--mount',f'type=bind,src={base/"worker.py"},dst=/worker.py,readonly',
        '--entrypoint=python',a.image,'-I','-B','/worker.py']
    proc=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    threads=[threading.Thread(target=drain,args=(proc.stdout,'stdout'),daemon=True),threading.Thread(target=drain,args=(proc.stderr,'stderr'),daemon=True)]
    for thread in threads: thread.start()
    failure=None
    try:
        proc.stdin.write(json.dumps(suite).encode());proc.stdin.close();proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        failure='timeout';proc.kill();proc.wait()
    except BrokenPipeError: failure='worker exited early'
    finally:
        subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
        for thread in threads:thread.join(timeout=2)
    if overflow.is_set(): failure='output limit'
    passed=0
    if not failure and proc.returncode==0:
        try:
            results=json.loads(buffers['stdout'])
            if not isinstance(results,list) or len(results)!=len(suite['cases']):raise ValueError()
            for result,case in zip(results,suite['cases']):
                expected=case['expected']
                passed+=int(isinstance(result,dict) and ((expected=='!ValueError' and result.get('exception')=='ValueError') or (expected!='!ValueError' and 'value' in result and result['value']==expected)))
        except (ValueError,TypeError):failure='invalid output'
    elif not failure:failure='execution failed'
report={'lab':a.lab,'passed':passed,'total':len(suite['cases']),
    'correctness_points':round(30*passed/len(suite['cases']),2),'final_grade':None,
    'failure':failure,'submission_sha256':hashlib.sha256(source).hexdigest(),
    'test_sha256':hashlib.sha256(json.dumps(suite,sort_keys=True).encode()).hexdigest(),
    'image':a.image,'assurance':'visible-case feedback; not official assessment'}
Path(a.report).write_text(json.dumps(report,indent=2));print(json.dumps(report))
raise SystemExit(0 if not failure and passed==len(suite['cases']) else 1)
