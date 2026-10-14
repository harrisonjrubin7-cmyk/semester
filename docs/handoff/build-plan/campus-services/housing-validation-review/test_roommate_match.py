import unittest
from roommate_match import match,sleep_overlap,segments
A={'opt_in':True,'shared':['lifestyle','noise','sleep'],'cleanliness':3,'social_activity':1,'noise_output':1,'noise_tolerance':2,'sleep':(1380,420)}
B={'opt_in':True,'shared':['lifestyle','noise','sleep'],'cleanliness':2,'social_activity':3,'noise_output':3,'noise_tolerance':2,'sleep':(60,540)}
W={'lifestyle':1,'noise':1,'sleep':1}
class Tests(unittest.TestCase):
 def test_identical(self):self.assertEqual(match(A,A,W)['score'],100)
 def test_equal(self):self.assertEqual(match(A,B,W)['score'],75)
 def test_symmetric(self):self.assertEqual(match(A,B,W),match(B,A,W))
 def test_overnight(self):self.assertEqual(sleep_overlap(A['sleep'],B['sleep']),.75)
 def test_wrap(self):self.assertEqual(sleep_overlap((1380,60),(0,60)),.5)
 def test_no_overlap(self):self.assertEqual(sleep_overlap((0,60),(60,120)),0)
 def test_zero_sleep(self):
  with self.assertRaises(ValueError):segments(0,0)
 def test_invalid_time(self):
  with self.assertRaises(ValueError):segments(-1,60)
 def test_float_time(self):
  with self.assertRaises(ValueError):segments(1.5,60)
 def test_no_opt(self):self.assertEqual(match({**A,'opt_in':False},B,W)['status'],'excluded')
 def test_block(self):self.assertEqual(match(A,B,W,blocked=True)['status'],'excluded')
 def test_ineligible(self):self.assertEqual(match(A,B,W,eligible=False)['status'],'excluded')
 def test_no_shared(self):self.assertIsNone(match({**A,'shared':[]},B,W)['score'])
 def test_zero_weights(self):self.assertIsNone(match(A,B,dict.fromkeys(W,0))['score'])
 def test_negative_weight(self):
  with self.assertRaises(ValueError):match(A,B,{**W,'noise':-1})
 def test_nan(self):
  with self.assertRaises(ValueError):match(A,B,{**W,'noise':float('nan')})
 def test_unknown_weight(self):
  with self.assertRaises(ValueError):match(A,B,{**W,'identity':1})
 def test_missing_coverage(self):self.assertAlmostEqual(match(A,{**B,'shared':['noise','sleep']},W)['coverage'],2/3,places=4)
 def test_invalid_level(self):
  with self.assertRaises(ValueError):match({**A,'noise_output':5},B,W)
 def test_bool_level(self):
  with self.assertRaises(ValueError):match({**A,'cleanliness':True},B,W)
 def test_noise_tolerance(self):self.assertEqual(match({**A,'noise_tolerance':4},B,{'lifestyle':0,'noise':1,'sleep':0})['score'],100)
if __name__=='__main__':unittest.main()
