import copy, importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("submission",Path(__file__).with_name("week3_starter.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class ContractTests(unittest.TestCase):
    def test_valid(self):
        self.assertIs(module.validate_task({"id":"t1","title":"Review","status":"open"}),True)
    def test_completed(self):
        self.assertIs(module.validate_task({"id":"t1","title":"Review","status":"completed"}),True)
    def test_invalid(self):
        for record in [None,[],"task",{}, {"id":1,"title":"Review","status":"open"},
                       {"id":"t1","title":"   ","status":"open"},
                       {"id":"t1","title":"Review","status":"OPEN"},
                       {"id":"t1","title":"Review","status":"open","tenantId":"other"}]:
            with self.subTest(record=record): self.assertIs(module.validate_task(record),False)
    def test_no_mutation(self):
        record={"id":"t1","title":"Review","status":"open"};before=copy.deepcopy(record)
        module.validate_task(record);self.assertEqual(record,before)
if __name__=="__main__": unittest.main()
