import ast, json, tempfile, unittest
from pathlib import Path
from grader import grade
BASE=Path(__file__).resolve().parent
MODULES=json.loads((BASE/'curriculum.json').read_text())
class HarnessTests(unittest.TestCase):
    def run_week(self,index,code,timeout=2):
        with tempfile.TemporaryDirectory() as folder:
            submission=Path(folder)/'starter.py';submission.write_text(code)
            return grade(MODULES[index],submission,timeout)
    def run_code(self,code,timeout=2):
        return self.run_week(2,code,timeout)
    def test_syllabus(self):
        self.assertEqual([m['week'] for m in MODULES],list(range(1,17)))
        self.assertEqual(len({m['function'] for m in MODULES}),16)
        for m in MODULES:
            self.assertTrue(m['requirements']);self.assertTrue(m['cases'])
            ast.parse('def '+m['function']+'(record):\n    raise NotImplementedError()\n')
    def test_week3_reference(self):
        result=self.run_code("def validate_task(r):\n    return isinstance(r,dict) and set(r)=={'id','title','status'} and all(isinstance(r[k],str) and bool(r[k].strip()) for k in ('id','title')) and r['status'] in ('open','completed')\n")
        self.assertEqual(result['passed'],4);self.assertIsNone(result['final_grade'])
    def test_incorrect_submission(self):
        result=self.run_code('def validate_task(r): return True\n')
        self.assertEqual(result['passed'],1)
    def test_import_failure(self):
        self.assertEqual(self.run_code('raise RuntimeError()\n')['failure'],'execution_failed')
    def test_timeout(self):
        self.assertEqual(self.run_code('while True: pass\n',0.2)['failure'],'timeout')
    def test_output_limit(self):
        self.assertEqual(self.run_code("print('x'*100000)\n")['failure'],'output_limit')
    def test_boolean_contracts_reject_integers(self):
        # Python treats 0 == False, so a bare 0 must not earn a boolean contract's points.
        result=self.run_code('def validate_task(r): return 0\n')
        self.assertEqual(result['passed'],0)
    def test_input_mutation_is_not_correct(self):
        # Week 3 forbids mutating the input, even when the returned boolean is right.
        result=self.run_code('def validate_task(r):\n    if isinstance(r,dict): r.clear()\n    return False\n')
        self.assertEqual(result['passed'],1)
    def test_learner_exceptions_are_reported(self):
        result=self.run_code('def validate_task(r): raise RuntimeError()\n')
        self.assertEqual(result['failure'],'learner_exception')
        self.assertEqual(result['learner_errors'],result['total'])
    def test_weeks_14_and_16_have_success_cases(self):
        for index in (13,15):
            self.assertTrue(any(c['expected'] is True for c in MODULES[index]['cases']),MODULES[index]['week'])
    def test_always_false_does_not_earn_full_credit(self):
        for index,name in ((13,'evidence_ready'),(15,'activation_ready')):
            result=self.run_week(index,f'def {name}(r): return False\n')
            self.assertLess(result['passed'],result['total'],MODULES[index]['week'])
if __name__=='__main__': unittest.main()
