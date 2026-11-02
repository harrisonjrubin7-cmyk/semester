"""Reference domain implementation. Caller identities are trusted: no authentication."""
import json
from migrate import migrate,connect
class CourseStudio:
 def __init__(self,path):self.path=path;migrate(path)
 def seed_demo(self):
  with connect(self.path) as c:
   for t in ['demo-a','demo-b']:
    c.execute('INSERT OR IGNORE INTO tenants VALUES (?,?)',(t,t))
    for u,r in [('teacher','faculty'),('student','student'),('viewer','viewer')]:c.execute('INSERT OR IGNORE INTO memberships VALUES (?,?,?)',(t,u,r))
 def _role(self,c,tenant,user):
  row=c.execute('SELECT role FROM memberships WHERE tenant_id=? AND user_id=?',(tenant,user)).fetchone()
  if not row:raise PermissionError('No workspace membership')
  return row[0]
 def _course(self,c,tenant,course):
  c.row_factory=__import__('sqlite3').Row
  row=c.execute('SELECT * FROM courses WHERE tenant_id=? AND id=?',(tenant,course)).fetchone()
  if row is None:raise LookupError('Course unavailable in this context')
  return dict(row)
 def _validate(self,title,assignment,ai_policy):
  for x in [title,assignment,ai_policy]:
   if not isinstance(x,str) or not 1<=len(x.strip())<=2000:raise ValueError('Required text, max 2000 characters')
 def create(self,tenant,user,course,title,assignment,ai_policy):
  self._validate(title,assignment,ai_policy)
  with connect(self.path) as c:
   c.execute('BEGIN IMMEDIATE')
   if self._role(c,tenant,user)!='faculty':raise PermissionError('Faculty capability required')
   c.execute('INSERT INTO courses(tenant_id,id,owner_id,title,assignment,ai_policy) VALUES (?,?,?,?,?,?)',(tenant,course,user,title.strip(),assignment.strip(),ai_policy.strip()))
   c.execute('INSERT INTO audit(tenant_id,user_id,action,course_id) VALUES (?,?,?,?)',(tenant,user,'course.create',course))
 def read(self,tenant,user,course):
  with connect(self.path) as c:
   role=self._role(c,tenant,user);v=self._course(c,tenant,course)
   if role!='faculty':
    row=c.execute('SELECT content_json FROM publications WHERE tenant_id=? AND course_id=? ORDER BY version DESC LIMIT 1',(tenant,course)).fetchone()
    if row is None:raise PermissionError('No published course')
    return json.loads(row[0])
   return v
 def save(self,tenant,user,course,expected_version,title,assignment,ai_policy):
  self._validate(title,assignment,ai_policy)
  with connect(self.path) as c:
   c.execute('BEGIN IMMEDIATE');role=self._role(c,tenant,user);v=self._course(c,tenant,course)
   if role!='faculty' or v['owner_id']!=user:raise PermissionError('Course owner required')
   if v['version']!=expected_version:raise ValueError('Version conflict')
   c.execute("UPDATE courses SET title=?,assignment=?,ai_policy=?,status='draft',version=version+1 WHERE tenant_id=? AND id=?",(title.strip(),assignment.strip(),ai_policy.strip(),tenant,course))
   c.execute('INSERT INTO audit(tenant_id,user_id,action,course_id) VALUES (?,?,?,?)',(tenant,user,'course.save',course))
 def publish(self,tenant,user,course,expected_version):
  with connect(self.path) as c:
   c.execute('BEGIN IMMEDIATE');role=self._role(c,tenant,user);v=self._course(c,tenant,course)
   if role!='faculty' or v['owner_id']!=user:raise PermissionError('Course owner required')
   if v['version']!=expected_version:raise ValueError('Version conflict')
   if v['status']!='draft':raise ValueError('Only drafts can publish')
   v['status']='published';v['version']+=1
   c.execute('INSERT INTO publications(tenant_id,course_id,version,content_json) VALUES (?,?,?,?)',(tenant,course,v['version'],json.dumps(v)))
   c.execute("UPDATE courses SET status='published',version=? WHERE tenant_id=? AND id=?",(v['version'],tenant,course))
   c.execute('INSERT INTO audit(tenant_id,user_id,action,course_id) VALUES (?,?,?,?)',(tenant,user,'course.publish',course))
   return v
