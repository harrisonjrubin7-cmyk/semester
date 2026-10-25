import argparse,json,os,hashlib
from pathlib import Path
from urllib.parse import urlparse,quote
import requests,yaml
from jsonschema import Draft202012Validator,FormatChecker,RefResolver
from openapi_spec_validator import validate_spec

def load(path):return yaml.safe_load(Path(path).read_text())
def deref(doc,obj):
    seen=set()
    while isinstance(obj,dict) and '$ref' in obj:
        ref=obj['$ref']
        if not ref.startswith('#/') or ref in seen:raise ValueError('Bundle local refs; cyclic non-schema reference rejected')
        seen.add(ref);v=doc
        for k in ref[2:].split('/'):v=v[k.replace('~1','/').replace('~0','~')]
        obj=v
    return obj

def main():
    a=argparse.ArgumentParser();a.add_argument('--spec',required=True);a.add_argument('--plan',required=True);a.add_argument('--report',default='live-oas-report.json');args=a.parse_args()
    doc=load(args.spec);plan=load(args.plan);base=plan['base_url'].rstrip('/');u=urlparse(base)
    if u.scheme!='https' or u.hostname not in plan.get('allowed_hosts',[]) or u.username or u.password or u.query or u.fragment:raise SystemExit('Unapproved HTTPS target')
    if plan.get('environment') not in ['staging','preview','local-test'] or plan.get('data_mode')!='synthetic':raise SystemExit('Synthetic non-production target required')
    def scan(v):
        if isinstance(v,dict):
            if '$ref' in v and not v['$ref'].startswith('#/'):raise ValueError('External refs blocked; bundle approved resources')
            if '$schema' in v and v['$schema'] not in ['https://json-schema.org/draft/2020-12/schema','https://spec.openapis.org/oas/3.1/dialect/base']:raise ValueError('Unsupported dialect')
            if 'nullable' in v:raise ValueError('Migrate nullable before 3.1 audit')
            for x in v.values():scan(x)
        elif isinstance(v,list):
            for x in v:scan(x)
    if not str(doc.get('openapi','')).startswith('3.1.'):raise SystemExit('OAS 3.1 required')
    if doc.get('jsonSchemaDialect','https://spec.openapis.org/oas/3.1/dialect/base') not in ['https://json-schema.org/draft/2020-12/schema','https://spec.openapis.org/oas/3.1/dialect/base']:raise SystemExit('Unsupported dialect')
    scan(doc);validate_spec(doc)
    results=[];covered=set()
    for c in plan.get('cases',[]):
        name=c.get('name','unnamed');method=c['method'].upper();template=c['path']
        try:
            if method not in ['GET','HEAD']:raise ValueError('Writes blocked: use reviewed fixture audit or separately approved isolated write runner')
            op=doc['paths'][template][method.lower()];route=template
            for k,v in c.get('path_parameters',{}).items():route=route.replace('{'+k+'}',quote(str(v),safe=''))
            if '{' in route or not route.startswith('/') or route.startswith('//') or '?' in route or '..' in route:raise ValueError('Invalid path')
            h={'Accept':'application/json, application/problem+json'}
            if c.get('token_env'):h['Authorization']='Bearer '+os.environ[c['token_env']]
            response=requests.request(method,base+route,headers=h,params=c.get('query',{}),timeout=(5,15),allow_redirects=False)
            errors=[];code=str(response.status_code)
            if response.status_code not in c['expected_statuses']:errors.append({'code':'UNEXPECTED_STATUS'})
            definition=deref(doc,op['responses'].get(code) or op['responses'].get(code[0]+'XX') or op['responses'].get('default') or {})
            if not definition:errors.append({'code':'UNDOCUMENTED_STATUS'})
            elif method!='HEAD' and response.status_code not in [204,304]:
                if len(response.content)>1000000:raise ValueError('Response too large for audit')
                media=response.headers.get('Content-Type','').split(';')[0].lower().strip();schema=definition.get('content',{}).get(media,{}).get('schema')
                if schema is None:errors.append({'code':'UNDOCUMENTED_MEDIA'})
                else:
                    def deny(uri):raise ValueError('External reference prohibited')
                    v=Draft202012Validator(schema,resolver=RefResolver.from_schema(doc,handlers={'https':deny,'http':deny}),format_checker=FormatChecker())
                    errors.extend({'code':'RESPONSE_SCHEMA','keyword':e.validator,'path':'/'+ '/'.join(map(str,e.absolute_path))} for e in v.iter_errors(response.json()))
            results.append({'case':name,'method':method,'path':template,'status':response.status_code,'passed':not errors,'errors':errors});covered.add((method,template))
        except Exception as e:results.append({'case':name,'passed':False,'error_type':type(e).__name__})
    missing=[{'method':m.upper(),'path':path,'status':'not_tested'} for path,item in doc['paths'].items() for m in item if m in ['get','head','post','put','patch','delete','options','trace'] and (m.upper(),path) not in covered]
    report={'spec_sha256':hashlib.sha256(Path(args.spec).read_bytes()).hexdigest(),'environment':plan['environment'],'cases':results,'missing_operations':missing,'limitations':['Read-only live runner','No directional readOnly/writeOnly processing','No full header/parameter assertions','JSON response schemas only','Observation is not proof of JWT signature implementation'],'passed':bool(results) and all(r['passed'] for r in results) and not missing}
    Path(args.report).write_text(json.dumps(report,indent=2));raise SystemExit(0 if report['passed'] else 1)
if __name__=='__main__':main()
