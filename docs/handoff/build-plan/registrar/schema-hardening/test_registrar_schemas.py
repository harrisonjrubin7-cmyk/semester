import unittest
from registrar_schema_checks import migrate_subset,validate,enrollment_schema
U='11111111-1111-4111-8111-111111111111'
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
if __name__=='__main__':unittest.main(verbosity=2)
