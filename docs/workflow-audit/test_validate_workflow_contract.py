"""Executable negative and positive cases for the workflow contract validator.

Run from this directory: python3 -m unittest test_validate_workflow_contract -v
"""
import copy
import json
import unittest
from pathlib import Path

from validate_workflow_contract import validate_document

HERE = Path(__file__).parent
SCHEMA = json.loads((HERE / 'workflow_contract.schema.json').read_text())
EXAMPLE = json.loads((HERE / 'registration.workflow.example.json').read_text())
EVIDENCE = {'reference': 'ev:1', 'version': '1', 'environment': 'staging',
            'scope': 'registration', 'reviewer': 'registrar', 'verified_at': '2026-10-01T00:00:00Z'}


def mutate(fn):
    doc = copy.deepcopy(EXAMPLE)
    fn(doc)
    return doc


def errors_for(doc):
    return validate_document(SCHEMA, doc)


class ValidExample(unittest.TestCase):
    def test_example_is_accepted(self):
        self.assertEqual(errors_for(EXAMPLE), [])

    def test_verified_institution_authorization_with_effective_date_is_accepted(self):
        def fn(d):
            d['readiness']['institution_authorized'] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
            d['authority']['effective_from'] = '2026-10-01T00:00:00Z'
        self.assertEqual(errors_for(mutate(fn)), [])


class RejectedContracts(unittest.TestCase):
    def assertRejected(self, doc, fragment):
        errs = errors_for(doc)
        self.assertTrue(errs, 'expected rejection')
        self.assertTrue(any(fragment in e for e in errs), errs)

    def test_missing_baseline_suite(self):
        def fn(d):
            for t in d['acceptance_tests']:
                if t['suite'] == 'scoped_visibility':
                    t['suite'] = 'happy_path'
        self.assertRejected(mutate(fn), 'Missing baseline acceptance suites: scoped_visibility')

    def test_official_write_without_no_commit_path(self):
        def fn(d):
            d['recovery_paths'] = [r for r in d['recovery_paths'] if r['code'] != 'NO_COMMIT']
            d['steps'][0]['failure_codes'] = ['OUTCOME_UNKNOWN']
        self.assertRejected(mutate(fn), 'Official write missing recovery paths: NO_COMMIT')

    def test_step_without_transition(self):
        def fn(d):
            step = copy.deepcopy(d['steps'][0])
            step.update(id='notify', failure_codes=['NO_COMMIT'], output_refs=['proposed:notice'])
            d['steps'].append(step)
        self.assertRejected(mutate(fn), 'Step without transition: notify')

    def test_step_reads_unknown_input(self):
        def fn(d):
            d['steps'][0]['input_refs'] = ['proposed:unknown']
        self.assertRejected(mutate(fn), 'reads unknown input refs')

    def test_declared_output_not_produced(self):
        def fn(d):
            d['steps'][0]['output_refs'] = []
        self.assertRejected(mutate(fn), 'Declared outputs not produced by any step')

    def test_authority_scope_not_bound_to_tenant(self):
        def fn(d):
            d['authority']['institution_scope'] = 'other-tenant/registration/enroll'
        self.assertRejected(mutate(fn), 'not bound to scope tenant_id')

    def test_authority_scope_not_bound_to_workflow_domain(self):
        def fn(d):
            d['authority']['institution_scope'] = 'illustrative-tenant/financial-aid/enroll'
        self.assertRejected(mutate(fn), 'not bound to scope tenant_id and domain')

    def test_invalid_effective_from(self):
        def fn(d):
            d['authority']['effective_from'] = '2026-13-45T00:00:00Z'
        self.assertRejected(mutate(fn), 'not a valid date-time')

    def test_verified_institution_authorization_without_effective_date(self):
        def fn(d):
            d['readiness']['institution_authorized'] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'effective_from')

    def test_verified_institution_authority_requires_scope_for_non_official_writes(self):
        def fn(d):
            d['authority']['official_record_write'] = False
            d['authority']['mode'] = 'authoritative'
            d['authority']['writer_policy'] = 'no_write'
            d['authority']['effective_from'] = '2026-01-01T00:00:00Z'
            d['authority']['institution_scope'] = None
            d['readiness']['institution_authorized'] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'Verified institution authority requires institution_scope')

    def test_personal_production_does_not_require_institution_scope(self):
        def fn(d):
            d['scope']['tenant_scope'] = 'personal'
            d['scope']['tenant_id'] = None
            d['authority']['official_record_write'] = False
            d['authority']['mode'] = 'authoritative'
            d['authority']['writer_policy'] = 'no_write'
            d['authority']['institution_scope'] = None
            d['authority']['effective_from'] = '2026-01-01T00:00:00Z'
            d['authority']['activation_ref'] = 'activation:1'
            for test in d['acceptance_tests']:
                test['evidence_refs'] = ['ev:1']
            for gate in ('designed', 'implemented', 'tested', 'deployed'):
                d['readiness'][gate] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
            d['readiness']['production_enabled'] = {'status': 'verified', 'evidence': [dict(EVIDENCE, environment='production')], 'reason': 'x'}
        errs = errors_for(mutate(fn))
        self.assertFalse(any('requires institution_scope' in e for e in errs), errs)

    def test_outcome_unknown_recovery_must_not_target_terminal_state(self):
        def fn(d):
            for r in d['recovery_paths']:
                if r['code'] == 'OUTCOME_UNKNOWN':
                    r['to_execution_state'] = 'committed'
        self.assertRejected(mutate(fn), 'OUTCOME_UNKNOWN recovery must target a nonterminal state')

    def test_blocked_gate_requires_reason(self):
        def fn(d):
            d['readiness']['designed'] = {'status': 'blocked', 'evidence': [], 'reason': ''}
        self.assertRejected(mutate(fn), 'readiness/designed/reason')

    def test_recovery_path_must_be_declared_by_a_step(self):
        def fn(d):
            d['recovery_paths'].append(dict(d['recovery_paths'][0], code='UNUSED'))
        self.assertRejected(mutate(fn), 'Recovery paths not declared by any step: UNUSED')

    def test_step_actor_outside_allowed_roles(self):
        def fn(d):
            d['steps'][0]['actor_role'] = 'registrar'
        self.assertRejected(mutate(fn), 'actor is outside allowed_roles')

    def test_official_write_must_be_consequential(self):
        def fn(d):
            d['controls']['risk'] = 'low'
            d['controls']['human_authority_required'] = False
        self.assertRejected(mutate(fn), 'risk')

    def test_baseline_requires_happy_path_and_recovery(self):
        def fn(d):
            for t in d['acceptance_tests']:
                if t['suite'] == 'happy_path':
                    t['suite'] = 'replay'
        self.assertRejected(mutate(fn), 'Missing baseline acceptance suites: happy_path')

    def test_verified_readiness_requires_catalog_link(self):
        def fn(d):
            d['catalog_links'] = []
            d['readiness']['tested'] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'catalog_links')

    def test_operational_review_needs_workspace_reference(self):
        def fn(d):
            d['steps'][0]['kind'] = 'operational_review'
            d['steps'][0]['surface_refs'] = []
            d['steps'][0]['executor_ref'] = None
        self.assertRejected(mutate(fn), 'no workspace or checklist reference')

    def test_produced_output_must_be_declared_or_consumed(self):
        def fn(d):
            d['steps'][0]['output_refs'] = ['proposed:registration-receipt', 'proposed:sensitive-extra']
        self.assertRejected(mutate(fn), 'neither declared nor consumed: proposed:sensitive-extra')

    def test_future_dated_readiness_evidence_is_rejected(self):
        def fn(d):
            future = dict(EVIDENCE, verified_at='2099-01-01T00:00:00Z')
            for test in d['acceptance_tests']:
                test['evidence_refs'] = ['ev:1']
            d['readiness']['tested'] = {'status': 'verified', 'evidence': [future], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'verified_at is in the future')

    def test_verified_production_requires_activation_ref(self):
        def fn(d):
            for test in d['acceptance_tests']:
                test['evidence_refs'] = ['ev:1']
            d['authority']['official_record_write'] = False
            d['authority']['mode'] = 'authoritative'
            d['authority']['writer_policy'] = 'no_write'
            d['authority']['effective_from'] = '2026-10-01T00:00:00Z'
            d['authority']['activation_ref'] = None
            for gate in ('designed', 'implemented', 'tested', 'deployed', 'institution_authorized'):
                d['readiness'][gate] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
            d['readiness']['production_enabled'] = {'status': 'verified', 'evidence': [dict(EVIDENCE, environment='production')], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'Verified production enablement requires activation_ref')

    def test_recovery_path_must_link_matching_test(self):
        def fn(d):
            for r in d['recovery_paths']:
                if r['code'] == 'NO_COMMIT':
                    r['acceptance_test_ids'] = ['happy_path']
        self.assertRejected(mutate(fn), 'not linked to a matching acceptance test: NO_COMMIT')

    def test_lowercase_z_timestamps_are_accepted(self):
        def fn(d):
            d['authority']['effective_from'] = '2026-10-01t00:00:00z'
            d['readiness']['institution_authorized'] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
        self.assertEqual(errors_for(mutate(fn)), [])

    def test_production_enabled_evidence_must_be_production(self):
        def fn(d):
            for test in d['acceptance_tests']:
                test['evidence_refs'] = ['ev:1']
            d['authority']['effective_from'] = '2026-10-01T00:00:00Z'
            for gate in ('designed', 'implemented', 'tested', 'deployed'):
                d['readiness'][gate] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
            d['readiness']['institution_authorized'] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
            d['readiness']['production_enabled'] = {'status': 'verified', 'evidence': [dict(EVIDENCE, environment='staging')], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'production_enabled evidence is not from production')

    def test_acceptance_evidence_must_resolve_to_readiness_evidence(self):
        def fn(d):
            for test in d['acceptance_tests']:
                test['evidence_refs'] = ['missing-evidence']
        self.assertRejected(mutate(fn), 'cites evidence not in the tested gate: missing-evidence')

    def test_acceptance_evidence_must_come_from_tested_gate(self):
        def fn(d):
            for test in d['acceptance_tests']:
                test['evidence_refs'] = ['ev:other']
            d['readiness']['deployed'] = {'status': 'unverified', 'evidence': [dict(EVIDENCE, reference='ev:other')], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'not in the tested gate: ev:other')

    def test_future_effective_date_rejected_once_authorized(self):
        def fn(d):
            d['authority']['effective_from'] = '2099-01-01T00:00:00Z'
            d['readiness']['institution_authorized'] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'effective_from is in the future for verified authority')

    def test_production_evidence_must_not_predate_authority(self):
        def fn(d):
            for test in d['acceptance_tests']:
                test['evidence_refs'] = ['ev:1']
            d['authority']['effective_from'] = '2026-10-15T00:00:00Z'
            prod = dict(EVIDENCE, environment='production', verified_at='2026-10-01T00:00:00Z')
            for gate in ('designed', 'implemented', 'tested', 'deployed'):
                d['readiness'][gate] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
            d['readiness']['institution_authorized'] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
            d['readiness']['production_enabled'] = {'status': 'verified', 'evidence': [prod], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'predates authority effective_from')

    def test_production_evidence_must_not_predate_prerequisites(self):
        def fn(d):
            for test in d['acceptance_tests']:
                test['evidence_refs'] = ['ev:1']
            d['authority']['effective_from'] = '2026-09-01T00:00:00Z'
            prod = dict(EVIDENCE, environment='production', verified_at='2026-10-10T00:00:00Z')
            late_auth = dict(EVIDENCE, verified_at='2026-10-15T00:00:00Z')
            for gate in ('designed', 'implemented', 'tested', 'deployed'):
                d['readiness'][gate] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
            d['readiness']['institution_authorized'] = {'status': 'verified', 'evidence': [late_auth], 'reason': 'x'}
            d['readiness']['production_enabled'] = {'status': 'verified', 'evidence': [prod], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'predates institution_authorized evidence')

    def test_mandatory_recovery_codes_must_be_declared_by_a_step(self):
        def fn(d):
            d['steps'][0]['failure_codes'] = ['OUTCOME_UNKNOWN']
        self.assertRejected(mutate(fn), 'not declared by any step: NO_COMMIT')


if __name__ == '__main__':
    unittest.main()
