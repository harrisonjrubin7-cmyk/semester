# Remaining role journey specifications

Status: proposed full lifecycle specifications, not implemented journeys. Applicant onboarding already has a seeded journey in migration 110; that does not close the absent master-catalog admissions lifecycle. Online/adult/caregiver journeys extend shared student engines. Actor intent is never an authority grant.

## Prospective student
- kind: Admissions discovery
- entry guard: Public program discovery; no institutional record access
- happy path: Discover → sourced comparison → shortlist → inquiry → application entry
- entities: Program, requirement version, inquiry, personal shortlist
- access boundary: Own shortlist; published information only
- completion: Inquiry acknowledged by owner or application draft saved
- recovery: Unavailable program → alternatives; unanswered inquiry → escalation
- proposed owner: Admissions discovery lead
- acceptance: Sourced requirements and costs; no eligibility guarantee; saved work resumes
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Applicant
- kind: Admissions
- entry guard: Authenticated applicant; institutional applicant identity verified separately
- happy path: Draft → submit → evidence review → human decision → accept/defer → matriculate
- entities: Application, documents, decision, acceptance, identity-match case
- access boundary: Own application; staff assigned review only
- completion: Decision receipt and reconciled matriculation or documented deferral/closure
- recovery: Missing documents → request/resume; appeal → review; identity conflict → steward
- proposed owner: Admissions lead
- acceptance: No client decision authority; decision history preserved; duplicate identity safe
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Online student
- kind: Student loop variant
- entry guard: Verified course access; optional time zone and remote-service preference
- happy path: Set zone → access materials → plan → submit → remote support → feedback
- entities: Course, schedule, submission, remote support case
- access boundary: Own workspace plus enrolled course permissions
- completion: Durable submission or resolved support; correct local display and official deadline
- recovery: Time-zone mismatch → official timestamp explanation; outage → authorized alternate delivery
- proposed owner: Online learning lead
- acceptance: DST/time-zone tests; accessible alternatives; no notification-only deadline evidence
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Adult learner
- kind: Planning/re-entry variant
- entry guard: Optional commitments; authorized prior-learning evidence
- happy path: Goals → prior-learning request → staff evaluation → scenario → enroll → study
- entities: Prior-learning evidence, evaluation, catalog version, plan
- access boundary: Private constraints opt-in; official credit from authorized evaluator
- completion: Approved credit or reviewed plan plus next owned action
- recovery: Interrupted enrollment → resume/re-entry case; evaluation dispute → appeal
- proposed owner: Academic planning lead
- acceptance: No inferred official credit; scenario not degree promise; constraints remain private
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Graduate student
- kind: Graduate milestones
- entry guard: Verified program membership and supervisor/resource grants
- happy path: Milestones → supervision → research approvals → review → thesis/degree decision
- entities: Milestone, supervisor assignment, research permission, review, degree record
- access boundary: Scoped supervision; research data excluded unless separately authorized
- completion: Human-approved milestone/degree outcome with next action or archive
- recovery: Supervisor change → approved reassignment; missed milestone → extension review
- proposed owner: Graduate programs lead
- acceptance: AI cannot grant research approval; restricted evidence scoped; supervisor changes traceable
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## International student
- kind: Restricted service case
- entry guard: Verified affiliation and office-specific access; not automatic legal eligibility
- happy path: Identify institutional requirement → restricted upload → staff review → specialist next step → follow-up
- entities: Restricted document, expiry, office case, human guidance
- access boundary: Minimum case context; no unrelated advisor/family disclosure
- completion: Office disposition and acknowledged next step; no legal-status guarantee
- recovery: Expiry/missing evidence → specialist case; uncertainty → authorized referral
- proposed owner: International services lead
- acceptance: No automatic immigration/legal decision; document expiry and access tests
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Student athlete
- kind: Academic coordination variant
- entry guard: Verified athletics affiliation and separately scoped academic access
- happy path: Travel constraints → academic plan → authorized eligibility review → coordinate → follow-up
- entities: Travel schedule, course plan, eligibility decision, scoped share
- access boundary: Private work remains private; eligibility evidence scoped
- completion: Owned conflict resolution and authorized eligibility outcome
- recovery: Travel change → replan; denied exception/eligibility → institutional appeal
- proposed owner: Athletics academic-support lead
- acceptance: No automatic eligibility decision; sharing minimized; course authority retained
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Student worker
- kind: Campus employment
- entry guard: Verified student identity; employment role granted only after authorized hiring
- happy path: Discover job → apply → review/hire → onboard → schedule → follow-up/exit
- entities: Job, application, hiring decision, work assignment, employment grant
- access boundary: Applicant vs employee access separated; payroll integration separately authorized
- completion: Authorized hire/start or notice; exit revokes employment grants
- recovery: Failed onboarding → HR case; conflict → reschedule; termination → scoped revoke
- proposed owner: Student employment lead
- acceptance: No AI hiring authority; academic access not removed by employment exit
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Student parent/caregiver
- kind: Constraint-aware student variant
- entry guard: Optional self-disclosed constraints; no mandatory caregiver label
- happy path: Set optional availability → plan → discover services → request → receive support → adjust
- entities: Private constraint, plan, service request, availability
- access boundary: Constraints student-controlled; minimum office share
- completion: Confirmed service or owned alternative plus updated plan
- recovery: Unavailable service → alternatives; changed commitments → student-approved replan
- proposed owner: Student support lead
- acceptance: No compulsory sensitive disclosure; no inferred risk classification; reminders adjustable
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Program director
- kind: Curriculum governance
- entry guard: Assigned program authority; conflict and approval rules
- happy path: Proposal → impact analysis → review → approval → effective date → publish → monitor
- entities: Curriculum version, requirement rule, impact set, approval, exception
- access boundary: Program-scoped configuration; student impacts restricted
- completion: Approved effective version and audited affected-student disposition
- recovery: Rejected change → revise; bad release → prior version plus approved exceptions
- proposed owner: Academic affairs lead
- acceptance: No retroactive silent requirement change; cohort/catalog version and approval tests
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Admissions staff
- kind: Assigned admissions operations
- entry guard: Verified employment and scoped application caseload
- happy path: Accept caseload → review permitted evidence → approve/route decision → notice → reconcile
- entities: Review assignment, evidence, decision, appeal, identity match
- access boundary: Assigned caseload; restricted evidence; conflicts require recusal
- completion: Human-authorized decision and delivery/reconciliation evidence
- recovery: Conflict → reassignment; appeal → second review; identity match failure → steward
- proposed owner: Admissions operations lead
- acceptance: Least privilege; no client forged decision; notice delivery not itself matriculation
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Library staff
- kind: Resource and research services
- entry guard: Verified library role; item/license/service scope
- happy path: Publish availability → authorize access → reserve → fulfill → research support → close
- entities: Resource, license rule, reservation, fulfillment, support case
- access boundary: No general student-private workspace access; lending history retention scoped
- completion: Fulfilled reservation or owned alternate/resource resolution
- recovery: Unavailable item → queue/alternative; access denial → license review; cancel → release capacity
- proposed owner: Library services lead
- acceptance: No double reservation; private reading/research history not public; retention verified
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.

## Mentor
- kind: Scoped mentoring relationship
- entry guard: Verified mentor profile; student accepts relationship and scope
- happy path: Offer/request → safe match → accept scope → schedule → support → end/revoke
- entities: Mentor verification, relationship grant, session, follow-up
- access boundary: Only shared context; mentor not advisor/registrar by default
- completion: Completed session/follow-up or safe rematch; revocation enforced
- recovery: No response/mismatch → rematch; concern → human support; revoke → immediate access stop
- proposed owner: Mentoring lead
- acceptance: No authority escalation; unsafe match reporting; revoked context absent from retrieval
- activation gate: Verified code + access/recovery/accessibility tests + deployment + institutional scope where required
- status: Proposed full role journey; source onboarding existence does not prove full lifecycle
- Shared closure: stable Action Center item; scoped source-aware search; durable receipt; permitted projection updates; owned escalation; accessible resume.
