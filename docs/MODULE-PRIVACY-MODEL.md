# Privacy by module

<!-- Rendered from app/src/lib/governance/module-privacy.ts by module-privacy.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

**Discover privately; share deliberately; act through the accountable office.** Semester can make help easier to find and coordinate, but it
minimizes sensitive data, keeps staff access purpose-bound, and never converts a
student’s request for help into a hidden risk score. Under FERPA an institution
may disclose education-record information to school officials with a defined
legitimate educational interest, but access is not automatic or unlimited:
written criteria, use limited to the stated purpose, and contractors under the
institution’s direct control. A product and governance blueprint, not legal
advice.

| Supplied document | What it holds |
| --- | --- |
| [How do these modules protect student privacy; what data do they share with staff; how does the system handle liability](expansion/Privacy-by-Module-and-Liability-Controls.pdf) | Privacy by module, the staff views, the role matrix, the share screen, the liability controls, the risk table and the launch gates. |
| [What governance do institutions need for this](expansion/Transfer-Hub-Career-Safe-AI-and-Basic-Needs.pdf) | The governance council, the required controls and the decision-rights rule. |

## 1. Privacy by module

### Transfer Transition Hub

| Data type | Default state | When staff can access | Staff should not receive |
| --- | --- | --- | --- |
| Transfer timeline, actions, goals | Private to student | Student explicitly shares, or an approved advising workflow requires a selected item | Private notes, unrelated plans, AI conversations |
| Prior-course list and unofficial transcript | Private, encrypted | Student submits or shares to the designated transfer evaluator or advisor | Broad access by faculty, clubs, employers or unrelated offices |
| Syllabi and course documents | Student-controlled | Only a named official reviewer or authorized support role, if shared | Reuse for model training, unrelated student comparisons |
| Credit-comparison estimate | Private planning result | Shared only as part of a review packet | Presentation as an official transfer-credit decision |
| Official credit-evaluation result | Institution-controlled record | Authorized records and advising roles under institutional policy | Modification by Semester, or by staff outside defined roles |
| Peer-mentor participation | Private by default | The program coordinator sees minimum operational status | Transcript, grades, aid status, accommodation details |

### Career and workforce

| Data type | Default state | Permitted sharing | Prohibited sharing |
| --- | --- | --- | --- |
| Goals, target roles, skill reflections | Private | Student-selected advisor or mentor view | Employers by default; hidden profiling |
| Portfolio artifacts | Private | Student selects item, audience, duration and permission | Automatic publication or employer access |
| Resume and application drafts | Private | Student explicitly requests career-center or mentor feedback | Employer access without submission |
| Opportunity saves and applications | Private | Aggregate institutional reporting only, unless the student requests assistance | Sale to recruiters; academic surveillance |
| Verified credentials | Student-controlled | Export or share through student action | Revoke or alter verified records without the issuer process |
| Academic records | Not required by default | Only through a separately authorized, clearly explained workflow | Employer discovery, talent ranking, advertising |

### Basic-Needs Navigator

| User action | Default | Staff visibility | Minimum data practice |
| --- | --- | --- | --- |
| Browse a resource | Private | None by default | Do not create a staff-visible case or alert |
| Save a private checklist | Private | None | Store only in the student workspace; permit deletion |
| Ask an informational question | Private | No case unless the student requests a referral | Provide a source-labelled answer and the official route |
| Request an appointment or referral | Consented | Only the named receiving office or case manager | Collect minimum required fields and explicit consent |
| Complete official intake | Institution-managed | Managed by the official service system where possible | Semester stores referral status, not sensitive intake detail |
| Use the emergency or campus-safety route | Institution policy | Follow the institution-approved emergency policy | Do not market this as crisis monitoring or emergency response |

Design rule: staff see only what is necessary to perform the selected workflow.
A transfer advisor may need a student-shared agenda and the documents needed for
review; they do not need the student’s complete private planning history, other
community memberships, or AI chats. The basic-needs module is the highest-
sensitivity one: browsing for food, housing, emergency aid, health, childcare,
technology or safety resources is private.

### The AI assistant

- **Private AI mode.** The student’s interaction is private and not visible to staff.
- **Course AI mode.** Use only the course’s approved sources and policy; do not expose conversation content to instructors unless the student intentionally shares an artifact.
- **Institutional navigator mode.** Use official, curated resource information; do not send the student’s question to an office unless they explicitly request a referral or handoff.
- **Support mode.** Share only the minimum information needed to resolve the requested support issue, with a named support role, purpose and time-limited access.

AI conversations are never used to infer mental-health status, financial distress, disability, academic risk, immigration status, misconduct risk. No general-purpose model is trained on institutional or student content unless a documented agreement, authorization and technical controls permit it ([`AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md)).

## 2. What staff can see

A minimum-necessary, role-based, purpose-bound model. Staff have no universal
“student 360” profile. For many offices the appropriate view is operational and
aggregate:

- Resource page ownership and freshness
- Broken links and content issues
- Aggregate searches with small-cell suppression
- Aggregate referral volume
- Appointment demand
- Referral completion status, if needed operationally
- Anonymized feedback themes
- Accessibility issues reported
- Service-level performance

That lets a basic-needs office improve access without knowing who merely looked
for food assistance. Student-specific data appears only when all of these are true:

1. The office has a defined institutional function.
2. The person has a role that needs the data.
3. The data is necessary for the specific work.
4. The student has explicitly initiated or shared the workflow, or another documented institutional or legal basis applies.
5. The screen limits data to the relevant case or referral.
6. The access is logged, reviewable and time-bounded where appropriate.

### Role matrix

Each role as the document names it, the `app_roles` row that carries it (held to
[`ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md) by the test), what it can see
and what it cannot.

| Role | App role | Can see | Cannot see |
| --- | --- | --- | --- |
| Transfer advisor | `academic_advisor` | Student-shared agenda, selected documents, unresolved questions, official evaluation status if authorized | Private plans, unrelated community activity, basic-needs browsing, private AI history |
| Registrar or credit evaluator | `registrar` | The official evaluation packet and required documents | Career goals, mentoring conversations, private notes |
| Career counselor | `career_coach` | Student-shared resume, portfolio, career goals, selected applications | Grades, aid details, basic-needs activity, private academic AI chats |
| Basic-needs case manager | **none** — No such role exists; counseling_liaison publishes resources only, and a help request to an office reaches an inbox, not a case. | Minimum referral information and case-specific intake through the authorized system | Full transcript, club membership, mentor conversations, unrelated transfer documents |
| Faculty member | `faculty` | Course-authorized material and explicitly shared academic work | Basic-needs requests, career records, accommodation diagnosis, private account activity |
| Club officer | `organization_officer` | Membership and event-related information required for the organization | Academic record, aid status, mentoring cases, safety case details |
| Moderator | `moderator` | Only content and evidence attached to assigned cases | Broad private-message browsing, academic record, transfer or aid history |
| Platform support | `support_agent` | Time-limited, approved technical context | Unrestricted content access, case details outside the support request |

### The data-sharing control screen

Before a share, the student sees:

| Line | Example |
| --- | --- |
| You are sharing | Transfer-credit question list and two course syllabi |
| With | A named transfer credit evaluator, Registrar’s Office |
| Purpose | Review your official transfer-credit evaluation |
| Access | View-only |
| Expires | A date within the term |
| Not included | Private notes, other uploaded documents, AI conversations, career workspace, club memberships, basic-needs activity |
| You can | Cancel before submission; edit the selection; revoke future access where permitted |

That makes student agency tangible and reduces inadvertent over-sharing. The
consent workflow behind it, field by field against the schema, is
[`trust/FERPA-CONSENT-WORKFLOW.md`](trust/FERPA-CONSENT-WORKFLOW.md).

## 3. Liability and risk controls

Semester cannot eliminate institutional or company liability through disclaimers
alone. It needs accurate product boundaries, technical controls, documented
operating procedures, contracts, insurance and trained people.

### Clear authority boundaries

Every relevant interface states whether information is *institution verified*, *published policy*, *student provided*, *semester estimate*, *ai generated*, *needs official review*, *emergency information*. Four of these are source labels of `lib/source.ts`, the five the database enforces (`institution_verified`, `student_entered`, `estimated`, `needs_review`); *published policy*, *AI generated* and *emergency information* are display states that never reach a row, and *imported* is a source label the document does not name.

| Domain | The boundary, conspicuously |
| --- | --- |
| Transfer credit | Semester organizes information and helps prepare questions. Only the authorized institution can determine official transfer credit. |
| Financial aid | Semester is not a financial-aid determination system. Confirm eligibility, awards and deadlines with the official financial-aid office. |
| Career | Semester helps you prepare and organize opportunities. It does not guarantee employment or share your information with employers without your direction. |
| Basic needs | Semester can help you find resources. It is not an emergency, medical, mental-health, legal or crisis-response service. |
| AI | AI can help explain and organize information. Verify important decisions with official sources or qualified people. |

### Purpose limitation and data minimization

For each feature, a data-processing register carries: feature; business owner; student purpose; institutional purpose; data fields; sensitive-data category; legal or contractual basis; who can access; retention period; deletion and export process; subprocessors; cross-border and residency location; security controls; risk rating; approval date. If a field does not support a defined purpose, do not collect it.

### Consent and appropriate authorization

Use consent for optional student-controlled sharing, optional mentoring, optional employer visibility and optional communication preferences. Do not use “consent” as a substitute for institutional obligations or legal requirements; for institution-provided data, use the appropriate contractual and institutional authorization model.

### High-risk workflow controls

| Risk area | Required control |
| --- | --- |
| Incorrect transfer guidance | Official-source labels, freshness dates, uncertainty display, human evaluator handoff, no official-decision claims |
| Misleading AI output | Source grounding, limitations, policy checks, report path, evaluation, human escalation |
| Student distress or emergency | Emergency notice, approved official routes, no promise of emergency monitoring, trained escalation policy |
| Sensitive basic-needs disclosure | Private browsing, minimum intake, named recipient, consented referral, restricted case access |
| Employer misuse | Student opt-in, artifact-level sharing, no academic or behavioural data access, anti-spam rules, audit logs |
| Discrimination and bias | Accessibility testing, bias evaluation, human review, appeal and correction route, aggregate monitoring |
| Harassment and community harm | Block, mute, report; moderator training; case controls; evidence and appeal process |
| Data breach | Encryption, MFA, least privilege, detection, response plan, notification procedure, tested recovery |
| Service failure or outage | Status page, redundancy, backups, manual fallback, incident communications, SLA and SLO controls |
| Staff misuse | Role separation, least privilege, access logs, periodic review, anomaly alerts, sanctions and training |

### Safety and escalation boundaries

- Show emergency guidance prominently when relevant.
- Use institution-configured official emergency contacts and service routes.
- Train moderators, support staff, mentors and operators in boundaries and escalation.
- Do not require a student to explain sensitive circumstances to access general resources.
- Do not imply active monitoring of private activity.
- Do not promise response times or intervention capabilities you cannot meet.
- Preserve evidence only when necessary and according to retention and legal-hold policy.

### Contracts, insurance and evidence

Institutional contracts define:

- Roles: the institution as education-record owner or controller where applicable; Semester as service provider or processor as applicable.
- Permitted data use and prohibited secondary use.
- Security controls, subprocessor management and breach notice.
- Support and incident-response responsibilities.
- Accessibility commitments and remediation process.
- AI providers, training and data-use rules, and policy configuration.
- Data export, deletion, retention, legal holds and offboarding.
- Indemnity, liability caps, exclusions and insurance requirements.
- Content ownership, intellectual property, and copyright and takedown process.
- Institution responsibilities for source accuracy, policy configuration, moderation ownership and emergency routing.

An evidence register demonstrates — not merely claims — compliance: access-review reports; penetration-test and vulnerability evidence; backup and recovery tests; incident exercises; ai evaluations and safety testing; accessibility test results and remediation; subprocessor reviews; data-deletion and export tests; training completion; moderation and escalation drills; policy approvals and change history.

## 4. Practical launch gates

A module is not enabled for a tenant until it passes these. Statuses were read
at `origin/main` `92952f0` on 28 September 2026, under the expansion register’s
rule: `designed` cites a document, `building` code, `tested` a test.

| not-started | designed | building | tested |
| ---: | ---: | ---: | ---: |
| 0 | 3 | 0 | 9 |

| ID | Gate | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LG-01 | Named institutional business owner | tested | `app/src/lib/governance/data-contracts.test.ts` — each data domain names the institutional role that owns it, and reports unstaffed until a person holds it<br>`supabase/migrations/20260927235000_governance_registries.sql` — governance_steward_assignments: the named person per school | Owners are named per data domain and per flag, not per module a tenant enables. |
| LG-02 | Approved purpose, scope, audience and authority boundary | tested | `app/src/lib/governance/charters.test.ts` — every module flag has a charter with its problem, user and owners<br>`app/src/lib/governance/scorecard.ts` — core, module, pilot, partner or decline | A charter states purpose and user; the authority boundary is prose in the screen, not a field of the charter. |
| LG-03 | Data map and retention schedule | tested | `app/src/lib/retention.test.ts` — every table the migrations create has a retention answer<br>`docs/operating-model/DATA-STEWARDSHIP.md` — data classes per domain | Retention is per table; no data map per module says which tables a module touches. |
| LG-04 | Role and permission matrix tested | tested | `app/src/lib/rolelaunch.test.ts` — every role and capability held to app_roles and role_capabilities<br>`supabase/rolegrants.check.sql` — grants carry scope, expiry and revocation | Nothing assigns an app role yet, so every role is modeled and none provisionable. |
| LG-05 | Privacy notice and student-facing disclosure reviewed | designed | `docs/legal/PRIVACY-POLICY-DRAFT.md` — the draft, not in force<br>`app/src/lib/trust/legal-drafts.test.ts` — held to the subprocessor register; the banner stays until counsel reviews | A draft for counsel; no review has happened. |
| LG-06 | Accessibility acceptance tests passed | tested | `app/src/a11y/axe.test.tsx` — axe-core over the rendered app<br>`app/src/lib/governance/quality-gates.test.ts` — accessibility criteria in the definition of ready and done | Automated only; the manual assistive-technology pass has not been done (docs/accessibility/AT-PASS-PROTOCOL.md). |
| LG-07 | Human handoff and emergency or escalation route configured | tested | `app/src/lib/help-routes.test.ts` — wellbeing is directory-only and names 988; nobody is referred automatically<br>`app/src/lib/escalationadapter.test.ts` — the escalation payload and channel<br>`docs/CAMPUS-ESCALATION-POLICY.md` — escalation off by default | Routes exist in code; no tenant has configured its own emergency contacts. |
| LG-08 | Content owner, source freshness and review date assigned | tested | `app/src/lib/launch/content.test.ts` — each content kind has an owner, a review interval and an expiry<br>`supabase/integration-quality.check.sql` — an owner and a review cadence per connection | Per content kind and per connection, not per resource. |
| LG-09 | AI policy and provider settings approved, if AI is enabled | tested | `supabase/intelligence-policy.check.sql` — ai_policy per tenant: modes, providers, sources, retention<br>`app/src/lib/aikillswitch.test.ts` — the switch fails closed | The claude edge function does not yet enforce ai_policy; approval is a row, not a signed review. |
| LG-10 | Support runbook, incident process and escalation contacts tested | designed | `docs/RUNBOOKS.md` — the runbook library<br>`docs/CRISIS-RESPONSE-RUNBOOK.md` — P0 and P1 to professional Trust & Safety only | No drill has run and no contact is named. |
| LG-11 | Audit logging, export, deletion and revocation paths verified | tested | `supabase/deletion.check.sql` — account deletion<br>`app/src/lib/erasure.test.ts` — export and erasure held to one data map<br>`supabase/supportshares.check.sql` — every read logged; revocation stops reads | Verified in test, not exercised on a tenant; no legal-hold object. |
| LG-12 | Contract, DPA and security obligations mapped to implemented controls | designed | `docs/trust/DPA-CHECKLIST.md` — clauses mapped to what exists<br>`docs/trust/SOC2-READINESS.md` — controls scored | No contract is signed, so nothing is mapped to an obligation in force. |

The pilot-to-production state machine (`rollout.ts`, `tenant_rollout`) already
refuses a forward move without exit-gate evidence; these twelve are the module-
level gates that machine does not yet name.

## 5. Institutional governance

These modules need a governance structure before they need more features: a
Student Experience, Data and AI Governance Council with named authority and a
written charter.

| Area | Accountable owner | Required participants |
| --- | --- | --- |
| Transfer hub | Transfer or academic-success leader | Admissions and records, articulation, advising, financial aid, student affairs, registrar, student representatives |
| Career and workforce | Career-services leader | Experiential learning, academic affairs, employer relations, legal and privacy, accessibility, students and alumni |
| Basic needs | Basic-needs or student-affairs leader | Financial aid, housing, food resources, health and wellness, public-benefits partners, privacy, students |
| AI | CIO, provost delegate, or designated AI-governance executive | Faculty, IT and security, privacy and legal, accessibility, library, student affairs, students |
| Accessibility | Accessibility leader | Disability services, IT, instructional design, procurement, students with disabilities |
| Community safety | Student affairs or trust-and-safety owner | Campus safety, legal, Title IX or equivalent office, privacy, mental health and wellness, student leaders |

### Required controls

- Named business owner for every module and content type.
- Student advisory participation, including transfer, commuter, working, international, veteran, disabled and historically underserved students.
- Written purpose limitation for each data category.
- Data inventory, classification, retention, export, deletion and legal-hold rules.
- Role-based access and time-bound support access.
- Institution-specific content-ownership and freshness process.
- Source, scope and status labels in student-facing experiences.
- Accessibility acceptance criteria and release testing.
- AI-use inventory, provider and model approval, evaluation, monitoring, incident response and change-control process.
- Human escalation and “no wrong door” routing.
- Vendor and subprocessor due diligence and contract controls.
- Risk assessment before launching high-risk functions.
- Audit logs, periodic access review and evidence register.
- Appeal and correction route for harmful or incorrect outcomes.

### Decision-rights rule

- **Semester can:** Organize, explain, prepare, remind, route, surface sources, support reflection, and facilitate authorized workflows.
- **Institutional offices can:** Make official academic, financial, conduct, accommodation, admissions, credential and service-eligibility decisions.
- **Students can:** Control their private planning, preferences, shares, artifacts, profile visibility, and eligible data export and deletion choices.
- **AI can:** Assist within configured policy and clearly stated limitations.
- **AI cannot:** Make high-impact decisions, conceal uncertainty, or override human and institutional authority.

The benchmark outcome is a platform where staff receive just enough information
to provide help, students retain control over private exploration and optional
sharing, and Semester never mistakes a need for help as permission to monitor or
judge a student.
