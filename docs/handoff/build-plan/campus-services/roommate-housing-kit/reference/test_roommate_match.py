import unittest
from roommate_match import match,sleep_overlap,segments
class MatchingTests(unittest.TestCase):
 def setUp(self):
  self.a={'opt_in':True,'shared':['lifestyle','noise','sleep'],'cleanliness':3,'social_activity':1,'noise_output':1,'noise_tolerance':2,'sleep':(1380,420)}
  self.b={'opt_in':True,'shared':['lifestyle','noise','sleep'],'cleanliness':2,'social_activity':3,'noise_output':3,'noise_tolerance':2,'sleep':(60,540)}
  self.w={'lifestyle':1,'noise':1,'sleep':1}
 def test_identical(self):self.assertEqual(match(self.a,self.a,self.w)['score'],100)
 def test_symmetric(self):self.assertEqual(match(self.a,self.b,self.w),match(self.b,self.a,self.w))
 def test_overnight(self):self.assertEqual(sleep_overlap((1380,420),(60,540)),.75)
 def test_no_sleep_overlap(self):self.assertEqual(sleep_overlap((0,60),(60,120)),0)
 def test_wrap_overlap(self):self.assertEqual(sleep_overlap((1380,60),(0,60)),.5)
 def test_zero_window(self):
  with self.assertRaises(ValueError):segments(0,0)
 def test_invalid_minute(self):
  with self.assertRaises(ValueError):segments(-1,60)
 def test_float_time(self):
  with self.assertRaises(ValueError):segments(1.5,60)
 def test_not_opted_in(self):self.assertEqual(match({**self.a,'opt_in':False},self.b,self.w)['status'],'excluded')
 def test_blocked(self):self.assertEqual(match(self.a,self.b,self.w,blocked=True)['status'],'excluded')
 def test_ineligible(self):self.assertEqual(match(self.a,self.b,self.w,eligible=False)['status'],'excluded')
 def test_unshared(self):self.assertIsNone(match({**self.a,'shared':[]},self.b,self.w)['score'])
 def test_zero_weights(self):self.assertIsNone(match(self.a,self.b,dict.fromkeys(self.w,0))['score'])
 def test_negative_weight(self):
  with self.assertRaises(ValueError):match(self.a,self.b,{**self.w,'noise':-1})
 def test_nan(self):
  with self.assertRaises(ValueError):match(self.a,self.b,{**self.w,'noise':float('nan')})
 def test_extra_weight(self):
  with self.assertRaises(ValueError):match(self.a,self.b,{**self.w,'identity':1})
 def test_partial_coverage(self):self.assertAlmostEqual(match({**self.a,'shared':['noise']},self.b,self.w)['coverage'],1/3,places=4)
 def test_missing_field(self):self.assertEqual(match({**self.a,'cleanliness':None},self.b,{'lifestyle':1,'noise':0,'sleep':0})['score'],50)
 def test_invalid_level(self):
  with self.assertRaises(ValueError):match({**self.a,'noise_output':5},self.b,self.w)
 def test_noise_tolerance(self):self.assertEqual(match({**self.a,'noise_tolerance':4},self.b,{'lifestyle':0,'noise':1,'sleep':0})['score'],100)
 def test_bool_level(self):
  with self.assertRaises(ValueError):match({**self.a,'cleanliness':True},self.b,self.w)
if __name__=='__main__':unittest.main()
