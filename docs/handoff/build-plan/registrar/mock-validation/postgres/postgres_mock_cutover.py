import os,json,argparse
from urllib.parse import urlparse
from pathlib import Path
import psycopg

def run():
    parser=argparse.ArgumentParser();parser.add_argument('--report',default='postgres-mock-report.json');a=parser.parse_args()
    dsn=os.environ['MOCK_DATABASE_URL'];u=urlparse(dsn)
    if u.hostname not in ('localhost','127.0.0.1','::1') or not (u.path or '').startswith('/semester_mock_'):
        raise SystemExit('Refusing non-local or non-mock target')
    sql=Path(__file__).with_name('postgres_mock_guard.sql').read_text()
    checks=[]
    with psycopg.connect(dsn,autocommit=True) as c:
        if c.execute("SELECT to_regnamespace('cutover_test')").fetchone()[0] is not None:
            raise SystemExit('Use a fresh mock database; existing schema not overwritten')
        c.execute(sql)
        with c.transaction():
            c.execute("INSERT INTO cutover_test.mock_legacy VALUES ('e1','s1','c1','enrolled',1)")
            c.execute("INSERT INTO cutover_test.candidate SELECT * FROM cutover_test.mock_legacy")
            c.execute("INSERT INTO cutover_test.control(scope,writer) VALUES ('enrollment','semester')")
        match=c.execute('SELECT count(*) FROM ((SELECT * FROM cutover_test.mock_legacy EXCEPT SELECT * FROM cutover_test.candidate) UNION ALL (SELECT * FROM cutover_test.candidate EXCEPT SELECT * FROM cutover_test.mock_legacy)) d').fetchone()[0]
        checks.append({'case':'baseline exact reconciliation','passed':match==0})
        decision=c.execute("SELECT cutover_test.guard('enrollment',1,false,false)").fetchone()[0]
        checks.append({'case':'precommit return trigger','passed':decision=='return_to_legacy_candidate'})
        with c.transaction():
            c.execute("UPDATE cutover_test.control SET writer='semester',native_commits=1")
            c.execute("INSERT INTO cutover_test.candidate VALUES ('e2','s2','c1','enrolled',1)")
        decision=c.execute("SELECT cutover_test.guard('enrollment',1,false,false)").fetchone()[0]
        preserved=c.execute('SELECT count(*) FROM cutover_test.candidate').fetchone()[0]==2
        checks.append({'case':'postcommit hold preserves writes','passed':decision=='hold_preserve_writes' and preserved})
    Path(a.report).write_text(json.dumps({'checks':checks,'limitations':'No live HTTP, concurrent writer or production IAM tests'},indent=2))
    raise SystemExit(0 if all(x['passed'] for x in checks) else 1)
if __name__=='__main__':run()
