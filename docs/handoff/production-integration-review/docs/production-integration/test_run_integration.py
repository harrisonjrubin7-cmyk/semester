import unittest,tempfile,os,subprocess
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from run_integration import local_url,plan,execute
class RunnerTests(unittest.TestCase):
 def test_public_rejected(self):
  with self.assertRaises(ValueError):local_url('https://semester.example/')
 def test_credentials_rejected(self):
  with self.assertRaises(ValueError):local_url('http://user:pass@localhost:4173')
 def test_query_rejected(self):
  with self.assertRaises(ValueError):local_url('http://localhost:4173/?token=x')
 def test_loopback(self):self.assertEqual(local_url('http://127.0.0.1:4173'),'http://127.0.0.1:4173/')
 def test_missing_account_url(self):
  with self.assertRaises(ValueError):plan('personal-account','http://localhost:4173')
 def test_baseline(self):self.assertEqual(len(plan('personal-baseline','http://localhost:4173')),3)
 def test_account_plan(self):self.assertEqual(len(plan('personal-account','http://localhost:4173','http://localhost:4174')),4)
 def test_missing_key(self):
  with patch.dict(os.environ,{},clear=True):
   with self.assertRaises(ValueError):execute('.', 'personal-account','http://localhost:4173','http://localhost:4174')
 def invoke(self,code):
  with tempfile.TemporaryDirectory() as d:
   app=Path(d)/'app';app.mkdir();(app/'package.json').write_text('{}')
   return execute(d,'personal-baseline','http://localhost:4173',run=lambda *a,**k:SimpleNamespace(returncode=code))
 def test_pass_does_not_claim_production(self):
  r=self.invoke(0);self.assertTrue(r['scope_passed']);self.assertFalse(r['production_ready'])
 def test_failure(self):self.assertFalse(self.invoke(1)['scope_passed'])
 def test_unavailable(self):self.assertTrue(all(x['status']=='unavailable' for x in self.invoke(2)['results']))
 def test_timeout(self):
  with tempfile.TemporaryDirectory() as d:
   app=Path(d)/'app';app.mkdir();(app/'package.json').write_text('{}')
   def timeout(*a,**k):raise subprocess.TimeoutExpired('npm',900)
   r=execute(d,'personal-baseline','http://localhost:4173',run=timeout)
   self.assertFalse(r['scope_passed']);self.assertEqual(r['results'][0]['status'],'unavailable')
if __name__=='__main__':unittest.main()
