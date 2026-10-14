import json,sys,hashlib
from pathlib import Path
from openapi_spec_validator import validate_spec
from jsonschema import Draft202012Validator,RefResolver,FormatChecker
spec=json.loads(Path(sys.argv[1]).read_text());validate_spec(spec)
results=[]
for fixture in json.loads(Path(sys.argv[2]).read_text()):
    op=spec['paths'][fixture['path']][fixture['method'].lower()]
    responses=op['responses'];code=str(fixture['status'])
    response=responses.get(code) or responses.get(code[0]+'XX') or responses.get('default')
    if not response:raise SystemExit('Undocumented status: '+code)
    if '$ref' in response:raise SystemExit('Response-level refs need explicit resolution before audit')
    media=response.get('content',{}).get(fixture['content_type'])
    if not media:raise SystemExit('Undocumented response media type')
    v=Draft202012Validator(media['schema'],resolver=RefResolver.from_schema(spec),format_checker=FormatChecker())
    valid=not list(v.iter_errors(fixture['payload']))
    results.append({'case':fixture['case'],'passed':valid==fixture.get('expected_valid',True)})
if not results:raise SystemExit('No fixtures supplied; validation incomplete')
report={'spec_sha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),'results':results,'limitations':'Captured fixtures only, not runtime authentication or HTTP conformance'}
Path('oas-audit-report.json').write_text(json.dumps(report,indent=2))
raise SystemExit(0 if all(x['passed'] for x in results) else 1)
