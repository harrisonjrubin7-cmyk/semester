import unittest
from registrar_schema_checks import migrate_subset,validate,enrollment_schema
U='11111111-1111-4111-8111-111111111111'
V='a1b2c3d4-1111-4111-8111-111111111111'
class MigrationTests(unittest.TestCase):
    def test_null_union(self):self.assertFalse(validate(migrate_subset({'type':'string','nullable':True}),None))
    def test_enum_excludes_null(self):self.assertTrue(validate(migrate_subset({'type':'string','nullable':True,'enum':['A']}),None))
    def test_enum_includes_null(self):self.assertFalse(validate(migrate_subset({'type':'string','nullable':True,'enum':['A',None]}),None))
    def test_required_presence(self):self.assertTrue(validate(migrate_subset({'type':'object','required':['x'],'properties':{'x':{'type':'string','nullable':True}}}),{}))
    def test_required_null(self):self.assertFalse(validate(migrate_subset({'type':'object','required':['x'],'properties':{'x':{'type':'string','nullable':True}}}),{'x':None}))
    def test_exclusive(self):self.assertTrue(validate(migrate_subset({'type':'number','minimum':0,'exclusiveMinimum':True}),0))
    def test_inclusive(self):self.assertFalse(validate(migrate_subset({'type':'number','minimum':0,'exclusiveMinimum':False}),0))
    def blocked(self,s):
        with self.assertRaises(ValueError):migrate_subset(s)
    def test_no_type(self):self.blocked({'nullable':True})
    def test_ref(self):self.blocked({'$ref':'https://invalid.example'})
    def test_direction(self):self.blocked({'type':'string','readOnly':True})
    def test_discriminator(self):self.blocked({'type':'object','discriminator':{'propertyName':'kind'}})
    def test_union_input(self):self.blocked({'type':['string','null']})
    def test_array_without_items(self):self.blocked({'type':'array'})
    def test_example_becomes_examples(self):
        s=migrate_subset({'type':'string','example':'A'});self.assertNotIn('example',s);self.assertEqual(s['examples'],['A'])
    def test_default_must_match_type(self):self.blocked({'type':'integer','default':'oops'})
    def test_valid_default_kept(self):self.assertEqual(migrate_subset({'type':'integer','default':3})['default'],3)
    def test_properties_must_be_mapping(self):self.blocked({'type':'object','properties':[]})
    def test_composition_must_be_array(self):self.blocked({'oneOf':None})
    def test_null_default_rejected_unless_nullable(self):
        self.blocked({'type':'string','default':None})
        self.assertIsNone(migrate_subset({'type':'string','nullable':True,'default':None})['default'])
    def test_boolean_branch_does_not_crash(self):
        self.assertTrue(validate({'oneOf':[False,False]},1))
    def test_date_time_format_is_checked(self):self.assertTrue(validate(migrate_subset({'type':'string','format':'date-time'}),'not valid'))
class EnrollmentTests(unittest.TestCase):
    def body(self,op='add'):
        b={'studentId':U,'termCode':'2026FA','expectedScheduleVersion':1,'operation':op}
        if op in ['add','swap']:b['sectionIds']=[U]
        if op in ['drop','swap','withdraw']:b['fromEnrollmentIds']=[U]
        return b
    def invalid(self,b):self.assertTrue(validate(enrollment_schema(),b))
    def test_valid_operations(self):
        for op in ['add','drop','swap','withdraw']:
            with self.subTest(op=op):self.assertFalse(validate(enrollment_schema(),self.body(op)))
    def test_swap_source(self):
        b=self.body('swap');del b['fromEnrollmentIds'];self.invalid(b)
    def test_irrelevant_array(self):
        b=self.body('drop');b['sectionIds']=[U];self.invalid(b)
    def test_empty(self):
        b=self.body();b['sectionIds']=[];self.invalid(b)
    def test_duplicate(self):
        b=self.body();b['sectionIds']=[U,U];self.invalid(b)
    def test_uuid(self):
        b=self.body();b['studentId']='bad';self.invalid(b)
    def test_boolean_version(self):
        b=self.body();b['expectedScheduleVersion']=True;self.invalid(b)
    def test_negative_version(self):
        b=self.body();b['expectedScheduleVersion']=-1;self.invalid(b)
    def test_term(self):
        b=self.body();b['termCode']='Fall';self.invalid(b)
    def test_extra(self):
        b=self.body();b['role']='registrar';self.invalid(b)
    def test_term_trailing_newline(self):
        b=self.body();b['termCode']='2026FA\n';self.invalid(b)
    def test_uppercase_uuid(self):
        b=self.body();b['studentId']=V.upper();self.invalid(b)
    def test_uppercase_duplicate_in_array(self):
        b=self.body();b['sectionIds']=[V,V.upper()];self.invalid(b)
    def test_root_error_pointer_is_empty(self):
        b=self.body();del b['studentId']
        self.assertIn('',[e['instance_path'] for e in validate(enrollment_schema(),b)])
    def test_pointer_escapes_tilde_and_slash(self):
        from registrar_schema_checks import pointer
        self.assertEqual(pointer(['a/b','c~d']),'/a~1b/c~0d')
    def test_nodes_are_independent(self):
        s=enrollment_schema();s['oneOf'][0]['properties']['sectionIds']['maxItems']=2
        self.assertEqual(s['oneOf'][1]['properties']['fromEnrollmentIds']['maxItems'],12)
    def test_nested_error_names_the_field(self):
        b=self.body();b['studentId']='bad'
        self.assertIn('/studentId',[e['instance_path'] for e in validate(enrollment_schema(),b)])
        self.assertNotIn('oneOf',[e['keyword'] for e in validate(enrollment_schema(),b)])
    def test_operation_branch_is_selected(self):
        b=self.body();b['sectionIds']=['bad','bad']
        errs=validate(enrollment_schema(),b);paths=[e['instance_path'] for e in errs]
        self.assertTrue(any(p.startswith('/sectionIds') for p in paths))
        self.assertNotIn('const',[e['keyword'] for e in errs])
    def test_required_errors_name_the_field(self):
        msgs=[e['message'] for e in validate(enrollment_schema(),{})]
        self.assertTrue(any("'studentId'" in m for m in msgs))
    def test_boolean_operation_subschema_does_not_crash(self):
        s={'oneOf':[{'type':'object','properties':{'operation':False}},{'type':'object','properties':{'operation':False}}]}
        self.assertTrue(validate(s,{'operation':'add'}))
    def test_artifact_matches_builder(self):
        import json,os
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'enrollment_commands.schema.json')) as f:artifact=json.load(f)
        artifact.pop('$schema');self.assertEqual(artifact,enrollment_schema())
if __name__=='__main__':unittest.main(verbosity=2)
