import copy
from jsonschema import Draft202012Validator,FormatChecker

def migrate_subset(schema):
    if not isinstance(schema,dict):raise ValueError('3.0 Schema Object required')
    s=copy.deepcopy(schema)
    allowed={'type','properties','required','additionalProperties','items','allOf','anyOf','oneOf','not','enum','nullable','minimum','maximum','exclusiveMinimum','exclusiveMaximum','minLength','maxLength','pattern','minItems','maxItems','uniqueItems','minProperties','maxProperties','format','description','title','default','example','deprecated','readOnly','writeOnly','discriminator','multipleOf'}
    if set(s)-allowed:raise ValueError('Unsupported keyword')
    if isinstance(s.get('type'),list) or s.get('type')=='null':raise ValueError('Not 3.0 type')
    n=s.pop('nullable',False)
    if not isinstance(n,bool):raise ValueError('Invalid nullable')
    if n:
        if 'type' not in s:raise ValueError('Local type required')
        s['type']=[s['type'],'null']
    for flag,bound in [('exclusiveMinimum','minimum'),('exclusiveMaximum','maximum')]:
        if flag in s:
            e=s.pop(flag)
            if not isinstance(e,bool):raise ValueError('Boolean flag required')
            if e:
                if bound not in s:raise ValueError('Missing bound')
                s[flag]=s.pop(bound)
    if 'properties' in s:s['properties']={k:migrate_subset(v) for k,v in s['properties'].items()}
    for k in ['items','not']:
        if k in s:s[k]=migrate_subset(s[k])
    if isinstance(s.get('additionalProperties'),dict):s['additionalProperties']=migrate_subset(s['additionalProperties'])
    for k in ['allOf','anyOf','oneOf']:
        if k in s:s[k]=[migrate_subset(v) for v in s[k]]
    if s.get('readOnly') or s.get('writeOnly') or 'discriminator' in s:raise ValueError('Manual directional/composition review required')
    Draft202012Validator.check_schema(s);return s

def validate(schema,payload):
    Draft202012Validator.check_schema(schema)
    return [{'keyword':e.validator,'instance_path':'/'+ '/'.join(map(str,e.absolute_path)),'schema_path':'/'+ '/'.join(map(str,e.absolute_schema_path))} for e in Draft202012Validator(schema,format_checker=FormatChecker()).iter_errors(payload)]

def enrollment_schema():
    uid={'type':'string','format':'uuid'};arr={'type':'array','items':uid,'minItems':1,'maxItems':12,'uniqueItems':True}
    common={'studentId':uid,'termCode':{'type':'string','pattern':'^[0-9]{4}(FA|SP|SU)$'},'expectedScheduleVersion':{'type':'integer','minimum':0}}
    out=[]
    for op in ['add','drop','swap','withdraw']:
        props={**common,'operation':{'const':op}};req=list(props)
        if op in ['add','swap']:props['sectionIds']=arr;req.append('sectionIds')
        if op in ['drop','swap','withdraw']:props['fromEnrollmentIds']=arr;req.append('fromEnrollmentIds')
        out.append({'type':'object','properties':props,'required':req,'additionalProperties':False})
    return {'oneOf':out}
