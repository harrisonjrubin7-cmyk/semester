"""Local integration orchestration. Does not provision, migrate or deploy."""
import argparse, json, os, subprocess, time
from pathlib import Path
from urllib.parse import urlsplit
LOOPBACK={'localhost','127.0.0.1','::1'}
def local_url(value):
 u=urlsplit(value)
 if u.scheme not in {'http','https'} or u.hostname not in LOOPBACK or u.username or u.password or u.query or u.fragment:
  raise ValueError('Only explicit loopback test URLs without credentials/query/fragment are allowed')
 return value.rstrip('/')+'/'
def plan(mode,url,sync_url=None):
 url=local_url(url)
 jobs=[('cold','smoke:cold',url),('accessibility','smoke:a11y',url),('golden','smoke:golden',url)]
 if mode=='personal-account':
  if not sync_url:raise ValueError('Account scope requires a separately built local account URL')
  jobs.append(('account-sync','smoke:sync',local_url(sync_url)))
 elif mode!='personal-baseline':raise ValueError('Unsupported scope')
 return jobs
def execute(root,mode,url,sync_url=None,run=subprocess.run):
 jobs=plan(mode,url,sync_url)
 if mode=='personal-account' and not os.environ.get('SMOKE_SUPABASE_SERVICE_KEY'):
  raise ValueError('Local account tests require the ephemeral local service key in the environment')
 app=Path(root)/'app'
 if not (app/'package.json').exists():raise ValueError('Repository app/package.json missing')
 results=[]
 for name,script,target in jobs:
  env=os.environ.copy();env['SMOKE_URL']=target
  start=time.monotonic()
  try:
   p=run(['npm','run',script],cwd=app,env=env,capture_output=True,text=True,timeout=900)
   code=p.returncode;status='passed' if code==0 else 'failed' if code==1 else 'unavailable'
  except subprocess.TimeoutExpired:code=2;status='unavailable'
  results.append({'suite':name,'script':script,'status':status,'exit_code':code,'seconds':round(time.monotonic()-start,3)})
 report={'scope':mode,'results':results,'scope_passed':all(x['status']=='passed' for x in results),'production_ready':False,'excluded':['institutional authority','faculty course publication/submission','company board disclosure','production provider quality','deployment and rollback']}
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',default='.');p.add_argument('--mode',choices=['personal-baseline','personal-account'],required=True);p.add_argument('--url',required=True);p.add_argument('--sync-url');p.add_argument('--report',required=True);a=p.parse_args()
 try:
  result=execute(a.root,a.mode,a.url,a.sync_url)
  path=Path(a.report);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,indent=2))
  print('Selected scope passed' if result['scope_passed'] else 'Selected scope did not pass')
  raise SystemExit(0 if result['scope_passed'] else 1 if any(x['status']=='failed' for x in result['results']) else 2)
 except ValueError as e:print(str(e));raise SystemExit(2)
