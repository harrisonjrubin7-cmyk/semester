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
        self.assertEqual(result['passed'],result['total']);self.assertIsNone(result['final_grade'])
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
    def test_mutation_is_only_penalised_where_the_contract_forbids_it(self):
        # Week 11 does not forbid mutation, so an in-place redact that returns the right dict earns full credit.
        result=self.run_week(10,'def redact(r):\n    for k in ("token","password","student_name","submission_body"): r.pop(k,None)\n    return r\n')
        self.assertEqual(result['passed'],result['total'])
    def test_weeks_8_and_15_cannot_pass_by_returning_a_constant(self):
        for index in (7,14):
            inputs=[json.dumps(c['input'],sort_keys=True) for c in MODULES[index]['cases']]
            self.assertGreaterEqual(len(set(inputs)),2,MODULES[index]['week'])
    def test_oversized_submission_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            submission=Path(folder)/'starter.py';submission.write_bytes(b'#'*65537)
            with self.assertRaises(ValueError):grade(MODULES[2],submission)
    def test_learner_output_does_not_corrupt_results(self):
        # A correct week 3 submission that prints while importing and while running must still score in full.
        code="print('importing')\nimport sys\ndef validate_task(r):\n    print('checking', r)\n    return isinstance(r,dict) and set(r)=={'id','title','status'} and all(isinstance(r[k],str) and bool(r[k].strip()) for k in ('id','title')) and r['status'] in ('open','completed')\n"
        result=self.run_code(code)
        self.assertIsNone(result['failure'])
        self.assertEqual(result['passed'],result['total'])
    def test_week5_and_week12_reject_partial_contracts(self):
        for index,code in ((4,"def authorize(r): return r['active']\n"),(11,"def retry_allowed(r): return r['method'] == 'GET'\n")):
            result=self.run_week(index,code)
            self.assertLess(result['passed'],result['total'],MODULES[index]['week'])
    def test_correct_week5_and_week12_pass_every_case(self):
        authorize="def authorize(r): return r['active'] is True and 'tasks:read' in r['scopes']\n"
        retry="def retry_allowed(r): return r['status'] in (429,503) and r['attempt']<r['max_attempts'] and (r['method']=='GET' or bool(r.get('idempotency_key')))\n"
        for code,index in ((authorize,4),(retry,11)):
            result=self.run_week(index,code)
            self.assertEqual(result['passed'],result['total'],MODULES[index]['week'])
    def test_unexpected_valueerror_is_a_learner_error(self):
        result=self.run_code('def validate_task(r): raise ValueError()\n')
        self.assertEqual(result['failure'],'learner_exception')
    def test_tuple_results_do_not_pass_list_contracts(self):
        code="def paginate(r):\n    if r['offset']<0 or not 1<=r['limit']<=100: raise ValueError()\n    return tuple(r['items'][r['offset']:r['offset']+r['limit']])\n"
        result=self.run_week(3,code)
        self.assertLess(result['passed'],result['total'])
    def test_reference_solutions_pass_every_case(self):
        references={
            1:"def classify_record(r): return {'draft':'private','grade':'official','fixture':'synthetic'}[r['kind']]\n",
            2:"def validate_pr(r): return all(isinstance(r.get(k),str) and bool(r[k].strip()) for k in ('title','test_evidence','reviewer'))\n",
            3:"def validate_task(r):\n    return isinstance(r,dict) and set(r)=={'id','title','status'} and all(isinstance(r[k],str) and bool(r[k].strip()) for k in ('id','title')) and r['status'] in ('open','completed')\n",
            4:"def paginate(r):\n    if r['offset']<0 or not 1<=r['limit']<=100: raise ValueError()\n    return r['items'][r['offset']:r['offset']+r['limit']]\n",
            6:"def tenant_access(r): return bool(r['principal_tenant']) and r['principal_tenant']==r['resource_tenant'] and r['active'] is True and 'tasks:read' in r['scopes']\n",
            7:"def audit_ready(r): return all(isinstance(r.get(k),str) and bool(r[k]) for k in ('actor','tenant','action','target','request_id'))\n",
            10:"def deduplicate(r):\n    out=[]\n    for i in r['ids']:\n        if i not in out: out.append(i)\n    return out\n",
            11:"def redact(r): return {k:v for k,v in r.items() if k not in ('token','password','student_name','submission_body')}\n",
            13:"def safe_destination(r):\n    from urllib.parse import urlsplit\n    import ipaddress\n    u=urlsplit(r['url'])\n    try: ip=ipaddress.ip_address(u.hostname)\n    except ValueError: return False\n    return u.scheme=='https' and ip.is_global and u.username is None and u.password is None and u.port in (None,443)\n",
            14:"def evidence_ready(r):\n    t=r.get('tests',{})\n    return all(bool(r.get(k)) for k in ('artifact_digest','contract_version','fixture_version')) and all(t.get(k) is True for k in ('contract','isolation','revocation','accessibility','recovery'))\n",
            16:"def activation_ready(r): return all(r.get(k) is True for k in ('certified','institution_approved','reconciled','rollback_ready','support_ready'))\n",
            9:"def idempotency(r):\n    p=r['previous_digest']\n    if p is None: return 'execute'\n    return 'replay' if p==r['digest'] else 'conflict'\n",
            15:"def reconcile(r):\n    e=set(r['expected']); o=set(r['observed'])\n    return {'missing':sorted(e-o),'unexpected':sorted(o-e)}\n",
        }
        for week,code in references.items():
            result=self.run_week(week-1,code)
            self.assertEqual(result['passed'],result['total'],'week %d'%week)
    def test_nested_result_types_are_checked(self):
        code="def reconcile(r):\n    return {'missing':tuple(sorted(set(r['expected'])-set(r['observed']))),'unexpected':tuple(sorted(set(r['observed'])-set(r['expected'])))}\n"
        result=self.run_week(14,code)
        self.assertLess(result['passed'],result['total'])
    def test_learner_module_is_registered_before_execution(self):
        code="from __future__ import annotations\nfrom dataclasses import dataclass\n@dataclass\nclass Check:\n    value: int = 0\ndef validate_task(r):\n    return isinstance(r,dict) and set(r)=={'id','title','status'} and all(isinstance(r[k],str) and bool(r[k].strip()) for k in ('id','title')) and r['status'] in ('open','completed')\n"
        result=self.run_code(code)
        self.assertIsNone(result['failure'])
        self.assertEqual(result['passed'],result['total'])
    def test_verification_record_matches_the_suite(self):
        record=json.loads((BASE/'verification.json').read_text())
        self.assertEqual(record['week3_visible_cases_passed'],len(MODULES[2]['cases']))
        self.assertEqual(record['harness_unittest_methods'],len([n for n in dir(HarnessTests) if n.startswith('test_')]))
    def test_common_shortcuts_lose_points(self):
        shortcuts={
            13:"def safe_destination(r):\n    from urllib.parse import urlsplit\n    u=urlsplit(r['url'])\n    return u.scheme=='https' and ':' not in u.hostname and '.' in u.hostname and u.username is None and u.port in (None,443)\n",
            14:"def evidence_ready(r):\n    t=r.get('tests',{})\n    return all(bool(r.get(k)) for k in ('artifact_digest','contract_version','fixture_version')) and all(t.get(k) for k in ('contract','isolation','revocation','accessibility','recovery'))\n",
            11:"def redact(r):\n    for k in ('token','password','student_name','submission_body'):\n        if k in r:\n            r.pop(k)\n            break\n    return r\n",
        }
        for week,code in shortcuts.items():
            result=self.run_week(week-1,code)
            self.assertLess(result['passed'],result['total'],'week %d'%week)
    def test_unserializable_result_is_incorrect_not_a_worker_failure(self):
        # A set cannot cross the JSON result channel; it must score as wrong, not abort the whole grade.
        result=self.run_week(9,'def deduplicate(r): return set(r["ids"])\n')
        self.assertIsNone(result['failure'])
        self.assertEqual(result['passed'],0)
        self.assertEqual(result['learner_errors'],0)
    def test_always_false_does_not_earn_full_credit(self):
        for index,name in ((13,'evidence_ready'),(15,'activation_ready')):
            result=self.run_week(index,f'def {name}(r): return False\n')
            self.assertLess(result['passed'],result['total'],MODULES[index]['week'])
if __name__=='__main__': unittest.main()
