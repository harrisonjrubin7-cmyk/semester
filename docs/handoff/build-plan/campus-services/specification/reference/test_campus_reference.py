import unittest
from datetime import date
from campus_reference import periods_overlap,standard_title_iv_deadline,hold_cancellation_deadline,rollover_preview,roommate_similarity
class CampusReferenceTests(unittest.TestCase):
 def test_overlap(self):self.assertTrue(periods_overlap(1,4,3,5))
 def test_adjacent(self):self.assertFalse(periods_overlap(1,3,3,5))
 def test_invalid(self):
  with self.assertRaises(ValueError):periods_overlap(4,1,3,5)
 def test_credit_before_classes(self):self.assertEqual(standard_title_iv_deadline(date(2026,8,1),date(2026,8,20)),date(2026,9,3))
 def test_credit_after_classes(self):self.assertEqual(standard_title_iv_deadline(date(2026,8,25),date(2026,8,20)),date(2026,9,8))
 def test_credit_on_start(self):self.assertEqual(standard_title_iv_deadline(date(2026,8,20),date(2026,8,20)),date(2026,9,3))
 def test_cancellation(self):self.assertEqual(hold_cancellation_deadline(date(2026,10,13)),date(2026,10,27))
 def test_roll_cap(self):self.assertEqual(rollover_preview(100,30,0,50,True)['transfer'],50)
 def test_roll_ineligible(self):self.assertEqual(rollover_preview(100,30,0,50,False)['transfer'],0)
 def test_reserved(self):
  r=rollover_preview(100,30,20,100,True);self.assertEqual(r['transfer'],50);self.assertTrue(r['requires_reserved_resolution'])
 def test_overdrawn(self):
  with self.assertRaises(ValueError):rollover_preview(10,8,3,10,True)
 def test_float(self):
  with self.assertRaises(ValueError):rollover_preview(10.0,0,0,10,True)
 def test_missing_roommate(self):self.assertIsNone(roommate_similarity({}, {}, {'quiet':1})['score'])
 def test_explained(self):
  r=roommate_similarity({'quiet':True,'sleep':'early'},{'quiet':True,'sleep':'late'},{'quiet':2,'sleep':1});self.assertAlmostEqual(r['score'],2/3);self.assertEqual(len(r['compared_fields']),2)
 def test_negative_weight(self):
  with self.assertRaises(ValueError):roommate_similarity({}, {}, {'quiet':-1})
if __name__=='__main__':unittest.main()
