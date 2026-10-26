# Semester phased build plan: every role, screen and capability

**Generated 6 Oct 2026** from `ui_kits/semester-app/Shell.jsx`: 20 workspaces and 123 screens. Each screen is a working prototype at `ui_kits/semester-app/index.html#/<workspace>/<screen>`.

## One super OS, three layers
Semester brings all of a campus's education systems into one app, with one identity and one lifecycle record (prospect → applicant → student → alumni):
- **Student / Education OS:** the public site, applicant, student, family delegate and alumni workspaces.
- **Institution OS (faculty and staff):** faculty, TA, advisor, the institution console (OS overview, work queue, term planner, announcements, registrar, integrations), financial operations, support desk, admissions, Career Hub, campus services, insights and trust.
- **Business OS (campus finance and leadership):** institutional insights plus the campus business overview (`#/insights/business`): tuition, department budgets, classroom use, allocation scenarios. Aggregates only; Banner Finance is the ledger of record.
- **Semester company and partners:** company, operations, marketplace moderation and employers. This runs Semester itself, separate from any campus.

The workspace switcher in `ui_kits/semester-app` groups the workspaces this way. Institutional systems (SIS, LMS, campus card, housing) stay authoritative behind each connection: Semester centralizes the experience and the workflows, not the systems of record.

## Definition of done (every screen)
1. **Prototype:** the screen exists in the prototype. All of them do.
2. **Records:** its tables exist, with tenant-safe keys. Reference: `user/semester_campus_portals.sql` plus 014–017, and the live repo first.
3. **Reads:** RLS read policies are reviewed (014 pattern).
4. **Writes:** go through commands only (017 pattern): actor from the session, scope check, idempotency key, locks, audit plus outbox.
5. **States:** loading, empty, error, denied, stale-source, offline.
6. **Tests:** negative-access pgTAP, plus a behavioral test of the workflow.
7. **Release:** the gates in `handoff/assurance/04-*` are met with evidence.

**Status ladder** (`handoff/REPO-CROSSWALK.md`): specified → schema-present → code-present → connected → tested → deployed → operational. **Every screen starts at "specified".** Only repo evidence moves it up.

## Order and exit criteria
| Phase | Exit criteria (all evidenced) |
|---|---|
| 1 | Pilot cohort can sign in by SSO, see a sourced Today, registration readiness, assignments with submit and receipt, grades, and messages. No cross-student or cross-tenant reads (014 tests pass). |
| 2 | Faculty publish, grade with drafts that are approved before release, and sync grades over LTI (007–009, 012). Advisors see only advisees. Family sees only delegated items. |
| 3 | Each office handles its queue through commands (017 pattern). Domain authority is recorded (`domain_authority`). Housing and dining invariants are tested (017 tests). |
| 4 | Company billing reconciles (006 + webhook). Operations runbooks are drilled (`handoff/assurance/06–07`). The trust console audit and FERPA records work (011, 013, 016). |
| 5 | Employer postings are reviewed before students see them. Marketplace payments run on a decided provider and legal model. Alumni credentials are verifiable. |

## Phase 1: student core, plus public and applicant

### Public site (`#/public`): 8 screens
- Home (`home`)
- Pilot (`pilot`)
- Trust (`trust`)
- Sign up (`signup`)
- Solutions (`solutions`)
- Pricing (`pricing`)
- Resources (`resources`)
- Recover account (`recover`)

### Applicant / admitted (`#/applicant`): 2 screens
- Application (`application`)
- Getting to day one (`onboarding`)

### Student (`#/student`): 45 screens
- Today (`today`)
- Courses (`courses`)
- Assignments (`assignments`)
- Assignment Studio (`coursework`)
- Quiz 4 (live) (`quiz`)
- Feedback (`feedback`)
- Grades (`grades`)
- Registration (`registration`)
- Advising (`advising`)
- Messages (`messages`)
- Money (`account`)
- Study studio (`study`)
- Work on it (`toolkit`)
- Teach it back (`teach`)
- Briefing (`briefing`)
- Ask Semester (`ai`)
- Recommendation (`recommendation`)
- Action center (`actions`)
- Search (`search`)
- Launchpad (`launchpad`)
- Calendar (`calendar`)
- The degree (`degree`)
- Class search and cart (`register`)
- Tuition and aid (`bill`)
- Marketplace (`market`)
- Housing (`housing`)
- Housing application (`housingportal`)
- Meal plan (`dining`)
- Family sharing (`family`)
- Write (`write`)
- Solve (`solve`)
- Sources (`sources`)
- Classmates (`community`)
- Groupwork (`groupwork`)
- Maps (`maps`)
- Activities (`activities`)
- Get help (`help`)
- Back on track (`recovery`)
- Career (`career`)
- Me (`me`)
- Membership (`plan`)
- Privacy (`privacy`)
- Trust room (`trustroom`)
- What’s new (`changes`)
- Everything (`everything`)

## Phase 2: teaching and advising (faculty, TA, advisor, family)

### Faculty (`#/faculty`): 14 screens
- Teaching home (`home`)
- Course studio (`course`)
- Roster (`roster`)
- Grading (`grading`)
- Announcements (`announce`)
- Assignment builder (`builder`)
- Question bank (`bank`)
- Submission inbox (`inbox`)
- Grade a submission (`grade`)
- Gradebook (`gradebook`)
- Requests (`requests`)
- Grade sync (`gradesync`)
- Grade column (`lineitem`)
- Course copy (`coursecopy`)

### Advisor (`#/advisor`): 1 screens
- Caseload (`caseload`)

### Teaching assistant (`#/ta`): 1 screens
- My grading (`queue`)

### Family delegate (`#/family`): 1 screens
- Shared with me (`shared`)

## Phase 3: institution offices

### Institution (`#/institution`): 9 screens
- Office handoffs (`handoffs`)
- Registrar (`registrar`)
- Invitations (`people`)
- Integrations (`integrations`)
- Domain authority (`authority`)
- Entitlements (`entitlements`)
- Module activation (`activation`)
- Registration operations (`regops`)
- Admitted verification (`onbverify`)

### Financial operations (`#/finops`): 1 screens
- Accounts and aid (`queue`)

### Support desk (`#/support`): 1 screens
- Cases (`desk`)

### Admissions (`#/admissions`): 1 screens
- Applicants (`applicants`)

### Career Hub (`#/career`): 3 screens
- Postings (`postings`)
- Coaching (`coaching`)
- Outcomes (`outcomes`)

### Campus services (`#/campus`): 4 screens
- Service requests (`requests`)
- Housing capacity (`capacity`)
- Dining (`dining`)
- Wallet rules (`rules`)

### Institutional insights (`#/insights`): 1 screens
- Readiness (`readiness`)

## Phase 4: Semester company and platform operations, plus trust

### Trust console (`#/trust`): 3 screens
- Audit explorer (`audit`)
- Access matrix (`matrix`)
- Governance monitor (`monitor`)

### Company (`#/company`): 13 screens
- Company home (`home`)
- Pipeline (`pipeline`)
- Contracts (`contracts`)
- Support (`support`)
- Invoices (`billing`)
- Company OS (`os`)
- Customer account view (`account`)
- Quotes (`quotes`)
- Billing lifecycle (`lifecycle`)
- Ledger (`ledger`)
- Reconciliation (`recon`)
- Vendors (`vendors`)
- Customer agreements (`agreements`)

### Operations (`#/operations`): 12 screens
- Command center (`home`)
- Incidents (`incidents`)
- Releases (`releases`)
- Access (`access`)
- Privacy requests (`privacy`)
- Dead letters (`deadletters`)
- Architecture (`architecture`)
- LTI launch checks (`lti`)
- LTI sequence (`ltiseq`)
- LTI audit (`lticompliance`)
- Launch trace (`ltitrace`)
- JWT inspector (`jwt`)

## Phase 5: ecosystem (alumni, employer, marketplace)

### Marketplace moderation (`#/marketplace`): 1 screens
- Review queue (`queue`)

### Alumni (`#/alumni`): 1 screens
- Lifelong account (`home`)

### Employer (`#/employer`): 1 screens
- Opportunities (`roles`)

## Campus marketplace (added 6 Oct; phase 3 for staff review, phase 5 for partners)
**Screens:**
- `#/student/opportunities`: one search across jobs, internships, study abroad, clubs, events, services, peer help, and housing and deals. It has saved-search alerts and a verification badge on every listing (Vanderbilt-verified, partner-verified, student-posted, or an unreviewed external link), with scam warnings on external links.
- `#/student/abroad`: program comparison with estimated costs and a preliminary eligibility check (not a decision), plus an application checklist where offices own their own steps.
- `#/student/clubs`: follow or join; leader tools for officers, membership, events with RSVP, waitlist and QR check-in, budgets, and a handoff when officers change; aggregate engagement only.
- `#/career/review`: listing review through draft → submitted → approved, returned or rejected → published → paused, filled or expired → archived. It flags money requests off the platform and contract cheating.

**Spec:** `reference-slice/enterprise-v4/user/pdfs/Semester-Campus-Marketplace.*`.

**Schema:** `user/020_campus_marketplace_social.sql` (18 tables): organizations with verification, officers, memberships; listings with append-only versions, disclosures and risk flags; one application builder with blind review, rubrics and no decline without a reason; events, RSVPs and check-in; saved searches; a feed with a "why you see this" reason; messaging that needs an opt-in or an application; moderation reports. Also from the Campus Platform Blueprint and Blueprint Roadmap PDFs.

**Study-abroad states:** draft → submitted → eligibility review → nominated → provider application → accepted → committed (deposit) → pre-departure → abroad → returned.

**Rule:** community and social records are kept apart from education records. **Still to write:** commands in the 017 pattern, and their tests.

## Institution OS (added 6 Oct; phase 3)
- `#/institution/os`: health, participation, risk, service and campus pulse, with shortcuts into configuration.
- `#/institution/queue`: a team-scoped work queue for approvals, moderation, reviews and incidents.
- `#/institution/term`: term planner with the academic calendar (approve proposed dates) and the section lifecycle (draft → department submitted → registrar review → published to YES). Room and instructor conflicts block publishing, and edit rights are per field.

**Specs:** `user/pdfs/Semester-expanded-outline.*` and `user/pdfs/Administration-console-map.*`.

**Schema:** `user/021_academic_operations.sql`.
- **Calendar milestones:** published only once approved.
- **Rooms and bookings:** a GiST exclusion prevents double-booking a room.
- **Department scheduling windows.**
- **Section change requests:**
  - Departments submit only inside their window and for their own subjects; room changes are registrar-only.
  - Conflicts block publishing, and the requester can't approve their own change.
  - The registrar approval goes to YES through the outbox.
- **Commands:** `submit_section_change` and `approve_section_change`.
- **Approval chain:** department → chair → dean → registrar, with an Academic Affairs exception review for non-standard times, rooms or offerings.
- **Conflict engine** (`detect_schedule_conflicts`): instructor overlap, room overlap, room over capacity, non-standard meeting pattern.
- **Term lifecycle:** `set_term_stage`, with gate rules.
- **Section states (from your RBAC-matrix PDF):** draft → validation_pending → validation_failed or department_ready → chair_review → dean_review → registrar_review → room_coordination → academic_affairs_review (exceptions) → approved_for_publish → published → change_requested or locked, with denied and archived as end states.
- **Permission codes** (stage authority kept separate from data-edit authority, and view, edit, approve, export and override as separate rights): listed at the end of 021. Seed them through the role-grant workflow.
- **Schedule notifications (event-driven, from your second approval-matrix PDF):** every transition writes one outbox event in the same transaction. A notification worker then fans each event out to the right people:
  - **Submitted:** the chair.
  - **Chair approves:** the dean.
  - **Dean approves:** the registrar.
  - **Exception flagged:** Academic Affairs.
  - **Returned or denied:** the scheduler, with the reason.
  - **Published:** affected instructors, plus any enrolled students when times or rooms change.

  The worker deduplicates by event id, respects quiet hours, and never puts student data in email. Audit records stay append-only and separate from notification logs.

  **Schema:** `user/022_notifications.sql`. It has notification rules, per-person preferences (channels, quiet hours, daily limit), notifications (one per event per person) and deliveries (queued, deferred for quiet hours, sent, failed, or suppressed). Messages carry links only, never record content.
- **Machine definition:** `user/registrar-workflow.json`. It lists 21 transitions, each with its role, permission and guards, plus before and after hooks and webhook rules. The server engine reads it, and the database enforces the same transitions. Webhooks are signed, deduplicated by event id, never carry student data, and go to a dead-letter queue after 24 hours.
- **Tamper-evident ledger:** `user/023_workflow_ledger.sql`. A hash chain per tenant (sha256 of the previous hash plus the canonical row), appended in the same transaction as each transition. `verify_workflow_ledger()` reports the first break. Export the daily chain head to separate storage, so even a rewrite by a database administrator is detectable.
- **Endpoints and per-state permissions:** see `user/pdfs/Registrar-state-machine-RBAC.*`. The server routes should map one-to-one onto `submit_section_change`, `approve_section_change`, `set_term_stage` and `detect_schedule_conflicts`.

## Profiles, announcements and messaging (024)
- **Profiles:** per-field visibility, portfolio items (never grades), and expiring share links stored as a hash.
- **Announcements:** routed to audiences (all, role, cohort, program, section, housing, club, person), with receipts and acknowledgments. Urgent ones need a second approver.
- **Messaging:** read cursors, idempotent resends, and attachments served only after a clean scan. Realtime goes over an authenticated WebSocket, with the same membership check as the database; typing indicators are never stored.
- **Prototype:** `#/student/profile` and `#/student/messages`.

## Cross-cutting capabilities (built once, used everywhere)
- **Identity and access:** identity links; memberships; scoped roles; `authorize()` and purpose; delegation; consent; privileged access (011, 014, 017).
- **Audit and governance:** append-only audit, subject tokens, disclosure records, retention guard (013, 016).
- **Integrations:**
  - SIS: read and transaction, with reconciliation for unknown outcomes.
  - LTI 1.3: launch, Deep Linking and AGS (007–009, 012; `LTI-ADAPTERS.md`).
  - Stripe: personal plans (006).
- **AI gateway:** grounded in the course AI rule, with approval-bound execution (015), and a recommendation format that shows its working.
- **Notifications:** quiet hours, a daily nudge limit, and source labels on every item.
- **Security assurance:** `handoff/assurance/`. **No evidence, no release.**
