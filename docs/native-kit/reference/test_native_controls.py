import unittest
from native_controls import Line,validate_journal,ObserveTask,evaluate_checks,CHECK_IDS,action_digest
class Controls(unittest.TestCase):
 def test_all_checks(self):self.assertTrue(evaluate_checks(dict.fromkeys(CHECK_IDS,True))["allowed"])
 def test_missing(self):self.assertFalse(evaluate_checks({})["allowed"])
 def test_string_truth(self):self.assertFalse(evaluate_checks(dict.fromkeys(CHECK_IDS,"true"))["allowed"])
 def test_each_denial(self):
  for k in CHECK_IDS:
   c=dict.fromkeys(CHECK_IDS,True);c[k]=False;self.assertFalse(evaluate_checks(c)["allowed"])
 def test_balanced(self):self.assertTrue(validate_journal([Line("cash",100),Line("AR",credit=100)]))
 def test_unbalanced(self):
  with self.assertRaises(ValueError):validate_journal([Line("cash",100),Line("AR",credit=99)])
 def test_currency(self):
  with self.assertRaises(ValueError):validate_journal([Line("cash",100,currency="USD"),Line("AR",credit=100,currency="EUR")])
 def test_float(self):
  with self.assertRaises(ValueError):validate_journal([Line("cash",1.0),Line("AR",credit=1)])
 def test_negative(self):
  with self.assertRaises(ValueError):validate_journal([Line("cash",-1),Line("AR",credit=1)])
 def test_double(self):
  with self.assertRaises(ValueError):validate_journal([Line("cash",1,1),Line("AR",credit=1)])
 def test_auth(self):
  t=ObserveTask("task","a",[("a","b")])
  with self.assertRaises(ValueError):t.handoff("a","b","p","d")
  with self.assertRaises(ValueError):t.handoff("a","b","p","d","false")
  with self.assertRaises(ValueError):t.handoff("a","b","p","d",1)
  self.assertEqual(t.handoffs,0)
 def test_route(self):
  with self.assertRaises(ValueError):ObserveTask("task","a",[]).handoff("a","b","p","d",True)
 def test_dedupe(self):
  t=ObserveTask("task","a",[("a","b")]);t.handoff("a","b","p","d",True);self.assertEqual(t.handoff("a","b","p","d",True),"deduplicated");self.assertEqual(t.handoffs,1)
 def test_cycle(self):
  t=ObserveTask("task","a",[("a","b"),("b","a")]);t.handoff("a","b","p","d",True)
  with self.assertRaises(ValueError):t.handoff("b","a","p","d2",True)
 def test_total(self):
  t=ObserveTask("task","a",[("a",x) for x in "bcde"])
  for x in "bcd":t.handoff("a",x,"p",x,True)
  with self.assertRaises(ValueError):t.handoff("a","e","p","e",True)
 def test_depth(self):
  t=ObserveTask("task","a",[("a","b"),("b","c"),("c","d"),("d","e")])
  for a,b in [("a","b"),("b","c"),("c","d")]:t.handoff(a,b,"p",b,True)
  with self.assertRaises(ValueError):t.handoff("d","e","p","e",True)
 def test_observe(self):
  with self.assertRaises(PermissionError):ObserveTask("task","a",[]).execute_external_write()
 def test_digest_change(self):self.assertNotEqual(action_digest({"amount":100}),action_digest({"amount":101}))
 def test_digest_order(self):self.assertEqual(action_digest({"a":1,"b":2}),action_digest({"b":2,"a":1}))
if __name__=="__main__":unittest.main()
