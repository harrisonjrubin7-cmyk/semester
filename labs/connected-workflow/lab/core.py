import sqlite3,json,hashlib,time,uuid
from contextlib import contextmanager
from urllib.parse import quote
class Rejected(Exception): pass

def canon(v): return json.dumps(v,sort_keys=True,separators=(',',':'),allow_nan=False)
def digest(v): return hashlib.sha256(canon(v).encode()).hexdigest()
# Each part is percent-encoded, so a ':' inside a course or student ID cannot make two pairs share one grade row.
def grade_id(tenant,course,student): return ':'.join(quote(p,safe='') for p in (tenant,course,student))
class Lab:
 def __init__(self,path):
  self.path=str(path)
  with self.db() as d:
   d.executescript("""
CREATE TABLE IF NOT EXISTS actors(id TEXT PRIMARY KEY,tenant TEXT NOT NULL,role TEXT NOT NULL,token TEXT UNIQUE NOT NULL,active INTEGER NOT NULL,expires REAL NOT NULL);
CREATE TABLE IF NOT EXISTS courses(id TEXT,tenant TEXT,PRIMARY KEY(tenant,id));
CREATE TABLE IF NOT EXISTS access(tenant TEXT,course TEXT,actor TEXT,PRIMARY KEY(tenant,course,actor));
CREATE TABLE IF NOT EXISTS students(id TEXT,tenant TEXT,onboarded INTEGER,hold INTEGER,prerequisite TEXT,source_at REAL,version INTEGER,PRIMARY KEY(tenant,id));
CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,tenant TEXT,course TEXT,student TEXT,body TEXT,created REAL);
CREATE TABLE IF NOT EXISTS grades(id TEXT PRIMARY KEY,tenant TEXT,course TEXT,student TEXT,score REAL,state TEXT,version INTEGER,submission_id TEXT);
CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY,tenant TEXT,kind TEXT,object_id TEXT,requester TEXT,binding TEXT,expires REAL,state TEXT,reason TEXT);
CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,tenant TEXT,actor TEXT,key TEXT,fingerprint TEXT,body TEXT,UNIQUE(tenant,actor,key));
CREATE TABLE IF NOT EXISTS outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE,tenant TEXT,kind TEXT,object_id TEXT,version INTEGER,payload TEXT,projected INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS projection(tenant TEXT,kind TEXT,object_id TEXT,version INTEGER,payload TEXT,PRIMARY KEY(tenant,kind,object_id));
CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,tenant TEXT,actor TEXT,command TEXT,object_id TEXT,receipt TEXT,created REAL);
""")
   # Databases created before a column existed keep their old tables; add the missing columns.
   if 'submission_id' not in [r['name'] for r in d.execute('PRAGMA table_info(grades)')]:d.execute('ALTER TABLE grades ADD COLUMN submission_id TEXT')
   # Legacy drafts do not record which submission they assessed, so they keep a NULL submission and must be drafted again.
   if 'reason' not in [r['name'] for r in d.execute('PRAGMA table_info(approvals)')]:
    d.execute('ALTER TABLE approvals ADD COLUMN reason TEXT')
    # Legacy pending approvals have no recoverable reason, so they are retired and must be requested again.
    d.execute("UPDATE approvals SET state='retired' WHERE state='pending' AND reason IS NULL")
 @contextmanager
 def db(self):
  d=sqlite3.connect(self.path,timeout=5);d.row_factory=sqlite3.Row
  try: yield d;d.commit()
  except: d.rollback();raise
  finally:d.close()
 def seed(self):
  with self.db() as d:
   if d.execute('SELECT 1 FROM actors LIMIT 1').fetchone():
    # Renew synthetic sessions that lapsed since the database was first seeded; keep every other row.
    d.execute('UPDATE actors SET expires=? WHERE expires<=?',(time.time()+86400,time.time()));return
   for tenant in ('a','b'):
    d.execute('INSERT INTO courses VALUES (?,?)',('course',tenant))
    for role in ('student','faculty','reviewer','registrar','operator'):
     aid=tenant+'-'+role;d.execute('INSERT INTO actors VALUES (?,?,?,?,?,?)',(aid,tenant,role,'demo-'+aid,1,time.time()+86400))
     if role!='operator':d.execute('INSERT INTO access VALUES (?,?,?)',(tenant,'course',aid))
    d.execute('INSERT INTO students VALUES (?,?,?,?,?,?,?)',(tenant+'-student',tenant,0,1,'unknown',time.time(),1))
 def actor(self,d,token):
  a=d.execute('SELECT * FROM actors WHERE token=?',(token,)).fetchone()
  if not a or not a['active'] or a['expires']<=time.time():raise Rejected('session revoked, expired or invalid')
  return a
 def allowed(self,d,a,course):
  if not d.execute('SELECT 1 FROM access WHERE tenant=? AND course=? AND actor=?',(a['tenant'],course,a['id'])).fetchone():raise Rejected('course object scope denied')
 def student(self,d,a,sid):
  s=d.execute('SELECT * FROM students WHERE tenant=? AND id=?',(a['tenant'],sid)).fetchone()
  if not s:raise Rejected('student not found in permitted tenant')
  if a['role']=='student' and sid!=a['id']:raise Rejected('student object denied')
  return s
 def event(self,d,a,kind,oid,version,payload):
  d.execute('INSERT INTO outbox(id,tenant,kind,object_id,version,payload) VALUES (?,?,?,?,?,?)',(str(uuid.uuid4()),a['tenant'],kind,oid,version,canon(payload)))
 def execute(self,token,command,p,key):
  if not isinstance(p,dict) or not isinstance(key,str) or not key.strip() or len(key)>128:raise Rejected('invalid payload/idempotency key')
  if any(k in p and not isinstance(p[k],str) for k in ('tenant','course','student','grade','approval')):raise Rejected('identifiers must be strings')
  fp=digest({'command':command,'payload':p})
  with self.db() as d:
   d.execute('BEGIN IMMEDIATE');a=self.actor(d,token);tenant=a['tenant'];role=a['role']
   if p.get('tenant',tenant)!=tenant:raise Rejected('cross tenant denied')
   course=p.get('course','course');self.allowed(d,a,course) if role!='operator' else None
   old=d.execute('SELECT * FROM receipts WHERE tenant=? AND actor=? AND key=?',(tenant,a['id'],key)).fetchone()
   if old:
    if old['fingerprint']!=fp:raise Rejected('idempotency payload conflict')
    return json.loads(old['body'])
   oid=p.get('student',a['id']);result={}
   if command=='onboarding.complete':
    if role!='student':raise Rejected('student onboarding only')
    s=self.student(d,a,a['id'])
    if not s['onboarded']:d.execute('UPDATE students SET onboarded=1,version=version+1 WHERE tenant=? AND id=?',(tenant,a['id']))
    oid=a['id'];result={'onboarded':True}
   elif command=='submission.create':
    if role!='student':raise Rejected('student submission only')
    s=self.student(d,a,a['id'])
    if not s['onboarded']:raise Rejected('onboarding required')
    if d.execute("SELECT 1 FROM grades WHERE tenant=? AND course=? AND student=? AND state='released'",(tenant,course,a['id'])).fetchone():raise Rejected('grade already released; submissions are closed')
    body=p.get('body')
    if not isinstance(body,str) or not body.strip() or len(body)>4000:raise Rejected('submission body required, max 4000')
    oid=str(uuid.uuid4());d.execute('INSERT INTO submissions VALUES (?,?,?,?,?,?)',(oid,tenant,course,a['id'],body,time.time()));result={'submission':oid,'state':'submitted'}
    self.event(d,a,'submission',oid,1,{'student':a['id'],'course':course,'state':'submitted'})
   elif command=='grade.draft':
    if role!='faculty':raise Rejected('faculty only')
    s=self.student(d,a,p.get('student',''))
    if not s['onboarded']:raise Rejected('student onboarding required')
    if not d.execute('SELECT 1 FROM submissions WHERE tenant=? AND course=? AND student=?',(tenant,course,s['id'])).fetchone():raise Rejected('submission required')
    score=p.get('score')
    if isinstance(score,bool) or not isinstance(score,(float,int)) or not 0<=score<=100:raise Rejected('score must be 0 to 100')
    oid=grade_id(tenant,course,s['id']);g=d.execute('SELECT * FROM grades WHERE id=? AND tenant=?',(oid,tenant)).fetchone();version=g['version'] if g else 0
    if p.get('version')!=version:raise Rejected('grade version conflict')
    if g and g['state']=='released':raise Rejected('released grade needs separate correction workflow')
    d.execute('INSERT INTO grades VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET score=excluded.score,version=excluded.version,submission_id=excluded.submission_id',(oid,tenant,course,s['id'],score,'draft',version+1,self.latest_submission(d,tenant,course,s['id'])));result={'grade':oid,'version':version+1,'state':'draft'}
   elif command in ('grade.request_release','hold.request_clear'):
    kind='grade' if command.startswith('grade') else 'hold'
    if role!=('faculty' if kind=='grade' else 'registrar'):raise Rejected('requester role denied')
    if kind=='grade':
     oid=p.get('grade','');g=d.execute('SELECT * FROM grades WHERE id=? AND tenant=? AND course=?',(oid,tenant,course)).fetchone()
     if not g or g['state']!='draft' or p.get('version')!=g['version']:raise Rejected('grade absent or stale')
     if g['submission_id']!=self.latest_submission(d,tenant,course,g['student']):raise Rejected('grade drafted against a superseded submission; draft again')
     binding=digest(dict(g))
    else:
     s=self.student(d,a,p.get('student',''));oid=s['id']
     if not s['onboarded'] or not s['hold'] or p.get('version')!=s['version']:raise Rejected('hold request absent or stale')
     binding=digest(dict(s))
    reason=p.get('reason')
    if not isinstance(reason,str) or not reason.strip():raise Rejected('reason required')
    approval=str(uuid.uuid4());d.execute('INSERT INTO approvals VALUES (?,?,?,?,?,?,?,?,?)',(approval,tenant,kind,oid,a['id'],binding,time.time()+900,'pending',reason));result={'approval':approval,'kind':kind,'state':'pending','reason':reason}
   elif command in ('grade.approve_release','hold.approve_clear'):
    if role!='reviewer':raise Rejected('independent reviewer only')
    approval=d.execute('SELECT * FROM approvals WHERE id=? AND tenant=?',(p.get('approval',''),tenant)).fetchone();kind='grade' if command.startswith('grade') else 'hold'
    if not approval or approval['kind']!=kind or approval['state']!='pending' or approval['expires']<=time.time():raise Rejected('approval missing, expired or decided')
    if approval['requester']==a['id']:raise Rejected('self approval denied')
    oid=approval['object_id'];obj=d.execute('SELECT * FROM grades WHERE id=? AND tenant=? AND course=?',(oid,tenant,course)).fetchone() if kind=='grade' else self.student(d,a,oid)
    if not obj or digest(dict(obj))!=approval['binding'] or (kind=='grade' and obj['submission_id']!=self.latest_submission(d,tenant,course,obj['student'])):raise Rejected('approval binding changed; request again')
    version=obj['version']+1
    if kind=='grade':
     d.execute("UPDATE grades SET state='released',version=? WHERE id=? AND tenant=?",(version,oid,tenant));payload={'student':obj['student'],'course':course,'score':obj['score'],'state':'released'}
    else:
     d.execute('UPDATE students SET hold=0,version=? WHERE id=? AND tenant=?',(version,oid,tenant));payload={'student':oid,'hold':False}
    d.execute("UPDATE approvals SET state='approved' WHERE id=? AND tenant=?",(approval['id'],tenant));self.event(d,a,kind,oid,version,payload);result={'object':oid,'version':version,'state':'confirmed','projection':'updating'}
   elif command=='source.confirm_prerequisite':
    if role!='registrar':raise Rejected('registrar source adapter simulation only')
    s=self.student(d,a,p.get('student',''));oid=s['id']
    if p.get('version')!=s['version']:raise Rejected('student version conflict')
    d.execute("UPDATE students SET prerequisite='confirmed',source_at=?,version=version+1 WHERE tenant=? AND id=?",(time.time(),tenant,oid));result={'source':'synthetic-confirmed','version':s['version']+1}
   else:raise Rejected('command not implemented')
   rid=str(uuid.uuid4());receipt={'id':rid,'tenant':tenant,'command':command,'object':oid,'label':'local synthetic receipt; no institutional authority',**result}
   d.execute('INSERT INTO receipts VALUES (?,?,?,?,?,?)',(rid,tenant,a['id'],key,fp,canon(receipt)))
   d.execute('INSERT INTO audit(tenant,actor,command,object_id,receipt,created) VALUES (?,?,?,?,?,?)',(tenant,a['id'],command,oid,rid,time.time()))
   return receipt
 def approval_current(self,d,tenant,r):
  # An approval is actionable only while the object it names still matches the binding recorded at request time.
  if r['kind']=='grade':
   g=d.execute('SELECT * FROM grades WHERE id=? AND tenant=?',(r['object_id'],tenant)).fetchone()
   return bool(g) and digest(dict(g))==r['binding'] and g['submission_id']==self.latest_submission(d,tenant,g['course'],g['student'])
  s=d.execute('SELECT * FROM students WHERE id=? AND tenant=?',(r['object_id'],tenant)).fetchone()
  return bool(s) and digest(dict(s))==r['binding']
 def latest_submission(self,d,tenant,course,student):
  sub=d.execute('SELECT id FROM submissions WHERE tenant=? AND course=? AND student=? ORDER BY created DESC LIMIT 1',(tenant,course,student)).fetchone()
  return sub['id'] if sub else None
 def project(self,token):
  with self.db() as d:
   d.execute('BEGIN IMMEDIATE');a=self.actor(d,token)
   if a['role']!='operator':raise Rejected('operator worker only')
   events=d.execute('SELECT * FROM outbox WHERE tenant=? AND projected=0 ORDER BY seq',(a['tenant'],)).fetchall()
   for e in events:
    old=d.execute('SELECT version FROM projection WHERE tenant=? AND kind=? AND object_id=?',(e['tenant'],e['kind'],e['object_id'])).fetchone()
    if not old or old['version']<e['version']:
     d.execute('INSERT INTO projection VALUES (?,?,?,?,?) ON CONFLICT(tenant,kind,object_id) DO UPDATE SET version=excluded.version,payload=excluded.payload',(e['tenant'],e['kind'],e['object_id'],e['version'],e['payload']))
    d.execute('UPDATE outbox SET projected=1 WHERE id=?',(e['id'],))
   return {'events_processed':len(events),'tenant':a['tenant']}
 def view(self,token):
  with self.db() as d:
   a=self.actor(d,token);t=a['tenant'];role=a['role'];out={'actor':a['id'],'tenant':t,'role':role,'label':'synthetic local lab; not official records'}
   if role=='operator':
    out['health']={'pending_events':d.execute('SELECT count(*) FROM outbox WHERE tenant=? AND projected=0',(t,)).fetchone()[0]};return out
   # Workspace data follows the actor's own course grants, not a fixed seed course.
   courses=[r['course'] for r in d.execute('SELECT course FROM access WHERE tenant=? AND actor=?',(t,a['id'])).fetchall()]
   if not courses:raise Rejected('course object scope denied')
   marks=','.join('?'*len(courses));grading=role in ('faculty','reviewer')
   if role=='student':
    s=self.student(d,a,a['id']);fresh=time.time()-s['source_at']<=300
    readiness='blocked' if s['hold'] else 'unknown' if s['prerequisite']!='confirmed' else 'stale' if not fresh else 'ready_as_of'
    # Only grades from courses the student is still granted; a revoked course's released score stays out of the view.
    grades=[g for g in (json.loads(r['payload']) for r in d.execute("SELECT payload FROM projection WHERE tenant=? AND kind='grade'",(t,))) if g.get('student')==a['id'] and g.get('course') in courses]
    out.update(student=dict(s),readiness=readiness,grades=grades);return out
   # Grade records go only to grading roles; a registrar sees holds and prerequisites, not scores.
   out['grades']=[dict(r) for r in d.execute(f'SELECT * FROM grades WHERE tenant=? AND course IN ({marks})',(t,*courses))] if grading else []
   # Pending and unexpired only; faculty see grade approvals and registrars see hold approvals, reviewers see both.
   kind={'faculty':'grade','registrar':'hold'}.get(role)
   sql="SELECT id,kind,object_id,requester,expires,state,reason FROM approvals WHERE tenant=? AND state='pending' AND expires>?"+(" AND kind=?" if kind else '')
   rows=[dict(r) for r in d.execute(sql.replace('state,reason','state,reason,binding'),(t,time.time())+((kind,) if kind else ()))]
   # A grade approval is listed only to an actor granted the grade's course; the tenant alone is not enough.
   def granted(r):
    if r['kind']!='grade':return True
    g=d.execute('SELECT course FROM grades WHERE id=? AND tenant=?',(r['object_id'],t)).fetchone()
    return bool(g) and d.execute('SELECT 1 FROM access WHERE tenant=? AND course=? AND actor=?',(t,g['course'],a['id'])).fetchone() is not None
   out['approvals']=[{k:v for k,v in r.items() if k!='binding'} for r in rows if self.approval_current(d,t,r) and granted(r)]
   if role=='faculty':out['submissions']=[dict(r) for r in d.execute(f'SELECT id,course,student,body,created FROM submissions WHERE tenant=? AND course IN ({marks})',(t,*courses))]
   # Registrars get the full student rows for hold and prerequisite work. Grading roles get only the students with work in their courses, and no registrar-only fields.
   if role=='registrar':out['students']=[dict(r) for r in d.execute('SELECT * FROM students WHERE tenant=?',(t,))]
   elif grading:out['students']=[dict(r) for r in d.execute(f'SELECT id,onboarded FROM students WHERE tenant=? AND id IN (SELECT student FROM submissions WHERE tenant=? AND course IN ({marks}))',(t,t,*courses))]
   else:out['students']=[]
   return out
