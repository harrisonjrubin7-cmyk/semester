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

    def test_invalid_effective_from(self):
        def fn(d):
            d['authority']['effective_from'] = '2026-13-45T00:00:00Z'
        self.assertRejected(mutate(fn), 'not a valid date-time')

    def test_verified_institution_authorization_without_effective_date(self):
        def fn(d):
            d['readiness']['institution_authorized'] = {'status': 'verified', 'evidence': [EVIDENCE], 'reason': 'x'}
        self.assertRejected(mutate(fn), 'effective_from')

    def test_step_actor_outside_allowed_roles(self):
        def fn(d):
            d['steps'][0]['actor_role'] = 'registrar'
        self.assertRejected(mutate(fn), 'actor is outside allowed_roles')

    def test_official_write_must_be_consequential(self):
        def fn(d):
            d['controls']['risk'] = 'low'
            d['controls']['human_authority_required'] = False
        self.assertRejected(mutate(fn), 'risk')


if __name__ == '__main__':
    unittest.main()
