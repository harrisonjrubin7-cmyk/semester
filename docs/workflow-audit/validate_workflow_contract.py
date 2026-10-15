import json
import sys
from jsonschema import Draft202012Validator, FormatChecker

def semantic_errors(doc):
    errors = []
    for key in ['steps', 'transitions', 'acceptance_tests']:
        ids = [x['id'] for x in doc[key]]
        if len(ids) != len(set(ids)):
            errors.append('Duplicate IDs in ' + key)
    for track in ['business', 'execution']:
        states = doc['states'][track]
        if len(states) != len(set(states)):
            errors.append('Duplicate states in ' + track)
        if doc['states']['initial_' + track] not in states:
            errors.append('Invalid initial state in ' + track)
        for terminal in doc['states']['terminal_' + track]:
            if terminal not in states:
                errors.append('Invalid terminal state in ' + track)
        transitions = [t for t in doc['transitions'] if t['track'] == track]
        for t in transitions:
            if t['from'] not in states or t['to'] not in states:
                errors.append('Undefined transition state: ' + t['id'])
        reached = {doc['states']['initial_' + track]}
        for _ in states:
            reached.update(t['to'] for t in transitions if t['from'] in reached)
        for state in states:
            if state not in reached:
                errors.append('Unreachable state: ' + track + '/' + state)
        terminals = set(doc['states']['terminal_' + track])
        can_finish = set(terminals)
        for _ in states:
            can_finish.update(t['from'] for t in transitions if t['to'] in can_finish)
        for state in states:
            if state not in can_finish:
                errors.append('No terminal path: ' + track + '/' + state)
        for t in transitions:
            if t['from'] in terminals:
                errors.append('Transition leaves terminal state: ' + t['id'])
    step_ids = {x['id'] for x in doc['steps']}
    for t in doc['transitions']:
        if t['step_id'] not in step_ids:
            errors.append('Undefined step: ' + t['step_id'])
    recovery_codes = [x['code'] for x in doc['recovery_paths']]
    if len(recovery_codes) != len(set(recovery_codes)):
        errors.append('Duplicate recovery codes')
    test_ids = {x['id'] for x in doc['acceptance_tests']}
    for step in doc['steps']:
        for code in step['failure_codes']:
            if code not in recovery_codes:
                errors.append('Failure without recovery: ' + code)
    for r in doc['recovery_paths']:
        if r['to_execution_state'] not in doc['states']['execution']:
            errors.append('Undefined recovery state: ' + r['code'])
        if not set(r['acceptance_test_ids']) <= test_ids:
            errors.append('Undefined recovery test: ' + r['code'])
    if doc['authority']['official_record_write']:
        if doc['authority']['mode'] in ['personal', 'read_only', 'shadow']:
            errors.append('Official write forbidden in this mode')
        suites = {t['suite'] for t in doc['acceptance_tests']}
        required = {'happy_path', 'authority', 'tenant_isolation', 'role_denial', 'concurrency', 'replay',
                    'timeout', 'recovery', 'approval_expiry', 'unknown_outcome', 'reconciliation', 'correction'}
        if not required <= suites:
            errors.append('Missing consequential-write acceptance suites')
    if doc['authority']['official_record_write'] and doc['scope']['tenant_scope'] == 'personal':
        errors.append('Official write not permitted in personal scope')
    if doc['scope']['tenant_scope'] == 'personal' and doc['scope']['tenant_id'] is not None:
        errors.append('Personal scope must not bind an institutional tenant')
    return errors

def validate_document(schema, doc):
    Draft202012Validator.check_schema(schema)
    errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(doc))
    structural = ['/'.join(map(str, e.absolute_path)) + ': ' + e.message for e in errors]
    return structural if structural else semantic_errors(doc)

if __name__ == '__main__':
    with open(sys.argv[1]) as f:
        schema = json.load(f)
    with open(sys.argv[2]) as f:
        doc = json.load(f)
    errors = validate_document(schema, doc)
    print(json.dumps({'valid': not errors, 'errors': errors}, indent=2))
    sys.exit(1 if errors else 0)
