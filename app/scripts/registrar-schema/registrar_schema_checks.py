import copy
from jsonschema import Draft202012Validator,FormatChecker

def migrate_subset(schema):
    if not isinstance(schema,dict):raise ValueError('3.0 Schema Object required')
    s=copy.deepcopy(schema)
    allowed={'type','properties','required','additionalProperties','items','allOf','anyOf','oneOf','not','enum','nullable','minimum','maximum','exclusiveMinimum','exclusiveMaximum','minLength','maxLength','pattern','minItems','maxItems','uniqueItems','minProperties','maxProperties','format','description','title','default','example','deprecated','readOnly','writeOnly','discriminator','multipleOf'}
    if set(s)-allowed:raise ValueError('Unsupported keyword')
    if isinstance(s.get('type'),list) or s.get('type')=='null':raise ValueError('Not 3.0 type')
    if s.get('type')=='array' and 'items' not in s:raise ValueError('items required for array')
    if 'example' in s:s['examples']=[s.pop('example')]
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

def pointer(parts):
    # RFC 6901: the root is the empty string, and ~ and / inside a token are escaped
    return ''.join('/'+str(p).replace('~','~0').replace('/','~1') for p in parts)

def leaf_errors(e):
    # A oneOf/anyOf error hides its reasons in context. Descend into the branch with the fewest errors,
    # which for an enrollment command is the branch its operation selects.
    if e.validator not in ('oneOf','anyOf') or not e.context:return [e]
    branches={}
    for c in e.context:branches.setdefault(c.relative_schema_path[0],[]).append(c)
    return [leaf for c in min(branches.values(),key=len) for leaf in leaf_errors(c)]

def validate(schema,payload):
    Draft202012Validator.check_schema(schema)
    errors=Draft202012Validator(schema,format_checker=FormatChecker()).iter_errors(payload)
    return [{'keyword':e.validator,'instance_path':pointer(e.absolute_path),'schema_path':pointer(e.absolute_schema_path)} for top in errors for e in leaf_errors(top)]

# Length bounds sit beside each pattern: Python's $ also matches before a trailing newline.
# The UUID pattern is lowercase-only so one identifier has one spelling and uniqueItems can see duplicates.
def uuid_node():return {'type':'string','format':'uuid','pattern':'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$','minLength':36,'maxLength':36}
def uuid_array():return {'type':'array','items':uuid_node(),'minItems':1,'maxItems':12,'uniqueItems':True}
def term_node():return {'type':'string','pattern':'^[0-9]{4}(FA|SP|SU)$','minLength':6,'maxLength':6}

def enrollment_schema():
    out=[]
    for op in ['add','drop','swap','withdraw']:
        props={'studentId':uuid_node(),'termCode':term_node(),'expectedScheduleVersion':{'type':'integer','minimum':0},'operation':{'const':op}};req=list(props)
        if op in ['add','swap']:props['sectionIds']=uuid_array();req.append('sectionIds')
        if op in ['drop','swap','withdraw']:props['fromEnrollmentIds']=uuid_array();req.append('fromEnrollmentIds')
        out.append({'type':'object','properties':props,'required':req,'additionalProperties':False})
    return {'oneOf':out}
