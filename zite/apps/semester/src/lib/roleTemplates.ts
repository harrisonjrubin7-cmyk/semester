// GENERATED from the founder-supplied workbook "Semester 79-row role architecture reference — reconciliation draft" (uploaded 23 Oct 2026).
// Status: PROPOSED. Not a verified canonical registry and not authorization. A template grants nothing until it is listed in
// APPROVED_TEMPLATES (lib/authz.ts) after owner review and allow/deny tests. Persona overlays never grant permissions.
export type RoleTemplate = { id: string; name: string; category: 'student' | 'academic' | 'administrative' | 'system'; family: string; model: string;
  module: string; scope: string; permissions: string[]; authScope: string; exclusions: string; relatedBase: string; evidence: string };

export const ROLE_TEMPLATES: RoleTemplate[] = [
 {
  "id": "SEM-ROLE-001",
  "name": "Prospective student",
  "category": "student",
  "family": "learner",
  "model": "Lifecycle persona",
  "module": "Admissions",
  "scope": "Discover programs, costs and pathways; save questions and plans.",
  "permissions": [
   "program.public.read",
   "prospect.plan.manage",
   "inquiry.own.submit"
  ],
  "authScope": "Public information and own saved plans only",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-002",
  "name": "Applicant",
  "category": "student",
  "family": "learner",
  "model": "Lifecycle persona",
  "module": "Admissions",
  "scope": "Manage application checklist and supporting documents.",
  "permissions": [
   "application.own.read",
   "application.own.prepare",
   "document.own.upload"
  ],
  "authScope": "Own applications; official submission and decisions depend on authorized source",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-003",
  "name": "Student",
  "category": "student",
  "family": "learner",
  "model": "Base learner role",
  "module": "Student Workspace",
  "scope": "Manage personal study, plans, tasks and approved requests.",
  "permissions": [
   "workspace.own.manage",
   "action.own.manage",
   "sharing.own.manage",
   "request.own.submit"
  ],
  "authScope": "Own records; institutional records limited to authorized self-service",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-004",
  "name": "Transfer student",
  "category": "student",
  "family": "learner",
  "model": "Persona overlay",
  "module": "Academic Planning",
  "scope": "Prepare prior-credit evidence and compare transfer pathways.",
  "permissions": [
   "transfer.own.prepare",
   "evaluation.own.read",
   "plan.own.manage"
  ],
  "authScope": "Own evidence and plans; no equivalency approval",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-005",
  "name": "Online student",
  "category": "student",
  "family": "learner",
  "model": "Persona overlay",
  "module": "Learning",
  "scope": "Coordinate remote learning and timezone-aware schedules.",
  "permissions": [
   "course.assigned.read",
   "study.own.manage",
   "appointment.own.book"
  ],
  "authScope": "Own and enrolled-course scope",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-006",
  "name": "Adult learner",
  "category": "student",
  "family": "learner",
  "model": "Persona overlay",
  "module": "Academic Planning",
  "scope": "Manage flexible pathways and work-compatible study.",
  "permissions": [
   "plan.own.manage",
   "credential.own.read",
   "evidence.own.export"
  ],
  "authScope": "Own records and deliberately shared evidence",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-007",
  "name": "Graduate student",
  "category": "student",
  "family": "learner",
  "model": "Persona overlay",
  "module": "Academic Planning",
  "scope": "Track research milestones, funding deadlines and supervisor sharing.",
  "permissions": [
   "milestone.own.manage",
   "research.own.manage",
   "sharing.own.manage"
  ],
  "authScope": "Own projects; TA access requires separate assignment",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-008",
  "name": "International student",
  "category": "student",
  "family": "learner",
  "model": "Persona overlay",
  "module": "Student Support",
  "scope": "Track sourced requirements and specialist-service handoffs.",
  "permissions": [
   "checklist.own.read",
   "service.own.request",
   "appointment.own.book"
  ],
  "authScope": "Own information; no immigration or eligibility decisions",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-009",
  "name": "Student athlete",
  "category": "student",
  "family": "learner",
  "model": "Persona overlay",
  "module": "Student Workspace",
  "scope": "Plan academic work around athletics and travel.",
  "permissions": [
   "commitment.own.manage",
   "schedule.own.compare",
   "sharing.own.manage"
  ],
  "authScope": "Own schedule; official eligibility remains with authorized office",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-010",
  "name": "Student worker",
  "category": "student",
  "family": "learner",
  "model": "Persona overlay",
  "module": "Student Workspace",
  "scope": "Coordinate shifts, classes and employment-service handoffs.",
  "permissions": [
   "commitment.own.manage",
   "schedule.own.compare",
   "employment.own.handoff"
  ],
  "authScope": "Own approved employment context; no payroll administration",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-011",
  "name": "Student parent/caregiver",
  "category": "student",
  "family": "learner",
  "model": "Persona overlay",
  "module": "Student Support",
  "scope": "Plan around caregiving and discover relevant support.",
  "permissions": [
   "constraint.own.manage",
   "resource.public.read",
   "service.own.request"
  ],
  "authScope": "Optional private preferences; no automatic institutional disclosure",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-012",
  "name": "Alumni",
  "category": "student",
  "family": "external",
  "model": "Lifecycle affiliation",
  "module": "Alumni & Mentoring",
  "scope": "Retain selected work, request credentials and join opt-in programs.",
  "permissions": [
   "portfolio.own.manage",
   "credential.own.request",
   "alumni.program.join"
  ],
  "authScope": "Own retained content and explicitly authorized alumni services",
  "exclusions": "No education-record access by relationship alone; only explicitly approved shared/application scope; expired and revoked grants unusable.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-013",
  "name": "Family/guardian",
  "category": "administrative",
  "family": "family",
  "model": "Delegated external role",
  "module": "Delegated Access",
  "scope": "View student-shared categories and approved service handoffs.",
  "permissions": [
   "share.active.read",
   "calendar.shared.read",
   "payment.authorized.handoff"
  ],
  "authScope": "Explicit grants with expiry/revocation; relationship alone grants nothing",
  "exclusions": "No education-record access by relationship alone; only explicitly approved shared/application scope; expired and revoked grants unusable.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-014",
  "name": "Faculty/instructor",
  "category": "academic",
  "family": "academic",
  "model": "Provisioned responsibility",
  "module": "Course Studio",
  "scope": "Teach assigned courses, author content, assess and release within authority.",
  "permissions": [
   "course.assigned.manage",
   "assessment.assigned.review",
   "grade.assigned.draft",
   "grade.release.request"
  ],
  "authScope": "Assigned course/section; final release requires separate authority",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-015",
  "name": "Teaching assistant",
  "category": "academic",
  "family": "academic",
  "model": "Delegated responsibility",
  "module": "Course Studio",
  "scope": "Support assigned sections, feedback queues and office hours.",
  "permissions": [
   "section.assigned.read",
   "feedback.assigned.write",
   "grade.delegated.draft",
   "officehours.assigned.manage"
  ],
  "authScope": "Assigned sections; no independent final-grade release",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-016",
  "name": "Department chair",
  "category": "academic",
  "family": "academic",
  "model": "Provisioned leadership role",
  "module": "Academic Governance",
  "scope": "Coordinate staffing, demand and delegated curriculum decisions.",
  "permissions": [
   "department.aggregate.read",
   "staffing.assigned.approve",
   "curriculum.assigned.review"
  ],
  "authScope": "Department scope; no unrestricted student-record access",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-017",
  "name": "Program director",
  "category": "academic",
  "family": "academic",
  "model": "Provisioned leadership role",
  "module": "Academic Governance",
  "scope": "Coordinate program requirements, milestones and outcomes.",
  "permissions": [
   "program.assigned.manage",
   "curriculum.assigned.propose",
   "outcome.aggregate.read"
  ],
  "authScope": "Assigned program and delegated decisions",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-018",
  "name": "Academic advisor",
  "category": "academic",
  "family": "academic",
  "model": "Relationship-scoped role",
  "module": "Advising",
  "scope": "Prepare meetings, shared plans and referrals for assigned students.",
  "permissions": [
   "caseload.assigned.read",
   "plan.shared.review",
   "advising.note.scoped.write",
   "referral.scoped.create"
  ],
  "authScope": "Assigned caseload and consent/policy-permitted records",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-019",
  "name": "Student success staff",
  "category": "academic",
  "family": "academic",
  "model": "Relationship-scoped role",
  "module": "Student Support",
  "scope": "Manage assigned follow-ups, referrals and approved outreach.",
  "permissions": [
   "case.assigned.manage",
   "outreach.approved.send",
   "referral.scoped.track"
  ],
  "authScope": "Assigned cohort/cases; no hidden profiling or private study access",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-020",
  "name": "Registrar staff",
  "category": "administrative",
  "family": "academic",
  "model": "Provisioned operations role",
  "module": "Registrar",
  "scope": "Operate assigned registration and record processes.",
  "permissions": [
   "registration.assigned.process",
   "override.assigned.prepare",
   "record.authorized.export"
  ],
  "authScope": "Delegated office scope; consequential changes require approval and reconciliation",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-021",
  "name": "Financial aid staff",
  "category": "administrative",
  "family": "service",
  "model": "Provisioned service role",
  "module": "Student Finance",
  "scope": "Handle aid requirements, questions and approved handoffs.",
  "permissions": [
   "aid.case.assigned.read",
   "aid.requirement.notify",
   "aid.decision.route"
  ],
  "authScope": "Assigned aid cases; award decisions require separate authority",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-022",
  "name": "Student accounts staff",
  "category": "administrative",
  "family": "service",
  "model": "Provisioned service role",
  "module": "Student Finance",
  "scope": "Manage account requests, payment-plan workflows and reconciliation.",
  "permissions": [
   "account.assigned.read",
   "paymentplan.assigned.prepare",
   "payment.reconcile",
   "hold.release.request"
  ],
  "authScope": "Assigned accounts; hold release requires confirmed payment and authority",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-023",
  "name": "Admissions staff",
  "category": "administrative",
  "family": "service",
  "model": "Provisioned service role",
  "module": "Admissions",
  "scope": "Review checklists, communicate missing documents and coordinate onboarding.",
  "permissions": [
   "application.assigned.review",
   "applicant.approved.message",
   "onboarding.assigned.handoff"
  ],
  "authScope": "Assigned applications; admission decisions separately granted",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-024",
  "name": "Housing staff",
  "category": "administrative",
  "family": "service",
  "model": "Provisioned service role",
  "module": "Campus Services",
  "scope": "Manage housing requests, inventory assignments and maintenance.",
  "permissions": [
   "housing.assigned.manage",
   "maintenance.assigned.manage"
  ],
  "authScope": "Assigned service scope; no general academic-record access",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-025",
  "name": "Dining/campus-card staff",
  "category": "administrative",
  "family": "service",
  "model": "Provisioned service role",
  "module": "Campus Services",
  "scope": "Maintain menus, service availability and permitted transactions.",
  "permissions": [
   "dining.assigned.manage",
   "card.issue.assigned.process",
   "transaction.assigned.reconcile"
  ],
  "authScope": "Assigned service operations and minimum necessary financial context",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-026",
  "name": "Library staff",
  "category": "academic",
  "family": "service",
  "model": "Provisioned service role",
  "module": "Library",
  "scope": "Maintain reserves, resource links and research consultations.",
  "permissions": [
   "library.resource.manage",
   "reserve.assigned.manage",
   "consultation.assigned.manage"
  ],
  "authScope": "Library operations; no unrelated grades or private study history",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-027",
  "name": "Accessibility/disability services",
  "category": "administrative",
  "family": "service",
  "model": "Restricted service role",
  "module": "Accessibility Services",
  "scope": "Review accommodation requests and control approved arrangement sharing.",
  "permissions": [
   "accommodation.case.assigned.review",
   "arrangement.authorized.approve",
   "disclosure.scoped.manage"
  ],
  "authScope": "Restricted case scope; minimum necessary teaching disclosure",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-028",
  "name": "Counseling/wellbeing staff",
  "category": "administrative",
  "family": "service",
  "model": "Restricted service role",
  "module": "Wellbeing Services",
  "scope": "Coordinate safe referrals and approved scheduling.",
  "permissions": [
   "wellbeing.referral.assigned.read",
   "appointment.assigned.manage",
   "handoff.minimal.record"
  ],
  "authScope": "Restricted service boundary; clinical records require separate approval",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-029",
  "name": "Career staff",
  "category": "administrative",
  "family": "service",
  "model": "Provisioned service role",
  "module": "Career",
  "scope": "Review opportunities, provide appointments and verify permitted evidence.",
  "permissions": [
   "opportunity.assigned.review",
   "career.appointment.manage",
   "evidence.authorized.verify"
  ],
  "authScope": "Career-service scope; student-selected materials only",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-030",
  "name": "Employer",
  "category": "administrative",
  "family": "external",
  "model": "Approved external role",
  "module": "Employer Network",
  "scope": "Submit opportunities and review applications or selected evidence.",
  "permissions": [
   "opportunity.organization.submit",
   "application.consented.read",
   "interview.scoped.manage"
  ],
  "authScope": "Verified organization and submitted/explicitly shared materials only",
  "exclusions": "No education-record access by relationship alone; only explicitly approved shared/application scope; expired and revoked grants unusable.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-031",
  "name": "Mentor",
  "category": "academic",
  "family": "external",
  "model": "Consent-based relationship",
  "module": "Alumni & Mentoring",
  "scope": "Manage availability, mentoring sessions and agreed follow-up.",
  "permissions": [
   "mentoring.match.accept",
   "session.assigned.manage",
   "resource.shared.publish"
  ],
  "authScope": "Consenting assigned relationships; no default education-record access",
  "exclusions": "No education-record access by relationship alone; only explicitly approved shared/application scope; expired and revoked grants unusable.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-032",
  "name": "Peer mentor",
  "category": "student",
  "family": "learner",
  "model": "Student responsibility overlay",
  "module": "Alumni & Mentoring",
  "scope": "Support matched peers and route concerns through approved channels.",
  "permissions": [
   "mentoring.assigned.read",
   "session.assigned.manage",
   "referral.minimal.create"
  ],
  "authScope": "Assigned matches with training; no confidential case access",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Student",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-033",
  "name": "Campus safety staff",
  "category": "administrative",
  "family": "service",
  "model": "Restricted service role",
  "module": "Campus Safety",
  "scope": "Manage authorized safety communications and incident routing.",
  "permissions": [
   "safety.incident.assigned.process",
   "notice.authorized.publish"
  ],
  "authScope": "Authorized incident scope; no general student dossier",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-034",
  "name": "Community moderator",
  "category": "administrative",
  "family": "service",
  "model": "Bounded moderation role",
  "module": "Community & Organizations",
  "scope": "Review assigned reports and apply policy-bound moderation.",
  "permissions": [
   "report.assigned.review",
   "content.assigned.moderate",
   "appeal.assigned.route"
  ],
  "authScope": "Assigned community; appeals require separation where applicable",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-035",
  "name": "Student organization leader",
  "category": "student",
  "family": "learner",
  "model": "Organization-scoped role",
  "module": "Community & Organizations",
  "scope": "Manage organization membership, events and announcements.",
  "permissions": [
   "organization.assigned.manage",
   "event.organization.manage",
   "announcement.organization.publish"
  ],
  "authScope": "Verified organization only; no member academic records",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Student",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-036",
  "name": "Institutional IT",
  "category": "system",
  "family": "institution",
  "model": "Human control-plane role",
  "module": "Identity & Integrations",
  "scope": "Configure approved SSO mappings, connectors and sync operations.",
  "permissions": [
   "integration.tenant.configure",
   "sync.tenant.monitor",
   "identity.mapping.propose"
  ],
  "authScope": "Tenant technical configuration; no standing student-content access",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-037",
  "name": "Institutional security/privacy",
  "category": "system",
  "family": "institution",
  "model": "Human control-plane role",
  "module": "Trust & Governance",
  "scope": "Review access, privacy requests, integration scopes and exceptional access.",
  "permissions": [
   "access.tenant.review",
   "privacy.request.process",
   "security.log.scoped.read",
   "scope.request.review"
  ],
  "authScope": "Purpose-bound review; no unrestricted record access",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-038",
  "name": "Institutional executive",
  "category": "administrative",
  "family": "institution",
  "model": "Leadership role",
  "module": "Institutional Insights",
  "scope": "Review verified aggregate outcomes and delegated program decisions.",
  "permissions": [
   "insight.approved.aggregate.read",
   "program.delegated.approve"
  ],
  "authScope": "Aggregate reporting and delegated decisions only",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-039",
  "name": "Institutional auditor",
  "category": "administrative",
  "family": "institution",
  "model": "Read-only assurance role",
  "module": "Trust & Governance",
  "scope": "Inspect approved evidence, records logs and findings.",
  "permissions": [
   "audit.scoped.read",
   "evidence.approved.export",
   "finding.scoped.record"
  ],
  "authScope": "Read-only audit scope; no operational modification",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-040",
  "name": "Semester support operator",
  "category": "system",
  "family": "company",
  "model": "Human platform-operations role",
  "module": "Company Support",
  "scope": "Triage support tickets and route institutional issues.",
  "permissions": [
   "support.ticket.assigned.manage",
   "knowledge.approved.update"
  ],
  "authScope": "Business/support records; tenant access requires time-limited audited grant",
  "exclusions": "No standing student-table access; no tenant actions without approved, time-limited audited support scope; no commercial authority beyond delegation.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-041",
  "name": "Semester implementation lead",
  "category": "administrative",
  "family": "company",
  "model": "Company delivery role",
  "module": "Company Implementation",
  "scope": "Coordinate launch plans, staging tests, training and cutover evidence.",
  "permissions": [
   "implementation.assigned.manage",
   "readiness.evidence.record",
   "training.assigned.manage"
  ],
  "authScope": "Assigned customer project; production activation independently approved",
  "exclusions": "No standing student-table access; no tenant actions without approved, time-limited audited support scope; no commercial authority beyond delegation.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-042",
  "name": "Semester customer-success manager",
  "category": "administrative",
  "family": "company",
  "model": "Company account role",
  "module": "Company Customer Success",
  "scope": "Coordinate sponsor updates, outcome reviews and renewals.",
  "permissions": [
   "account.assigned.manage",
   "outcome.approved.aggregate.read",
   "renewal.assigned.prepare"
  ],
  "authScope": "Business records and approved aggregates; no student tables",
  "exclusions": "No standing student-table access; no tenant actions without approved, time-limited audited support scope; no commercial authority beyond delegation.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-043",
  "name": "Semester revenue operations",
  "category": "administrative",
  "family": "company",
  "model": "Company commercial role",
  "module": "Company Revenue Operations",
  "scope": "Manage pipeline, quote preparation and commercial forecasts.",
  "permissions": [
   "pipeline.company.manage",
   "quote.company.prepare",
   "forecast.company.read"
  ],
  "authScope": "Business records only; signature/discount authority separately granted",
  "exclusions": "No standing student-table access; no tenant actions without approved, time-limited audited support scope; no commercial authority beyond delegation.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-044",
  "name": "Semester finance operator",
  "category": "administrative",
  "family": "company",
  "model": "Company finance role",
  "module": "Company Finance",
  "scope": "Manage invoices, reconciliation, close and runway reporting.",
  "permissions": [
   "invoice.company.manage",
   "finance.company.reconcile",
   "reporting.company.prepare"
  ],
  "authScope": "Company finance only; separate from institutional student accounts",
  "exclusions": "No standing student-table access; no tenant actions without approved, time-limited audited support scope; no commercial authority beyond delegation.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-045",
  "name": "Semester security operator",
  "category": "system",
  "family": "company",
  "model": "Human platform-security role",
  "module": "Platform Security & Reliability",
  "scope": "Investigate scoped alerts, coordinate remediation and recovery evidence.",
  "permissions": [
   "security.platform.triage",
   "remediation.platform.prepare",
   "recovery.drill.record"
  ],
  "authScope": "Redacted platform telemetry; production changes independently approved",
  "exclusions": "No standing student-table access; no tenant actions without approved, time-limited audited support scope; no commercial authority beyond delegation.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-046",
  "name": "Semester privacy/legal operator",
  "category": "administrative",
  "family": "company",
  "model": "Company governance role",
  "module": "Company Legal & Privacy",
  "scope": "Coordinate contracts, privacy requests and approved claims.",
  "permissions": [
   "contract.company.review",
   "privacy.company.route",
   "claim.company.review"
  ],
  "authScope": "Approved business/legal records; no standing student-record access",
  "exclusions": "No standing student-table access; no tenant actions without approved, time-limited audited support scope; no commercial authority beyond delegation.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-047",
  "name": "Semester product operator",
  "category": "system",
  "family": "company",
  "model": "Human release-control role",
  "module": "Platform Release Management",
  "scope": "Prepare releases, cohort flags and evaluation review.",
  "permissions": [
   "release.platform.prepare",
   "featureflag.scoped.prepare",
   "evaluation.approved.read"
  ],
  "authScope": "Delegated configuration; deployment and activation separately approved",
  "exclusions": "No standing student-table access; no tenant actions without approved, time-limited audited support scope; no commercial authority beyond delegation.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-048",
  "name": "Semester executive",
  "category": "administrative",
  "family": "company",
  "model": "Company leadership role",
  "module": "Company Executive",
  "scope": "Review company outcomes, risks, capital and delegated decisions.",
  "permissions": [
   "company.aggregate.read",
   "decision.delegated.approve",
   "board.report.prepare"
  ],
  "authScope": "Company scope; seniority never grants student-record access",
  "exclusions": "No standing student-table access; no tenant actions without approved, time-limited audited support scope; no commercial authority beyond delegation.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-049",
  "name": "Developer/partner",
  "category": "system",
  "family": "external",
  "model": "Approved human developer role",
  "module": "Developer Platform",
  "scope": "Use sandbox APIs and submit applications or scope requests.",
  "permissions": [
   "sandbox.own.manage",
   "app.organization.submit",
   "scope.organization.request"
  ],
  "authScope": "Approved sandbox/application scopes only; no default production access",
  "exclusions": "No education-record access by relationship alone; only explicitly approved shared/application scope; expired and revoked grants unusable.",
  "relatedBase": "",
  "evidence": "Named in role-page registry"
 },
 {
  "id": "SEM-ROLE-050",
  "name": "Admitted student",
  "category": "student",
  "family": "learner",
  "model": "Lifecycle persona",
  "module": "Admissions",
  "scope": "Complete sourced admission-to-enrollment onboarding steps.",
  "permissions": [
   "onboarding.own.manage",
   "checklist.own.read",
   "plan.own.prepare"
  ],
  "authScope": "Verified admission context; no self-issued status changes",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Applicant / Student",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-051",
  "name": "Self-serve student",
  "category": "student",
  "family": "learner",
  "model": "Access-mode variant",
  "module": "Student Workspace",
  "scope": "Use private plans, courses and study without institutional adoption.",
  "permissions": [
   "workspace.own.manage",
   "study.own.manage",
   "data.own.export"
  ],
  "authScope": "Personal data only; no implied institutional linkage",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-052",
  "name": "Institution-linked student",
  "category": "student",
  "family": "learner",
  "model": "Access-mode variant",
  "module": "Student Workspace",
  "scope": "Use approved institutional information and authorized requests.",
  "permissions": [
   "record.own.authorized.read",
   "request.own.submit",
   "receipt.own.read"
  ],
  "authScope": "Verified active membership plus module-specific grants",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-053",
  "name": "Undergraduate student",
  "category": "student",
  "family": "learner",
  "model": "Persona overlay",
  "module": "Academic Planning",
  "scope": "Coordinate degree planning, coursework and campus participation.",
  "permissions": [
   "plan.own.manage",
   "course.enrolled.read",
   "opportunity.own.save"
  ],
  "authScope": "Student base scope; no additional privilege from persona",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-054",
  "name": "Dual-enrollment student",
  "category": "student",
  "family": "learner",
  "model": "Persona overlay",
  "module": "Academic Planning",
  "scope": "Plan across distinct educational affiliations and credit contexts.",
  "permissions": [
   "membership.own.read",
   "plan.own.manage",
   "credit.own.review"
  ],
  "authScope": "Separate memberships and applicable delegation rules",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-055",
  "name": "Visiting/exchange student",
  "category": "student",
  "family": "learner",
  "model": "Temporary-affiliation persona",
  "module": "Academic Planning",
  "scope": "Manage temporary study plans and transfer-back evidence.",
  "permissions": [
   "plan.own.manage",
   "evidence.own.export",
   "course.authorized.read"
  ],
  "authScope": "Time-bounded institutional membership",
  "exclusions": "Persona/access-mode label grants no additional privilege; no access to others’ private records; no unilateral official-record changes.",
  "relatedBase": "Student",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-056",
  "name": "Authorized payer",
  "category": "administrative",
  "family": "family",
  "model": "Delegated external role",
  "module": "Delegated Access",
  "scope": "View authorized billing scope and use approved payment handoffs.",
  "permissions": [
   "statement.shared.read",
   "payment.authorized.handoff",
   "receipt.authorized.read"
  ],
  "authScope": "Explicit payer authorization; no grades or general student profile",
  "exclusions": "No education-record access by relationship alone; only explicitly approved shared/application scope; expired and revoked grants unusable.",
  "relatedBase": "Family/guardian",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-057",
  "name": "Course designer/instructional designer",
  "category": "academic",
  "family": "academic",
  "model": "Specialist responsibility",
  "module": "Course Studio",
  "scope": "Draft course templates, content and accessibility reviews.",
  "permissions": [
   "course.template.prepare",
   "material.assigned.edit",
   "accessibility.content.review"
  ],
  "authScope": "Assigned design project; no default gradebook access",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Faculty/instructor",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-058",
  "name": "Tutor",
  "category": "academic",
  "family": "academic",
  "model": "Bounded teaching role",
  "module": "Tutoring",
  "scope": "Manage tutoring availability, sessions and agreed learning goals.",
  "permissions": [
   "tutoring.availability.own.manage",
   "session.assigned.manage",
   "resource.approved.read"
  ],
  "authScope": "Assigned sessions and chosen materials only",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-059",
  "name": "Peer tutor",
  "category": "academic",
  "family": "academic",
  "model": "Supervised teaching role",
  "module": "Tutoring",
  "scope": "Provide trained peer tutoring within an approved program.",
  "permissions": [
   "session.assigned.manage",
   "resource.approved.read",
   "concern.scoped.escalate"
  ],
  "authScope": "Program assignment and supervision; no gradebook access",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Tutor",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-060",
  "name": "Dean/academic affairs leader",
  "category": "academic",
  "family": "academic",
  "model": "Leadership specialization",
  "module": "Academic Governance",
  "scope": "Review school-level evidence and approve delegated policies.",
  "permissions": [
   "school.aggregate.read",
   "policy.delegated.review",
   "decision.delegated.approve"
  ],
  "authScope": "School scope; individual records only with separate purpose-bound authority",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Department chair / Program director",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-061",
  "name": "Curriculum administrator",
  "category": "academic",
  "family": "academic",
  "model": "Specialist operations role",
  "module": "Academic Governance",
  "scope": "Prepare versioned catalog rules, equivalencies and impact packages.",
  "permissions": [
   "catalog.assigned.draft",
   "curriculum.impact.review",
   "approval.package.submit"
  ],
  "authScope": "Effective-dated proposals; no unilateral publication",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Registrar staff / Program director",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-062",
  "name": "Department administrator/scheduler",
  "category": "administrative",
  "family": "academic",
  "model": "Specialist operations role",
  "module": "Academic Scheduling",
  "scope": "Prepare section offerings, rooms, staffing and conflict resolution.",
  "permissions": [
   "section.assigned.prepare",
   "schedule.constraint.validate",
   "room.assigned.allocate"
  ],
  "authScope": "Assigned department/term; publication separately granted",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Department chair",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-063",
  "name": "Accessibility teaching liaison",
  "category": "academic",
  "family": "academic",
  "model": "Restricted coordination role",
  "module": "Accessibility Services",
  "scope": "Coordinate implementation of approved teaching arrangements.",
  "permissions": [
   "arrangement.assigned.read",
   "implementation.assigned.confirm",
   "barrier.scoped.route"
  ],
  "authScope": "Approved instructions only; diagnoses excluded",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Faculty/instructor / Accessibility/disability services",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-064",
  "name": "Success coach",
  "category": "academic",
  "family": "academic",
  "model": "Relationship-scoped specialization",
  "module": "Student Support",
  "scope": "Coordinate student-agreed goals and permitted follow-ups.",
  "permissions": [
   "goal.shared.manage",
   "case.assigned.followup",
   "referral.minimal.create"
  ],
  "authScope": "Assigned or consented relationship; no hidden profiling",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Student success staff",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-065",
  "name": "Student-success leader",
  "category": "administrative",
  "family": "academic",
  "model": "Service leadership specialization",
  "module": "Student Support",
  "scope": "Manage service capacity, assignments and aggregate outcomes.",
  "permissions": [
   "caseload.team.assign",
   "service.capacity.manage",
   "outcome.aggregate.read"
  ],
  "authScope": "Team operations; no automatic access to confidential notes",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Student success staff",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-066",
  "name": "First-year/orientation staff",
  "category": "administrative",
  "family": "service",
  "model": "Cohort operations specialization",
  "module": "Admissions",
  "scope": "Coordinate approved onboarding cohorts and first-term tasks.",
  "permissions": [
   "cohort.assigned.read",
   "onboarding.assigned.coordinate",
   "outreach.approved.send"
  ],
  "authScope": "Assigned cohorts and required onboarding context",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Admissions staff",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-067",
  "name": "Learning-center staff",
  "category": "academic",
  "family": "service",
  "model": "Program operations specialization",
  "module": "Tutoring",
  "scope": "Manage tutor programs, availability, referrals and quality reviews.",
  "permissions": [
   "tutor.program.assign",
   "tutoring.capacity.manage",
   "service.quality.review"
  ],
  "authScope": "Approved learning-center program scope",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Tutor",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-068",
  "name": "International-student advisor",
  "category": "academic",
  "family": "service",
  "model": "Restricted advising specialization",
  "module": "Student Support",
  "scope": "Handle assigned specialist cases and official-service handoffs.",
  "permissions": [
   "international.case.assigned.review",
   "document.scoped.read",
   "official.handoff.prepare"
  ],
  "authScope": "Restricted specialist assignment; decisions require professional authority",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Academic advisor",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-069",
  "name": "Study-abroad advisor",
  "category": "academic",
  "family": "service",
  "model": "Advising specialization",
  "module": "Academic Planning",
  "scope": "Coordinate mobility plans, approvals and credit reconciliation.",
  "permissions": [
   "mobility.plan.assigned.manage",
   "approval.package.submit",
   "credit.reconciliation.prepare"
  ],
  "authScope": "Assigned participants and approved programs",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Academic advisor",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-070",
  "name": "Resident assistant",
  "category": "student",
  "family": "service",
  "model": "Student service responsibility",
  "module": "Campus Services",
  "scope": "Support assigned residents and route concerns.",
  "permissions": [
   "community.assigned.publish",
   "concern.minimal.route",
   "resident.request.assigned.read"
  ],
  "authScope": "Assigned residence duties; no general housing/academic dossier",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Student / Housing staff",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-071",
  "name": "Recreation/events operator",
  "category": "administrative",
  "family": "service",
  "model": "Service operations specialization",
  "module": "Campus Services",
  "scope": "Manage recreation capacity, facility bookings and event operations.",
  "permissions": [
   "facility.assigned.manage",
   "booking.assigned.process",
   "event.assigned.operate"
  ],
  "authScope": "Assigned facilities/events and necessary participant details",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-072",
  "name": "Transportation/parking staff",
  "category": "administrative",
  "family": "service",
  "model": "Service operations specialization",
  "module": "Campus Services",
  "scope": "Maintain routes, permits and approved service requests.",
  "permissions": [
   "transport.information.manage",
   "permit.assigned.process",
   "disruption.authorized.publish"
  ],
  "authScope": "Assigned transport service; no person-location tracking",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-073",
  "name": "Alumni-relations staff",
  "category": "administrative",
  "family": "service",
  "model": "Network program specialization",
  "module": "Alumni & Mentoring",
  "scope": "Operate opt-in alumni programs, events and mentoring.",
  "permissions": [
   "alumni.program.manage",
   "participant.consented.invite",
   "event.assigned.manage"
  ],
  "authScope": "Opt-in program records; no unrestricted historic academic records",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Alumni",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-074",
  "name": "Registration specialist",
  "category": "administrative",
  "family": "institution",
  "model": "Registrar specialization",
  "module": "Registrar",
  "scope": "Process assigned requests, holds and approved overrides.",
  "permissions": [
   "registration.assigned.review",
   "override.approval.request",
   "registration.authorized.execute"
  ],
  "authScope": "Delegated workflow; no self-approval or unsupported hold release",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Registrar staff",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-075",
  "name": "Academic-records specialist",
  "category": "administrative",
  "family": "institution",
  "model": "Registrar specialization",
  "module": "Registrar",
  "scope": "Prepare controlled corrections and record-service cases.",
  "permissions": [
   "record.assigned.review",
   "correction.prepare",
   "correction.approved.post"
  ],
  "authScope": "Evidence plus independent approval; immutable history retained",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Registrar staff",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-076",
  "name": "Transcript/record-services specialist",
  "category": "administrative",
  "family": "institution",
  "model": "Registrar specialization",
  "module": "Registrar",
  "scope": "Validate release authority and fulfill record requests.",
  "permissions": [
   "transcript.request.assigned.review",
   "recipient.identity.verify",
   "transcript.authorized.fulfill"
  ],
  "authScope": "Approved release scope, recipient checks and delivery audit",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Registrar staff",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-077",
  "name": "Transfer-credit/articulation evaluator",
  "category": "academic",
  "family": "institution",
  "model": "Registrar specialization",
  "module": "Registrar",
  "scope": "Evaluate prior-credit evidence and propose equivalencies.",
  "permissions": [
   "transfer.case.assigned.review",
   "equivalency.propose",
   "approval.package.submit"
  ],
  "authScope": "Assigned evaluation; final approval separately granted",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Registrar staff",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-078",
  "name": "Graduation/degree-audit specialist",
  "category": "administrative",
  "family": "institution",
  "model": "Registrar specialization",
  "module": "Registrar",
  "scope": "Review candidates, requirements and exception routing.",
  "permissions": [
   "audit.candidate.review",
   "exception.approval.request",
   "conferral.authorized.prepare"
  ],
  "authScope": "Authorized catalog/policy context; no unilateral conferral",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Registrar staff",
  "evidence": "Specialist extension from broader specification"
 },
 {
  "id": "SEM-ROLE-079",
  "name": "Institution administrator",
  "category": "system",
  "family": "institution",
  "model": "Human tenant-control specialization",
  "module": "Institution Administration",
  "scope": "Configure modules, delegated roles and activation requests.",
  "permissions": [
   "tenant.configuration.manage",
   "role.delegated.assign",
   "activation.request.prepare"
  ],
  "authScope": "Tenant-scoped; no blanket record access or self-approved privileged access",
  "exclusions": "No records outside assignment/purpose; no access to student-private work by default; no consequential action without explicit authority and required review.",
  "relatedBase": "Institutional IT",
  "evidence": "Specialist extension from broader specification"
 }
];
