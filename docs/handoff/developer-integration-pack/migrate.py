"""Local SQLite only. Not a Supabase or existing-repository migration."""
import sqlite3,hashlib,argparse
from pathlib import Path
def connect(path):
 c=sqlite3.connect(path);c.execute('PRAGMA foreign_keys=ON');return c
def migrate(path):
 sql=Path(__file__).with_name('migrations').joinpath('001_course_studio.sql').read_text()
 digest=hashlib.sha256(sql.encode()).hexdigest()
 with connect(path) as c:
  c.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT DEFAULT CURRENT_TIMESTAMP)')
  row=c.execute('SELECT checksum FROM schema_migrations WHERE version=1').fetchone()
  if row:
   if row[0]!=digest:raise RuntimeError('Checksum changed: write a new migration')
   return
  try:c.executescript("BEGIN IMMEDIATE;\n"+sql+"\nINSERT INTO schema_migrations VALUES(1,'"+digest+"',CURRENT_TIMESTAMP);\nCOMMIT;")
  except Exception:c.rollback();raise
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--database',required=True);p.add_argument('--backup',required=True);a=p.parse_args()
 if Path(a.backup).exists():raise SystemExit('Backup already exists; refusing overwrite')
 if Path(a.database).resolve()==Path(a.backup).resolve():raise SystemExit('Backup must differ from database')
 if Path(a.database).exists():
  with connect(a.database) as src,sqlite3.connect(a.backup) as dst:src.backup(dst)
 migrate(a.database)
 print('Local SQLite migration complete; no remote database contacted')
