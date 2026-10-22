# Role catalog

_Generated 2026-10-05 from ui_kits/master-catalog/catalog-data.js, ui_kits/workflow-runner/runner-data.js and os-map-data.js. Design-level only: nothing here is verified until repo code, RLS/tenant isolation, accessibility, tests, monitoring, support, documentation and release evidence exist._

49 catalogued roles plus system actors, with the workflow steps each one acts in or receives.

| Role | Job to be done | Acts in (steps) | Receives (steps) | Workflows |
| --- | --- | --- | --- | --- |
| Prospective student | Discover programs, understand fit, explore value, apply or sign up | 0 | 0 | — gap: no workflow |
| Applicant | Track admissions tasks, documents, decisions, aid and onboarding | 0 | 0 | — gap: no workflow |
| Student | Daily workspace, learning, planning, actions, support, campus life, career | 95 | 46 | Student journey, Governed AI request, Support request, Student finance & payment, Campus services, Community & moderation, Career, employer & alumni, Family & guardian consent, Faculty course lifecycle, Advising & student success, Registrar & academic operations, Institution implementation, Developer platform & marketplace |
| Transfer student | Credit evaluation, articulation, path comparison, onboarding | 0 | 1 | Registrar & academic operations |
| Online student | Remote learning, time-zone-aware schedule, support, community, career | 0 | 0 | — gap: no workflow |
| Adult learner | Flexible plans, credential tracking, employer links, financial planning | 0 | 0 | — gap: no workflow |
| Graduate student | Research, milestones, advisor collaboration, funding, career | 0 | 0 | — gap: no workflow |
| International student | Visa/immigration handoffs, orientation, support, compliance notifications | 0 | 0 | — gap: no workflow |
| Student athlete | Academic plan, permitted support sharing, travel and eligibility-aware workflows | 0 | 0 | — gap: no workflow |
| Student worker | Schedule, payroll/employment handoffs, workload planning | 0 | 0 | — gap: no workflow |
| Student parent/caregiver | Flexible planning, childcare/resource handoffs, support coordination | 0 | 0 | — gap: no workflow |
| Alumni | Credentials, lifelong learning, mentoring, opportunities, network | 2 | 2 | Career, employer & alumni, Student journey |
| Family/guardian | Student-consented support, payment/support handoffs, approved summaries | 4 | 4 | Family & guardian consent, Student journey |
| Faculty/instructor | Course Studio, course policy, learning content, assessment, gradebook | 25 | 3 | Faculty course lifecycle, Career, employer & alumni, Registrar & academic operations, Analytics, outcomes & reliability |
| Teaching assistant | Scoped course support, grading/feedback, office hours, course content | 1 | 2 | Community & moderation, Faculty course lifecycle |
| Department chair | Curriculum, faculty/course operations, outcomes, demand, approvals | 0 | 2 | Faculty course lifecycle |
| Program director | Program path, requirements, outcomes, advising, retention, curriculum | 0 | 0 | — gap: no workflow |
| Academic advisor | Student path, action completion, check-ins, referrals, planning | 13 | 5 | Advising & student success, Student journey, Registrar & academic operations, Governed AI request |
| Student success staff | Caseload, interventions, campaigns, referrals, outcomes | 4 | 1 | Advising & student success |
| Registrar staff | Terms, catalog, sections, registration, holds, overrides, records | 25 | 12 | Registrar & academic operations, Domain migration, Student journey, Faculty course lifecycle, Institution implementation, Governed AI request, Support request, Student finance & payment |
| Financial aid staff | Aid handoffs, required actions, policy-guided communication | 0 | 1 | Student finance & payment |
| Student accounts staff | Balances, payment plans, reconciliation, holds, controlled account actions | 5 | 6 | Student finance & payment, Student journey, Family & guardian consent |
| Admissions staff | Prospects, applicants, campaigns, recruitment conversion | 0 | 0 | — gap: no workflow |
| Housing staff | Assignments, requests, service handoffs, housing policy workflows | 2 | 1 | Campus services |
| Dining/campus-card staff | Locations, plans, orders, balances, service operations | 1 | 5 | Campus services, Student journey |
| Library staff | Resources, research guidance, discovery, course reserves | 0 | 0 | — gap: no workflow |
| Accessibility/disability services | Accommodation workflows, consented access, service plans | 1 | 2 | Campus services, Faculty course lifecycle |
| Counseling/wellbeing staff | Safe referral and resource handoffs; no unnecessary broad access | 0 | 3 | Advising & student success, Campus services |
| Career staff | Opportunities, employer relations, appointments, skills, outcomes | 2 | 2 | Career, employer & alumni |
| Employer | Approved talent discovery, postings, internships, verified evidence | 4 | 2 | Career, employer & alumni, Student journey |
| Mentor | Mentoring offers, requests, schedule, scoped student interaction | 0 | 0 | — gap: no workflow |
| Peer mentor | Consent-based peer support, program workflows, supervision | 0 | 1 | Student journey |
| Campus safety staff | Institution-authorized emergency/safety handoffs only | 0 | 2 | Campus services, Community & moderation |
| Community moderator | Content reports, moderation queue, appeals, safety escalation | 5 | 3 | Community & moderation |
| Student organization leader | Organization setup, membership, events, communications, finance handoffs | 0 | 1 | Student journey |
| Institutional IT | SSO, SCIM, integrations, security, tenant configuration | 17 | 5 | Institution implementation, Controlled integration, Domain migration, Student journey, Registrar & academic operations |
| Institutional security/privacy | Security review, data flows, access, policy, evidence, incidents | 7 | 10 | Institution implementation, Controlled integration, Developer platform & marketplace, Student journey, Incident response |
| Institutional executive | Outcomes, adoption, risk, operational health, strategic decisions | 10 | 7 | Institution implementation, Domain migration, Analytics, outcomes & reliability, Incident response |
| Institutional auditor | Scoped evidence, audit history, compliance proof | 0 | 4 | Registrar & academic operations, Domain migration, Student finance & payment |
| Semester support operator | Ticket queue, time-limited support access, incident escalation | 7 | 7 | Support request, Institution implementation, Controlled integration, Incident response |
| Semester implementation lead | Tenant setup, integrations, training, rollout, launch readiness | 23 | 7 | Institution implementation, Controlled integration, Domain migration |
| Semester customer-success manager | Health, QBRs, renewals, expansion, pilot conversion | 9 | 0 | Institution implementation, Incident response, Analytics, outcomes & reliability |
| Semester revenue operations | Accounts, quotes, contracts, plans, pricing exceptions, forecast | 0 | 1 | Institution implementation |
| Semester finance operator | Invoices, collections, dunning, financial reporting, approved adjustments | 1 | 0 | Developer platform & marketplace |
| Semester security operator | Access reviews, security evidence, incidents, vulnerabilities | 8 | 0 | Incident response |
| Semester privacy/legal operator | Data requests, legal holds, retention, contracts, claims | 2 | 0 | Family & guardian consent |
| Semester product operator | Roadmap, feature flags, beta, feedback, release evidence | 17 | 8 | Support request, Incident response, Developer platform & marketplace, Analytics, outcomes & reliability, Governed AI request, Community & moderation |
| Semester executive | Company health, risk, strategy, major approvals, board reporting | 5 | 0 | Incident response, Analytics, outcomes & reliability |
| Developer/partner | APIs, sandbox, integration, marketplace publishing, support | 6 | 5 | Developer platform & marketplace |
| AI gateway (system) | System / company actor | 17 | 0 | Governed AI request, Community & moderation |
| Payment processor (system) | System / company actor | 1 | 1 | Student finance & payment |
| Board/investor (company) | System / company actor | 0 | 1 | Analytics, outcomes & reliability |
