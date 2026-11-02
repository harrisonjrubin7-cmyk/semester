"""Local-only Semester demo. Never use real education or financial records."""
import json, sqlite3, secrets, os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
TOKEN = secrets.token_urlsafe(32)
SEED = {
 "course": {"title":"Sample course","assignment":"Sample weekly reflection","status":"draft","version":1,"ai_policy":"Guided assistance; no generated submissions","source":"Sample"},
 "privacy": {"notifications":False,"location":False,"family_sharing":False,"source":"Local demo preferences, not OS permissions"},
 "tasks": [{"id":"a1","title":"Review sample assignment","status":"open","context":"personal"},{"id":"a2","title":"Review sample launch evidence","status":"open","context":"company"}],
 "board": {"period":"Not set","summary":"Draft — enter evidence-backed management commentary.","cash":None,"burn":None,"reserve":None,"source":"Unverified inputs"},
 "risks": [{"id":"r1","title":"Sample: delivery dependency","likelihood":3,"impact":4,"owner":"Unassigned","source":"Sample"}]
}
class Store:
 def __init__(self,path):
  self.path=path
  with sqlite3.connect(path) as c:
   c.execute('CREATE TABLE IF NOT EXISTS objects (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
   c.execute('CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, action TEXT, detail TEXT, occurred_at TEXT DEFAULT CURRENT_TIMESTAMP)')
   for k,v in SEED.items(): c.execute('INSERT OR IGNORE INTO objects VALUES (?,?)',(k,json.dumps(v)))
 def state(self):
  with sqlite3.connect(self.path) as c:
   result={k:json.loads(v) for k,v in c.execute('SELECT key,value FROM objects')}
   result['audit']=[{'action':a,'time':t} for a,t in c.execute('SELECT action,occurred_at FROM audit ORDER BY id DESC LIMIT 20')]
   return result
 def command(self,action,payload):
  with sqlite3.connect(self.path) as c:
   get=lambda k: json.loads(c.execute('SELECT value FROM objects WHERE key=?',(k,)).fetchone()[0])
   if action=='course.save':
    key='course'; v=get(key)
    for f in ['title','assignment','ai_policy']:
     if not isinstance(payload.get(f),str) or not 1<=len(payload[f].strip())<=2000: raise ValueError('Complete course fields; maximum 2000 characters each.')
     v[f]=payload[f].strip()
    v['status']='draft';v['version']+=1
   elif action=='course.publish':
    key='course';v=get(key)
    if payload.get('version')!=v['version']: raise ValueError('Course changed; refresh before publishing.')
    v['status']='published'; v['version']+=1
   elif action=='privacy.save':
    key='privacy';v=get(key)
    for f in ['notifications','location','family_sharing']:
     if type(payload.get(f)) is not bool: raise ValueError('Preference must be true or false.')
     v[f]=payload[f]
   elif action=='task.complete':
    key='tasks';v=get(key)
    if payload.get('id') not in [t['id'] for t in v]: raise ValueError('Unknown task.')
    for t in v:
     if t['id']==payload['id']: t['status']='done'
   elif action=='board.save':
    key='board';v=get(key)
    for f in ['period','summary']:
     if not isinstance(payload.get(f),str) or len(payload[f])>10000: raise ValueError('Invalid narrative.')
     v[f]=payload[f]
    for f in ['cash','burn','reserve']:
     n=payload.get(f)
     if n is not None and (type(n) not in [int,float] or not __import__('math').isfinite(n)): raise ValueError('Invalid amount.')
     if f in ['cash','reserve'] and n is not None and n<0: raise ValueError('Cash and reserve cannot be negative.')
     v[f]=n
   else: raise ValueError('Unsupported command.')
   c.execute('UPDATE objects SET value=? WHERE key=?',(json.dumps(v),key))
   c.execute('INSERT INTO audit(action,detail) VALUES (?,?)',(action,json.dumps({'object':key})))
  return self.state()
class Handler(BaseHTTPRequestHandler):
 def send(self,status,data,kind='application/json'):
  body=json.dumps(data).encode() if kind=='application/json' else data.encode()
  self.send_response(status);self.send_header('Content-Type',kind+'; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)
 def do_GET(self):
  if self.headers.get('Host') not in ['127.0.0.1:8000','localhost:8000']: return self.send(403,{'error':'Local host required.'})
  if self.path=='/': return self.send(200,Path(__file__).with_name('index.html').read_text().replace('__TOKEN__',TOKEN),'text/html')
  if self.path=='/api/state' and self.headers.get('X-Demo-Token')==TOKEN: return self.send(200,STORE.state())
  self.send(404,{'error':'Not found.'})
 def do_POST(self):
  if self.headers.get('Host') not in ['127.0.0.1:8000','localhost:8000'] or self.headers.get('X-Demo-Token')!=TOKEN: return self.send(403,{'error':'Local demo token required.'})
  if self.path!='/api/command': return self.send(404,{'error':'Not found.'})
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 0<length<=65536: raise ValueError('Invalid request size.')
   data=json.loads(self.rfile.read(length));result=STORE.command(data['action'],data.get('payload',{}));self.send(200,result)
  except (ValueError,KeyError,TypeError) as e: self.send(400,{'error':str(e)})
if __name__=='__main__':
 STORE=Store(os.environ.get('SEMESTER_DEMO_DB','semester-demo.sqlite'))
 print('Local-only SAMPLE demo: http://127.0.0.1:8000 — no production authentication')
 HTTPServer(('127.0.0.1',8000),Handler).serve_forever()
