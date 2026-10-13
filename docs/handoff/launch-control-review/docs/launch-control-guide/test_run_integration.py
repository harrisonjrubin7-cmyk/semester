import unittest,tempfile,os,subprocess,json
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from run_integration import local_url,plan,execute,child_env,write_report
class Tests(unittest.TestCase):
 def test_public(self):
  with self.assertRaises(ValueError):local_url('https://prod.example')
 def test_credentials(self):
  with self.assertRaises(ValueError):local_url('http://x:y@localhost')
 def test_query(self):
  with self.assertRaises(ValueError):local_url('http://localhost/?secret=x')
 def test_port(self):
  with self.assertRaises(ValueError):local_url('http://localhost:wrong')
 def test_account_preview(self):
  with self.assertRaises(ValueError):plan('personal-account','http://localhost')
 def test_baseline(self):self.assertEqual(len(plan('personal-baseline','http://localhost')),3)
 def test_scopes(self):self.assertEqual(len(plan('personal-account','http://localhost','http://127.0.0.1:4174')),4)
 def test_key_not_forwarded(self):
  with patch.dict(os.environ,{'SMOKE_SUPABASE_SERVICE_KEY':'synthetic-not-a-key'}):self.assertNotIn('SMOKE_SUPABASE_SERVICE_KEY',child_env('smoke:golden','http://localhost'))
 def test_account_key_forwarded(self):
  with patch.dict(os.environ,{'SMOKE_SUPABASE_SERVICE_KEY':'synthetic-not-a-key'}):self.assertIn('SMOKE_SUPABASE_SERVICE_KEY',child_env('smoke:sync','http://localhost'))
 def invoke(self,fn):
  with tempfile.TemporaryDirectory() as d:
   (Path(d)/'app').mkdir();(Path(d)/'app/package.json').write_text('{}');return execute(d,'personal-baseline','http://localhost',run=fn)
 def test_success_not_production(self):
  r=self.invoke(lambda *a,**k:SimpleNamespace(returncode=0));self.assertTrue(r['scope_passed']);self.assertFalse(r['production_ready'])
 def test_assertion(self):self.assertFalse(self.invoke(lambda *a,**k:SimpleNamespace(returncode=1))['scope_passed'])
 def test_unavailable(self):self.assertEqual(self.invoke(lambda *a,**k:SimpleNamespace(returncode=2))['results'][0]['status'],'unavailable')
 def test_launch_error(self):
  def fail(*a,**k):raise FileNotFoundError()
  self.assertEqual(self.invoke(fail)['results'][0]['reason'],'launch_error')
 def test_timeout(self):
  def fail(*a,**k):raise subprocess.TimeoutExpired('npm',900)
  self.assertEqual(self.invoke(fail)['results'][0]['reason'],'timeout')
 def test_report(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'report.json';write_report(p,{'production_ready':False});self.assertFalse(json.loads(p.read_text())['production_ready'])
if __name__=='__main__':unittest.main()
