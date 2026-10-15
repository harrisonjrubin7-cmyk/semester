import unittest,tempfile,sqlite3
from pathlib import Path
from course_studio import CourseStudio
from migrate import migrate,connect
class CourseTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=Path(self.tmp.name)/'test.sqlite';self.s=CourseStudio(self.db);self.s.seed_demo();self.s.create('demo-a','teacher','c1','Sample','Reflection','Guided')
 def tearDown(self):self.tmp.cleanup()
 def test_create(self):self.assertEqual(self.s.read('demo-a','teacher','c1')['version'],1)
 def test_save(self):
  self.s.save('demo-a','teacher','c1',1,'Revised','Essay','Off');self.assertEqual(self.s.read('demo-a','teacher','c1')['version'],2)
 def test_publish(self):self.assertEqual(self.s.publish('demo-a','teacher','c1',1)['status'],'published')
 def test_stale_save(self):
  self.s.save('demo-a','teacher','c1',1,'Revised','Essay','Off')
  with self.assertRaises(ValueError):self.s.save('demo-a','teacher','c1',1,'Stale','Essay','Off')
 def test_stale_publish(self):
  with self.assertRaises(ValueError):self.s.publish('demo-a','teacher','c1',0)
 def test_repeat_publish(self):
  self.s.publish('demo-a','teacher','c1',1)
  with self.assertRaises(ValueError):self.s.publish('demo-a','teacher','c1',2)
 def test_student_draft_denied(self):
  with self.assertRaises(PermissionError):self.s.read('demo-a','student','c1')
 def test_student_published(self):
  self.s.publish('demo-a','teacher','c1',1);self.assertEqual(self.s.read('demo-a','student','c1')['assignment'],'Reflection')
 def test_student_write_denied(self):
  with self.assertRaises(PermissionError):self.s.save('demo-a','student','c1',1,'X','Y','Z')
 def test_cross_tenant(self):
  with self.assertRaises(LookupError):self.s.read('demo-b','teacher','c1')
 def test_no_membership(self):
  with self.assertRaises(PermissionError):self.s.read('demo-a','stranger','c1')
 def test_atomic_validation(self):
  with self.assertRaises(ValueError):self.s.save('demo-a','teacher','c1',1,'Changed','','Off')
  self.assertEqual(self.s.read('demo-a','teacher','c1')['title'],'Sample')
 def test_snapshot_preserved(self):
  self.s.publish('demo-a','teacher','c1',1);self.s.save('demo-a','teacher','c1',2,'Draft revision','Changed','Off')
  self.assertEqual(self.s.read('demo-a','student','c1')['title'],'Sample')
 def test_snapshot_immutable(self):
  self.s.publish('demo-a','teacher','c1',1)
  with connect(self.db) as c:
   with self.assertRaises(sqlite3.IntegrityError):c.execute("UPDATE publications SET content_json='{}'")
 def test_migration_idempotence(self):
  migrate(self.db);migrate(self.db)
  with connect(self.db) as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM schema_migrations').fetchone()[0],1)
 def test_foreign_keys(self):
  with connect(self.db) as c:
   with self.assertRaises(sqlite3.IntegrityError):c.execute("INSERT INTO memberships VALUES('missing','user','faculty')")
 def test_persistence(self):self.assertEqual(CourseStudio(self.db).read('demo-a','teacher','c1')['title'],'Sample')
 def test_audit(self):
  self.s.publish('demo-a','teacher','c1',1)
  with connect(self.db) as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM audit').fetchone()[0],2)
if __name__=='__main__':unittest.main()
