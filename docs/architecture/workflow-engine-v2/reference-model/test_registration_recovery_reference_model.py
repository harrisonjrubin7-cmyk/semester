import unittest
from concurrent.futures import ThreadPoolExecutor
from registration_recovery_reference_model import RegistrationModel, WorkerReferenceModel

class RecoveryTests(unittest.TestCase):
    def submit(self, m, context=None, fault=None, key='k', payload=None, actor='u'):
        return m.submit(actor, 'tenant-a', key, payload or {'section_ref': 's1'}, context, fault)

    def test_REG_01_identity_tenant(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'identity_ok': False})['state'], 'denied')
        self.assertEqual(self.submit(m, {'permission_ok': False})['state'], 'denied')
        self.assertEqual(m.submit('u1', 'tenant-b', 'k', {'section_ref': 's1'},
                                  {'grant_tenants': ['tenant-a']})['state'], 'denied')
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
        self.assertEqual(self.submit(m, {'hold': False})['state'], 'enrolled')

    def test_REG_05_eligibility_override(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'eligible': False})['state'], 'awaiting_approval')
        self.assertEqual(self.submit(m, {'eligible': False, 'scoped_override': True})['state'], 'enrolled')

    def test_REG_06_capacity_race(self):
        m = RegistrationModel(capacity=1)
        with ThreadPoolExecutor(max_workers=2) as ex:
            results = list(ex.map(lambda u: self.submit(m, actor=u, key=u), ['u1', 'u2']))
        self.assertEqual(sorted(r['state'] for r in results), ['enrolled', 'waitlisted'])
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
        self.assertEqual(self.submit(m, payload={'section_ref': 's2'})['state'], 'conflict')
        self.assertEqual(len(m.authoritative), 1)

    def test_REG_09_timeout_after(self):
        m = RegistrationModel()
        r = self.submit(m, fault='timeout_after')
        self.assertEqual(r['state'], 'result_unknown')
        self.assertNotIn('receipt', r)
        self.assertEqual(m.reconcile(r['key'])['state'], 'enrolled')
        self.assertEqual(m.trail[r['key']], ['reconciling', 'committed'])
        self.assertEqual(self.submit(m)['state'], 'enrolled')
        self.assertEqual(len(m.authoritative), 1)

    def test_REG_09_timeout_before_and_inconclusive(self):
        m = RegistrationModel()
        r = self.submit(m, fault='timeout_before')
        self.assertEqual(m.reconcile(r['key'], definitive=False)['state'], 'result_unknown')
        self.assertEqual(m.reconcile(r['key'], definitive=True)['state'], 'failed')
        self.assertFalse(m.authoritative)
        self.assertEqual(self.submit(m)['state'], 'enrolled')
        self.assertEqual(len(m.authoritative), 1)

    def test_reconcile_requires_result_unknown(self):
        m = RegistrationModel()
        r = self.submit(m)
        self.assertEqual(m.reconcile(r['key'])['state'], 'enrolled')
        self.assertNotIn(r['key'], m.trail)

    def test_waitlist_is_business_track(self):
        m = RegistrationModel(capacity=1)
        self.assertEqual(self.submit(m, actor='u1', key='k1')['state'], 'enrolled')
        r = self.submit(m, actor='u2', key='k2')
        self.assertEqual(r['state'], 'waitlisted')
        self.assertEqual(r['execution'], 'committed')
        self.assertEqual(m.waitlist[r['key']]['receipt'], r['receipt'])
        self.assertFalse(m.authoritative.get(r['key']))
        self.assertEqual(self.submit(m, actor='u2', key='k2')['state'], 'waitlisted')

    def test_REG_10_projection_repair(self):
        m = RegistrationModel()
        r = self.submit(m, fault='projection_fail')
        self.assertEqual(r['state'], 'enrolled')
        self.assertEqual(r['projection'], 'pending')
        self.assertEqual(m.repair_projection(r['key'])['projection'], 'complete')
        self.assertEqual(len(m.authoritative), 1)

    def test_REG_11_precommit(self):
        m = RegistrationModel()
        failed = self.submit(m, fault='precommit')
        self.assertTrue(failed['confirmed_no_commit'])
        self.assertFalse(m.authoritative)
        self.assertEqual(self.submit(m, payload={'section_ref': 's2'})['state'], 'conflict')
        self.assertEqual(self.submit(m)['state'], 'enrolled')

    def test_REG_12_expiry_and_revocation(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'override_expired': True})['state'], 'awaiting_approval')
        self.assertEqual(self.submit(m, {'permission_ok': False})['state'], 'denied')
        self.assertFalse(m.authoritative)

    def test_REG_12_revoked_between_preview_and_commit(self):
        m = RegistrationModel()
        # Preview: the eligibility override is missing, so nothing commits yet.
        self.assertEqual(self.submit(m, {'eligible': False})['state'], 'awaiting_approval')
        # The override arrives, but the permission is revoked before the commit attempt.
        self.assertEqual(self.submit(m, {'eligible': False, 'scoped_override': True,
                                         'permission_ok': False})['state'], 'denied')
        self.assertFalse(m.authoritative)
        # Authority restored: the commit runs on fresh checks, not on the earlier preview.
        self.assertEqual(self.submit(m, {'eligible': False, 'scoped_override': True})['state'], 'enrolled')
        self.assertEqual(len(m.authoritative), 1)

    def test_replay_after_revocation_returns_original(self):
        m = RegistrationModel()
        first = self.submit(m)
        revoked = self.submit(m, {'permission_ok': False})
        self.assertEqual(revoked['state'], 'enrolled')
        self.assertEqual(revoked['receipt'], first['receipt'])
        self.assertEqual(len(m.authoritative), 1)

    def test_repeat_while_result_unknown_observes_unknown(self):
        m = RegistrationModel()
        self.submit(m, fault='timeout_after')
        again = self.submit(m)
        self.assertEqual(again['state'], 'result_unknown')
        self.assertNotIn('receipt', again)
        self.assertEqual(len(m.authoritative), 1)

    def test_replay_requires_authenticated_caller(self):
        m = RegistrationModel()
        self.submit(m)
        denied = self.submit(m, {'identity_ok': False})
        self.assertEqual(denied['state'], 'denied')
        self.assertNotIn('receipt', denied)

    def test_payload_snapshot_is_independent_of_caller(self):
        m = RegistrationModel()
        payload = {'section_ref': 's1', 'override_grant_refs': ['g1']}
        r = self.submit(m, payload=payload)
        payload['override_grant_refs'].append('g2')
        self.assertEqual(m.authoritative[r['key']]['payload']['override_grant_refs'], ['g1'])
        self.assertEqual(m.commands[r['key']]['original_payload']['override_grant_refs'], ['g1'])
        same = self.submit(m, payload={'section_ref': 's1', 'override_grant_refs': ['g1']})
        self.assertEqual(same['receipt'], r['receipt'])
        same['original_payload']['override_grant_refs'].append('g3')
        self.assertEqual(m.commands[r['key']]['original_payload']['override_grant_refs'], ['g1'])

    def test_REG_13_offer_expiry(self):
        m = RegistrationModel()
        self.assertEqual(self.submit(m, {'offer_expired': True})['state'], 'waitlisted')
        self.assertFalse(m.authoritative)

    def test_offer_expiry_replay_stays_waitlisted(self):
        m = RegistrationModel()
        r = self.submit(m, {'offer_expired': True})
        again = self.submit(m)
        self.assertEqual((again['state'], again['receipt']), ('waitlisted', r['receipt']))
        self.assertFalse(m.authoritative)

    def test_enrollment_records_business_outcome(self):
        m = RegistrationModel()
        r = self.submit(m)
        self.assertEqual((r['state'], r['execution']), ('enrolled', 'committed'))
        self.assertEqual(m.commands[r['key']]['business'], 'enrolled')

    def test_correction_replay_returns_original_result(self):
        m = RegistrationModel()
        r = self.submit(m)
        first = m.correct(r['key'], approved=True, correction_key='c1')
        again = m.correct(r['key'], approved=True, correction_key='c1')
        self.assertEqual(again, first)
        self.assertEqual(len(m.corrections), 1)

    def test_second_correction_request_is_recorded(self):
        m = RegistrationModel()
        r = self.submit(m)
        m.correct(r['key'], approved=True, correction_key='c1')
        second = m.correct(r['key'], approved=True, correction_key='c2')
        self.assertEqual(second['correction_receipt'], 2)
        self.assertEqual(len(m.corrections), 2)

    def test_reconcile_and_repair_return_copies(self):
        m = RegistrationModel()
        payload = {'section_ref': 's1', 'override_grant_refs': ['g1']}
        r = self.submit(m, payload=payload, fault='timeout_after')
        got = m.reconcile(r['key'])
        got['original_payload']['override_grant_refs'].append('g2')
        self.assertEqual(m.commands[r['key']]['original_payload']['override_grant_refs'], ['g1'])
        m2 = RegistrationModel()
        r2 = self.submit(m2, payload=payload, fault='projection_fail')
        repaired = m2.repair_projection(r2['key'])
        repaired['original_payload']['override_grant_refs'].append('g2')
        self.assertEqual(m2.commands[r2['key']]['original_payload']['override_grant_refs'], ['g1'])

    def test_REG_14_swap_failure(self):
        m = RegistrationModel()
        r = m.swap('original-enrollment', replacement_available=False)
        self.assertTrue(r['original_retained'])
        self.assertEqual(r['state'], 'failed')

    def test_REG_15_correction_history(self):
        m = RegistrationModel()
        r = self.submit(m)
        original = dict(m.commands[r['key']])
        self.assertEqual(m.correct(r['key'], approved=False, correction_key='c1')['state'], 'correction_pending')
        self.assertFalse(m.corrections)
        self.assertEqual(m.correct(r['key'], approved=True, correction_key='c1')['state'], 'corrected')
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
        a = m.submit('u1', 'tenant-a', 'same-key', {'section_ref': 's1'})
        b = m.submit('u1', 'tenant-b', 'same-key', {'section_ref': 's1'})
        self.assertEqual(a['state'], 'enrolled')
        self.assertEqual(b['state'], 'enrolled')
        self.assertNotEqual(a['key'], b['key'])
        self.assertEqual(len(m.authoritative), 2)

    def test_capacity_scoped_by_tenant_and_section(self):
        m = RegistrationModel(capacity=1)
        self.assertEqual(m.submit('u1', 'tenant-a', 'k1', {'section_ref': 's1'})['state'], 'enrolled')
        self.assertEqual(m.submit('u2', 'tenant-b', 'k2', {'section_ref': 's1'})['state'], 'enrolled')
        self.assertEqual(m.submit('u3', 'tenant-a', 'k3', {'section_ref': 's2'})['state'], 'enrolled')
        self.assertEqual(m.submit('u4', 'tenant-a', 'k4', {'section_ref': 's1'})['state'], 'waitlisted')
        self.assertEqual(len(m.authoritative), 3)

class WorkerTests(unittest.TestCase):
    def test_duplicate_delivery_one_effect(self):
        w = WorkerReferenceModel(); token = w.claim('default', 'e1', 'default')
        self.assertEqual(w.apply('e1', token), 'committed')
        self.assertEqual(w.apply('e1', token), 'duplicate')
        self.assertEqual(w.effects, 1)

    def test_stale_lease_cannot_commit(self):
        w = WorkerReferenceModel(); stale = w.claim('default', 'e1', 'default'); fresh = w.claim('default', 'e1', 'default')
        self.assertEqual(w.apply('e1', stale), 'stale_lease')
        self.assertEqual(w.apply('e1', fresh), 'committed')
        self.assertEqual(w.effects, 1)

    def test_revoked_grant_no_effect(self):
        w = WorkerReferenceModel(); token = w.claim('default', 'e1', 'default')
        self.assertEqual(w.apply('e1', token, approved=False), 'denied')
        self.assertEqual(w.effects, 0)
        self.assertFalse(w.receipts)

    def test_redelivery_after_revocation_observes_prior_result(self):
        w = WorkerReferenceModel(); token = w.claim('default', 'e1', 'default')
        self.assertEqual(w.apply('e1', token), 'committed')
        self.assertEqual(w.apply('e1', token, approved=False), 'duplicate')
        self.assertEqual(w.effects, 1)

    def test_fencing_is_per_job(self):
        w = WorkerReferenceModel()
        a = w.claim('A', 'e1', 'default'); b = w.claim('B', 'e2', 'default')
        self.assertEqual(w.apply('e1', a), 'committed')
        self.assertEqual(w.apply('e2', b), 'committed')
        self.assertEqual(w.effects, 2)

    def test_inbox_checked_before_fence(self):
        w = WorkerReferenceModel()
        first = w.claim('A', 'e1', 'default')
        self.assertEqual(w.apply('e1', first), 'committed')
        w.claim('A', 'e1', 'default')
        self.assertEqual(w.apply('e1', first), 'duplicate')
        self.assertEqual(w.effects, 1)

    def test_denial_is_durable(self):
        w = WorkerReferenceModel(); token = w.claim('default', 'e1', 'default')
        self.assertEqual(w.apply('e1', token, approved=False), 'denied')
        self.assertEqual(w.apply('e1', token, approved=True), 'denied')
        self.assertEqual(w.effects, 0)

    def test_token_applies_only_to_its_event(self):
        w = WorkerReferenceModel()
        a = w.claim('A', 'e1', 'default'); b = w.claim('B', 'e2', 'default')
        self.assertEqual(w.apply('e2', a), 'wrong_event')
        self.assertEqual(w.effects, 0)
        self.assertEqual(w.apply('e2', b), 'committed')
        self.assertEqual(w.apply('e1', a), 'committed')
        self.assertEqual(w.effects, 2)

    def test_crash_before_marker_rolls_back(self):
        w = WorkerReferenceModel(); token = w.claim('default', 'e1', 'default')
        with self.assertRaises(RuntimeError):
            w.apply('e1', token, fault='crash_before_marker')
        self.assertEqual((w.effects, w.receipts), (0, []))
        self.assertEqual(w.apply('e1', token), 'committed')
        self.assertEqual(w.effects, 1)

    def test_dedup_is_scoped_by_tenant(self):
        w = WorkerReferenceModel()
        a = w.claim('default', 'e1', 'tenant-a')
        self.assertEqual(w.apply('e1', a, tenant='tenant-a'), 'committed')
        # A lease for tenant A cannot apply the same event ID for tenant B.
        self.assertEqual(w.apply('e1', a, tenant='tenant-b'), 'wrong_tenant')
        b = w.claim('default', 'e1', 'tenant-b')
        self.assertEqual(w.apply('e1', b, tenant='tenant-b'), 'committed')
        self.assertEqual(w.effects, 2)

if __name__ == '__main__':
    unittest.main()
