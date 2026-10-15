"""Reviewed local-only orchestrator. Does not provision, migrate, or deploy."""
import argparse,json,os,subprocess,time
from pathlib import Path
from urllib.parse import urlsplit
LOOPBACK={'localhost','127.0.0.1','::1'}
def local_url(value):
 try:u=urlsplit(value);port=u.port
 except ValueError:raise ValueError('Invalid test URL')
 if u.scheme not in {'http','https'} or u.hostname not in LOOPBACK or u.username or u.password or u.query or u.fragment:
  raise ValueError('Explicit loopback URLs only; no credentials/query/fragment')
 return value.rstrip('/')+'/'
def plan(mode,url,sync_url=None):
 jobs=[('cold','smoke:cold',local_url(url)),('accessibility','smoke:a11y',local_url(url)),('golden','smoke:golden',local_url(url))]
 if mode=='personal-account':
  if not sync_url:raise ValueError('Separate local account preview required')
  jobs.append(('account-sync','smoke:sync',local_url(sync_url)))
 elif mode!='personal-baseline':raise ValueError('Unknown test scope')
 return jobs
def child_env(script,target):
 env=os.environ.copy();env['SMOKE_URL']=target
 if script!='smoke:sync':env.pop('SMOKE_SUPABASE_SERVICE_KEY',None)
 return env
def execute(root,mode,url,sync_url=None,run=subprocess.run):
 jobs=plan(mode,url,sync_url);app=Path(root).resolve()/'app'
 if not (app/'package.json').exists():raise ValueError('Missing app/package.json')
 if mode=='personal-account' and not os.environ.get('SMOKE_SUPABASE_SERVICE_KEY'):raise ValueError('Ephemeral LOCAL service key required')
 results=[]
 for name,script,target in jobs:
  start=time.monotonic();reason=None
  try:
   p=run(['npm','run',script],cwd=app,env=child_env(script,target),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=900)
   code=p.returncode;status='passed' if code==0 else 'failed' if code==1 else 'unavailable'
   if code not in (0,1):reason='instrument_exit'
  except subprocess.TimeoutExpired:code=2;status='unavailable';reason='timeout'
  except OSError:code=2;status='unavailable';reason='launch_error'
  results.append({'suite':name,'status':status,'exit_code':code,'reason':reason,'seconds':round(time.monotonic()-start,3)})
 return {'scope':mode,'scope_passed':bool(results) and all(r['status']=='passed' for r in results),'production_ready':False,'results':results,'excluded':['institutional authority','course submissions/grades','company disclosures','live deployment/rollback']}
def write_report(path,value):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.tmp');tmp.write_text(json.dumps(value,indent=2));os.replace(tmp,path)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',default='.');p.add_argument('--mode',required=True,choices=['personal-baseline','personal-account']);p.add_argument('--url',required=True);p.add_argument('--sync-url');p.add_argument('--report',required=True);a=p.parse_args()
 try:r=execute(a.root,a.mode,a.url,a.sync_url)
 except ValueError as e:r={'scope':a.mode,'scope_passed':False,'production_ready':False,'setup_error':str(e),'results':[]}
 try:write_report(a.report,r)
 except OSError:print('Report could not be persisted; scope unverified');raise SystemExit(2)
 print('Selected scope passed' if r['scope_passed'] else 'Selected scope did not pass; inspect report')
 raise SystemExit(0 if r['scope_passed'] else 1 if any(x['status']=='failed' for x in r['results']) else 2)
