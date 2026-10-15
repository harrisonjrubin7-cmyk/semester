import ast, json, tempfile, unittest
from pathlib import Path
from grader import grade
BASE=Path(__file__).resolve().parent
MODULES=json.loads((BASE/'curriculum.json').read_text())
class HarnessTests(unittest.TestCase):
    def run_code(self,code,timeout=2):
        with tempfile.TemporaryDirectory() as folder:
            submission=Path(folder)/'starter.py';submission.write_text(code)
            return grade(MODULES[2],submission,timeout)
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
    def test_int_is_not_bool(self):
        # 1/0 must not pass True/False cases (Python's == says 1 == True).
        result=self.run_code("def validate_task(r):\n    return int(isinstance(r,dict) and set(r)=={'id','title','status'} and isinstance(r.get('id'),str))\n")
        self.assertEqual(result['passed'],0)
    def test_forged_stdout_ignored(self):
        # Learner print() must not reach the result channel.
        result=self.run_code("import json\nprint(json.dumps([{'value':True}]*4))\ndef validate_task(r): raise ValueError()\n")
        self.assertEqual(result['passed'],0);self.assertIsNone(result['failure'])
if __name__=='__main__': unittest.main()
