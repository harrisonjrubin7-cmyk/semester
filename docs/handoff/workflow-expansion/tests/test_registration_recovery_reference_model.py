import unittest
from concurrent.futures import ThreadPoolExecutor
from registration_recovery_reference_model import RegistrationModel, WorkerReferenceModel

class RecoveryTests(unittest.TestCase):
    def submit(self, m, context=None, fault=None, key='k', payload=None, actor='u'):
        return m.submit(actor, 'tenant-a', key, payload or {'section': 's1'}, context, fault)

    def test_REG_01_identity_tenant(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'identity_ok': False})['state'], 'denied')
        self.assertEqual(self.submit(m, {'permission_ok': False})['state'], 'denied')
        self.assertFalse(m.authoritative)

    def test_REG_02_stale_authority(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'fresh': False})['state'], 'awaiting_information')
        self.assertEqual(self.submit(m, {'authority_ok': False})['state'], 'paused')
        self.assertFalse(m.authoritative)

    def test_REG_03_window_ticket(self):
        m = RegistrationModel()
        for field in ['window_open', 'ticket_open']:
            self.assertEqual(self.submit(m, {field: False})['state'], 'denied')
        self.assertFalse(m.authoritative)

    def test_REG_04_hold(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'hold': True, 'local_task_completed': True})['state'], 'awaiting_information')
        self.assertFalse(m.authoritative)
        self.assertEqual(self.submit(m, {'hold': False})['state'], 'committed')

    def test_REG_05_eligibility_override(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'eligible': False})['state'], 'awaiting_approval')
        self.assertEqual(self.submit(m, {'eligible': False, 'scoped_override': True})['state'], 'committed')

    def test_REG_06_capacity_race(self):
        m = RegistrationModel(capacity=1)
        with ThreadPoolExecutor(max_workers=2) as ex:
            results = list(ex.map(lambda u: self.submit(m, actor=u, key=u), ['u1', 'u2']))
        self.assertEqual(sorted(r['state'] for r in results), ['committed', 'waitlisted'])
        self.assertEqual(len(m.authoritative), 1)

    def test_REG_07_replay(self):
        m = RegistrationModel()
        first = self.submit(m)
        again = self.submit(m)
        self.assertEqual(first['receipt'], again['receipt'])
        self.assertEqual(len(m.authoritative), 1)

    def test_REG_08_payload_conflict(self):
        m = RegistrationModel()
        self.submit(m)
        self.assertEqual(self.submit(m, payload={'section': 's2'})['state'], 'conflict')
        self.assertEqual(len(m.authoritative), 1)

    def test_REG_09_timeout_after(self):
        m = RegistrationModel()
        r = self.submit(m, fault='timeout_after')
        self.assertEqual(r['state'], 'result_unknown')
        self.assertEqual(m.reconcile(r['key'])['state'], 'committed')
        self.assertEqual(self.submit(m)['state'], 'committed')
        self.assertEqual(len(m.authoritative), 1)

    def test_REG_09_timeout_before_and_inconclusive(self):
        m = RegistrationModel()
        r = self.submit(m, fault='timeout_before')
        self.assertEqual(m.reconcile(r['key'], definitive=False)['state'], 'result_unknown')
        self.assertEqual(m.reconcile(r['key'], definitive=True)['state'], 'failed')
        self.assertFalse(m.authoritative)

    def test_REG_10_projection_repair(self):
        m = RegistrationModel()
        r = self.submit(m, fault='projection_fail')
        self.assertEqual(r['state'], 'committed')
        self.assertEqual(r['projection'], 'pending')
        self.assertEqual(m.repair_projection(r['key'])['projection'], 'complete')
        self.assertEqual(len(m.authoritative), 1)

    def test_REG_11_precommit(self):
        m = RegistrationModel()
        failed = self.submit(m, fault='precommit')
        self.assertTrue(failed['confirmed_no_commit'])
        self.assertFalse(m.authoritative)
        self.assertEqual(self.submit(m)['state'], 'committed')

    def test_REG_12_expiry_and_revocation(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'override_expired': True})['state'], 'awaiting_approval')
        self.assertEqual(self.submit(m, {'permission_ok': False})['state'], 'denied')
        self.assertFalse(m.authoritative)

    def test_REG_13_offer_expiry(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'offer_expired': True})['state'], 'waitlisted')
        self.assertFalse(m.authoritative)

    def test_REG_14_swap_failure(self):
        m = RegistrationModel()
        r = m.swap('original-enrollment', replacement_available=False)
        self.assertTrue(r['original_retained'])
        self.assertEqual(r['state'], 'failed')

    def test_REG_15_correction_history(self):
        m = RegistrationModel()
        r = self.submit(m)
        original = dict(m.commands[r['key']])
        self.assertEqual(m.correct(r['key'], approved=False)['state'], 'correction_pending')
        self.assertFalse(m.corrections)
        self.assertEqual(m.correct(r['key'], approved=True)['state'], 'corrected')
        self.assertEqual(m.commands[r['key']], original)
        self.assertEqual(len(m.corrections), 1)

    def test_REG_16_financial_separation(self):
        m = RegistrationModel()
        r = m.withdrawal(financial_ok=False)
        self.assertEqual(r['academic'], 'withdrawn')
        self.assertEqual(r['financial'], 'owned_exception')

    def test_REG_17_authority_drift(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'authority_ok': False})['state'], 'paused')
        self.assertFalse(m.authoritative)

    def test_scoped_same_key_not_shared(self):
        m = RegistrationModel(capacity=2)
        a = m.submit('u1', 'tenant-a', 'same-key', {'section': 's1'})
        b = m.submit('u2', 'tenant-b', 'same-key', {'section': 's1'})
        self.assertNotEqual(a['key'], b['key'])
        self.assertEqual(len(m.authoritative), 2)

class WorkerTests(unittest.TestCase):
    def test_duplicate_delivery_one_effect(self):
        w = WorkerReferenceModel(); token = w.claim()
        self.assertEqual(w.apply('e1', token), 'committed')
        self.assertEqual(w.apply('e1', token), 'duplicate')
        self.assertEqual(w.effects, 1)

    def test_stale_lease_cannot_commit(self):
        w = WorkerReferenceModel(); stale = w.claim(); fresh = w.claim()
        self.assertEqual(w.apply('e1', stale), 'stale_lease')
        self.assertEqual(w.apply('e1', fresh), 'committed')
        self.assertEqual(w.effects, 1)

    def test_revoked_grant_no_effect(self):
        w = WorkerReferenceModel(); token = w.claim()
        self.assertEqual(w.apply('e1', token, approved=False), 'denied')
        self.assertEqual(w.effects, 0)
        self.assertFalse(w.receipts)

    def test_REG_07b_replay_after_source_goes_stale(self):
        m = RegistrationModel()
        first = m.submit('a', 't', 'k' * 16, {'section': 'S1'})
        self.assertEqual(first['state'], 'committed')
        again = m.submit('a', 't', 'k' * 16, {'section': 'S1'}, context={'fresh': False, 'authority_ok': False})
        self.assertEqual(again['state'], 'committed')
        self.assertEqual(again['receipt'], first['receipt'])
        self.assertEqual(len(m.authoritative), 1)

    def test_REG_07c_replay_still_requires_identity(self):
        m = RegistrationModel()
        m.submit('a', 't', 'k' * 16, {'section': 'S1'})
        denied = m.submit('a', 't', 'k' * 16, {'section': 'S1'}, context={'identity_ok': False})
        self.assertEqual(denied['state'], 'denied')
        self.assertNotIn('receipt', denied)

if __name__ == '__main__':
    unittest.main()
