"""Live, read-only OpenAPI 3.1 audit against an approved staging host — v2 of the uploaded runner (see original/).

Changes from the original:
  1. Coverage is split. The original failed every run whenever the spec had a POST, because a GET/HEAD-only runner can
     never cover one. Now: unread GET/HEAD operations fail the run; write operations are listed separately as
     `write_operations_for_capture_audit` and must be covered by ../validator (captured fixtures), not by this runner.
  2. `referencing` instead of the removed RefResolver (same as validator v2); remote retrieval refused.
  3. A case only counts toward coverage if it reached a response and matched an expected status.
  4. `expected_statuses` must all be documented for the operation (or its NXX/default); otherwise the plan is refused.
  5. Non-JSON or invalid JSON bodies report RESPONSE_NOT_JSON instead of failing with only an exception type.
  6. The plan must name `allowed_hosts` explicitly and the base host must be in it; IP-literal hosts are refused.
  7. Token values are never written to the report; a missing token env var reports TOKEN_ENV_MISSING by name.

Run: python live_registrar_oas_runner.py --spec bundled.openapi.yaml --plan approved-plan.json --report live-report.json
"""
import argparse, hashlib, ipaddress, json, os
from pathlib import Path
from urllib.parse import quote, urlparse

import requests
import yaml
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate
from referencing import Registry
from referencing.exceptions import NoSuchResource

DIALECTS = {'https://json-schema.org/draft/2020-12/schema', 'https://spec.openapis.org/oas/3.1/dialect/base',
            'https://spec.openapis.org/oas/3.1/dialect/2024-11-10'}
READ, WRITE = {'get', 'head'}, {'post', 'put', 'patch', 'delete'}
METHODS = READ | WRITE | {'options', 'trace'}
REFUSE_REMOTE = Registry(retrieve=lambda uri: (_ for _ in ()).throw(NoSuchResource(ref=uri)))


def load(path):
    return yaml.safe_load(Path(path).read_text())


def deref(doc, obj):
    seen = set()
    while isinstance(obj, dict) and '$ref' in obj:
        ref = obj['$ref']
        if not ref.startswith('#/') or ref in seen:
            raise ValueError('Bundle local refs; cyclic non-schema reference rejected')
        seen.add(ref)
        v = doc
        for k in ref[2:].split('/'):
            v = v[k.replace('~1', '/').replace('~0', '~')]
        obj = v
    return obj


def response_for(doc, op, code):
    rs = op.get('responses', {})
    return deref(doc, rs.get(code) or rs.get(code[0] + 'XX') or rs.get('default') or {})


def validator(doc, schema):
    root = dict(schema) if isinstance(schema, dict) else {'allOf': [schema]}
    root['$schema'] = 'https://json-schema.org/draft/2020-12/schema'
    if 'components' in doc:
        root['components'] = doc['components']
    return Draft202012Validator(root, registry=REFUSE_REMOTE, format_checker=FormatChecker())


def check_target(plan):
    base = plan['base_url'].rstrip('/')
    u = urlparse(base)
    allowed = plan.get('allowed_hosts') or []
    if not allowed:
        raise SystemExit('allowed_hosts must list the approved test host')
    try:
        ipaddress.ip_address(u.hostname or '')
        raise SystemExit('Use an approved host name, not an IP address')
    except ValueError:
        pass
    if u.scheme != 'https' or u.hostname not in allowed or u.username or u.password or u.query or u.fragment or (u.path not in ('', '/') and not u.path.startswith('/')):
        raise SystemExit('Unapproved HTTPS target')
    if plan.get('environment') not in ('staging', 'preview', 'local-test') or plan.get('data_mode') != 'synthetic':
        raise SystemExit('Synthetic non-production target required')
    return base


def check_doc(doc):
    if not str(doc.get('openapi', '')).startswith('3.1.'):
        raise SystemExit('OAS 3.1 required')
    if doc.get('jsonSchemaDialect', 'https://spec.openapis.org/oas/3.1/dialect/base') not in DIALECTS:
        raise SystemExit('Unsupported dialect')

    def scan(v):
        if isinstance(v, dict):
            if '$ref' in v and not str(v['$ref']).startswith('#/'):
                raise SystemExit('External refs blocked; bundle approved resources')
            if '$schema' in v and v['$schema'] not in DIALECTS:
                raise SystemExit('Unsupported dialect')
            if 'nullable' in v:
                raise SystemExit('Migrate nullable before a 3.1 audit')
            for x in v.values():
                scan(x)
        elif isinstance(v, list):
            for x in v:
                scan(x)
    scan(doc)
    validate(doc)


def check_plan(doc, plan):
    for c in plan.get('cases', []):
        name, m, path = c.get('name', 'unnamed'), c['method'].lower(), c['path']
        if m not in READ:
            raise SystemExit(f'{name}: writes are blocked here — cover {m.upper()} {path} with captured fixtures in ../validator')
        op = doc['paths'].get(path, {}).get(m)
        if op is None:
            raise SystemExit(f'{name}: {m.upper()} {path} is not in the spec')
        for s in c['expected_statuses']:
            if not response_for(doc, op, str(s)):
                raise SystemExit(f'{name}: expected status {s} is not documented for {m.upper()} {path}')


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--spec', required=True); a.add_argument('--plan', required=True); a.add_argument('--report', default='live-oas-report.json')
    args = a.parse_args()
    doc, plan = load(args.spec), load(args.plan)
    base = check_target(plan)
    check_doc(doc)
    check_plan(doc, plan)
    results, covered = [], set()
    for c in plan.get('cases', []):
        name, method, template = c.get('name', 'unnamed'), c['method'].upper(), c['path']
        try:
            op = doc['paths'][template][method.lower()]
            route = template
            for k, v in c.get('path_parameters', {}).items():
                route = route.replace('{' + k + '}', quote(str(v), safe=''))
            if '{' in route or not route.startswith('/') or route.startswith('//') or '?' in route or '..' in route:
                raise ValueError('Invalid path')
            h = {'Accept': 'application/json, application/problem+json'}
            if c.get('token_env'):
                tok = os.environ.get(c['token_env'])
                if not tok:
                    results.append({'case': name, 'passed': False, 'errors': [{'code': 'TOKEN_ENV_MISSING', 'env': c['token_env']}]})
                    continue
                h['Authorization'] = 'Bearer ' + tok
            r = requests.request(method, base + route, headers=h, params=c.get('query', {}), timeout=(5, 15), allow_redirects=False)
            errors, code = [], str(r.status_code)
            if r.status_code not in c['expected_statuses']:
                errors.append({'code': 'UNEXPECTED_STATUS', 'expected': c['expected_statuses']})
            definition = response_for(doc, op, code)
            if not definition:
                errors.append({'code': 'UNDOCUMENTED_STATUS'})
            elif method != 'HEAD' and r.status_code not in (204, 304):
                if len(r.content) > 1_000_000:
                    raise ValueError('Response too large for audit')
                media = r.headers.get('Content-Type', '').split(';')[0].lower().strip()
                schema = definition.get('content', {}).get(media, {}).get('schema')
                if schema is None:
                    errors.append({'code': 'UNDOCUMENTED_MEDIA', 'media': media})
                else:
                    try:
                        body = r.json()
                    except ValueError:
                        errors.append({'code': 'RESPONSE_NOT_JSON', 'media': media})
                    else:
                        errors += [{'code': 'RESPONSE_SCHEMA', 'keyword': e.validator, 'path': '/' + '/'.join(map(str, e.absolute_path))}
                                   for e in validator(doc, schema).iter_errors(body)]
            results.append({'case': name, 'method': method, 'path': template, 'status': r.status_code, 'passed': not errors, 'errors': errors})
            if r.status_code in c['expected_statuses']:
                covered.add((method, template))
        except Exception as e:
            results.append({'case': name, 'passed': False, 'errors': [{'code': 'EXECUTION', 'type': type(e).__name__}]})
    ops = [(m.upper(), p) for p, item in doc['paths'].items() for m in item if m in METHODS]
    missing_read = [{'method': m, 'path': p} for m, p in ops if m.lower() in READ and (m, p) not in covered]
    writes = [{'method': m, 'path': p} for m, p in ops if m.lower() in WRITE]
    report = {'spec_sha256': hashlib.sha256(Path(args.spec).read_bytes()).hexdigest(), 'environment': plan['environment'],
              'cases': results, 'missing_read_operations': missing_read, 'write_operations_for_capture_audit': writes,
              'limitations': ['Read-only live runner; writes are covered by ../validator captured fixtures',
                              'No readOnly/writeOnly processing on responses',
                              'No full header or parameter assertions',
                              'JSON response schemas only',
                              'An observed 401 is not proof that JWT signatures are verified'],
              'passed': bool(results) and all(r['passed'] for r in results) and not missing_read}
    Path(args.report).write_text(json.dumps(report, indent=2))
    print(f"{sum(r['passed'] for r in results)}/{len(results)} cases · {len(missing_read)} read ops untested · {len(writes)} write ops for capture audit")
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
