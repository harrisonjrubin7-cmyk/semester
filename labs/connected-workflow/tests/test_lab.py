import unittest,tempfile,time,sqlite3
from pathlib import Path
from lab.core import Lab,Rejected
class TestLab(unittest.TestCase):
 def setUp(self):
  self.dir=tempfile.TemporaryDirectory();self.lab=Lab(Path(self.dir.name)/'lab.sqlite');self.lab.seed();self.n=0
 def tearDown(self):self.dir.cleanup()
 def cmd(self,who,command,payload=None,key=None):
  self.n+=1;return self.lab.execute('demo-'+who,command,payload or {},key or 'k'+str(self.n))
 def onboard(self):return self.cmd('a-student','onboarding.complete')
 def draft(self):
  self.onboard();self.cmd('a-student','submission.create',{'body':'synthetic work'});return self.cmd('a-faculty','grade.draft',{'student':'a-student','score':85,'version':0})
 def request_grade(self):
  g=self.draft();return g,self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1,'reason':'Reviewed rubric'})
 def hold_request(self):
  self.onboard();return self.cmd('a-registrar','hold.request_clear',{'student':'a-student','version':2,'reason':'Synthetic resolution'})
 def test_full_learning_loop(self):
  g,a=self.request_grade();self.assertEqual(self.lab.view('demo-a-student')['grades'],[])
  r=self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']});self.assertEqual(r['projection'],'updating');self.assertEqual(self.lab.view('demo-a-student')['grades'],[])
  self.lab.project('demo-a-operator');self.assertEqual(self.lab.view('demo-a-student')['grades'][0]['score'],85)
 def test_onboarding_required(self):
  with self.assertRaises(Rejected):self.cmd('a-student','submission.create',{'body':'x'})
 def test_hold_clear_not_ready(self):
  a=self.hold_request();self.cmd('a-reviewer','hold.approve_clear',{'approval':a['approval']});self.assertEqual(self.lab.view('demo-a-student')['readiness'],'unknown')
 def test_readiness_confirmed(self):
  a=self.hold_request();self.cmd('a-reviewer','hold.approve_clear',{'approval':a['approval']});self.cmd('a-registrar','source.confirm_prerequisite',{'student':'a-student','version':3});self.assertEqual(self.lab.view('demo-a-student')['readiness'],'ready_as_of')
 def test_stale_source(self):
  a=self.hold_request();self.cmd('a-reviewer','hold.approve_clear',{'approval':a['approval']});self.cmd('a-registrar','source.confirm_prerequisite',{'student':'a-student','version':3})
  with self.lab.db() as d:d.execute('UPDATE students SET source_at=? WHERE tenant=?',(time.time()-400,'a'))
  self.assertEqual(self.lab.view('demo-a-student')['readiness'],'stale')
 def test_cross_tenant(self):
  with self.assertRaises(Rejected):self.cmd('a-student','onboarding.complete',{'tenant':'b'})
 def test_cross_student(self):
  self.onboard()
  with self.assertRaises(Rejected):self.cmd('a-faculty','grade.draft',{'student':'b-student','score':85,'version':0})
 def test_duplicate_receipt(self):
  self.assertEqual(self.cmd('a-student','onboarding.complete',key='fixed'),self.cmd('a-student','onboarding.complete',key='fixed'))
  with self.lab.db() as d:self.assertEqual(d.execute('SELECT count(*) FROM audit').fetchone()[0],1)
 def test_key_conflict(self):
  self.cmd('a-student','onboarding.complete',key='fixed')
  with self.assertRaises(Rejected):self.cmd('a-student','onboarding.complete',{'extra':True},'fixed')
 def test_restart_durable(self):
  r=self.onboard();other=Lab(self.lab.path);self.assertTrue(other.view('demo-a-student')['student']['onboarded']);self.assertEqual(other.execute('demo-a-student','onboarding.complete',{},'k1'),r)
 def test_grant_revoked(self):
  with self.lab.db() as d:d.execute("UPDATE actors SET active=0 WHERE id='a-student'")
  with self.assertRaises(Rejected):self.lab.view('demo-a-student')
 def test_expired(self):
  with self.lab.db() as d:d.execute("UPDATE actors SET expires=0 WHERE id='a-student'")
  with self.assertRaises(Rejected):self.onboard()
 def test_course_scope(self):
  with self.assertRaises(Rejected):self.cmd('a-student','onboarding.complete',{'course':'other'})
 def test_student_cannot_grade(self):
  self.onboard()
  with self.assertRaises(Rejected):self.cmd('a-student','grade.draft',{'student':'a-student','score':90,'version':0})
 def test_faculty_cannot_approve(self):
  g,a=self.request_grade()
  with self.assertRaises(Rejected):self.cmd('a-faculty','grade.approve_release',{'approval':a['approval']})
 def test_self_approval_even_after_role_change(self):
  g,a=self.request_grade()
  with self.lab.db() as d:d.execute("UPDATE actors SET role='reviewer' WHERE id='a-faculty'")
  with self.assertRaises(Rejected):self.cmd('a-faculty','grade.approve_release',{'approval':a['approval']})
 def test_expired_approval(self):
  g,a=self.request_grade()
  with self.lab.db() as d:d.execute('UPDATE approvals SET expires=0 WHERE id=?',(a['approval'],))
  with self.assertRaises(Rejected):self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']})
 def test_changed_grade_binding(self):
  g,a=self.request_grade();self.cmd('a-faculty','grade.draft',{'student':'a-student','score':70,'version':1})
  with self.assertRaises(Rejected):self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']})
 def test_changed_hold_binding(self):
  a=self.hold_request();self.cmd('a-registrar','source.confirm_prerequisite',{'student':'a-student','version':2})
  with self.assertRaises(Rejected):self.cmd('a-reviewer','hold.approve_clear',{'approval':a['approval']})
 def test_decided_approval(self):
  g,a=self.request_grade();self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']})
  with self.assertRaises(Rejected):self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']})
 def test_wrong_kind(self):
  a=self.hold_request()
  with self.assertRaises(Rejected):self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']})
 def test_cross_tenant_approval(self):
  g,a=self.request_grade()
  with self.assertRaises(Rejected):self.cmd('b-reviewer','grade.approve_release',{'approval':a['approval']})
 def test_no_submission(self):
  self.onboard()
  with self.assertRaises(Rejected):self.cmd('a-faculty','grade.draft',{'student':'a-student','score':80,'version':0})
 def test_score_invalid(self):
  self.draft()
  for score in [-1,101,True,float('inf')]:
   with self.assertRaises((Rejected,ValueError)):self.cmd('a-faculty','grade.draft',{'student':'a-student','score':score,'version':1})
 def test_version_conflict(self):
  self.draft()
  with self.assertRaises(Rejected):self.cmd('a-faculty','grade.draft',{'student':'a-student','score':80,'version':0})
 def test_reason_required(self):
  g=self.draft()
  with self.assertRaises(Rejected):self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1})
 def test_operator_business_only(self):
  self.draft();v=self.lab.view('demo-a-operator');self.assertNotIn('grades',v);self.assertNotIn('students',v);self.assertNotIn('submissions',v)
 def test_worker_role(self):
  with self.assertRaises(Rejected):self.lab.project('demo-a-student')
 def test_worker_tenant(self):
  g,a=self.request_grade();self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']});self.lab.project('demo-b-operator');self.assertEqual(self.lab.view('demo-a-student')['grades'],[])
 def test_worker_replay(self):
  g,a=self.request_grade();self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']});self.lab.project('demo-a-operator');self.assertEqual(self.lab.project('demo-a-operator')['events_processed'],0)
 def test_released_grade_not_mutable(self):
  g,a=self.request_grade();self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']})
  with self.assertRaises(Rejected):self.cmd('a-faculty','grade.draft',{'student':'a-student','score':95,'version':2})
 def test_unknown_command(self):
  with self.assertRaises(Rejected):self.cmd('a-student','enroll')
 def test_rejection_rolls_back(self):
  with self.assertRaises(Rejected):self.cmd('a-student','submission.create',{'body':'x'})
  with self.lab.db() as d:self.assertEqual(d.execute('SELECT count(*) FROM receipts').fetchone()[0],0)
 def test_empty_key(self):
  with self.assertRaises(Rejected):self.lab.execute('demo-a-student','onboarding.complete',{},'')

class TestReviewFindings(unittest.TestCase):
 def setUp(self):
  self.dir=tempfile.TemporaryDirectory();self.lab=Lab(Path(self.dir.name)/'lab.sqlite');self.lab.seed();self.n=0
 def tearDown(self):self.dir.cleanup()
 def cmd(self,who,command,payload=None,key=None):
  self.n+=1;return self.lab.execute('demo-'+who,command,payload or {},key or 'k'+str(self.n))
 def test_faculty_sees_submitted_work(self):
  self.cmd('a-student','onboarding.complete');self.cmd('a-student','submission.create',{'body':'synthetic work'})
  self.assertEqual([s['body'] for s in self.lab.view('demo-a-faculty')['submissions']],['synthetic work'])
  self.assertNotIn('submissions',self.lab.view('demo-a-student'))
 def test_new_submission_invalidates_grade_approval(self):
  self.cmd('a-student','onboarding.complete');self.cmd('a-student','submission.create',{'body':'first'})
  g=self.cmd('a-faculty','grade.draft',{'student':'a-student','score':85,'version':0})
  a=self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1,'reason':'Reviewed rubric'})
  self.cmd('a-student','submission.create',{'body':'second'})
  with self.assertRaises(Rejected):self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']})
 def test_repeated_onboarding_keeps_version(self):
  self.cmd('a-student','onboarding.complete');before=self.lab.view('demo-a-student')['student']['version']
  self.cmd('a-student','onboarding.complete')
  self.assertEqual(self.lab.view('demo-a-student')['student']['version'],before)
 def test_approval_reason_visible_to_reviewer(self):
  self.cmd('a-student','onboarding.complete');self.cmd('a-student','submission.create',{'body':'work'})
  g=self.cmd('a-faculty','grade.draft',{'student':'a-student','score':85,'version':0})
  self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1,'reason':'Reviewed rubric'})
  self.assertEqual([a['reason'] for a in self.lab.view('demo-a-reviewer')['approvals']],['Reviewed rubric'])
 def test_grade_drafted_on_superseded_submission_cannot_request_release(self):
  self.cmd('a-student','onboarding.complete');self.cmd('a-student','submission.create',{'body':'first'})
  g=self.cmd('a-faculty','grade.draft',{'student':'a-student','score':85,'version':0})
  self.cmd('a-student','submission.create',{'body':'second'})
  with self.assertRaises(Rejected):self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1,'reason':'Reviewed rubric'})
 def test_grade_approvals_stay_with_faculty_and_registrar_sees_no_grade(self):
  self.cmd('a-student','onboarding.complete');self.cmd('a-student','submission.create',{'body':'work'})
  g=self.cmd('a-faculty','grade.draft',{'student':'a-student','score':85,'version':0})
  self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1,'reason':'Reviewed rubric'})
  self.assertEqual(self.lab.view('demo-a-registrar')['approvals'],[])
  self.assertEqual([a['kind'] for a in self.lab.view('demo-a-faculty')['approvals']],['grade'])
 def test_expired_approval_leaves_pending_queue(self):
  self.cmd('a-student','onboarding.complete');self.cmd('a-student','submission.create',{'body':'work'})
  g=self.cmd('a-faculty','grade.draft',{'student':'a-student','score':85,'version':0})
  self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1,'reason':'Reviewed rubric'})
  import sqlite3;d=sqlite3.connect(self.lab.path);d.execute('UPDATE approvals SET expires=0');d.commit();d.close()
  self.assertEqual(self.lab.view('demo-a-reviewer')['approvals'],[])
 def test_non_string_identifier_is_rejected_not_crashed(self):
  with self.assertRaises(Rejected):self.cmd('a-student','onboarding.complete',{'course':[]})
 def test_lapsed_demo_sessions_renew_on_reopen(self):
  import sqlite3;d=sqlite3.connect(self.lab.path);d.execute('UPDATE actors SET expires=0');d.commit();d.close()
  Lab(self.lab.path).seed();self.assertEqual(self.lab.view('demo-a-student')['role'],'student')
 def test_stale_approval_leaves_reviewer_queue(self):
  self.cmd('a-student','onboarding.complete');self.cmd('a-student','submission.create',{'body':'work'})
  g=self.cmd('a-faculty','grade.draft',{'student':'a-student','score':85,'version':0})
  self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1,'reason':'Reviewed rubric'})
  self.cmd('a-faculty','grade.draft',{'student':'a-student','score':70,'version':1})
  self.assertEqual(self.lab.view('demo-a-reviewer')['approvals'],[])
 def test_grade_approval_hidden_from_reviewer_without_course_grant(self):
  import sqlite3
  self.cmd('a-student','onboarding.complete')
  self.cmd('a-student','submission.create',{'body':'work'})
  g=self.cmd('a-faculty','grade.draft',{'student':'a-student','score':85,'version':0})
  self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1,'reason':'Reviewed rubric'})
  # Control: the reviewer is granted 'course', so the same-course approval is listed.
  self.assertEqual(len(self.lab.view('demo-a-reviewer')['approvals']),1)
  d=sqlite3.connect(self.lab.path);tenant=d.execute('SELECT tenant FROM access WHERE actor=?',('a-faculty',)).fetchone()[0]
  d.execute('INSERT INTO courses VALUES (?,?)',('other',tenant))
  for actor in ('a-student','a-faculty'):d.execute('INSERT INTO access VALUES (?,?,?)',(tenant,'other',actor))
  d.commit();d.close()
  self.cmd('a-student','submission.create',{'body':'work','course':'other'})
  g2=self.cmd('a-faculty','grade.draft',{'student':'a-student','score':80,'version':0,'course':'other'})
  self.cmd('a-faculty','grade.request_release',{'grade':g2['grade'],'version':1,'reason':'Other course','course':'other'})
  # The reviewer has no 'other' grant, so only the same-course approval is listed.
  self.assertEqual([r['object_id'] for r in self.lab.view('demo-a-reviewer')['approvals']],[g['grade']])
 def test_submission_after_release_is_rejected(self):
  self.cmd('a-student','onboarding.complete');self.cmd('a-student','submission.create',{'body':'work'})
  g=self.cmd('a-faculty','grade.draft',{'student':'a-student','score':85,'version':0})
  a=self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1,'reason':'Reviewed rubric'})
  self.cmd('a-reviewer','grade.approve_release',{'approval':a['approval']})
  with self.assertRaises(Rejected):self.cmd('a-student','submission.create',{'body':'late revision'})
 def test_legacy_database_gains_new_columns_and_retires_unreasoned_approvals(self):
  import sqlite3
  self.cmd('a-student','onboarding.complete');self.cmd('a-student','submission.create',{'body':'work'})
  g=self.cmd('a-faculty','grade.draft',{'student':'a-student','score':85,'version':0})
  a=self.cmd('a-faculty','grade.request_release',{'grade':g['grade'],'version':1,'reason':'Reviewed rubric'})
  d=sqlite3.connect(self.lab.path);d.execute('ALTER TABLE grades DROP COLUMN submission_id');d.execute('ALTER TABLE approvals DROP COLUMN reason');d.commit();d.close()
  Lab(self.lab.path).seed()
  d=sqlite3.connect(self.lab.path);cols=lambda t:[r[1] for r in d.execute(f'PRAGMA table_info({t})')]
  self.assertIn('submission_id',cols('grades'));self.assertIn('reason',cols('approvals'))
  # Legacy drafts keep a NULL submission, so they cannot be released against a later submission.
  self.assertIsNone(d.execute('SELECT submission_id FROM grades').fetchone()[0])
  # Legacy pending approvals have no recoverable reason, so they are retired rather than shown to reviewers.
  self.assertEqual(d.execute('SELECT state FROM approvals WHERE id=?',(a['approval'],)).fetchone()[0],'retired');d.close()
