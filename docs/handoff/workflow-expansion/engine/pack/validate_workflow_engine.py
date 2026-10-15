import json
import sys
from datetime import datetime
from jsonschema import Draft202012Validator, FormatChecker

def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))

def semantic_errors(doc):
    errors = []
    kind = doc['document_type']
    if kind == 'workflow_definition':
        for key in ['steps', 'transitions', 'acceptance_tests']:
            ids = [x['id'] for x in doc[key]]
            if len(ids) != len(set(ids)):
                errors.append('Duplicate IDs in ' + key)
        steps = {s['id'] for s in doc['steps']}
        tests = {t['id'] for t in doc['acceptance_tests']}
        recovery_codes = [r['code'] for r in doc['recovery_paths']]
        if len(recovery_codes) != len(set(recovery_codes)):
            errors.append('Duplicate recovery codes')
        for track in ['business', 'execution']:
            states = set(doc['states'][track])
            initial = doc['states']['initial_' + track]
            terminals = set(doc['states']['terminal_' + track])
            if initial not in states or not terminals <= states:
                errors.append('Invalid initial/terminal state: ' + track)
            transitions = [t for t in doc['transitions'] if t['track'] == track]
            for t in transitions:
                if t['from'] not in states or t['to'] not in states:
                    errors.append('Undefined state: ' + t['id'])
                if t['step_id'] not in steps:
                    errors.append('Undefined step: ' + t['id'])
                if t['from'] in terminals:
                    errors.append('Transition leaves terminal: ' + t['id'])
            reached = {initial}
            finishable = set(terminals)
            for _ in states:
                reached.update(t['to'] for t in transitions if t['from'] in reached)
                finishable.update(t['from'] for t in transitions if t['to'] in finishable)
            for s in states - reached:
                errors.append('Unreachable state: ' + track + '/' + s)
            for s in states - finishable:
                errors.append('No terminal path: ' + track + '/' + s)
        for s in doc['steps']:
            for code in s['failure_codes']:
                if code not in recovery_codes:
                    errors.append('Missing recovery: ' + code)
        for r in doc['recovery_paths']:
            states = set(doc['states']['execution'])
            if r['to_execution_state'] not in states or not set(r['from_execution_states']) <= states:
                errors.append('Undefined recovery state: ' + r['code'])
            if not set(r['test_ids']) <= tests:
                errors.append('Undefined recovery test: ' + r['code'])
        if doc['authority']['official_write']:
            suites = {t['suite'] for t in doc['acceptance_tests']}
            required = {'authority', 'tenant_isolation', 'role_denial', 'concurrency', 'replay', 'timeout', 'recovery'}
            if not required <= suites:
                errors.append('Missing official-write suites')
    elif kind == 'execution_binding':
        delivery = doc['delivery']
        lease, retry = delivery['lease'], delivery['retry']
        if lease['heartbeat_seconds'] >= lease['lease_seconds']:
            errors.append('Heartbeat must be shorter than lease')
        if retry['base_delay_ms'] > retry['max_delay_ms']:
            errors.append('Base delay exceeds maximum delay')
        if doc['effect']['kind'] == 'official_write':
            if doc['scope']['kind'] != 'institution':
                errors.append('Official write needs institution scope')
            if doc['effect']['compensation_kind'] == 'provisional_cleanup':
                errors.append('Official records cannot use provisional cleanup')
        if doc['authority']['official_write'] and doc['effect']['kind'] != 'official_write':
            errors.append('Official-write authority/effect mismatch')
        if doc['status'] == 'active':
            if doc['handler_registry_key'].startswith('proposed.'):
                errors.append('Proposed handler cannot activate')
            if (doc['resolution']['code_ref'] or '').startswith('proposed:'):
                errors.append('Proposed code reference cannot activate')
    elif kind == 'execution_instance':
        if timestamp(doc['updated_at']) < timestamp(doc['created_at']):
            errors.append('updated_at precedes created_at')
    elif kind == 'approval_grant':
        if doc['requested_by'] == doc['approved_by']:
            errors.append('Requester cannot approve this grant')
        if timestamp(doc['expires_at']) <= timestamp(doc['issued_at']):
            errors.append('Approval expiry must follow issuance')
        if doc['revoked_at'] and timestamp(doc['revoked_at']) < timestamp(doc['issued_at']):
            errors.append('Revocation precedes issuance')
    return errors

def validate_document(schema, doc):
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    structural = list(validator.iter_errors(doc))
    if structural:
        return [str(list(e.absolute_path)) + ': ' + e.message for e in structural]
    return semantic_errors(doc)

def validate_bundle(schema, docs, require_resolved_bindings=False):
    errors = []
    definitions = {(d['id'], d['version']): d for d in docs if d.get('document_type') == 'workflow_definition'}
    bindings = {d['id']: d for d in docs if d.get('document_type') == 'execution_binding'}
    instances = {d['id']: d for d in docs if d.get('document_type') == 'execution_instance'}
    for d in docs:
        individual = validate_document(schema, d)
        if individual:
            errors.extend(individual)
            continue
        kind = d['document_type']
        if kind == 'execution_binding':
            wf = definitions.get((d['workflow_id'], d['workflow_version']))
            if (d['status'] == 'active' or require_resolved_bindings) and wf is None:
                errors.append('Missing definition for binding ' + d['id'])
            if wf and d['step_id'] not in {s['id'] for s in wf['steps']}:
                errors.append('Binding step absent from definition ' + d['id'])
            if require_resolved_bindings and not d['resolution']['resolved']:
                errors.append('Unresolved binding ' + d['id'])
        elif kind == 'execution_instance':
            wf = definitions.get((d['workflow_id'], d['workflow_version']))
            binding = bindings.get(d['binding_id'])
            if not wf or not binding:
                errors.append('Instance references missing definition/binding')
            else:
                if d['business_state'] not in wf['states']['business'] or d['execution_state'] not in wf['states']['execution']:
                    errors.append('Instance state absent from definition')
                if binding['workflow_id'] != d['workflow_id'] or binding['workflow_version'] != d['workflow_version']:
                    errors.append('Instance binding version mismatch')
                if d['scope']['tenant_id'] != binding['scope']['tenant_id']:
                    errors.append('Instance/binding tenant mismatch')
        elif kind in ['execution_receipt', 'approval_grant']:
            instance = instances.get(d['instance_id'])
            if not instance:
                errors.append('Receipt/approval references missing instance')
            elif any(d[k] != instance[k] for k in ['payload_hash', 'idempotency_key'] if k in d):
                errors.append('Receipt/approval command binding mismatch')
            elif d['scope']['tenant_id'] != instance['scope']['tenant_id']:
                errors.append('Receipt/approval tenant mismatch')
    return errors

if __name__ == '__main__':
    with open(sys.argv[1]) as f:
        schema = json.load(f)
    with open(sys.argv[2]) as f:
        payload = json.load(f)
    Draft202012Validator.check_schema(schema)
    errors = validate_bundle(schema, payload) if isinstance(payload, list) else validate_document(schema, payload)
    print(json.dumps({'valid': not errors, 'errors': errors}, indent=2))
    sys.exit(1 if errors else 0)
