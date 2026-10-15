"""Registrar OpenAPI 3.1 contract validator — v2 of the uploaded reference (see original/).

Changes from the original, each because the original could pass a case for the wrong reason or miss one:
  1. Discriminated oneOf: the branch named by the discriminator value is validated on its own, so a bad UUID in an
     "add" request reports /sectionIds/0 format, not just "matched none of oneOf". Unknown values report
     DISCRIMINATOR_UNKNOWN.
  2. Negative captures must say WHY they're invalid (expected_errors: keyword + instance_path). A case passes only if
     every expected error is reported. "expected_valid" is now required, not defaulted to true.
  3. A case that crashes no longer counts toward operation coverage.
  4. Uses the `referencing` registry (jsonschema >= 4.18). RefResolver is deprecated and removed in newer releases.
     Remote retrieval is refused.
  5. Format assertion is explicit: uuid / date-time / email are checked, and the report says which formats it asserted.

Run: python registrar_oas_validator.py --spec actual.openapi.json --captures approved-captures.json --report oas-report.json
Self-test: python registrar_oas_validator.py --self-test
"""
import argparse, hashlib, json, sys
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry
from referencing.exceptions import NoSuchResource

SUPPORTED = {'https://json-schema.org/draft/2020-12/schema', 'https://spec.openapis.org/oas/3.1/dialect/base',
             'https://spec.openapis.org/oas/3.1/dialect/2024-11-10'}
ASSERTED_FORMATS = ['uuid', 'date-time', 'date', 'email']
FORMATS = FormatChecker(ASSERTED_FORMATS)
METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']
HERE = Path(__file__).parent


def pointer(doc, ref):
    if not ref.startswith('#/'):
        raise ValueError('External references blocked; bundle reviewed local resources first')
    v = doc
    for key in ref[2:].split('/'):
        v = v[key.replace('~1', '/').replace('~0', '~')]
    return v


def resolve(doc, obj):
    seen = set()
    while isinstance(obj, dict) and '$ref' in obj:
        ref = obj['$ref']
        if ref in seen:
            raise ValueError('Cyclic non-schema Reference Object')
        seen.add(ref)
        obj = pointer(doc, ref)
    return obj


REFUSE_REMOTE = Registry(retrieve=lambda uri: (_ for _ in ()).throw(NoSuchResource(ref=uri)))


def validator(doc, schema):
    """Validate a schema taken from anywhere in the document. Local refs ("#/components/...") resolve against the
    schema's own root, so the document's components are attached to that root; 2020-12 ignores the unknown key."""
    root = dict(schema) if isinstance(schema, dict) else {'allOf': [schema]}
    root['$schema'] = 'https://json-schema.org/draft/2020-12/schema'
    if 'components' in doc:
        root['components'] = doc['components']
    return Draft202012Validator(root, registry=REFUSE_REMOTE, format_checker=FORMATS)


def lint(doc):
    findings = []
    if not str(doc.get('openapi', '')).startswith('3.1.'):
        findings.append({'code': 'OAS_VERSION', 'severity': 'error', 'path': '/openapi'})
    if doc.get('jsonSchemaDialect', 'https://spec.openapis.org/oas/3.1/dialect/base') not in SUPPORTED:
        findings.append({'code': 'UNSUPPORTED_DIALECT', 'severity': 'error', 'path': '/jsonSchemaDialect'})

    def walk(v, path=''):
        if isinstance(v, dict):
            if '$schema' in v and v['$schema'] not in SUPPORTED:
                findings.append({'code': 'UNSUPPORTED_DIALECT', 'severity': 'error', 'path': path})
            if '$ref' in v and not str(v['$ref']).startswith('#/'):
                findings.append({'code': 'EXTERNAL_REF', 'severity': 'error', 'path': path})
            if 'nullable' in v:
                findings.append({'code': 'NULLABLE_HAS_NO_31_ASSERTION', 'severity': 'error', 'path': path})
            if 'discriminator' in v:
                if not any(k in v for k in ['oneOf', 'anyOf']):
                    findings.append({'code': 'DISCRIMINATOR_COMPOSITION', 'severity': 'error', 'path': path})
                elif discriminator_map(doc, v) is None:
                    findings.append({'code': 'DISCRIMINATOR_UNMAPPABLE', 'severity': 'error', 'path': path,
                                     'detail': 'every branch must require the property and fix it with const or a one-value enum'})
            for k, x in v.items():
                walk(x, path + '/' + k)
        elif isinstance(v, list):
            for i, x in enumerate(v):
                walk(x, path + '/' + str(i))
    walk(doc)
    return findings


def discriminator_map(doc, schema):
    """value -> branch, from each branch's const/enum on the discriminator property. None if any branch can't be mapped."""
    prop = schema['discriminator']['propertyName']
    out = {}
    for branch in schema.get('oneOf') or schema.get('anyOf') or []:
        b = resolve(doc, branch)
        p = resolve(doc, b.get('properties', {}).get(prop, {}))
        vals = [p['const']] if 'const' in p else (p.get('enum') if len(p.get('enum', [])) == 1 else None)
        if not vals or prop not in b.get('required', []):
            return None
        out[vals[0]] = branch
    return out


def schema_errors(doc, schema, payload):
    s = resolve(doc, schema)
    if isinstance(s, dict) and 'discriminator' in s and isinstance(payload, dict):
        m = discriminator_map(doc, s)
        prop = s['discriminator']['propertyName']
        if m is not None:
            if prop not in payload:
                return [{'code': 'PAYLOAD_SCHEMA', 'instance_path': '/', 'schema_path': '/discriminator', 'keyword': 'required'}]
            if payload[prop] not in m:
                return [{'code': 'DISCRIMINATOR_UNKNOWN', 'instance_path': '/' + prop, 'schema_path': '/discriminator', 'keyword': 'discriminator'}]
            s = resolve(doc, m[payload[prop]])
    v = validator(doc, s)
    return [{'code': 'PAYLOAD_SCHEMA', 'instance_path': '/' + '/'.join(map(str, e.absolute_path)),
             'schema_path': '/' + '/'.join(map(str, e.absolute_schema_path)), 'keyword': e.validator}
            for e in sorted(v.iter_errors(payload), key=lambda e: list(map(str, e.absolute_path)))]


def directional_errors(doc, schema, payload, direction, path='', depth=0):
    if depth > 64:
        raise ValueError('Directional traversal limit exceeded')
    s = resolve(doc, schema)
    out = []
    if not isinstance(s, dict):
        return out
    if 'discriminator' in s and isinstance(payload, dict):
        m = discriminator_map(doc, s) or {}
        branch = m.get(payload.get(s['discriminator']['propertyName']))
        if branch is not None:
            return directional_errors(doc, branch, payload, direction, path, depth + 1)
    if isinstance(payload, dict):
        for key, ps in s.get('properties', {}).items():
            if key not in payload:
                continue
            eff = resolve(doc, ps)
            if (direction == 'request' and eff.get('readOnly')) or (direction == 'response' and eff.get('writeOnly')):
                out.append({'code': 'DIRECTIONAL_FIELD', 'instance_path': path + '/' + key, 'keyword': 'readOnly' if direction == 'request' else 'writeOnly'})
            out += directional_errors(doc, ps, payload[key], direction, path + '/' + key, depth + 1)
    if isinstance(payload, list) and isinstance(s.get('items'), dict):
        for i, y in enumerate(payload):
            out += directional_errors(doc, s['items'], y, direction, path + '/' + str(i), depth + 1)
    for child in s.get('allOf', []):
        out += directional_errors(doc, child, payload, direction, path, depth + 1)
    return out


def matches(expected, got):
    return all(any(g.get('keyword') == e['keyword'] and g.get('instance_path') == e['instance_path'] for g in got) for e in expected)


def audit(doc, cases, document_validation=True):
    findings = lint(doc)
    document_status = 'not_run'
    if document_validation:
        try:
            from openapi_spec_validator import validate
            if any(f['code'] == 'EXTERNAL_REF' for f in findings):
                raise ValueError('Bundle local references first')
            validate(doc)
            document_status = 'passed'
        except ImportError:
            document_status = 'blocked_missing_dependency'
            findings.append({'code': 'DOCUMENT_VALIDATOR_MISSING', 'severity': 'error', 'path': '/'})
        except Exception as e:
            document_status = 'failed'
            findings.append({'code': 'DOCUMENT_INVALID', 'severity': 'error', 'exception_type': type(e).__name__})
    results, covered = [], set()
    for case in cases:
        name = case.get('case', 'unnamed')
        try:
            if 'expected_valid' not in case:
                raise ValueError('expected_valid is required')
            if case['expected_valid'] is False and not case.get('expected_errors'):
                raise ValueError('a negative case must list expected_errors (keyword + instance_path)')
            path, method, direction = case['path'], case['method'].lower(), case['direction']
            op = doc['paths'][path][method]
            if direction == 'request':
                container = resolve(doc, op['requestBody'])
            elif direction == 'response':
                st = str(case['status'])
                rs = op['responses']
                container = resolve(doc, rs.get(st) or rs.get(st[0] + 'XX') or rs.get('default') or {})
            else:
                raise ValueError('Invalid direction')
            media = case['content_type'].split(';')[0].strip().lower()
            schema = container['content'][media]['schema']
            errors = schema_errors(doc, schema, case['payload']) + directional_errors(doc, schema, case['payload'], direction)
            valid = not errors
            ok = (valid is True) if case['expected_valid'] else (not valid and matches(case['expected_errors'], errors))
            results.append({'case': name, 'path': path, 'method': method, 'direction': direction, 'valid': valid,
                            'passed': ok, 'errors': errors, **({'expected_errors': case['expected_errors']} if not case['expected_valid'] else {})})
            covered.add((path, method, direction))  # only a case that actually ran counts as coverage
        except Exception as e:
            results.append({'case': name, 'passed': False, 'errors': [{'code': 'AUDIT_EXECUTION', 'exception_type': type(e).__name__, 'detail': str(e)[:160]}]})
    if not cases:
        findings.append({'code': 'NO_CAPTURED_CASES', 'severity': 'error', 'path': '/'})
    for path, item in doc.get('paths', {}).items():
        for method, op in item.items():
            if method not in METHODS:
                continue
            for direction in (['request', 'response'] if 'requestBody' in op else ['response']):
                if (path, method, direction) not in covered:
                    findings.append({'code': 'UNCOVERED_OPERATION', 'severity': 'error', 'path': path, 'method': method, 'direction': direction})
    return {'document_validation': document_status, 'asserted_formats': ASSERTED_FORMATS, 'findings': findings, 'cases': results,
            'passed': not any(f['severity'] == 'error' for f in findings) and all(r['passed'] for r in results),
            'limitations': ['Captured JSON bodies only; no live endpoint calls',
                            'Parameters, headers, cookies and serialization not covered',
                            'Required readOnly/writeOnly omission semantics need an OAS-aware validator',
                            'No JWT signature or current-grant verification',
                            'No remote or custom dialect resolution; unsupported cases block',
                            'Contract validation does not prove FERPA, transactions or SIS correctness']}


if __name__ == '__main__':
    a = argparse.ArgumentParser()
    a.add_argument('--spec'); a.add_argument('--captures'); a.add_argument('--report', default='oas-report.json')
    a.add_argument('--self-test', action='store_true')
    args = a.parse_args()
    if args.self_test:
        args.spec, args.captures, args.report = str(HERE / 'synthetic_validator_spec.json'), str(HERE / 'synthetic_captures.json'), str(HERE / 'validator_self_test_results.json')
    if not args.spec or not args.captures:
        a.error('--spec and --captures are required (or use --self-test)')
    b = Path(args.spec).read_bytes()
    report = audit(json.loads(b), json.loads(Path(args.captures).read_text()), document_validation=not args.self_test)
    report['spec_sha256'] = hashlib.sha256(b).hexdigest()
    Path(args.report).write_text(json.dumps(report, indent=2))
    print(f"{sum(r['passed'] for r in report['cases'])}/{len(report['cases'])} cases passed · {len(report['findings'])} findings · document_validation={report['document_validation']}")
    raise SystemExit(0 if report['passed'] else 1)
