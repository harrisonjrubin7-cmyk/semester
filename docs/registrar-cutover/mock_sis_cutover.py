import sqlite3, json, hashlib, argparse, time
from pathlib import Path

def database():
    c=sqlite3.connect(':memory:')
    c.execute('PRAGMA foreign_keys=ON')
    c.executescript('CREATE TABLE control(id INTEGER PRIMARY KEY CHECK(id=1),writer TEXT NOT NULL,epoch INTEGER NOT NULL,pnr INTEGER NOT NULL DEFAULT 0); INSERT INTO control VALUES(1,"legacy",1,0); CREATE TABLE legacy(id TEXT PRIMARY KEY,student TEXT NOT NULL,section TEXT NOT NULL,status TEXT NOT NULL,rev INTEGER NOT NULL); CREATE TABLE target(id TEXT PRIMARY KEY,student TEXT NOT NULL,section TEXT NOT NULL,status TEXT NOT NULL,rev INTEGER NOT NULL,source TEXT NOT NULL DEFAULT "legacy"); CREATE TABLE operations(k TEXT PRIMARY KEY,digest TEXT NOT NULL,state TEXT NOT NULL);')
    c.executemany('INSERT INTO legacy VALUES(?,?,?,?,?)',[('e1','s1','c1','enrolled',1),('e2','s2','c1','enrolled',1)])
    c.commit()
    return c

def sync(c):
    with c:
        for r in c.execute('SELECT * FROM legacy').fetchall():
            old=c.execute('SELECT rev,source FROM target WHERE id=?',(r[0],)).fetchone()
            if old and old[1]!='legacy': raise RuntimeError('native record cannot be overwritten')
            c.execute('INSERT INTO target(id,student,section,status,rev) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET student=excluded.student,section=excluded.section,status=excluded.status,rev=excluded.rev WHERE excluded.rev>target.rev',r)

def discrepancies(c):
    a=c.execute('SELECT id,student,section,status,rev FROM legacy ORDER BY id').fetchall()
    b=c.execute('SELECT id,student,section,status,rev FROM target WHERE source="legacy" ORDER BY id').fetchall()
    return 0 if a==b else 1

def rollback(c):
    with c:
        if c.execute('SELECT pnr FROM control').fetchone()[0]:
            c.execute('UPDATE control SET writer="held",epoch=epoch+1')
            return 'held_preserve_writes'
        c.execute('UPDATE control SET writer="legacy",epoch=epoch+1')
        return 'returned_to_legacy'

def cutover(c):
    if discrepancies(c): return rollback(c)
    with c: c.execute('UPDATE control SET writer="semester",epoch=epoch+1')
    return 'semester'

def write(c,writer,epoch,row):
    with c:
        owner,current=c.execute('SELECT writer,epoch FROM control').fetchone()
        if owner!=writer or current!=epoch: raise PermissionError('writer fenced')
        if writer=='semester':
            c.execute('INSERT INTO target VALUES(?,?,?,?,?,"native")',row)
            c.execute('UPDATE control SET pnr=1')
        else: c.execute('INSERT INTO legacy VALUES(?,?,?,?,?)',row)

def command(c,token,payload,key,timeout_after=False):
    if token.get('expires',0)<=time.time(): return 401
    if token.get('tenant')!='mock-school' or not token.get('allowed'): return 403
    if set(payload)-{'operation','sectionIds','fromEnrollmentIds','expectedScheduleVersion'}: return 422
    kind=payload.get('operation'); to=payload.get('sectionIds',[]); fr=payload.get('fromEnrollmentIds',[])
    if kind not in ['add','drop','swap','withdraw'] or not isinstance(payload.get('expectedScheduleVersion'),int) or isinstance(payload.get('expectedScheduleVersion'),bool): return 422
    if not isinstance(to,list) or not isinstance(fr,list) or any(not isinstance(x,str) for x in to+fr): return 422
    if (kind=='add' and (not to or fr)) or (kind in ['drop','withdraw'] and (not fr or to)) or (kind=='swap' and (not fr or not to)): return 422
    digest=hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()
    old=c.execute('SELECT digest,state FROM operations WHERE k=?',(key,)).fetchone()
    if old: return 200 if old[0]==digest else 409
    with c: c.execute('INSERT INTO operations VALUES(?,?,?)',(key,digest,'reconcile_required' if timeout_after else 'accepted'))
    return 202

def tests():
    results=[]
    def check(name,fn):
        try: fn(); results.append({'case':name,'passed':True})
        except Exception as e: results.append({'case':name,'passed':False,'error':str(e)})
    def migration():
        c=database();sync(c);sync(c);assert discrepancies(c)==0;assert c.execute('SELECT count(*) FROM target').fetchone()[0]==2
    def delta():
        c=database();sync(c)
        with c:c.execute('UPDATE legacy SET status="withdrawn",rev=2 WHERE id="e1"')
        sync(c);assert discrepancies(c)==0
    def mismatch():
        c=database();sync(c)
        with c:c.execute('UPDATE target SET student="wrong" WHERE id="e1"')
        assert cutover(c)=='returned_to_legacy'
    def fencing():
        c=database();sync(c);assert cutover(c)=='semester'
        try:write(c,'legacy',1,('e3','s3','c1','enrolled',1));raise AssertionError('old writer accepted')
        except PermissionError:pass
    def postwrite():
        c=database();sync(c);cutover(c);epoch=c.execute('SELECT epoch FROM control').fetchone()[0]
        write(c,'semester',epoch,('e3','s3','c1','enrolled',1));assert rollback(c)=='held_preserve_writes';assert c.execute('SELECT count(*) FROM target').fetchone()[0]==3
    check('idempotent schema/data sync',migration);check('incremental source revision',delta);check('pre-write mismatch rollback',mismatch);check('old writer fenced',fencing);check('post-write hold preserves native writes',postwrite)
    token={'expires':time.time()+300,'tenant':'mock-school','allowed':True}
    good={'operation':'add','sectionIds':['c1'],'expectedScheduleVersion':1}
    def auth_expiry():assert command(database(),dict(token,expires=0),good,'a')==401
    def wrong_scope():assert command(database(),dict(token,tenant='other'),good,'a')==403
    def bad_payload():assert command(database(),token,dict(good,operation='swap'),'a')==422
    def idempotency():
        c=database();assert command(c,token,good,'a')==202;assert command(c,token,good,'a')==200;assert command(c,token,dict(good,sectionIds=['c2']),'a')==409
    def uncertain():
        c=database();assert command(c,token,good,'a',True)==202;assert c.execute('SELECT state FROM operations').fetchone()[0]=='reconcile_required';assert command(c,token,good,'a')==200;assert c.execute('SELECT count(*) FROM operations').fetchone()[0]==1
    check('expired mock credentials',auth_expiry);check('wrong tenant',wrong_scope);check('invalid swap payload',bad_payload);check('duplicate and conflicting command',idempotency);check('timeout after dispatch never duplicates',uncertain)
    return {'engine':'SQLite in-memory mock; not PostgreSQL or live HTTP','auth':'mock expiry/scope only; no JWT signature verification','cases':results,'passed':sum(r['passed'] for r in results),'total':len(results)}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--report',default='mock-report.json');args=parser.parse_args()
    result=tests();Path(args.report).write_text(json.dumps(result,indent=2));print(json.dumps(result));raise SystemExit(0 if result['passed']==result['total'] else 1)
