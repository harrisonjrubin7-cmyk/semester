// 69-role application registry (owner build pack, 2026-10-24) reconciled against this workspace — stage 0 "Reconcile".
// Status is evidence about THIS repository only: 'partial' = a real surface exists but the role's full capability list does not;
// 'missing' = no role-specific surface yet. Nothing is 'verified' here: no role app has end-to-end acceptance evidence.
// Each role maps to the app that should host it (shared accounts, one database), never a separate product.
export type RoleStatus = 'partial' | 'missing';
export type Stage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type RoleApp = { n: number; role: string; group: string; host: string; capabilities: string; existing: string | null; stage: Stage; status: RoleStatus };

const G = { A: 'Student lifecycle', B: 'Teaching, learning, advising', C: 'Academic authority, records, finance', D: 'Campus services and support', E: 'Institutional administration', F: 'Platform operations and safety', G: 'External partners', H: 'Business and organizations', I: 'Semester company operations' };
type Row = [string, keyof typeof G, string, string, string | null, Stage];
const S = 'Semester', CO = 'Company OS', AP = 'Applicants', EM = 'Employers', SL = 'Security Lab', DV = 'Developers';

const ROWS: Row[] = [
  ['Prospective Student', 'A', AP, 'Program discovery, comparison, cost scenarios, visits, inquiries, application prep, scholarships', 'Applicants app; Site', 4],
  ['Student', 'A', S, 'Today, Action Center, calendar, tasks, courses, notes, files, study, registration readiness, support, finances, campus, career, privacy', 'Today, Calendar, Courses, Study, Help, Campus, Career, You', 2],
  ['Undergraduate Student', 'A', S, 'Major/minor, gen ed, degree audit, planning, course comparison, internships, capstone, graduation readiness', 'Degree, Progress', 3],
  ['Graduate Student', 'A', S, 'Research planning, committees, thesis milestones, funding, assistantships, defense scheduling', null, 4],
  ['Admitted Student', 'A', S, 'Decision, enrollment intent, deposit handoff, placement, orientation, housing/aid checklists, identity', 'Admissions, Onboarding', 4],
  ['Transfer Student', 'A', S, 'Transcript intake, articulation, equivalencies, credit evaluation, appeals, remaining-degree comparison', null, 4],
  ['Dual Enrollment Student', 'A', S, 'HS/college affiliation, eligibility, consent, approved courses, coordinated calendars, credit routing', null, 4],
  ['Alumni', 'A', S, 'Portfolio, credentials, mentoring, networking, opportunities, continuing education', 'Alumni role; Career', 5],
  ['Faculty', 'B', S, 'Course Studio, syllabus, assignments, rubrics, gradebook, feedback, office hours, announcements, course AI policy', 'Courses, SectionPage, Grades, RegradeQueue', 3],
  ['Teaching Assistant', 'B', S, 'Assigned sections, delegated grading, feedback queues, office hours, escalation to faculty', null, 3],
  ['Academic Advisor', 'B', S, 'Caseload, degree plans, appointments, notes, referrals, exceptions, outreach, consented sharing', 'Advising, SharedWithMe', 3],
  ['Tutor', 'B', S, 'Subject profile, availability, matching, appointments, session plans, scoped summaries', 'Tutor role', 4],
  ['Learning Center Staff', 'B', S, 'Tutor staffing, qualifications, scheduling, attendance, waitlists, quality review', null, 4],
  ['Career Coach', 'B', S, 'Career plans, portfolio/resume review, interview practice, appointments, referrals', null, 5],
  ['Peer Mentor', 'B', S, 'Opt-in matching, mentees, check-ins, goals, referrals, bounded concern escalation', 'Mentoring', 4],
  ['Orientation Leader', 'B', S, 'Assigned groups, schedules, attendance, onboarding progress, approved announcements', null, 4],
  ['Disability Services Officer', 'C', S, 'Restricted intake, documentation review, determinations, accommodation letters, appeals', 'Accommodations', 4],
  ['Registrar', 'C', S, 'Terms, catalog, sections, windows, waitlists, holds, overrides, grade changes, transcripts, reconciliation', 'Registration; registrar Neon functions', 3],
  ['Department Chair', 'C', S, 'Curriculum proposals, teaching assignments, section demand, approvals, program outcomes', null, 6],
  ['Dean', 'C', S, 'College planning, department health, resource allocation, program review, governance approvals', null, 6],
  ['Institutional Researcher', 'C', S, 'Metric definitions, governed datasets, cohorts, reproducible analysis, approved extracts', null, 6],
  ['Financial Aid Officer', 'C', S, 'Requirements, document review, eligibility, award proposals, appeals, SAP review', null, 4],
  ['Student Accounts Officer', 'C', S, 'Ledger, charges, statements, payment plans, holds, refunds, disputes, reconciliation', null, 3],
  ['International Student Advisor', 'C', S, 'Immigration milestones, document requests, travel/employment workflows, official-system handoffs', null, 4],
  ['Veterans Certifying Official', 'C', S, 'Benefits intake, enrollment certification, changes, deadlines, agency handoffs', null, 4],
  ['Dining Staff', 'D', S, 'Locations, menus, allergens, meal plans, orders, inventory, reconciliation', 'Campus (read-only)', 5],
  ['Residence Life Staff', 'D', S, 'Housing applications, assignments, contracts, move-in/out, maintenance, incidents', null, 5],
  ['Resident Assistant', 'D', S, 'Assigned residents, check-ins, programs, maintenance referrals, incident intake', null, 5],
  ['Counseling Liaison', 'D', S, 'Resource navigation, consented referrals, appointment handoffs, crisis routing', 'Help referrals (Cases)', 4],
  ['Athletics Compliance Officer', 'D', S, 'Versioned eligibility rules, roster reviews, certifications, exceptions', null, 6],
  ['Career Center Staff', 'D', S, 'Employer verification, posting review, fairs, internships, outcomes', null, 5],
  ['Disability Services Staff', 'D', S, 'Assigned intake, scheduling, document tracking, accommodation delivery checks', 'Accommodations', 4],
  ['Study Abroad Advisor', 'D', S, 'Programs, applications, learning agreements, equivalencies, travel readiness', null, 6],
  ['First Year Staff', 'D', S, 'Transition cohorts, onboarding checklists, outreach, referrals, retention support', null, 4],
  ['Athletic Academic Support', 'D', S, 'Travel-aware planning, check-ins, tutoring, permitted progress sharing', null, 6],
  ['University Admin', 'E', S, 'Institution structure, tenant policy, memberships, role grants, access reviews, rollout, audit', 'Institution, Console', 1],
  ['Department Admin', 'E', S, 'Department requests, scheduling, rooms, forms, delegated approvals', null, 6],
  ['University Staff', 'E', S, 'Office queues, service requests, appointments, knowledge, referrals, resolution', 'Staff, Help cases', 2],
  ['Integration Admin', 'E', S, 'Connections, scopes, mappings, sync runs, dead letters, replay, schema drift', 'Console sources (connectors off)', 6],
  ['Implementation Manager', 'E', CO, 'Tenant setup, data mapping, migration, UAT, launch gates, cutover, rollback', 'Implementation, Migrations', 7],
  ['Data Steward', 'E', S, 'Definitions, classifications, lineage, source authority, quality, retention', null, 6],
  ['Portfolio Council', 'E', S, 'Evidence standards, rubric versions, reviewer assignment, credential recommendations', null, 6],
  ['Billing Contact', 'E', S, 'Subscription/invoice visibility, POs, payment handoffs, disputes (no student finances)', 'Company OS invoices (internal side only)', 7],
  ['Platform Admin', 'F', DV, 'Tenant fleet, health, flags, quotas, maintenance, rollout controls', 'Developers app', 8],
  ['Support Agent', 'F', CO, 'Tickets, help articles, safe diagnostics, consented temporary access, expiry', 'Support, Support access', 7],
  ['Incident Responder', 'F', CO, 'Alerts, command, impact, containment, comms, recovery, postmortems', 'Incidents', 7],
  ['Moderator', 'F', S, 'Reports, contextual review, warnings, reversible actions, appeals routing', 'Community moderation reports', 5],
  ['Trust Safety Reviewer', 'F', SL, 'Specialist safety cases, evidence review, restriction proposals, escalation', 'Security Lab', 8],
  ['Trust Safety Senior', 'F', SL, 'Escalated decisions, high-impact approvals, appeals, calibration', null, 8],
  ['Community Manager', 'F', S, 'Community setup, membership, programming, health metrics, lifecycle', 'Community', 5],
  ['Employer', 'G', EM, 'Org verification, postings, approved talent discovery, applications, interviews, consented evidence', 'Employers app', 5],
  ['Scholarship Provider', 'G', EM, 'Sponsor verification, programs, criteria, applications, awards, disbursement handoffs', null, 6],
  ['Marketplace Partner', 'G', EM, 'Verification, listings, orders, fulfillment, refunds, disputes, settlements', null, 6],
  ['Transfer Partner Admin', 'G', EM, 'Agreements, articulation proposals, course mappings, mutual approvals', null, 6],
  ['High School Counselor', 'G', AP, 'Assigned students, authorized progress, documents, recommendations, consent', null, 6],
  ['Research Partner', 'G', EM, 'Protocol requests, governance review, DUAs, approved datasets, output review', null, 6],
  ['Business Admin', 'H', S, 'Org settings, teams, projects, procurement, budgets, approvals', null, 6],
  ['Organization Member', 'H', S, 'Membership, channels, events, RSVPs, tasks, dues handoffs', 'Community', 5],
  ['Organization Officer', 'H', S, 'Delegated leadership, events, communications, budget requests, handover', null, 5],
  ['Organization Admin', 'H', S, 'Charter, recognition, roles, elections, finance oversight, succession', null, 5],
  ['Account Executive', 'I', CO, 'Accounts, discovery, opportunities, pilot scope, quotes, contracts, handoff', 'Pipeline, Accounts, Deals, Contracts', 7],
  ['Trust Officer', 'I', CO, 'Risk, privacy/security governance, vendor review, trust room, claims review', 'Trust Center, Risk register', 7],
  ['Marketing Admin', 'I', CO, 'Campaigns, audiences, templates, budgets, consent, approval routing', 'Marketing', 7],
  ['Marketing Analyst', 'I', CO, 'Funnels, attribution, experiments, cohorts, aggregate reporting', null, 7],
  ['Campaign Reviewer', 'I', CO, 'Content, audience, consent, accessibility, claims verification, launch gating', 'Marketing approvals', 7],
  ['Finance Operator', 'I', CO, 'Receivables, payables, journals, reconciliation, collections, close', 'Invoices & approvals', 7],
  ['Customer Success', 'I', CO, 'Account health, adoption, success plans, QBRs, renewals, escalations', null, 7],
  ['Compliance Owner', 'I', CO, 'Obligations, controls, evidence, access reviews, audits, remediation', 'Release evidence, Audit log', 7],
  ['Content Owner', 'I', CO, 'Ownership, provenance, licensing, accessibility, versions, publication, retirement', 'Site publications', 7],
];

export const GROUP_LABEL = G;
export const ROLE_APPS: RoleApp[] = ROWS.map(([role, g, host, capabilities, existing, stage], i) =>
  ({ n: i + 1, role, group: G[g], host, capabilities, existing, stage, status: existing ? 'partial' : 'missing' }));

export const STAGES: Record<Stage, string> = { 1: 'Foundation', 2: 'Shared work', 3: 'Academic spine', 4: 'Lifecycle and support', 5: 'Campus and career', 6: 'Institutional and partner ops', 7: 'Company operations', 8: 'Activation and platform' };

/** Proof journeys from the pack; each lists the role apps it crosses. Acceptance evidence: none yet for any. */
export const JOURNEYS = [
  { name: 'Registration and financial hold', roles: ['Student', 'Academic Advisor', 'Student Accounts Officer', 'Registrar'] },
  { name: 'Learning and career evidence', roles: ['Faculty', 'Teaching Assistant', 'Student', 'Portfolio Council', 'Career Coach', 'Employer'] },
  { name: 'Accommodation delivery', roles: ['Student', 'Disability Services Staff', 'Disability Services Officer', 'Faculty'] },
  { name: 'Institutional launch', roles: ['Account Executive', 'Implementation Manager', 'Integration Admin', 'Data Steward', 'Trust Officer', 'Compliance Owner', 'Customer Success'] },
];
