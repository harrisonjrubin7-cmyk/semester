import unittest
from tools.extract_source import derive, extract
from pathlib import Path
class SourceTests(unittest.TestCase):
 def test_full_source(self):
  d=extract('source/The-Main-Semester-design-system.html')
  self.assertEqual(len(d['assets']),14)
  self.assertEqual(len(d['capabilities']),122)
  self.assertEqual(len(d['catalog']['tables']),235)
  self.assertEqual(len(d['catalog']['fns']),127)
  self.assertEqual(d['source_sha256'],'98fce65d4f5d1c4c4563d0e8ea20271ddea28b0c968a30e643421a3bf79bbab6')
 def test_dotted_command_not_inferred(self):
  row=['test','ops','Test','','service','event.publish','ctl.outbox','outbox.publish','event','','architecture']
  d=derive([row],dict(tables=[{'fq':'ctl.outbox'}],fns=[]))[0]
  self.assertEqual(d['missing_commands'],['outbox.publish'])
  self.assertEqual(d['implementation_status'],'unknown')
 def test_auth_record_not_implicitly_present(self):
  row=['test','shared','Test','','any','','auth.users','','','','x']
  self.assertEqual(derive([row],dict(tables=[],fns=[]))[0]['missing_records'],['auth.users'])
 def test_exact_function_match(self):
  row=['test','shared','Test','','any','','','api.test','','','x']
  self.assertEqual(derive([row],dict(tables=[],fns=[{'fq':'api.test'}]))[0]['missing_commands'],[])
 def test_duplicate_rejected(self):
  row=['test','shared','Test','','any','','','','','','x']
  with self.assertRaises(ValueError):derive([row,row],dict(tables=[],fns=[]))
 def test_malformed_rejected(self):
  with self.assertRaises(ValueError):derive([['test']],dict(tables=[],fns=[]))
 def test_literal_payload_not_executed(self):
  import ast
  with self.assertRaises(ValueError):ast.literal_eval("__import__('os').system('echo unsafe')")
