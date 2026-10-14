import unittest
from native_controls import Line, validate_journal, ObserveTask, evaluate_checks, CHECK_IDS, action_digest

class Controls(unittest.TestCase):
    def test_all_checks(self): self.assertTrue(evaluate_checks(dict.fromkeys(CHECK_IDS,True))["allowed"])
    def test_missing(self): self.assertFalse(evaluate_checks({})["allowed"])
    def test_string_truth(self): self.assertFalse(evaluate_checks(dict.fromkeys(CHECK_IDS,"true"))["allowed"])
    def test_each_denial(self):
        for key in CHECK_IDS:
            checks=dict.fromkeys(CHECK_IDS,True);checks[key]=False
            self.assertFalse(evaluate_checks(checks)["allowed"])
    def test_balanced(self): self.assertTrue(validate_journal([Line("cash",100),Line("receivable",credit=100)]))
    def test_unbalanced(self):
        with self.assertRaises(ValueError): validate_journal([Line("cash",100),Line("receivable",credit=99)])
    def test_cross_currency(self):
        with self.assertRaises(ValueError): validate_journal([Line("cash",100,currency="USD"),Line("receivable",credit=100,currency="EUR")])
    def test_float(self):
        with self.assertRaises(ValueError): validate_journal([Line("cash",1.0),Line("receivable",credit=1)])
    def test_negative(self):
        with self.assertRaises(ValueError): validate_journal([Line("cash",-1),Line("receivable",credit=1)])
    def test_double_sided(self):
        with self.assertRaises(ValueError): validate_journal([Line("cash",1,1),Line("receivable",credit=1)])
    def test_receiver_auth(self):
        t=ObserveTask("task","a",[("a","b")])
        with self.assertRaises(ValueError): t.handoff("a","b","review","hash")
        self.assertEqual(t.handoffs,0)
    def test_forbidden(self):
        t=ObserveTask("task","a",[])
        with self.assertRaises(ValueError): t.handoff("a","b","review","hash",True)
    def test_dedupe(self):
        t=ObserveTask("task","a",[("a","b")]);t.handoff("a","b","review","hash",True)
        self.assertEqual(t.handoff("a","b","review","hash",True),"deduplicated");self.assertEqual(t.handoffs,1)
    def test_cycle(self):
        t=ObserveTask("task","a",[("a","b"),("b","a")]);t.handoff("a","b","review","hash",True)
        with self.assertRaises(ValueError):t.handoff("b","a","review","hash2",True)
    def test_total_budget(self):
        t=ObserveTask("task","a",[("a",x) for x in "bcde"])
        for x in "bcd":t.handoff("a",x,"review",x,True)
        with self.assertRaises(ValueError):t.handoff("a","e","review","e",True)
    def test_depth(self):
        t=ObserveTask("task","a",[("a","b"),("b","c"),("c","d"),("d","e")])
        for a,b in [("a","b"),("b","c"),("c","d")]:t.handoff(a,b,"review",b,True)
        with self.assertRaises(ValueError):t.handoff("d","e","review","e",True)
    def test_observe(self):
        with self.assertRaises(PermissionError):ObserveTask("task","a",[]).execute_external_write()
    def test_digest_change(self):self.assertNotEqual(action_digest({"amount":100}),action_digest({"amount":101}))
    def test_digest_order(self):self.assertEqual(action_digest({"a":1,"b":2}),action_digest({"b":2,"a":1}))

if __name__ == "__main__":unittest.main()
