import unittest
from dataclasses import replace
from datetime import datetime, timezone, timedelta
from evidence_gate import Target, Evidence, evaluate

class GateTests(unittest.TestCase):
    def test_cases(self):
        now = datetime(2026,10,11,tzinfo=timezone.utc)
        t = Target('sha','deploy','config','schema','tenant-a:cohort-1','registration.submit')
        e = Evidence('security',t,True,True,now-timedelta(hours=1),now+timedelta(hours=1),'private-report','assessor')
        self.assertTrue(evaluate(t,['security'],[e],now)['allowed'])
        invalid = [[], [e,e], [replace(e,withdrawn=True)], [replace(e,accepted=False)],
                   [replace(e,passed=False)], [replace(e,expires_at=now)],
                   [replace(e,issued_at=now+timedelta(seconds=1))], [replace(e,approver='')],
                   [replace(e,expires_at=datetime(2026,10,12))]]
        for records in invalid:
            with self.subTest(records=records):
                self.assertFalse(evaluate(t,['security'],records,now)['allowed'])
        for field in ('sha','deployment','config','schema','scope','operation'):
            self.assertFalse(evaluate(replace(t,**{field:'other'}),['security'],[e],now)['allowed'])
        self.assertFalse(evaluate(t,['security'],[e],now,True)['allowed'])
        self.assertFalse(evaluate(t,[],[],now)['allowed'])
        self.assertFalse(evaluate(replace(t,deployment=''),['security'],[e],now)['allowed'])

if __name__ == '__main__':
    unittest.main()
