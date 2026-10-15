import unittest
from datetime import datetime, timezone, timedelta
from dataclasses import replace
from evidence_gate import Target, Evidence, evaluate

class EvidenceGateTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026,10,11,tzinfo=timezone.utc)
        self.target = Target('sha','deployment','config','schema','tenant-a:cohort','registration.submit')
        self.record = Evidence('security',self.target,True,True,self.now-timedelta(hours=1),self.now+timedelta(hours=1),'report-id','reviewer')
    def decision(self, records=None, target=None, required=None, killed=False):
        return evaluate(target or self.target, ['security'] if required is None else required, [self.record] if records is None else records,self.now,killed)['allowed']
    def test_valid(self): self.assertTrue(self.decision())
    def test_missing(self): self.assertFalse(self.decision(records=[]))
    def test_killed(self): self.assertFalse(self.decision(killed=True))
    def test_withdrawn(self): self.assertFalse(self.decision(records=[replace(self.record,withdrawn=True)]))
    def test_expired(self): self.assertFalse(self.decision(records=[replace(self.record,expires_at=self.now)]))
    def test_future(self): self.assertFalse(self.decision(records=[replace(self.record,issued_at=self.now+timedelta(seconds=1))]))
    def test_unaccepted(self): self.assertFalse(self.decision(records=[replace(self.record,accepted=False)]))
    def test_failed(self): self.assertFalse(self.decision(records=[replace(self.record,passed=False)]))
    def test_duplicate(self): self.assertFalse(self.decision(records=[self.record,self.record]))
    def test_empty_contract(self): self.assertFalse(self.decision(required=[]))
    def test_duplicate_contract(self): self.assertFalse(self.decision(required=['security','security']))
    def test_no_reviewer(self): self.assertFalse(self.decision(records=[replace(self.record,approver='')]))
    def test_no_reference(self): self.assertFalse(self.decision(records=[replace(self.record,evidence_ref='')]))
    def test_naive_time(self): self.assertFalse(self.decision(records=[replace(self.record,expires_at=datetime(2026,10,12))]))
    def test_unresolved(self): self.assertFalse(self.decision(target=replace(self.target,deployment='')))
    def test_mismatch_sha(self): self.assertFalse(self.decision(target=replace(self.target,sha='other')))
    def test_mismatch_deployment(self): self.assertFalse(self.decision(target=replace(self.target,deployment='other')))
    def test_mismatch_config(self): self.assertFalse(self.decision(target=replace(self.target,config='other')))
    def test_mismatch_schema(self): self.assertFalse(self.decision(target=replace(self.target,schema='other')))
    def test_mismatch_scope(self): self.assertFalse(self.decision(target=replace(self.target,scope='other')))
    def test_mismatch_operation(self): self.assertFalse(self.decision(target=replace(self.target,operation='other')))

if __name__ == '__main__': unittest.main()
