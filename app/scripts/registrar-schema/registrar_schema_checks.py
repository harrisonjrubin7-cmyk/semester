import copy,re
from jsonschema import Draft202012Validator,FormatChecker
from jsonschema.exceptions import SchemaError
from jsonschema.validators import extend
# OpenAPI 3.0 integers are JSON numbers without a fraction or exponent, so 1.0 and 1e0 are not integers here.
StrictValidator=extend(Draft202012Validator,type_checker=Draft202012Validator.TYPE_CHECKER.redefine('integer',lambda c,x:isinstance(x,int) and not isinstance(x,bool)))

def ecma_pattern(p):
    # Python's . excludes only \n and its $ also matches before a final \n; ECMA-262's . also excludes \r, U+2028 and
    # U+2029, and its $ matches only at the end of input. Rewrite unescaped . and $ outside character classes.
    out=[];i=0;in_class=False
    while i<len(p):
        c=p[i]
        if c=='\\':out.append(p[i:i+2]);i+=2;continue
        if in_class and c==']':in_class=False
        elif not in_class and c=='[':in_class=True
        if c=='.' and not in_class:out.append(r'[^\n\r  ]')
        elif c=='$' and not in_class:out.append(r'(?![\s\S])')
        else:out.append(c)
        i+=1
    return ''.join(out)

def migrate_subset(schema):
    if not isinstance(schema,dict):raise ValueError('3.0 Schema Object required')
    s=copy.deepcopy(schema)
    allowed={'type','properties','required','additionalProperties','items','allOf','anyOf','oneOf','not','enum','nullable','minimum','maximum','exclusiveMinimum','exclusiveMaximum','minLength','maxLength','pattern','minItems','maxItems','uniqueItems','minProperties','maxProperties','format','description','title','default','example','deprecated','readOnly','writeOnly','discriminator','multipleOf'}
    if set(s)-allowed:raise ValueError('Unsupported keyword')
    if isinstance(s.get('type'),list) or s.get('type')=='null':raise ValueError('Not 3.0 type')
    if s.get('type')=='array' and 'items' not in s:raise ValueError('items required for array')
    if 'enum' in s and (not isinstance(s['enum'],list) or not s['enum']):raise ValueError('enum must be a non-empty array')
    if 'required' in s and (not isinstance(s['required'],list) or not s['required']):raise ValueError('required must be a non-empty array')
    if 'example' in s:s['examples']=[s.pop('example')]
    if 'properties' in s and not isinstance(s['properties'],dict):raise ValueError('properties must be a mapping')
    n=s.pop('nullable',False)
    if not isinstance(n,bool):raise ValueError('Invalid nullable')
    if n:
        if 'type' not in s:raise ValueError('Local type required')
        s['type']=[s['type'],'null']
    if 'default' in s and 'type' in s:
        try:Draft202012Validator.check_schema({'type':s['type']})
        except SchemaError as ex:raise ValueError(f'invalid type: {ex.message}') from ex
        if not StrictValidator({'type':s['type']}).is_valid(s['default']):raise ValueError('default does not match declared type')
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
    if 'additionalProperties' in s and not isinstance(s['additionalProperties'],(bool,dict)):raise ValueError('additionalProperties must be a boolean or schema')
    if isinstance(s.get('additionalProperties'),dict):s['additionalProperties']=migrate_subset(s['additionalProperties'])
    for k in ['allOf','anyOf','oneOf']:
        if k in s and not isinstance(s[k],list):raise ValueError('composition must be an array')
        if k in s:s[k]=[migrate_subset(v) for v in s[k]]
    if s.get('readOnly') or s.get('writeOnly') or 'discriminator' in s:raise ValueError('Manual directional/composition review required')
    if isinstance(s.get('pattern'),str) and re.search(r'\\[dDwWsSbB]',s['pattern']):raise ValueError('pattern shorthand class differs from ECMA-262')
    if isinstance(s.get('pattern'),str):s['pattern']=ecma_pattern(s['pattern'])
    try:Draft202012Validator.check_schema(s)
    except SchemaError as ex:raise ValueError(f'invalid schema: {ex.message}') from ex
    return s

def pointer(parts):
    # RFC 6901: the root is the empty string, and ~ and / inside a token are escaped
    return ''.join('/'+str(p).replace('~','~0').replace('/','~1') for p in parts)

MISSING=object()

def same_const(a,b):return Draft202012Validator({'const':b}).is_valid(a)

def branch_operation(e,i):
    branches=e.schema.get(e.validator,[]) if isinstance(e.schema,dict) else []
    branch=branches[i] if isinstance(i,int) and 0<=i<len(branches) else None
    props=branch.get('properties',{}) if isinstance(branch,dict) else {}
    op=props.get('operation',{}) if isinstance(props,dict) else {}
    return op.get('const',MISSING) if isinstance(op,dict) else MISSING

def leaf_errors(e):
    # A oneOf/anyOf error hides its reasons in context. Descend into the branch whose operation const
    # matches the payload's operation; if none does, fall back to the branch with the fewest errors.
    if e.validator not in ('oneOf','anyOf') or not e.context:return [e]
    branches={}
    for c in e.context:branches.setdefault(c.relative_schema_path[0] if c.relative_schema_path else None,[]).append(c)
    op=e.instance.get('operation',MISSING) if isinstance(e.instance,dict) else MISSING
    matched=[i for i in branches if op is not MISSING and branch_operation(e,i) is not MISSING and same_const(branch_operation(e,i),op)]
    pool=[branches[i] for i in matched] or list(branches.values())
    return [leaf for c in min(pool,key=len) for leaf in leaf_errors(c)]

def validate(schema,payload):
    Draft202012Validator.check_schema(schema)
    errors=StrictValidator(schema,format_checker=FormatChecker()).iter_errors(payload)
    return [{'keyword':e.validator,'message':e.message,'instance_path':pointer(e.absolute_path),'schema_path':pointer(e.absolute_schema_path)} for top in errors for e in leaf_errors(top)]

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
