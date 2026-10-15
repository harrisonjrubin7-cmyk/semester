import sys,json,sqlite3,hashlib
c=sqlite3.connect(sys.argv[1]);c.execute('PRAGMA foreign_keys=ON')
c.executescript("""CREATE TABLE assignments(tenant TEXT,id TEXT,owner TEXT,version TEXT,PRIMARY KEY(tenant,id));
CREATE TABLE grants(tenant TEXT,actor TEXT,record TEXT,active INTEGER,PRIMARY KEY(tenant,actor,record));
CREATE TABLE operations(tenant TEXT,actor TEXT,operation_key TEXT,record TEXT,fingerprint TEXT,receipt TEXT,PRIMARY KEY(tenant,actor,operation_key),FOREIGN KEY(tenant,record) REFERENCES assignments(tenant,id));
CREATE TABLE submissions(tenant TEXT,actor TEXT,record TEXT,text TEXT,operation_key TEXT,PRIMARY KEY(tenant,actor,operation_key),FOREIGN KEY(tenant,record) REFERENCES assignments(tenant,id));
INSERT INTO assignments VALUES('a','x','student','v1');INSERT INTO assignments VALUES('b','x','other','v1');
INSERT INTO grants VALUES('a','student','x',1);""");c.commit()
def allow(p):
 return c.execute('SELECT 1 FROM grants WHERE tenant=? AND actor=? AND record=? AND active=1',(p['tenant'],p['actor'],p['record'])).fetchone() is not None
def process(p):
 op=p['op']
 if op=='grant':
  c.execute('UPDATE grants SET active=? WHERE tenant=? AND actor=? AND record=?',(p['active'],p['tenant'],p['actor'],p['record']));c.commit();return {'ok':True}
 if op=='count':return {'count':c.execute('SELECT COUNT(*) FROM submissions').fetchone()[0]}
 if op=='authorize':return {'allowed':allow(p)}
 if op=='get':
  if not allow(p):return {'error':'denied'}
  r=c.execute('SELECT version FROM assignments WHERE tenant=? AND id=?',(p['tenant'],p['record'])).fetchone();return {'version':r[0]} if r else None
 if op=='lookup':
  if not allow(p):return {'error':'denied'}
  r=c.execute('SELECT fingerprint,receipt,record FROM operations WHERE tenant=? AND actor=? AND operation_key=?',(p['tenant'],p['actor'],p['key'])).fetchone()
  if not r:return None
  if r[0]!=p['fingerprint'] or r[2]!=p['record']:return {'error':'key_conflict'}
  return json.loads(r[1])
 if op=='execute':
  try:
   c.execute('BEGIN IMMEDIATE')
   if not allow(p):c.rollback();return {'error':'denied'}
   r=c.execute('SELECT fingerprint,receipt,record FROM operations WHERE tenant=? AND actor=? AND operation_key=?',(p['tenant'],p['actor'],p['key'])).fetchone()
   if r:
    c.rollback();return json.loads(r[1]) if r[0]==p['fingerprint'] and r[2]==p['record'] else {'error':'key_conflict'}
   v=c.execute('SELECT version FROM assignments WHERE tenant=? AND id=?',(p['tenant'],p['record'])).fetchone()
   if not v or v[0]!=p['version']:c.rollback();return {'error':'stale'}
   c.execute('INSERT INTO submissions VALUES(?,?,?,?,?)',(p['tenant'],p['actor'],p['record'],p['text'],p['key']))
   receipt={'id':p['key'],'status':'completed','message':'Synthetic submission committed','recordedAt':'2026-10-11T00:00:00Z'}
   c.execute('INSERT INTO operations VALUES(?,?,?,?,?,?)',(p['tenant'],p['actor'],p['key'],p['record'],p['fingerprint'],json.dumps(receipt)));c.commit();return receipt
  except Exception:c.rollback();raise
 raise ValueError('unsupported')
for line in sys.stdin:
 try:r=process(json.loads(line));print(json.dumps({'result':r}),flush=True)
 except Exception:print(json.dumps({'error':'mock_backend_failure'}),flush=True)
