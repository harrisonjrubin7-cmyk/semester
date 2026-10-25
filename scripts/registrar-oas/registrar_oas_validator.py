import argparse, hashlib, json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker, RefResolver

SUPPORTED={'https://json-schema.org/draft/2020-12/schema','https://spec.openapis.org/oas/3.1/dialect/base','https://spec.openapis.org/oas/3.1/dialect/2024-11-10'}

def pointer(doc, ref):
    if not ref.startswith('#/'): raise ValueError('External references blocked; bundle reviewed local resources first')
    v=doc
    for key in ref[2:].split('/'): v=v[key.replace('~1','/').replace('~0','~')]
    return v

def resolve(doc,obj):
    seen=set()
    while isinstance(obj,dict) and '$ref' in obj:
        ref=obj['$ref']
        if ref in seen: raise ValueError('Cyclic non-schema Reference Object')
        seen.add(ref);obj=pointer(doc,ref)
    return obj

def lint(doc):
    findings=[]
    if not str(doc.get('openapi','')).startswith('3.1.'): findings.append({'code':'OAS_VERSION','severity':'error','path':'/openapi'})
    dialect=doc.get('jsonSchemaDialect','https://spec.openapis.org/oas/3.1/dialect/base')
    if dialect not in SUPPORTED: findings.append({'code':'UNSUPPORTED_DIALECT','severity':'error','path':'/jsonSchemaDialect'})
    def walk(v,path=''):
        if isinstance(v,dict):
            if '$schema' in v and v['$schema'] not in SUPPORTED:findings.append({'code':'UNSUPPORTED_DIALECT','severity':'error','path':path})
            if '$ref' in v and not v['$ref'].startswith('#/'):findings.append({'code':'EXTERNAL_REF','severity':'error','path':path})
            if 'nullable' in v:findings.append({'code':'NULLABLE_HAS_NO_31_ASSERTION','severity':'error','path':path})
            if 'discriminator' in v and not any(k in v for k in ['oneOf','anyOf','allOf']):findings.append({'code':'DISCRIMINATOR_COMPOSITION','severity':'error','path':path})
            for k,x in v.items():walk(x,path+'/'+k)
        elif isinstance(v,list):
            for i,x in enumerate(v):walk(x,path+'/'+str(i))
    walk(doc);return findings

def payload_errors(doc,schema,payload,direction):
    def deny(uri):raise ValueError('Remote schema fetch prohibited')
    resolver=RefResolver.from_schema(doc,handlers={'http':deny,'https':deny})
    v=Draft202012Validator(schema,resolver=resolver,format_checker=FormatChecker())
    errors=[{'code':'PAYLOAD_SCHEMA','instance_path':'/'+ '/'.join(map(str,e.absolute_path)), 'schema_path':'/'+ '/'.join(map(str,e.absolute_schema_path)), 'keyword':e.validator} for e in v.iter_errors(payload)]
    def directional(s,x,path='',depth=0):
        if depth>64:raise ValueError('Directional traversal limit exceeded')
        if not isinstance(s,dict):return
        if '$ref' in s:
            directional(pointer(doc,s['$ref']),x,path,depth+1)
        if isinstance(x,dict):
            for key,ps in s.get('properties',{}).items():
                if key not in x:continue
                effective=resolve(doc,ps)
                if (direction=='request' and effective.get('readOnly')) or (direction=='response' and effective.get('writeOnly')):
                    errors.append({'code':'DIRECTIONAL_FIELD','instance_path':path+'/'+key})
                directional(ps,x[key],path+'/'+key,depth+1)
        if isinstance(x,list) and isinstance(s.get('items'),dict):
            for i,y in enumerate(x):directional(s['items'],y,path+'/'+str(i),depth+1)
        for child in s.get('allOf',[]):directional(child,x,path,depth+1)
        for key in ['oneOf','anyOf']:
            for child in s.get(key,[]):
                if not list(Draft202012Validator(child,resolver=resolver,format_checker=FormatChecker()).iter_errors(x)):
                    directional(child,x,path,depth+1)
    directional(schema,payload)
    return errors

def audit(doc,cases,document_validation=True):
    findings=lint(doc);document_status='not_run'
    if document_validation:
        try:
            from openapi_spec_validator import validate_spec
            if any(f['code']=='EXTERNAL_REF' for f in findings):raise ValueError('Bundle local references first')
            validate_spec(doc);document_status='passed'
        except ImportError:document_status='blocked_missing_dependency';findings.append({'code':'DOCUMENT_VALIDATOR_MISSING','severity':'error','path':'/'})
        except Exception as e:document_status='failed';findings.append({'code':'DOCUMENT_INVALID','severity':'error','exception_type':type(e).__name__})
    results=[];covered=set()
    for case in cases:
        try:
            path=case['path'];method=case['method'].lower();op=doc['paths'][path][method];direction=case['direction'];covered.add((path,method,direction))
            if direction=='request':container=resolve(doc,op['requestBody'])
            elif direction=='response':
                status=str(case['status']);responses=op['responses'];container=resolve(doc,responses.get(status) or responses.get(status[0]+'XX') or responses.get('default') or {})
            else:raise ValueError('Invalid direction')
            media=case['content_type'].split(';')[0].strip().lower();schema=container['content'][media]['schema']
            errors=payload_errors(doc,schema,case['payload'],direction)
            expected=case.get('expected_valid',True);valid=not errors
            results.append({'case':case['case'],'path':path,'method':method,'direction':direction,'valid':valid,'passed':valid==expected,'errors':errors})
        except Exception as e:results.append({'case':case.get('case','unnamed'),'passed':False,'errors':[{'code':'AUDIT_EXECUTION','exception_type':type(e).__name__}]})
    if not cases:findings.append({'code':'NO_CAPTURED_CASES','severity':'error','path':'/'})
    for path,item in doc.get('paths',{}).items():
        for method,op in item.items():
            if method not in ['get','post','put','patch','delete','head','options','trace']:continue
            for direction in (['request','response'] if 'requestBody' in op else ['response']):
                if (path,method,direction) not in covered:findings.append({'code':'UNCOVERED_OPERATION','severity':'error','path':path,'method':method,'direction':direction})
    return {'document_validation':document_status,'findings':findings,'cases':results,'passed':not any(f['severity']=='error' for f in findings) and all(r['passed'] for r in results),'limitations':['Captured JSON bodies only; no live endpoint calls','Parameters, headers, cookies and serialization not fully covered','Required readOnly/writeOnly omission semantics require OAS-aware validator','No JWT signature or current-grant verification','No remote/custom dialect resolution; unsupported cases block','Contract validation does not prove FERPA, transactions or SIS correctness']}

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--spec',required=True);a.add_argument('--captures',required=True);a.add_argument('--report',default='oas-report.json');args=a.parse_args()
    b=Path(args.spec).read_bytes();report=audit(json.loads(b),json.loads(Path(args.captures).read_text()));report['spec_sha256']=hashlib.sha256(b).hexdigest()
    Path(args.report).write_text(json.dumps(report,indent=2));raise SystemExit(0 if report['passed'] else 1)
