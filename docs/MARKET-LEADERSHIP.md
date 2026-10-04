# Market leadership: what would make universities want Semester, held to the tree

<!-- Rendered from app/src/lib/ops/leadership.ts by leadership.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Three documents of 28 September 2026 say what would make Semester the
benchmark rather than another app: a memo of fourteen plays and a test to
apply before anything is built or marketed; the whole-platform business
model, with its promise that everything is *one* thing rather than a bundle;
and the faculty change-management playbook. This page is their structure,
with each item pointed at what the repository holds for it and a standing
read off the tree. **Nothing here says Semester is a whole platform.** The
memo’s own rule is not to say all-in-one without being precise, so the
thirteen *one X* promises are counted one by one, and the count is the finding.

| Supplied document | What it holds |
| --- | --- |
| [Anything else that should be added or improved to be the leader and benchmark in the market](expansion/Market-Leadership-and-the-Benchmark-Test.pdf) | The fourteen plays, the stakeholder table, the Academic Friction Index, No Wrong Door, the Campus AI Control Center, Knowledge Operations, the procurement room, portability, Trust Evidence, the Semester Standard, design partners, what not to do, the twelve-month plan and the benchmark test. |
| [What sets Semester apart is that it has everything: the whole business model and core principle](expansion/Whole-Platform-Business-Model.pdf) | The one-X promise, the connected graph and flywheel, the five layers, the shared services no module may re-create, the reusable workflows, the revenue lines, the business-model boundaries, the disruption table, the live-business standard and the enablement scopes. |
| [University edtech audit: the faculty change-management playbook](expansion/University-EdTech-Audit-IT-Compliance-and-Faculty-Playbook.pdf) | The six phases, the faculty segments, the policy families and what every policy carries, the moment-by-moment support table, the champion programme, the measures and the communications. |

Standings: **built** — Exists and an automated test exercises it; **partial** — Some of it exists in code; the gap says what does not; **not-built** — Nothing of it exists beyond a document; **held** — Conflicts with a decision already on main, which holds until the owner reopens it. Statuses were read at main commit 7476aca on 28 September 2026.

## The position

> Semester is the student-facing operating layer that makes a university’s existing systems understandable and usable — and adds a native learning, planning, support, community and career experience where the existing stack leaves gaps.

And the enduring benchmark the whole-platform model ends on:

- A student should not have to understand a university’s fragmented technology or organizational chart to make progress.
- A faculty member should not have to stitch together separate tools to teach, assess, grade and support students.
- An advisor or staff member should not have to reconstruct context from five systems.
- An institution should not have to choose between a unified student experience and privacy, accessibility, interoperability or governance.
- An IT team should not have to accept lock-in, shadow AI or unobservable data flows to improve the student experience.

## One X: the promise, item by item

The business model’s promise is thirteen *ones*. 4 built, 8 partial, 0 not-built, 1 held.

| ID | Item | Asks | Master rows (status) | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| **ONE-01** | One identity | A single account across the student’s own devices, the institution’s SSO and every module. | IAM-001 (tested), IAM-002 (tested), IAM-003 (building) | partial | [`supabase/identity-provisioning.check.sql`](../supabase/identity-provisioning.check.sql) — SAML membership bound to the account by the institution, not guessed<br>[`app/src/lib/cloud.ts`](../app/src/lib/cloud.ts) — one Supabase account behind every synced row | Institution SSO is tested against no real identity provider; the LTI arrival links to the same account, and MFA for privileged roles is designed only. |
| **ONE-02** | One student profile | One profile the student edits once and every module reads. | IAM-002 (tested), STU-011 (tested) | partial | [`app/src/lib/profile.ts`](../app/src/lib/profile.ts) — the profile record<br>[`app/src/lib/mecontrols.ts`](../app/src/lib/mecontrols.ts) — the one control surface under Me: what Semester knows, who sees it, how to change either | Career, athletics and community each hold profile fields of their own; the student edits them in three places. |
| **ONE-03** | One calendar | Every deadline, class, appointment and event on one calendar, from the syllabus, the school and the student. | STU-010 (tested), INT-011 (building) | built | [`app/src/screens/calendar-source.test.ts`](../app/src/screens/calendar-source.test.ts) — every source of a calendar entry named and labelled<br>[`app/src/lib/subscribe.ts`](../app/src/lib/subscribe.ts) — the outbound feed with its staleness rule | Club events and office hours reach the calendar only when the student adds them. |
| **ONE-04** | One action system | One ranked list of what to do next, with its reason, across every module. | STU-001 (tested), STU-002 (building) | partial | [`app/src/lib/actions.test.ts`](../app/src/lib/actions.test.ts) — rank(): the most important action, the next three, the rest, each with an explanation<br>[`app/src/components/TodayActionCenter.test.tsx`](../app/src/components/TodayActionCenter.test.tsx) — the Action Center on Today, behind its flag | The Action Center is behind a flag that is off in production; office actions, help requests and shares have lists of their own. |
| **ONE-05** | One search experience | One search over everything the student holds, ranked one way. | STU-009 (building) | partial | [`app/src/lib/find.ts`](../app/src/lib/find.ts) — one ranker over records, on the device (ADR 0006)<br>[`app/src/components/Command.tsx`](../app/src/components/Command.tsx) — the command palette | Campus places, people and the support directory are searched by their own screens. |
| **ONE-06** | One notification center | Every notice through one engine with an owner, a preference, a cap and a way out. | STU-001 (tested) | built | [`app/src/lib/notify.test.ts`](../app/src/lib/notify.test.ts) — tiers, the cap per tier and the “why” line on every reminder<br>[`app/src/donotbuild.test.ts`](../app/src/donotbuild.test.ts) — only three files may create a notification | Institutional notices arrive in the Notices hub, which is a channel rather than a notification; the cap does not count them. |
| **ONE-07** | One source-of-truth pattern | Every fact carries where it came from, how fresh it is, and what scope it is shared in. | TRUST-001 (tested), TRUST-002 (building), TRUST-003 (building), TRUST-004 (building) | partial | [`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts) — the five source labels; only a school system may say institution_verified<br>[`app/src/components/SourceBadge.test.tsx`](../app/src/components/SourceBadge.test.tsx) — the badge that shows a label<br>[`app/src/lib/integration/freshness.ts`](../app/src/lib/integration/freshness.ts) — freshness classes for synced records | Freshness and privacy scope are not on every surface a fact appears on; estimates are labelled in some places and not others. |
| **ONE-08** | One accessibility workspace | The student’s own accessibility settings, chosen once, following them to every device and module — never inferred. | A11Y-004 (tested), UX-002 (tested) | partial | [`app/src/lib/accessmode.ts`](../app/src/lib/accessmode.ts) — presets over the look keys and four modes, never switched on for somebody<br>[`app/src/components/AccessModes.tsx`](../app/src/components/AccessModes.tsx) — the one place to set them | Accommodations in the LMS are building (LMS-009) and do not read the workspace; generated content is not checked against it. |
| **ONE-09** | One data-agency center | One place to see what is held, who can see it, and to export, share, revoke or delete. | STU-011 (tested), UOS-007 (tested) | built | [`app/src/components/TrustCenter.test.tsx`](../app/src/components/TrustCenter.test.tsx) — active and past shares, revocation, export and deletion in one place<br>[`app/src/lib/privacy.test.ts`](../app/src/lib/privacy.test.ts) — the disclosure kept true to what syncs | One Sharing list across the three share tables is designed (D-037) and not built; a FERPA exception cannot be recorded. |
| **ONE-10** | One support-routing experience | Any question routes to the right official office with only what the student chose to send. | STU-012 (tested) | built | [`app/src/lib/help-routes.test.ts`](../app/src/lib/help-routes.test.ts) — nine needs, each to a destination; nothing sent until ticked; two destinations directory-only<br>[`app/src/lib/nowrongdoor.test.ts`](../app/src/lib/nowrongdoor.test.ts) — a sentence in the student’s own words is matched to a door, wellbeing first, and nothing typed is stored<br>[`app/src/components/GetHelp.test.tsx`](../app/src/components/GetHelp.test.tsx) — the preview before anything leaves | A referral has no status the student can track after it leaves; the basic-needs navigator routes and does not hand off. |
| **ONE-11** | One AI governance model | Every model call under one policy, one provider registry and one kill switch. | AI-001 (building), AI-006 (building), AI-012 (evidenced) | partial | [`app/src/lib/aikillswitch.test.ts`](../app/src/lib/aikillswitch.test.ts) — both runtimes read kill.ai_generation; an unreadable switch is thrown<br>[`app/src/lib/toolkit/policy.ts`](../app/src/lib/toolkit/policy.ts) — assignment over course over school over university<br>[`supabase/intelligence-policy.check.sql`](../supabase/intelligence-policy.check.sql) — a provider usable only once the institution approved it and a budget | The student’s own key on their own device is outside the switch by design; no evaluation set exists; the AI use policy a student reads is not started. |
| **ONE-12** | One integration gateway | Every institutional system through one gateway with one contract, one journal and one health view. | INT-001 (building), INT-014 (building) | partial | [`packages/institution/src/index.ts`](../packages/institution/src/index.ts) — the transport contract every adapter implements<br>[`app/server/institution/journal.ts`](../app/server/institution/journal.ts) — the two-phase journal: never twice, never on a timer<br>[`app/src/lib/integration/catalog.ts`](../app/src/lib/integration/catalog.ts) — the catalog of connectors | The adapter registry is deliberately empty; no connector has synced a real institution. |
| **ONE-13** | One Operations Console | One console for the company’s own operations: approvals, evidence, incidents, tenants. | IAM-010 (tested), IAM-011 (designed) | held | [`docs/DO-NOT-BUILD.md`](DO-NOT-BUILD.md) — rule 1: no new top-level navigation; the school-side tools live under university<br>[`docs/DECISION-LOG.md`](DECISION-LOG.md) — D-110: the console’s controls are data before the console; the console map stays missing until there is one | Its controls are written (ops/operations-console/); the console would live under an existing root, and none exists. |

### The crucial rule: shared services

> No module may create its own identity, permissions, notifications, audit log, source model, data-retention behaviour or visual system. It uses the shared platform services.

Seven services, and how each is held: **mechanical** when a test fails the
build, **review** when a person reads against a rule.

| Service | Held | By |
| --- | --- | --- |
| **Identity** | mechanical | [`supabase/rls-coverage.check.sql`](../supabase/rls-coverage.check.sql) — every table is under RLS keyed to auth.uid(); a module cannot invent a second identity |
| **Permissions** | mechanical | [`supabase/capabilities.check.sql`](../supabase/capabilities.check.sql) — least privilege by capability, granted and audited in one place<br>[`app/src/lib/rolelaunch.test.ts`](../app/src/lib/rolelaunch.test.ts) — no internal role holds a student-record capability |
| **Notifications** | mechanical | [`app/src/donotbuild.test.ts`](../app/src/donotbuild.test.ts) — rule 4: only lib/notify.ts, Ringing.tsx and the service worker may create a notification |
| **Audit log** | review | [`supabase/migrations/20260928320000_audit_correlation_and_outbox.sql`](../supabase/migrations/20260928320000_audit_correlation_and_outbox.sql) — one audit shape with a correlation id (ADR 0010); older modules keep their own audit tables |
| **Source model** | mechanical | [`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts) — five labels, and institution_verified only from a school system |
| **Data retention** | mechanical | [`app/src/lib/retention.test.ts`](../app/src/lib/retention.test.ts) — a new table with no retention answer fails the build |
| **Visual system** | mechanical | [`app/src/styles/rules.ts`](../app/src/styles/rules.ts) — the style audit: no custom button, card, modal or palette<br>[`app/src/lib/contrast.test.ts`](../app/src/lib/contrast.test.ts) — every ground walked for both faded rungs |

### The five layers

The model’s architecture, with the master-register domains each layer draws on.

| Layer | Holds | Master domains |
| --- | --- | --- |
| **Student experience** | Today, the plan, calendar and actions, courses, Study Studio, work completion, grades, portfolio, career, community, support, transfer, notices, search, Me. | STU (Student platform), UOS (Campus, career, and University OS modules), UX (UI and design system) |
| **Academic and learning** | Course workspaces, the source library, assignments, submission, assessment, rubrics, gradebook, feedback, accessible delivery, course AI policy, outcomes. | LMS (Native LMS), MIG (Migration) |
| **Institutional experience** | Service content operations, advisor and faculty tools, handoffs, transfer and career workflows, club operations, communications, policy publishing, AI policy configuration, freshness and ownership, aggregate friction. | UOS (Campus, career, and University OS modules), IMP (Implementation), SUP (Support) |
| **Trust and governance** | Identity and SSO, roles, consent, source/scope/status, retention and holds, AI policy and evaluations, accessibility evidence, audit and incidents, integration health, contracts and commitments. | IAM (Identity, tenant, and authorization), TRUST (Data trust), SEC (Security, privacy, and procurement), LEG (Legal), A11Y (Accessibility), AI (AI and intelligence) |
| **Platform and operations** | Tenants, entitlements, billing, implementation, the integration gateway, flags, monitoring, support, incident and status operations, the evidence register, the customer trust view, analytics. | PRG (Program and foundations), INT (Interoperability and integrations), SRE (Reliability), COM (Commercial operations) |

### The disruption, row by row

The reality the model says universities live in, the standard Semester sets
against it, and the lowest master row behind the standard.

| Current university reality | Semester standard | Master rows (status) | Lowest |
| --- | --- | --- | --- |
| Separate portals for every office | One student-facing action layer | STU-001 (tested), STU-002 (building) | building |
| LMS separated from planning and support | Coursework, planning, feedback and help connected | LMS-002 (tested), STU-010 (tested), STU-012 (tested) | tested |
| The student must know which office owns a problem | No Wrong Door support routing | STU-012 (tested) | tested |
| Course content is a file repository | A source-aware, accessible learning workspace | LMS-003 (building), AI-004 (building), AI-005 (building) | building |
| AI is inconsistent and ungoverned | Course- and institution-controlled AI with visible limits | AI-006 (building), AI-008 (building), AI-012 (evidenced) | building |
| Grades appear without explanatory context | Rubric-linked, source-aware, reviewable feedback and grade history | LMS-006 (designed), LMS-013 (building), LMS-014 (building) | designed |
| Clubs and events are separate from student goals | Participation becomes optional evidence and opportunity discovery | UOS-003 (building), UOS-004 (building) | building |
| Career systems ignore academic projects | A student-controlled skills and evidence graph | UOS-004 (building), UOS-007 (tested) | building |
| Accessibility is retrofitted | Accessibility preferences and alternatives are native | A11Y-004 (tested), A11Y-005 (tested), A11Y-006 (designed) | designed |
| IT receives one-off integration requests | One standards-first integration gateway | INT-001 (building), INT-002 (tested), INT-009 (building) | building |
| Privacy and security are procurement blockers | Trust and governance are platform features | SEC-013 (building), COM-003 (building), PRG-002 (tested) | building |
| Student data is scattered and opaque | Data agency, consent, sharing, export and audit controls | STU-011 (tested), UOS-007 (tested), TRUST-003 (building) | building |
| Institutions are locked into disconnected vendors | Modular adoption, documented export and interoperable standards | LEG-004 (building), INT-006 (not-started), INT-007 (designed) | not-started |

## The fourteen plays

4 built, 9 partial, 1 not-built, 0 held. The seat is who would own the gap; 7 of 12 seats are held (`founder`, `product`, `engineering`, `privacy`, `accessibility`, `success`, `operations`), the rest vacant.

| ID | Item | Asks | Master rows (status) | Standing | Evidence | Gap | Seat |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **PL-01** | Make adoption radically easy: the Semester Launch System | Week 0 readiness, weeks 1–4 setup, weeks 5–8 pilot, weeks 9–12 scale decision, with eleven artifacts. | IMP-001 (building), SUP-003 (designed) | built | [`app/src/lib/launch/ninety-day.test.ts`](../app/src/lib/launch/ninety-day.test.ts) — three windows of thirty days, every item with an owner and evidence, none before its prerequisites<br>[`docs/operating-model/PILOT-TO-PRODUCTION.md`](operating-model/PILOT-TO-PRODUCTION.md) — the lifecycle from pilot to production, with the tenant_rollout states | The programme exists as items; no institution has run it. The Launch Center screen is building (IMP-001). | `success` |
| **PL-02** | Replace work, not just interfaces | A before/after workflow for each of eight stakeholders, showing time saved or friction removed for their own team. | PRG-002 (tested) | not-built | [`docs/ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md) — what each role can do today, by row, which is the material a before/after would be written from | No before/after workflow is written for any stakeholder. The role register says what exists; it does not say what it replaced. | `product` |
| **PL-03** | A measurable Academic Friction Index | Nine questions measured by institution and in aggregate, baseline to pilot to plan; friction of the system, never deficiency of the student. | UOS-008 (tested) | partial | [`app/src/lib/ops/firstyear.test.ts`](../app/src/lib/ops/firstyear.test.ts) — twenty-four measures, each with its source or the statement that none exists<br>[`app/src/lib/clarity.ts`](../app/src/lib/clarity.ts) — the one survey question: did this help you understand what to do next? | Seven of the nine questions have a measure; none has been read for an institution. See the table below. | `product` |
| **PL-04** | No Wrong Door as a real service layer | Eight student situations, each routed to the official owner with only safe clarifying questions, a handoff packet the student chooses to share, a tracked referral status, and escalation. | STU-012 (tested) | built | [`app/src/lib/nowrongdoor.test.ts`](../app/src/lib/nowrongdoor.test.ts) — describe the problem in your own words and be sent to the right door; crisis wording routes to counseling first; NEVER is printed with every door<br>[`app/src/lib/help-routes.ts`](../app/src/lib/help-routes.ts) — nine needs to a destination each; nothing sent until ticked; NEVER_SENT lists what never goes<br>[`app/src/lib/basicneeds.ts`](../app/src/lib/basicneeds.ts) — seventeen categories read against the support directory | Five of eight situations reach a door by the router’s own match, read by the test; none has a tracked referral status after it leaves. See the table below. | `success` |
| **PL-05** | Accessibility as a product advantage | A personal accessibility workspace, accessible creation and source cards, keyboard-first flows, screen-reader gates, accessible math and tables, plain-language and focus modes, issue reporting, a public changelog. | A11Y-001 (tested), A11Y-004 (tested), A11Y-006 (designed), A11Y-007 (designed) | partial | [`app/src/lib/accessmode.ts`](../app/src/lib/accessmode.ts) — the workspace: presets and four modes, never inferred<br>[`app/src/a11y/axe.test.tsx`](../app/src/a11y/axe.test.tsx) — axe-core over the rendered app<br>[`docs/WCAG-UI-AUDIT-SCORECARD.md`](WCAG-UI-AUDIT-SCORECARD.md) — every component scored, every score citing its test | No manual assistive-technology pass, no ACR, no public issue route, no changelog; generated content is unchecked (GA-01 to GA-03). | `accessibility` |
| **PL-06** | The safest campus AI platform: a Campus AI Control Center | Approved providers, tenant and course policy, classification rules, authorized sources, a model inventory, evaluations, incidents, cost controls, feedback, kill switches, student-facing transparency. | AI-001 (building), AI-002 (building), AI-006 (building), AI-011 (building), AI-012 (evidenced), AI-013 (building) | partial | [`supabase/intelligence-policy.check.sql`](../supabase/intelligence-policy.check.sql) — providers, budgets and approved sources per institution<br>[`app/src/lib/aikillswitch.test.ts`](../app/src/lib/aikillswitch.test.ts) — the kill switch every generator reads<br>[`app/src/components/institutional/ControlPlane.tsx`](../app/src/components/institutional/ControlPlane.tsx) — the institution’s control plane, preview-only | Each of the eleven items rests on a master row and none is above tested; evaluations, incidents and the student-facing AI policy are building or designed. See the table below. | `product` |
| **PL-07** | Own the source-freshness problem: Campus Knowledge Operations | Every published resource with owner, source, audience, review dates, expiry, accessibility and translation status, policy version, related workflow, search demand, broken links and reported issues; then the stale, the unanswered and the unmaintained surfaced. | TRUST-002 (building), UOS-001 (building) | partial | [`app/src/lib/source.ts`](../app/src/lib/source.ts) — the five source labels a resource carries<br>[`app/src/lib/integration/freshness.ts`](../app/src/lib/integration/freshness.ts) — freshness classes and their text<br>[`app/src/lib/official-notices.ts`](../app/src/lib/official-notices.ts) — what the school shared, as messages with freshness | Four of thirteen fields exist; none of the seven signals is surfaced. See the table below. | `data` |
| **PL-08** | Make procurement unusually easy: procurement in a day | Thirteen artifacts, accurate first, in one room. | COM-003 (building), SEC-013 (building) | partial | [`app/src/lib/trustroom.test.ts`](../app/src/lib/trustroom.test.ts) — the NDA room: named reviewer, expiring link, every read recorded<br>[`docs/trust/COMPLIANCE-CROSSWALK.md`](trust/COMPLIANCE-CROSSWALK.md) — the twenty artifacts a critical-tier vendor owes and what Semester could hand over today | Three artifacts exist, nine are drafts, eight do not exist; the crosswalk page counts them, and the critical tier (grade passback) adds an impact assessment, legal review and executive risk acceptance that nothing carries. A day is possible when the drafts are in force. | `trust` |
| **PL-09** | Promise portability and prove it | Student exports, customer exports in documented formats, QTI 3 export, LTI and OneRoster, documented APIs and webhooks, migration support, an offboarding plan, no export fee, no hidden dependency on proprietary AI memory. | LEG-004 (building), INT-007 (designed), INT-013 (building) | partial | [`app/src/lib/export.test.ts`](../app/src/lib/export.test.ts) — CSV, Markdown and ICS exports of everything the student holds<br>[`app/src/lib/workspace-backup.test.ts`](../app/src/lib/workspace-backup.test.ts) — a whole workspace backed up and restored | Eight of ten promises have a file behind them; QTI export and the customer export have none, and the offboarding plan is written, not built. See the table below. | `engineering` |
| **PL-10** | A Trust Evidence product | A live, safe customer view: enabled modules, integration health, the data map, AI policy, accessibility status, audit and export activity, support and SLA status, maintenance, release impact, known limitations, contract alignment. | SEC-013 (building), INT-014 (building), COM-003 (building) | built | [`app/src/lib/trustdashboard.test.ts`](../app/src/lib/trustdashboard.test.ts) — the twelve rows an institution sees, every one derived from what the app knows about itself; an absence said plainly; usage suppressed under n = 10<br>[`app/src/components/institutional/TrustDashboard.tsx`](../app/src/components/institutional/TrustDashboard.tsx) — the view, under the institution’s control plane<br>[`app/src/lib/ops/commitments.ts`](../app/src/lib/ops/commitments.ts) — the customer commitment register | The data exists for ten of eleven panels and the dashboard renders them; audit and export activity has no row, and no institution is connected for it to show. See the table below. | `trust` |
| **PL-11** | The Semester Standard | A public, measurable benchmark of ten lines, with an annual scorecard that discloses shortcomings. | PRG-002 (tested), TRUST-001 (tested) | built | [`app/src/lib/standard.test.ts`](../app/src/lib/standard.test.ts) — the eleven public commitments of /semester-standard/, each with what holds it and the gap disclosed on the page<br>[`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) — every public claim carries a register word and is refused above its rows | Ten of ten lines are carried by a commitment of the public standard, read by the test; no annual scorecard has been published. See the table below. | `founder` |
| **PL-12** | A research and practitioner organization | Eight public assets that help universities before they buy: an annual friction index, an AI policy canvas, an accessible assessment toolkit, playbooks and a maturity model. | — | partial | [`app/src/site/render.tsx`](../app/src/site/render.tsx) — /research/ (the Friction Index with its method set before its data, the design-partner council) and /resources/ai-governance-canvas/<br>[`docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md`](operating-model/RESEARCH-AND-SERVICE-DESIGN.md) — the research practice, as a process nobody yet runs | Two of the eight assets have a public page: a method and a canvas, no data and no partners. The proof policy forbids a number without a measurement behind it. | `founder` |
| **PL-13** | A design-partner network | Nine kinds of institution recruited deliberately, with structured influence: a paid or discounted pilot, baseline and success measures, named sponsors, co-design, accessibility and security review, quarterly evidence review, a case study only with approval. | SUP-003 (designed), COM-002 (building) | partial | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — pilot readiness, the buying committee, the decision log, and the verdict<br>[`app/src/lib/beta.ts`](../app/src/lib/beta.ts) — the private beta: invitations each accepted by the person | No design partner exists and no institution has been recruited; the site is forbidden from saying otherwise (D-110). See the table below. | `founder` |
| **PL-14** | Win through implementation, not just sales | Twelve implementation elements from an executive alignment workshop to an annual maturity assessment, built into the commercial model. | IMP-001 (building), SUP-003 (designed), COM-002 (building) | partial | [`docs/operating-model/CHANGE-MANAGEMENT.md`](operating-model/CHANGE-MANAGEMENT.md) — the change path, the stakeholder map, the adoption tools and the readiness score with its pilot threshold<br>[`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — training, communications, hypercare and the ninety-day review as items with owners | Nine of twelve elements are written; none is priced in the deal desk, and no institution has been through any. | `success` |

### Replace work, not just interfaces (PL-02)

What each stakeholder should stop doing. No before/after workflow is written yet;
this is the table the workflows would be written against.

| Stakeholder | What Semester should eliminate |
| --- | --- |
| **Students** | Searching across portals, unclear next steps, missed deadlines, inaccessible materials, uncertainty about where to get help. |
| **Faculty** | Repeated “where do I find this?” questions, manual course setup, unclear AI-policy communication, disconnected feedback workflows. |
| **Advisors** | Reconstructing student context across systems, repetitive meeting preparation, unclear referrals. |
| **Student affairs** | Stale club and service directories, manual officer transitions, scattered event and referral workflows. |
| **IT** | One-off integrations, ungoverned AI tools, unmanaged data exports, unclear vendor controls. |
| **Accessibility teams** | Late-stage remediation, inaccessible student workflows, nonstandard content authoring. |
| **Security and privacy teams** | Opaque data use, uncontrolled staff access, unexplained AI providers, impossible audit requests. |
| **Executives** | A fragmented student experience, unprovable value, costly duplicate tools, low adoption. |

### The Academic Friction Index (PL-03)

> Measure the system’s friction, not the student’s deficiency. No secret student-risk score, ever.

Nine questions, 7 with a first-year measure behind them. None has been read for an institution.

| Question | First-year measure | Note |
| --- | --- | --- |
| Can students find an official answer? | `trust-comprehension` | Whether the student could say where each fact came from is the usability study’s question; the source label is the mechanism. |
| Can they identify the next action? | `path-clarity` | The one survey question under the Action Center: did this help you understand what to do next? |
| Can they complete a core workflow without support? | `meaningful-actions` | Actions completed, not screens opened; the golden path is the workflow. |
| Can they distinguish official information from estimates? | `trust-comprehension` | The same usability study, asked of an estimate and of a verified fact. |
| Can they use the workflow with keyboard, screen reader, zoom and mobile? | `a11y-task-success` | Success at a workflow with assistive technology; no reading has been taken. |
| Can they recover from a mistake? | **none** | Undo, restore and TypeToConfirm exist (DO-NOT-BUILD rule 11); nothing measures a recovery. |
| Can they find the right human office? | **none** | Help routes to nine needs; whether the student reached a person is not recorded. |
| Can staff maintain accurate, accessible information? | `integration-freshness` | Freshness of synced records is measured for connectors; staff-maintained pages have no measure. |
| Can the institution see its own friction? | `implementation-time` | Time to implement is the only institutional friction figure defined. |

### No Wrong Door (PL-04)

Eight things a student says, 5 of which reach a help route today.

| The student says | Help-route need | Where it goes |
| --- | --- | --- |
| “I cannot register.” | `registration` | Registration Center and the registrar route |
| “I need help paying for school.” | `money` | Financial aid, directory-only: nothing is sent |
| “I am overwhelmed by this class.” | `wellbeing` | Counseling first — “overwhelmed” is matched before the class is; the router says why |
| “I need a study room.” | **none** | Rooms and spaces on the campus screens; not a help route |
| “I need help with housing.” | **none** | The housing screen; not a help route |
| “I want an internship.” | `career` | Career services |
| “I am transferring.” | `registration` | The registrar’s door; the transfer hub is designed and not built |
| “I do not know who to ask.” | **none** | No match: every door is listed rather than one guessed |

And the seven things Semester does with it, 6 of them held by a file:

| Behaviour | Held by | Note |
| --- | --- | --- |
| Asks only safe clarifying questions | [`app/src/lib/nowrongdoor.ts`](../app/src/lib/nowrongdoor.ts) | It never decides, and NEVER is printed with every door; NEVER_SENT lists what never leaves. |
| Identifies the official or appropriate owner | [`app/src/lib/nowrongdoor.ts`](../app/src/lib/nowrongdoor.ts) | A sentence is matched to one of nine doors, wellbeing first; two are directory-only. |
| Shows source-labelled next actions | [`app/src/lib/source.ts`](../app/src/lib/source.ts) | The labels exist; a help route’s answer is not yet labelled. |
| Prepares a concise handoff packet | [`app/src/lib/nowrongdoor.ts`](../app/src/lib/nowrongdoor.ts) | summary(): built from the sentence alone, nothing the app added about the student; preview() shows every line before it is sent. |
| Lets the student choose whether to share | [`app/src/components/GetHelp.tsx`](../app/src/components/GetHelp.tsx) | Nothing leaves until ticked and confirmed. |
| Tracks only operational referral status | **nothing** | Only the registration handoff has one (`app/src/lib/handoff-status.ts`), as the student’s own report on their device. A help request keeps its own statuses; aid and accessibility are directory-only and have none. The office’s reply is not read back. |
| Provides recovery and escalation | [`docs/CAMPUS-ESCALATION-POLICY.md`](CAMPUS-ESCALATION-POLICY.md) | The escalation policy is written; no screen offers it. |

### The Launch System (PL-01)

The memo’s four windows, each held to the ninety-day programme’s tasks ([`docs/90-DAY-LAUNCH-PROGRAM.md`](90-DAY-LAUNCH-PROGRAM.md)).

| Window | Asks | Ninety-day tasks |
| --- | --- | --- |
| **Week 0** | Readiness assessment, stakeholders, data map, security and accessibility review, baseline friction measurement, success criteria. | `icp-cohort`, `data-inventory`, `launch-metrics`, `a11y-core` |
| **Weeks 1–4** | SSO, branding, core content, support routes, limited integrations, staff training, student communications, pilot setup. | `tenant-flags`, `identity`, `content-loaded`, `training`, `comms` |
| **Weeks 5–8** | Pilot with a cohort, feedback, accessibility testing, integration reconciliation, remediation, adoption measurement. | `launch-cohort`, `hypercare`, `track`, `fix-friction` |
| **Weeks 9–12** | Scale decision, implementation plan, department rollout, change management, executive value review, renewal and expansion plan. | `midpoint-report`, `annual-proposal`, `quotes` |

Eleven deliverables, 9 with a file:

| Deliverable | Where |
| --- | --- |
| Implementation workbook | [`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md`](market-readiness/IMPLEMENTATION_PLAYBOOK.md) |
| Named customer-success owner | **nothing** |
| Integration capability map | [`app/src/lib/integration/catalog.ts`](../app/src/lib/integration/catalog.ts) |
| Data-flow diagram | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) |
| Accessibility acceptance record | **nothing** |
| AI policy configuration | [`docs/market-readiness/AI_GOVERNANCE.md`](market-readiness/AI_GOVERNANCE.md) |
| Campus communications kit | [`docs/launch/ANNOUNCEMENT-TEMPLATES.md`](launch/ANNOUNCEMENT-TEMPLATES.md) |
| Faculty and advisor quick-start guides | [`docs/launch/FIRST-DAY-CHECKLISTS.md`](launch/FIRST-DAY-CHECKLISTS.md) |
| Student onboarding sequence | [`docs/launch/STUDENT-QUICK-START.md`](launch/STUDENT-QUICK-START.md) |
| Support escalation directory | [`docs/CAMPUS-ESCALATION-POLICY.md`](CAMPUS-ESCALATION-POLICY.md) |
| Pilot outcome scorecard | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) |

### The Campus AI Control Center (PL-06)

| Item | Master rows (status) | Lowest |
| --- | --- | --- |
| Approved models and providers | AI-002 (building) | building |
| Tenant and course policy controls | AI-006 (building) | building |
| Prompt and data classification rules | AI-007 (building), AI-010 (tested) | building |
| Authorized source libraries | AI-004 (building) | building |
| Model and version inventory | AI-002 (building) | building |
| Evaluations and red-team evidence | AI-011 (building) | building |
| Safety incidents | AI-014 (building) | building |
| Usage and cost controls | AI-003 (building) | building |
| User feedback | AI-013 (building) | building |
| Feature rollout and kill switches | AI-012 (evidenced), PRG-007 (tested) | tested |
| Student-facing AI transparency | AI-008 (building), AI-013 (building) | building |

### Knowledge Operations (PL-07)

Thirteen fields every published resource would carry, 4 carried by something today; and seven signals to surface, none surfaced.

| Field | Carried by |
| --- | --- |
| Owner | **nothing** |
| Source | source_label on every expansion table (lib/source.ts) |
| Audience | **nothing** |
| Last reviewed date | verified_at on an EvidenceReference (intelligence/contracts.ts) |
| Next review date | **nothing** |
| Expiry | expires_at on shares and grants; not on a resource |
| Accessibility status | **nothing** |
| Translation status | **nothing** |
| Policy version | policy_version on consent_record and ai_policy |
| Related workflow | **nothing** |
| Search demand | **nothing** |
| Broken-link status | **nothing** |
| Student-reported issues | **nothing** |

- Information at risk of becoming stale — not surfaced
- High-search, no-answer questions — not surfaced
- Frequently failed handoffs — not surfaced
- Broken official links — not surfaced
- Content missing accessible formats — not surfaced
- Services with long response times — not surfaced
- Pages nobody maintains — not surfaced

### Portability (PL-09)

Ten promises, 8 with a file behind them.

| Promise | Held by | Note |
| --- | --- | --- |
| Student-controlled eligible exports | [`app/src/lib/export.ts`](../app/src/lib/export.ts) | CSV, Markdown and ICS, plus the whole-workspace backup. |
| Customer data export in documented formats | **nothing** | No institutional export; the student’s is the only one. |
| QTI 3 assessment export | **nothing** | Designed (INT-007). |
| LTI and OneRoster standards support | [`app/src/lib/ltikey.test.ts`](../app/src/lib/ltikey.test.ts) | LTI 1.3 launch, deep linking and grade services; OneRoster not started (INT-006). |
| Documented APIs and webhooks | [`app/src/lib/interop.ts`](../app/src/lib/interop.ts) | Scopes and the standards register; the public integration registry prints each row’s claim word; webhooks building (INT-013). |
| Integration data maps | [`docs/INTEGRATION-DATA-PIPELINE-AUDIT.md`](INTEGRATION-DATA-PIPELINE-AUDIT.md) | Per connector, as an audit rather than a customer map. |
| Migration support | [`docs/DATA-MIGRATION-PLAN.md`](DATA-MIGRATION-PLAN.md) | Designed (MIG-001 to MIG-006). |
| An offboarding plan | [`docs/DATA-PORTABILITY-AND-OFFBOARDING.md`](DATA-PORTABILITY-AND-OFFBOARDING.md) | Written; the institutional path is not built (FERPA-7). |
| No punitive export fee | [`docs/DECISION-LOG.md`](DECISION-LOG.md) | D-009: export, deletion and saved plans are never paywalled. |
| No hidden dependency on proprietary AI memory | [`app/src/lib/aihandoff.ts`](../app/src/lib/aihandoff.ts) | Nothing is read back from an outside AI service; the assistant’s history is the student’s to delete. |

### Trust Evidence (PL-10)

Eleven panels of a customer view; the data exists for 10, and the trust dashboard renders it under the institution’s control plane; no institution is connected for it to show.

| Panel | Data today |
| --- | --- |
| Enabled modules and entitlements | [`app/src/lib/trustdashboard.ts`](../app/src/lib/trustdashboard.ts) |
| Integration health and freshness | [`app/src/lib/trustdashboard.ts`](../app/src/lib/trustdashboard.ts) |
| Current data-map configuration | [`app/src/lib/trustdashboard.ts`](../app/src/lib/trustdashboard.ts) |
| AI policy configuration | [`app/src/lib/trustdashboard.ts`](../app/src/lib/trustdashboard.ts) |
| Accessibility status and remediation tracker | [`app/src/lib/trustdashboard.ts`](../app/src/lib/trustdashboard.ts) |
| Audit and export activity | **nothing** |
| Support and SLA status | [`app/src/lib/trustdashboard.ts`](../app/src/lib/trustdashboard.ts) |
| Planned maintenance | [`app/src/lib/trustdashboard.ts`](../app/src/lib/trustdashboard.ts) |
| Release-impact notices | [`app/src/lib/trustdashboard.ts`](../app/src/lib/trustdashboard.ts) |
| Known limitations | [`app/src/lib/trustdashboard.ts`](../app/src/lib/trustdashboard.ts) |
| Contract commitment alignment | [`app/src/lib/ops/commitments.ts`](../app/src/lib/ops/commitments.ts) |

### The Semester Standard (PL-11)

Ten lines, every one carried by a commitment of the public Semester Standard ([`app/src/lib/standard.ts`](../app/src/lib/standard.ts), printed at /semester-standard/), which is the authoritative version and discloses each gap on the page. An annual scorecard has not been published.

| Line | Public commitment | Held by | How |
| --- | --- | --- | --- |
| Every critical fact has a source. | `source` | [`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts) | Five labels; only a school system says institution_verified. |
| Every estimate has a limitation. | `estimate` | [`app/src/components/NotOfficial.tsx`](../app/src/components/NotOfficial.tsx) | The not-official notice; the public tools label their results estimated. |
| Every high-impact action is reviewable. | `audit` | [`app/server/institution/journal.ts`](../app/server/institution/journal.ts) | No consequential write without exact review and confirmation; never twice. |
| Every student can control eligible sharing. | `share` | [`app/src/components/TrustCenter.test.tsx`](../app/src/components/TrustCenter.test.tsx) | Shares listed, revocable, expiring. |
| Every critical flow is accessible. | `keyboard` | [`app/scripts/accessibility-smoke.mjs`](../app/scripts/accessibility-smoke.mjs) | The critical journeys in a real browser; no manual pass yet. |
| Every AI use has a policy and an explanation. | `ai-context` | [`app/src/lib/governance/ai-lifecycle.ts`](../app/src/lib/governance/ai-lifecycle.ts) | The quality line under every reply; the gates; the student-facing AI policy is not started. |
| Every integration shows data scope and health. | `integration-health` | [`app/src/lib/integration/catalog.ts`](../app/src/lib/integration/catalog.ts) | Scope per connector; health is building (INT-014). |
| Every customer can export and offboard. | `export` | **nothing** | The student can; the customer path is written, not built. |
| Every public claim has evidence. | `evidence` | [`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) | A claim above its rows fails the build. |
| Every incident has an accountable communication path. | `incident` | [`app/src/lib/governance/incident-comms.ts`](../app/src/lib/governance/incident-comms.ts) | A notice per audience with required sections; never exercised. |

### Research assets, design partners, implementation (PL-12 to PL-14)

The eight public assets, 3 with a public page or a document behind them:

| Asset | Where | Note |
| --- | --- | --- |
| Annual Academic Friction Index | [`app/src/site/render.tsx`](../app/src/site/render.tsx) | /research/: the method, set before its data; no reading has been taken. |
| Campus AI Policy Canvas | [`app/src/site/render.tsx`](../app/src/site/render.tsx) | /resources/ai-governance-canvas/: ten boxes an institution fills in before it turns on an assistant. |
| Accessible Assessment Toolkit | **nothing** | Nothing. |
| Transfer Student Navigation Playbook | **nothing** | The transfer hub is a design, not a public playbook. |
| Basic-Needs Navigator Blueprint | **nothing** | The navigator is a design, not a public blueprint. |
| Student Data Agency Toolkit | **nothing** | Nothing. |
| Interoperability Maturity Model | [`docs/INTEROPERABILITY-ROADMAP.md`](INTEROPERABILITY-ROADMAP.md) | The standards in order with their claim words; not a maturity model an institution scores itself on. |
| Semester Implementation Academy | **nothing** | Nothing. |

The nine kinds of design partner, none recruited: Community college; Regional public university; Private university; Large research institution; HBCU; Hispanic-serving institution; Online or hybrid institution; Disability-services leader; Transfer-intensive institution. The structured influence a partner gets, 8 of nine held by a file:

| Influence | Held by |
| --- | --- |
| A paid or discounted pilot | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) |
| A clear use case | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) |
| Baseline and success measures | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) |
| Named executive and operational sponsors | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) |
| Student, faculty and staff co-design sessions | **nothing** |
| Accessibility testing | [`docs/accessibility/AT-PASS-PROTOCOL.md`](accessibility/AT-PASS-PROTOCOL.md) |
| Security and privacy review | [`docs/SECURITY-ACCESSIBILITY-READINESS.md`](SECURITY-ACCESSIBILITY-READINESS.md) |
| Quarterly evidence review | [`docs/PROOF-CALENDAR.md`](PROOF-CALENDAR.md) |
| A published case study only with approval | [`app/src/lib/ops/claims.ts`](../app/src/lib/ops/claims.ts) |

The twelve implementation elements, 9 with a file:

| Element | Held by |
| --- | --- |
| Executive alignment workshop | **nothing** |
| Campus journey map | [`docs/operating-model/CHANGE-MANAGEMENT.md`](operating-model/CHANGE-MANAGEMENT.md) |
| Stakeholder and governance map | [`docs/operating-model/CHANGE-MANAGEMENT.md`](operating-model/CHANGE-MANAGEMENT.md) |
| Technical readiness review | [`app/src/lib/readiness.ts`](../app/src/lib/readiness.ts) |
| Data and integration plan | [`docs/market-readiness/INTEGRATION_READINESS.md`](market-readiness/INTEGRATION_READINESS.md) |
| Role-based training | [`docs/launch/FIRST-DAY-CHECKLISTS.md`](launch/FIRST-DAY-CHECKLISTS.md) |
| Faculty and student champion programme | **nothing** |
| Communications calendar | [`docs/launch/ANNOUNCEMENT-TEMPLATES.md`](launch/ANNOUNCEMENT-TEMPLATES.md) |
| Office hours | **nothing** |
| Launch support | [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) |
| Ninety-day adoption review | [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) |
| Annual maturity assessment | [`docs/operating-model/OPERATIONAL-MATURITY.md`](operating-model/OPERATIONAL-MATURITY.md) |

## The business model

Eleven revenue lines. **Proposed**: a line the deal desk could price, with no
price book yet. **Held**: a decision on main keeps it out for now.

| Revenue line | Buyer | What they buy | Why it compounds | Standing | Note |
| --- | --- | --- | --- | --- | --- |
| **Individual student plan** | Student | Personal Academic OS: planning, study, work completion, portfolio | Bottom-up adoption and product learning | held (D-009) | Plus is priced $7.99 a month or $59 a year (D-134) and its individual billing lifecycle was live-accepted on 2026-10-03 (docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md); checkout stays held by the governed acquisition control, and the price is not a public claim until approved. Export, deletion and saved plans are never paywalled. |
| **Department or programme plan** | Department, transfer center, advising, career office, student affairs | One module plus the governed student experience | Creates institutional champions | proposed | The deal desk’s department floor is a proposed default; no price book exists. |
| **Institution platform licence** | University | The connected student, learning, community, support and governance platform | Expands modules and embeds shared infrastructure | proposed | Campus and system floors proposed in the deal desk. |
| **Enterprise implementation** | IT, academic affairs, student success | SSO, integrations, migration, configuration, training, launch support | Reduces risk and speeds adoption | proposed | An implementation fee floor is proposed; waivable only as capped pilot credit. |
| **Native learning and assessment** | Academic affairs, faculty, online learning | LMS, assessment, QTI, gradebook, feedback, accessible learning | Replaces fragmented academic tools | proposed | D-1067 reopens this direction. The native gradebook is built; the complete LMS authoring and assessment surface and any institutional cutover remain incomplete. |
| **AI governance and learning services** | CIO, provost, IT, teaching and learning center | The Campus AI Control Center, policy, approved sources, evaluations | Meets a major emerging institutional need | proposed | AI capacity and overage must be written into every order (deal desk). |
| **Community and student-life operations** | Student affairs, campus life | Clubs, events, mentorship, engagement, moderation | Extends daily student relevance | proposed | No unmoderated marketplace or public feed (boundary). |
| **Career and opportunity network** | Career services, experiential learning | Portfolio, skills evidence, alumni and employer workflows, opportunities | Connects academic work to workforce outcomes | proposed | Employers never receive student-level data (deal desk, marketplace rule). |
| **Premium support and success** | Institution | Dedicated support, training, implementation, advisory | Protects renewals and expands accounts | proposed | No 24/7 or emergency response is promised (SUP-002 designed). |
| **Approved payments and transactions** | Institution or authorized campus unit | Ticketing, dues, approved payments | Later-stage transactional revenue | held (D-009) | Campus payments, ticketing and dues stay out: no institutional or campus-transaction billing exists. Individual Plus billing is a separate line (D-134; accepted 2026-10-03). |
| **Approved employer and partner services** | Employers, partners, institutions | Verified events, office hours, opportunities — never student-data access | Expands the ecosystem without selling student data | proposed | Sponsorship is a separate opt-in that reads nothing about the student (DO-NOT-BUILD rule 10). |

### The lines not crossed

The model’s six business-model boundaries and the memo’s nine things not to do,
each held to a boundary of [`ops/strategic-boundaries/README.md`](../ops/strategic-boundaries/README.md), a rule of
[`docs/DO-NOT-BUILD.md`](DO-NOT-BUILD.md), or a decision — or marked *proposed*, which means
nothing forbids it today and the line is recorded so the rule is a decision
rather than a drift.

| Line | Held as | Note |
| --- | --- | --- |
| Do not sell student data. | boundary `data-sale` | Mechanical: no ad or tracking host in the source. |
| Do not sell access to hidden student behaviour. | boundary `surveillance` | No unapproved proctoring or surveillance. |
| Do not charge students for essential privacy, export, safety or support access. | [`docs/DECISION-LOG.md`](DECISION-LOG.md) | D-009: export, deletion and saved plans are never paywalled. |
| Do not let employers buy access to grades, accommodations, basic-needs activity, private AI conversations or undisclosed profiles. | boundary `data-sale` | The employer opt-in shares named artifacts only; the service register’s EMPLOYER_NEVER list says what never goes. |
| Do not use targeted advertising based on education records or sensitive data. | DO-NOT-BUILD rule 10 | No student data for advertising or sponsorship targeting. |
| Do not create pay-to-win club or opportunity placement. | *proposed* | Nothing sells placement today and nothing forbids it. Recorded so the rule is a decision, not a drift. |
| Do not build a giant feature list without shared foundations. | [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md) | The scope rule and its nine questions, asked in the pull-request template. |
| Do not claim to replace the SIS, registrar, financial aid or human support before authority and integrations warrant it. | boundary `sis-direct` | No direct SIS connection; the claims register refuses a word above its rows. |
| Do not market AI grading, retention prediction or student risk as automated decision products. | boundary `ai-decisions` | No official decision by AI; no behavioural risk scoring (its own boundary). |
| Do not collect sensitive data because it may become useful later. | boundary `surveillance` | Minimum necessary by construction: the app asks for what the current screen needs (DO-NOT-BUILD rule 5). |
| Do not use dark patterns, engagement addiction loops or behaviourally targeted ads. | DO-NOT-BUILD rule 4 | Every notification has an owner, a preference, a cap and a way out; the ethics of growth stance in the maturity register. |
| Do not make accessibility a premium module. | *proposed* | Nothing gates an accessibility setting behind a plan, and nothing forbids it. Proposed as a boundary. |
| Do not make integration or offboarding difficult to preserve revenue. | [`docs/DECISION-LOG.md`](DECISION-LOG.md) | D-009 for the student; the institutional offboarding path is written and not built, so the line is a promise not yet provable. |
| Do not overpromise 24/7 or emergency response. | [`app/src/site/pages.tsx`](../app/src/site/pages.tsx) | The contact page promises no response time; the crisis notice routes to people. |
| Do not build custom one-off features that compromise the shared platform. | boundary `forks` | No custom per-tenant forks; configuration tiers say what a tenant may change. |

## The twelve-month roadmap

| Quarter | Focus | Proof point | Master rows (status) | Lowest |
| --- | --- | --- | --- | --- |
| **Q1** | Core coherence: one identity, context, design system, source/scope/status, a shared audit model | Users experience a single platform rather than disconnected modules | IAM-002 (tested), UX-001 (tested), TRUST-001 (tested), SEC-006 (building) | building |
| **Q2** | Student value: Today, work completion, Study Studio, No Wrong Door support, transfer and basic-needs navigation | Students reach a meaningful outcome quickly and can find verified help | STU-001 (tested), STU-002 (building), STU-012 (tested), LMS-005 (building) | building |
| **Q3** | Institutional trust: AI Control Center, Knowledge Operations, procurement room, accessibility QA, integration health | Buyers can assess controls without months of document chasing | AI-001 (building), TRUST-002 (building), COM-003 (building), A11Y-007 (designed), INT-014 (building) | designed |
| **Q4** | Scale and category leadership: implementation academy, design partners, the Friction Index, portability and offboarding | Pilot evidence, a public methodology, references, a repeatable expansion model | IMP-001 (building), SUP-003 (designed), UOS-008 (tested), LEG-004 (building) | designed |

## The benchmark test

Before adding or marketing any feature, the memo asks nine questions, and
`benchmark()` passes only when every answer is yes. What this change built,
scored honestly — a *no* is a finding about the page, not a reason to drop it:

1. Does this make a student’s next right action clearer?
2. Does it reduce work for faculty, staff or IT, not merely move it?
3. Is the source, authority, scope and freshness visible?
4. Is it usable with keyboard, screen reader, zoom, mobile and low bandwidth?
5. Can the user correct, undo, export, delete, revoke or get help?
6. Is there a named institutional owner and a human escalation path?
7. Can it integrate through standards and be offboarded without lock-in?
8. Can we measure the real outcome without surveilling students?
9. Can we prove every public claim?

| Built here | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Passes | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The compliance crosswalk (docs/trust/COMPLIANCE-CROSSWALK.md) | no | yes | yes | yes | no | yes | yes | yes | yes | no | A reviewer’s page: it clarifies no student action and offers no undo; every score is a register row, every claim provable. |
| The evidence register (docs/trust/EVIDENCE-REGISTER.md) | no | yes | yes | yes | no | yes | yes | yes | yes | no | The same: reduces IT and security work, names owners and escalation, proves its claims; not a student surface. |
| This page | no | yes | yes | yes | no | yes | yes | yes | yes | no | Holds the memo to the tree; reduces nobody’s work but the next reader’s. |

## The live-business standard, and the scopes

A full launch is not “all features enabled”; it is every enabled module meeting thirteen requirements. 13 of thirteen have a place that would carry them.

| Requirement of every enabled module | Carried by |
| --- | --- |
| A clear customer and user outcome | [`app/src/lib/governance/charters.ts`](../app/src/lib/governance/charters.ts) |
| An accountable product owner | [`app/src/lib/governance/charters.ts`](../app/src/lib/governance/charters.ts) |
| A complete data and permission model | [`app/src/lib/governance/module-privacy.ts`](../app/src/lib/governance/module-privacy.ts) |
| Accessibility acceptance criteria | [`docs/WCAG-UI-AUDIT-SCORECARD.md`](WCAG-UI-AUDIT-SCORECARD.md) |
| Source, freshness and authority behaviour | [`app/src/lib/source.ts`](../app/src/lib/source.ts) |
| A support and escalation path | [`docs/CAMPUS-ESCALATION-POLICY.md`](CAMPUS-ESCALATION-POLICY.md) |
| Monitoring and an operational runbook | [`docs/RUNBOOKS.md`](RUNBOOKS.md) |
| Pricing and entitlement logic | [`app/src/lib/governance/deal-desk.ts`](../app/src/lib/governance/deal-desk.ts) |
| Export and offboarding behaviour | [`app/src/lib/export.ts`](../app/src/lib/export.ts) |
| A security, privacy and AI assessment | [`app/src/lib/governance/ai-lifecycle.ts`](../app/src/lib/governance/ai-lifecycle.ts) |
| Customer documentation | [`docs/launch/WHAT-IS-SEMESTER.md`](launch/WHAT-IS-SEMESTER.md) |
| An implementation playbook | [`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md`](market-readiness/IMPLEMENTATION_PLAYBOOK.md) |
| A measured adoption and value metric | [`app/src/lib/ops/firstyear.ts`](../app/src/lib/ops/firstyear.ts) |

Modules are enabled at nine scopes; 7 exist.

| Scope | Exists in | How |
| --- | --- | --- |
| **Institution** | [`app/src/lib/flags.ts`](../app/src/lib/flags.ts) | tenant_feature_policy per school |
| **Campus** | [`app/src/lib/governance/hierarchy.ts`](../app/src/lib/governance/hierarchy.ts) | A policy node at the campus level |
| **Department** | **nothing** | No department node; a school is the finest tenant unit |
| **Programme** | [`app/src/lib/governance/hierarchy.ts`](../app/src/lib/governance/hierarchy.ts) | A policy node at the programme level |
| **Cohort** | [`app/src/lib/beta.ts`](../app/src/lib/beta.ts) | The private beta’s invitation list is the only cohort mechanism |
| **Course** | [`app/src/lib/toolkit/policy.ts`](../app/src/lib/toolkit/policy.ts) | Course AI policy over school over university |
| **Role** | [`supabase/capabilities.check.sql`](../supabase/capabilities.check.sql) | Capabilities granted by role |
| **Term** | **nothing** | Nothing is enabled per term |
| **Individual user consent** | [`app/src/components/SupportAccess.tsx`](../app/src/components/SupportAccess.tsx) | Consented capability windows, per student |

Five reusable workflows every domain would use, 4 with a machine ([`docs/architecture/0009-workflow-state-machines.md`](architecture/0009-workflow-state-machines.md)):

| Workflow | Machine | Note |
| --- | --- | --- |
| Create → review → approve → publish → update → expire → archive | **nothing** | No publishing machine; Course Studio publishes without a review state. |
| Draft → submit → receive → review → decide → notify → appeal → close | [`packages/institution/src/workflow.ts`](../packages/institution/src/workflow.ts) | The submission and grade-passback machines (ADR 0009); no appeal state. |
| Connect → authorize → sync → reconcile → monitor → disconnect → export | [`app/server/institution/journal.ts`](../app/server/institution/journal.ts) | The two-phase action journal; reconcile and monitor are building (INT-014). |
| Share → scope → consent → access → revoke → retain/delete | [`app/src/lib/sharing.ts`](../app/src/lib/sharing.ts) | Every share ends within a term and is revocable; deletion does not yet consult a hold. |
| Report → triage → protect → investigate → decide → appeal → learn | [`app/src/lib/moderation.ts`](../app/src/lib/moderation.ts) | Reports and audited decisions; no appeal route (TS-1). |

## The faculty playbook

Faculty adoption is won through relevance, control, time savings and credible support. Six phases: 0 built, 3 partial, 3 not-built, 0 held. The segments to listen to first: early adopters, course coordinators, adjunct and part-time faculty, large-enrollment instructors, online and hybrid instructors, accessibility champions, skeptical faculty, teaching assistants, department chairs.

| ID | Item | Asks | Master rows (status) | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| **FP-1** | Listen and map | Segment faculty; map the LMS workflow, pain points, assessment and content-migration needs, AI-policy concerns, accessibility needs, support and high-stakes dates; run short compensated design sessions with seven questions. | LMS-016 (building) | not-built | [`docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md`](operating-model/RESEARCH-AND-SERVICE-DESIGN.md) — the research practice; no faculty session has been held | No faculty has been interviewed; main is written from the student’s side. |
| **FP-2** | Give faculty control | Six policy families a course sets without becoming an administrator; every policy with a plain-language student preview, version history, effective date, course override, institutional baseline, accessibility check and printable view. | AI-006 (building), LMS-002 (tested), LMS-006 (designed) | partial | [`app/src/lib/toolkit/policy.ts`](../app/src/lib/toolkit/policy.ts) — the course AI policy resolved assignment over course over school over university<br>[`app/src/components/CourseStudio.test.tsx`](../app/src/components/CourseStudio.test.tsx) — Course Studio: what an instructor sets up | Three of six families have a setting of some kind; see the table below. No policy carries a version history or a student preview. |
| **FP-3** | Pilot, do not impose | Three to eight representative courses; a limited scope; eight non-negotiable measures; never the highest-stakes grading first. | IMP-001 (building), SUP-003 (designed) | partial | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — pilot readiness and the verdict; a pilot without measures is refused | The pilot machinery is for an institution, not a course; no per-course pilot scope exists. |
| **FP-4** | Enable through the work | Role- and moment-specific help at seven moments from before term to end of term, instead of generic training. | SUP-001 (tested) | partial | [`app/src/lib/coursestudio.ts`](../app/src/lib/coursestudio.ts) — Course Studio: the before-term setup, the one moment with a tool<br>[`docs/launch/FIRST-DAY-CHECKLISTS.md`](launch/FIRST-DAY-CHECKLISTS.md) — a first-day checklist per role<br>[`docs/ONBOARDING-AND-CONTEXTUAL-HELP.md`](ONBOARDING-AND-CONTEXTUAL-HELP.md) — help where the work is, as a design | One moment of seven has material. See the table below. |
| **FP-5** | Build faculty champions | Department-nominated, recognised champions with early access, peer demonstrations, office hours and a clear boundary: they advise, they are not unpaid support. | SUP-003 (designed) | not-built | [`docs/operating-model/CHANGE-MANAGEMENT.md`](operating-model/CHANGE-MANAGEMENT.md) — the champion network as a process; AD-03 partial | No champion programme; the maturity register marks the network partial on the strength of the document alone. |
| **FP-6** | Measure and improve | Eleven faculty-value measures, from setup time per course to willingness to continue, instead of logins. | LMS-017 (building) | not-built | [`docs/FACULTY-ENABLEMENT.md`](FACULTY-ENABLEMENT.md) — faculty enablement, part 4 of the expansion command: nothing built | No faculty measure is defined in the first-year measures; course analytics is building for students only. |

### Give faculty control (FP-2)

Six policy families a course sets. 3 have a setting today. Every policy should carry: a plain-language student preview; a version history; an effective date; a course-level override; an institutional baseline; an accessibility check; an export or printable view. None carries a version history or a student preview.

| Family | Options | Setting today | Note |
| --- | --- | --- | --- |
| **Course AI policy** | Not allowed / limited / allowed with disclosure / instructor-defined | [`app/src/lib/toolkit/policy.ts`](../app/src/lib/toolkit/policy.ts) | banned, limited, allowed, unstated — read from the syllabus and overridable. |
| **Assessment policy** | Practice, graded, open book, timed, accommodation-aware, late work, attempts, release rules | [`app/src/lib/examattempt.ts`](../app/src/lib/examattempt.ts) | A practice paper kept, resumed and receipted; nothing graded, timed or accommodation-aware. |
| **Communication policy** | Announcement cadence, reminders, office-hours availability, notification preferences | **nothing** | The student sets reminder preferences; no course sets a cadence. |
| **Content policy** | Source ownership, visibility, copyright and access expiry, reuse and import permissions | **nothing** | Content rights are a maturity area (CR-01 to CR-11), mostly owed. |
| **Grading policy** | Rubrics, anonymous grading, TA role, moderation, release, appeal and regrade | **nothing** | Rubrics and the gradebook are designed; instructors see no individual student data by decision. |
| **Student-support policy** | Approved help routes and referral language | [`app/src/lib/help-routes.ts`](../app/src/lib/help-routes.ts) | The routes exist for the student; a course cannot approve or word them. |

### Enable through the work (FP-4)

| Moment | Faculty support | Material today |
| --- | --- | --- |
| **Before term** | Course migration clinic, syllabus review, AI-policy configuration, accessibility check | [`app/src/lib/coursestudio.ts`](../app/src/lib/coursestudio.ts) |
| **Week 1** | Student onboarding scripts, announcements, office hours, roster support | **nothing** |
| **Before the first assignment** | Rubric builder, submission preview, grading practice, TA calibration | **nothing** |
| **Before the first assessment** | Student-preview test, accommodation review, QTI and accessibility validation, contingency plan | **nothing** |
| **During grading** | Inline help, feedback templates, AI-assist disclosure, grade-release checklist | **nothing** |
| **Midterm** | Adoption review, student feedback, workload check, accessibility issue review | **nothing** |
| **End of term** | Grade export and reconciliation, archive, course reflection, next-term plan | **nothing** |

### Measure and improve (FP-6)

Measure faculty value, not logins: setup time per course; time spent locating or creating materials; assignment creation and grading time; feedback turnaround; repeated student questions; accessibility issues caught before release; student completion and error rate; support escalation volume; ai-policy clarity; faculty confidence; willingness to continue. None is defined among the first-year measures.

### What faculty are told

- Semester will not replace your academic judgment.
- AI will not assign final grades or make misconduct findings.
- You control course-specific AI and assessment policies within institutional rules.
- Students see clear source, policy and limitation labels.
- You will receive migration, accessibility, grading and support help.
- The pilot is designed to find what should change before broader rollout.

Each is a promise the claims register would have to carry before the site says it; none is on the site.

## Where the documents conflict with a decision on main

The decision holds until the owner reopens it (the decision log’s rule).

| The documents ask | Decision on main | Held as |
| --- | --- | --- |
| Payments and approved campus transactions as a module and a revenue line | D-009 kept billing out until a server-side environment and explicit approval; individual Plus billing has since been live-accepted (2026-10-03) with checkout held by the acquisition control, and campus payments and transactions remain out | Campus payments held; individual Plus billing accepted but its checkout held; the bill screen reads a statement |
| One Operations Console | DO-NOT-BUILD rule 1 and D-110: no new top-level navigation; the console’s controls are data before the console | ONE-13 held |
| An external immutable audit archive and a customer trust dashboard as a separate service | ADR 0003: no application server beyond the gateway; no second database | Trust Evidence panels named against the data that exists; no service |
| Five student destinations as the navigation | D-003: the five are the primary tab bar behind journeyNavigation; the shelves stay | ONE-04 and ONE-05 partial, not held |

This page names rows and never changes them; the registers that own the rows say what moves each.
