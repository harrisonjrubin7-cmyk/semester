// 51 roles as permission bundles (from uploads/provide the nessarcy stuff to make the 51 roles… PDF + master-catalog roles + role-lens). Design-level model; not read from a live policy engine.
(function(){
const FAM=[[1,'Platform operations','Required to run and recover all other systems','Operations shell'],[2,'Institution administration','Configure a tenant safely','Institution shell'],[3,'Students','Core pilot experience','Student shell'],[4,'Advising & registrar','Completes the Registration Readiness loop','Staff shell'],[5,'Faculty & TA','Teaching and grading workflows','Staff shell'],[6,'Student services & affairs','High-value, more sensitive operations','Staff shell'],[7,'External contexts','Delegation boundaries','External shell'],[8,'Partners & developers','Stable API and commercial controls','Developer shell'],[9,'Company & investor','Aggregate / business-only data by default','Company shell']];
// [key, title, family, purpose, identity source]
const ROLES=[
['sem_support','Semester support operator',1,'Resolve tickets inside a scoped, time-boxed support session','Semester SSO + MFA'],
['sem_security','Semester security operator',1,'Detect, contain and recover security incidents','Semester SSO + hardware key'],
['sem_product','Semester product operator',1,'Feature flags, releases and tenant activation','Semester SSO + MFA'],
['sem_privacy','Semester privacy/legal operator',1,'DSRs, legal holds, DPAs and subprocessor records','Semester SSO + MFA'],
['sem_impl','Semester implementation lead',1,'Set up tenants, mappings and pilot cutover','Semester SSO + MFA'],
['inst_it','Institutional IT',2,'Tenant settings, SSO, SCIM and integrations','Institution SSO'],
['inst_sec','Institutional security/privacy',2,'Review access, audit and privacy for the tenant','Institution SSO'],
['inst_exec','Institutional executive',2,'Aggregate dashboards and decisions; no individual records','Institution SSO'],
['inst_audit','Institutional auditor',2,'Read-only audit evidence for a scoped review','Institution SSO (time-boxed)'],
['student','Student',3,'Review academic and campus information, act, manage privacy','Institution SSO'],
['transfer','Transfer student',3,'Student + transfer credit evaluation','Institution SSO'],
['online','Online student',3,'Student, remote-first services','Institution SSO'],
['adult','Adult learner',3,'Student with work/family scheduling','Institution SSO'],
['grad','Graduate student',3,'Student + research, assistantships','Institution SSO'],
['intl','International student',3,'Student + immigration-status tasks (owned by ISSS)','Institution SSO'],
['athlete','Student athlete',3,'Student + eligibility and travel (owned by Athletics)','Institution SSO'],
['worker','Student worker',3,'Student + campus job shifts','Institution SSO'],
['parent','Student parent/caregiver',3,'Student + childcare and flexible scheduling','Institution SSO'],
['advisor','Academic advisor',4,'Caseload, notes, plans students share','Institution SSO'],
['success','Student success staff',4,'Opt-in outreach and referrals','Institution SSO'],
['registrar','Registrar staff',4,'Enrollment, holds, grade release, records','Institution SSO'],
['progdir','Program director',4,'Program requirements and section planning','Institution SSO'],
['faculty','Faculty/instructor',5,'Teach, grade and publish course materials','Institution SSO'],
['ta','Teaching assistant',5,'Grade and support assigned sections','Institution SSO'],
['chair','Department chair',5,'Department oversight, grade change approvals','Institution SSO'],
['finaid','Financial aid staff',6,'Packages, verification, appeals','Institution SSO'],
['accounts','Student accounts staff',6,'Billing, payment plans, refunds','Institution SSO'],
['admissions','Admissions staff',6,'Review applications, decisions','Institution SSO'],
['housing','Housing staff',6,'Assignments, requests, roommate issues','Institution SSO'],
['dining','Dining/campus-card staff',6,'Meal plans, card, swipe pool','Institution SSO'],
['library','Library staff',6,'Loans, holds, reserves','Institution SSO'],
['access','Accessibility/disability services',6,'Accommodation cases and letters','Institution SSO'],
['counsel','Counseling/wellbeing staff',6,'Appointments only; clinical records stay in the clinical system','Institution SSO'],
['career','Career staff',6,'Postings, appointments, student-shared profiles','Institution SSO'],
['safety','Campus safety staff',6,'Reports, walk-with-me, official alerts','Institution SSO'],
['moderator','Community moderator',6,'Moderate campus community spaces','Institution SSO'],
['orgleader','Student organization leader',6,'Roster, events, budget requests for one org','Institution SSO'],
['peer','Peer mentor',6,'Support assigned mentees with what they share','Institution SSO'],
['prospect','Prospective student',7,'Explore programs and costs','Email / social sign-in'],
['applicant','Applicant',7,'Apply, upload documents, see decisions','Applicant portal account'],
['alumni','Alumni',7,'Keep work, career profile, community','Alumni account'],
['family','Family/guardian',7,'Only what the student shares, until it expires','Invited account'],
['employer','Employer',7,'Post roles; see profiles students make discoverable','Employer account + verification'],
['mentor','Mentor',7,'Mentoring with what mentees share','Invited account'],
['developer','Developer/partner',8,'Build apps with OAuth scopes in sandbox, then reviewed tenants','Developer account + OAuth'],
['sem_csm','Semester customer-success manager',9,'Tenant health, adoption, renewals — aggregate','Semester SSO'],
['sem_revops','Semester revenue operations',9,'Pipeline, contracts, billing — business data','Semester SSO'],
['sem_fin','Semester finance operator',9,'Company finance, invoicing, close','Semester SSO'],
['sem_exec','Semester executive',9,'Company health and decisions — aggregate','Semester SSO'],
['investor','Investor / board member',9,'Read-only company health, runway, risk','Board portal account'],
['buyer','Institution buyer',9,'Evaluate Semester: trust docs, pricing, pilot terms','Trust room account']];
// capabilities (columns): [key, label, group, dataClass]
const CAPS=[['own.record','Own record','Self','student_private'],['own.privacy','Own privacy & sharing','Self','student_private'],['registration.submit','Registration submit','Academic','restricted'],['student.records','Other students’ records','Academic','restricted'],['advising.notes','Advising notes','Academic','restricted'],['grades.enter','Enter grades','Academic','restricted'],['grades.release','Release grades','Academic','restricted'],['course.publish','Publish course materials','Academic','institutional'],['finance.student','Student finance','Services','restricted'],['admissions.decide','Admission decisions','Services','restricted'],['services.case','Service cases (housing, dining, library…)','Services','restricted'],['accommodation.case','Accommodation cases','Services','restricted'],['community.moderate','Moderate community','Services','institutional'],['career.profiles','Student career profiles','Services','student_private'],['tenant.admin','Tenant admin','Tenant','institutional'],['identity.admin','Identity & role grants','Tenant','restricted'],['integration.admin','Integrations','Tenant','institutional'],['audit.read','Audit evidence','Tenant','restricted'],['security.ops','Security operations','Platform','restricted'],['privacy.dsr','Privacy requests & holds','Platform','restricted'],['release.activate','Release & activation','Platform','internal'],['support.session','Support session','Platform','restricted'],['ai.use','Use governed AI','Platform','internal'],['company.aggregate','Company / aggregate data','Company','internal'],['api.oauth','Partner API (OAuth)','Company','internal']];
// levels
const LV={'':['—','none'],S:['Self','own records only'],C:['Scoped','assigned sections, caseload, org or tickets'],G:['Granted','only what a student shared, until it expires'],R:['Read','read-only'],W:['Write','create and change'],A:['Approve','approve others’ work; second person required'],B:['Break-glass','emergency, time-boxed, every view logged and reviewed'],X:['Aggregate','counts only, min cell 10']};
// family defaults
const D={
1:{'support.session':'C','audit.read':'R','ai.use':'W'},2:{'tenant.admin':'R','audit.read':'R','ai.use':'W'},3:{'own.record':'S','own.privacy':'S','registration.submit':'S','ai.use':'W'},4:{'student.records':'C','advising.notes':'C','ai.use':'W'},5:{'grades.enter':'C','course.publish':'C','student.records':'C','ai.use':'W'},6:{'services.case':'C','ai.use':'W'},7:{},8:{'api.oauth':'W'},9:{'company.aggregate':'R'}};
const O={sem_support:{'support.session':'C'},sem_security:{'security.ops':'W','audit.read':'R','support.session':'B','student.records':'B'},sem_product:{'release.activate':'W','support.session':''},sem_privacy:{'privacy.dsr':'W','audit.read':'R'},sem_impl:{'integration.admin':'W','tenant.admin':'W','release.activate':'R'},
inst_it:{'tenant.admin':'W','identity.admin':'W','integration.admin':'W'},inst_sec:{'identity.admin':'A','audit.read':'R','privacy.dsr':'R','student.records':'B'},inst_exec:{'tenant.admin':'','company.aggregate':'X','audit.read':''},inst_audit:{'tenant.admin':'R','audit.read':'R','ai.use':''},
advisor:{'advising.notes':'W','student.records':'G'},success:{'student.records':'G','advising.notes':'C'},registrar:{'student.records':'W','registration.submit':'W','grades.release':'A','advising.notes':''},progdir:{'student.records':'X','course.publish':'R','advising.notes':''},
ta:{'course.publish':'R'},chair:{'grades.enter':'','grades.release':'A','course.publish':'R','student.records':'R'},
finaid:{'finance.student':'W','services.case':''},accounts:{'finance.student':'W','services.case':''},admissions:{'admissions.decide':'A','services.case':''},access:{'accommodation.case':'W','services.case':''},counsel:{'services.case':'C'},career:{'career.profiles':'G'},safety:{'services.case':'C'},moderator:{'community.moderate':'W','services.case':''},orgleader:{'own.record':'S','own.privacy':'S','services.case':'','community.moderate':'C'},peer:{'own.record':'S','own.privacy':'S','services.case':'','student.records':'G'},
prospect:{'own.privacy':'S'},applicant:{'own.record':'S','own.privacy':'S'},alumni:{'own.record':'S','own.privacy':'S','career.profiles':'S','ai.use':'W'},family:{'student.records':'G','own.privacy':'S'},employer:{'career.profiles':'G'},mentor:{'career.profiles':'G','student.records':'G'},
sem_csm:{'company.aggregate':'X'},sem_revops:{'company.aggregate':'W'},sem_fin:{'company.aggregate':'W'},sem_exec:{'company.aggregate':'X'},investor:{'company.aggregate':'X'},buyer:{'company.aggregate':''}};
// hard prohibitions: role family → caps that can never be granted (lock in the matrix)
const LOCK={7:['tenant.admin','identity.admin','integration.admin','audit.read','security.ops','grades.enter','grades.release','admissions.decide','finance.student'],8:['student.records','own.record','grades.enter','grades.release','identity.admin','audit.read'],9:['student.records','advising.notes','grades.enter','grades.release','finance.student','accommodation.case','own.record','career.profiles','support.session'],3:['student.records','tenant.admin','identity.admin','grades.release','audit.read','security.ops']};
// separation of duties
const SOD=[['grades.enter','grades.release','Same person can’t enter and release grades'],['identity.admin','audit.read','Grantor of access can’t also be the reviewer of the audit trail'],['release.activate','security.ops','Release owner can’t sign off their own security review'],['admissions.decide','finance.student','Admission decisions kept apart from aid/billing']];
const lvl=(r,c,ov)=>{const k=r[0];if(ov&&ov[k]&&c in ov[k])return ov[k][c];if(O[k]&&c in O[k])return O[k][c];return (D[r[2]]||{})[c]||'';};
const locked=(r,c)=>(LOCK[r[2]]||[]).includes(c);
const CHECK=['Role purpose and prohibited actions','Identity source and onboarding flow','Tenant membership and scope model','Navigation visibility rules','Route-level authorization','Server-action/API authorization','Database RLS allow/deny coverage','Data classification access rules','Workflow task eligibility','Approval/dual-control requirements','Audit requirements','AI permissions and restrictions','Session/revocation behavior','Offboarding/revocation runbook','Role-specific training','Accessibility/research acceptance'];
// sample actions for the switcher: [label, cap, needs ('S' self, 'C' scoped, 'G' grant, 'W', 'A', 'R'), dataNote]
const ACTS=[['View my schedule and grades','own.record','S'],['Share released grades with family','own.privacy','S'],['Submit registration readiness','registration.submit','S'],['Open another student’s record (Jordan Ellis)','student.records','R'],['Write an advising note for an advisee','advising.notes','C'],['Enter grades for CHEM 2210 §02','grades.enter','C'],['Release CHEM 2210 grades to students','grades.release','A'],['Approve a financial aid appeal','finance.student','W'],['Grant the Registrar role to a colleague','identity.admin','W'],['Read the tenant audit log','audit.read','R'],['Turn on a feature for the pilot tenant','release.activate','W'],['Ask AI to draft a study guide','ai.use','W'],['See company pipeline and runway','company.aggregate','R'],['Call the Semester API for a tenant','api.oauth','W']];
const RANK={'':0,X:1,G:1,S:1,C:2,R:2,B:2,W:3,A:4};
window.R51={FAM,ROLES,CAPS,LV,D,O,LOCK,SOD,lvl,locked,CHECK,ACTS,RANK};
})();
