import tempfile, unittest
from pathlib import Path
from server import Store
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=Path(self.tmp.name)/'demo.sqlite';self.s=Store(str(self.db))
 def tearDown(self): self.tmp.cleanup()
 def test_persistence(self):
  self.s.command('task.complete',{'id':'a1'});self.assertEqual(Store(str(self.db)).state()['tasks'][0]['status'],'done')
 def test_version_conflict(self):
  v=self.s.state()['course']['version'];self.s.command('course.publish',{'version':v})
  with self.assertRaises(ValueError):self.s.command('course.publish',{'version':v})
 def test_preferences(self):
  self.s.command('privacy.save',{'notifications':True,'location':False,'family_sharing':False});self.assertTrue(self.s.state()['privacy']['notifications'])
 def test_validation(self):
  with self.assertRaises(ValueError):self.s.command('board.save',{'period':'Sample','summary':'Draft','cash':-1,'burn':0,'reserve':0})
 def test_unknown_command(self):
  with self.assertRaises(ValueError):self.s.command('enroll',{})
 def test_audit(self):
  self.s.command('task.complete',{'id':'a1'});self.assertEqual(self.s.state()['audit'][0]['action'],'task.complete')
if __name__=='__main__':unittest.main()
