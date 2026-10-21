from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
import json,os
from lab.core import Lab,Rejected
lab=Lab(os.environ.get('SEMESTER_LAB_DB','semester-synthetic-lab.sqlite'));lab.seed()
class Handler(BaseHTTPRequestHandler):
 def send(self,status,value):
  b=json.dumps(value).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(b)
 def token(self):return self.headers.get('Authorization','').removeprefix('Bearer ')
 def do_GET(self):
  if self.path=='/':
   b=(Path(__file__).parent/'index.html').read_bytes();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(b);return
  if self.path!='/api/view':self.send(404,{'error':'not found'});return
  try:self.send(200,lab.view(self.token()))
  except Rejected as e:self.send(403,{'error':str(e)})
 def do_POST(self):
  try:
   n=int(self.headers.get('Content-Length','0'))
   if n<=0 or n>10000:raise Rejected('invalid request size')
   if self.headers.get('Origin') not in (None,'http://127.0.0.1:8765','http://localhost:8765'):raise Rejected('origin denied')
   p=json.loads(self.rfile.read(n))
   if self.path=='/api/command':v=lab.execute(self.token(),p['command'],p['payload'],p['key'])
   elif self.path=='/api/project':v=lab.project(self.token())
   else:self.send(404,{'error':'not found'});return
   self.send(200,v)
  except (Rejected,ValueError,KeyError,TypeError) as e:self.send(400,{'error':str(e)})
 def log_message(self,*args):pass
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()
