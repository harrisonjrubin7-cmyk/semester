# Enterprise reference v4: 71 tables, full RLS, 69 screens (uploaded 6 Oct 2026)

All files are kept verbatim. Nothing here has been executed; the package itself says the SQL was never run or parsed.

| File | What it is |
|---|---|
| `001_schema.sql` | 71 tables in `sx` (56), `sx_private` (12) and `sx_personal` (3) |
| `complete_enterprise_schema.sql` | The same, plus a composite FK so a grade must point to a submission from the same tenant, section and enrollment. **Use this one instead of 001**; the only difference is 3 added lines. |
| `002_access.sql` | RLS on all 71 tables. 58 have an authenticated SELECT policy; the rest are default-deny. All ordinary client writes are denied. |
| `003_permission_seed.sql` | Permission vocabulary only. No role assignments are seeded. |
| `enterprise_erd.mmd` | Mermaid ERD (key fields only; SQL is authoritative) |
| `table_inventory.csv` | Every table, its ownership model, read rule and write boundary |
| `complete_screen_inventory.csv`, `screen_workflow_matrix.csv` | 69 screens / 37 workflow rows: route, roles, read rule, command, records |
| `student_workspace_specs.pdf` | Per-screen behaviour, states and acceptance criteria for the student workspace |
| `billing_state_machines.pdf` | Subscription, invoice, payment and refund transitions and invariants |
| `reference_scope_and_runbook.pdf` | Install order, assumptions, limitations, acceptance tests |

## Added 6 Oct: backend, tests, membership
| File | What it is |
|---|---|
| `004_note_command.sql` | The one fully worked command: `sx_personal.create_note`. It handles idempotency receipts (same key with a different payload is a conflict), an advisory lock and input limits. Copy its pattern for every other command. |
| `rls_reference_tests.sql` | pgTAP fixtures and assertions. Disposable local database only: `supabase test db` or pg_prove. |
| `backend_routes.ts.txt` | Express + Zod routes mounted at `/api/v1`, using bearer auth and user-scoped clients, never service_role. Checkout, plan change, institution request and membership routes return **501** until `commerce_adapter.ts` is mounted (see "Payments and personal memberships"). |
| `proposed_membership_catalog.json` | **DRAFT, not approved, not live:** Free $0, Plus $8.99/mo or $69/yr, Pro $17.99/mo or $149/yr, Institution $18/student/yr with a $30,000 minimum |
| `backend_rls_membership_notes.pdf`, `frontend_component_specs.pdf` | Route assumptions; WorkspaceShell, FeatureGate, PlanComparison, CheckoutSummary, CheckoutPending, SubscriptionManager, UsageMeter, UpgradeDialog, BillingHistory, InstitutionActivationChecklist |

**Access rule:** `allow = authenticated && resource_authorized && (free_core || entitlement) && module_ready && quota_available`.
- A paid plan never grants grade, registrar, finance or operations authority.
- A paid plan is never required for enrolled coursework, published grades, required services or exporting your own records.
- Personal billing owner, sponsor and usage tables: added in `006_membership_completion.sql`.

**Prototype:**
- `#/public/pricing`: plans and the institution offer
- `#/student/plan`: plan cards with a monthly/yearly toggle, a server-priced checkout summary, a pending state, the subscription manager, personal and sponsored usage, and all six FeatureGate states
- `#/institution/activation`: the activation checklist

## Payments and personal memberships (6 Oct, continued)
Install order: `complete_enterprise_schema` → `002_access` → `003_permission_seed` → `004_note_command` → `membership_stripe_migration` → **`006_membership_completion`**.

| File | What it is |
|---|---|
| `membership_stripe_migration.sql` (yours) | Personal tier state, approved Stripe prices, durable webhook queue, institution sponsorship columns, `has_feature()` |
| `stripe_membership_webhook.ts.txt` (yours) | Raw-body signature-checked receiver plus a worker that re-reads the subscription and paid invoice before setting a tier |
| **`006_membership_completion.sql`** | Adds what yours doesn't model (details below) |
| **`commerce_adapter.ts.txt`** | The `Commerce` implementation `backend_routes.ts` expects. With it mounted, the four membership routes stop returning 501 (details below). |
| **`membership_tests.sql`** | 20 pgTAP checks (details below) |
| `all_table_rls_audit.sql`, `fixture_manifest_runner.psql` (yours) | All-table RLS audit and fixture runner |
| `per_screen_role_navigation.csv`, `admin_member_viewer_navigation.pdf` (yours) | Per-screen admin / member / viewer / anonymous gates |

**What `006_membership_completion.sql` adds:**
- **Who pays:** checkout sessions bound to the single approved price for each tier and cadence. A `stripe_prices` row now needs `approved_at` before it can be sold.
- **Scheduled changes:** downgrade, cadence change or cancel, effective on the paid-through date, and withdrawable.
- **Who sponsors:** person-to-person sponsorship, for example a parent paying for Plus. It needs the beneficiary's acceptance, and the sponsor sees status only.
  - `has_feature()` is redefined with that one extra branch.
- **What's used:** monthly allowances from three sources (personal tier, person sponsor, institution pool) and append-only usage events.
  - `record_usage` refuses if the cost wasn't shown first.
  - It charges the institution pool only for course work in a section the person is enrolled in.
  - It raises `QUOTA_EXHAUSTED` instead of borrowing from another source.
- **Also:** institution buyer requests, and `my_membership()` as the read model for GET /membership.

**What `commerce_adapter.ts.txt` does:**
- It runs every database call as the actor, so `auth.uid()` and the commands' checks apply.
- It creates and maps the Stripe customer on the server before checkout, and gives Stripe only the approved `price_id`.
- It uses idempotency keys from our own record ids.
- Background jobs:
  - mirror scheduled changes to Stripe subscription schedules
  - record `checkout.session.completed` and `checkout.session.expired`
  - bind sponsor subscriptions to their sponsorship row

**What `membership_tests.sql` checks:**
- private tables are unreadable by clients
- a draft price can't be bought
- replaying a request is safe, and the same key with a different payload conflicts
- checkout alone unlocks nothing
- an undisclosed cost or going over quota is refused
- usage events can't be edited
- a sponsorship needs acceptance
- service-only functions can't be called by clients

**Wire-up steps (all needed before real money):**
1. Add `checkout.session.completed` and `checkout.session.expired` to the receiver's supported set, and route them to `applyCheckoutEvent`.
2. In the worker, call `applySponsorSubscription` before the personal branch.
3. Schedule `mirrorScheduledChanges` every minute, and `sx_private.refresh_allowances(now())` daily.
4. Seed real Stripe price ids into `stripe_prices`, then set `approved_at` and `approved_by` only after pricing is approved. **The catalog is still DRAFT.**
5. Grant institution AI pools through the contract activation command, scope `course_work`, never through this code.

## LTI 1.3 and grade passback (6 Oct)
**`007_lti_ags.sql`** goes after 006.

**Tables:**
- registrations, with the JWKS URL as the only key source
- deployments, each mapped to an institution
- identities, linked only by SSO match, an admin or an invitation
- contexts and resource links, mapped to sections and assignments
- one-time launch transactions, consumed atomically by `consume_launch`
- AGS line items and score events, with one live event per student and line item
- deliveries and result snapshots

**Commands:**
- `enqueue_score`: call it inside the grade-publication transaction. It supersedes older unsent work.
- `grade_sync_status`: faculty read model for sections they teach.

**Delivery states:** queued → validating → delivering → delivered / retry_scheduled / outcome_unknown / action_required → reconciling → verified / conflict.
- "Delivered" isn't "verified".
- A conflict is never silently overwritten.
- The original event timestamp is kept across retries.
- Score comments are student-visible on Canvas.

**Launch rules:** a launch is rejected before any session is created unless all 13 checks pass. They're listed in the PDF and in the prototype at `#/operations/lti`.

**Adapters:** see `LTI-ADAPTERS.md`.

**Trace and copy:** `009_lti_trace_and_copy.sql` adds sanitized launch traces (8 stages, 8 reason codes, 30-day retention, admin-only viewer) and assignment templates vs course instances for copy rebinding.

**Hardening:** `008_lti_hardening.sql` adds environment-scoped registrations, granted scopes, Semester tool keys with overlapping rotation (`tool_jwks()`), a platform key cache, and line-item claim/bind with no duplicate columns. Prototype: `#/operations/lticompliance` (Canvas vs Blackboard audit) and `#/faculty/lineitem` (resolver).

**Prototype:** `#/operations/ltiseq` (step-by-step sequence), `#/operations/lti` (launch checker), `#/faculty/grade` (rubric grading → publish) and `#/faculty/gradesync` (per-student sync state and conflict resolution).

> **Superseded for campus portals:** your 129-table `user/semester_campus_portals.sql` is now the authoritative reference for admissions, registrar, housing, dining, campus payments, governance and LTI campus integration. 010, 011 and 013 below remain only for their command functions, ported to schema `semester`. See `user/README.md`.

## Campus portals (6 Oct)
`010_campus_portals.sql` goes after 009.

- **Who's in charge of each domain:** `sx.domain_authority` records, per institution and domain, the operating mode, the authoritative system and the business owner.
  - `native` requires an approval on record.
  - `require_mode()` gates commands by mode.
- **Admissions:** cycles, applications, and requirements with separate applicant and institution states.
  - Recommender links are stored as a hash only, and the applicant never sees the letter.
  - Reviews are private.
  - Released decisions can't be edited; a correction supersedes them.
  - Offers include deferral states.
- **Applicant → student:** `student_records` uses a stable correlation key, and `request_student_activation` is idempotent, finds an existing record first and writes to the outbox.
- **Registration:**
  - Requests and their items: add, drop, swap, waitlist, withdraw.
  - An `unknown` request blocks resubmission until it's reconciled.
  - Override requests.
- **Housing:**
  - A GiST exclusion prevents a bed being double-booked.
  - Applications carry approved features only, never reasons.
  - Contract signing is a handoff reference.
  - Work orders have respond-by times.
- **Dining:** wallet types with per-wallet rollover, expiry and refund rules, plus synced wallets and transactions.
- **RLS:** applicants and students read only their own rows. Staff tables without a policy are default-deny until reviewed policies are added.
- **Spec:** `../../PORTALS-SPEC.md`.

## FERPA access and ledgers (6 Oct)
`011_ferpa_access_and_ledgers.sql` goes after 010.

**Housing allocations:** one `housing_allocations` table holds holds, offers and assignments.
- A single GiST exclusion stops collisions per bed and per student; separate tables couldn't.
- It replaces 010's assignment-only constraint.

**Dining:**
- Published plan versions can't be changed.
- Swipe entitlements are periods with append-only entries.
- Money wallets (Meal Money, Commodore Cash) hold integer minor units in append-only entries.
- Corrections are reversals. An adjustment needs an approver who isn't the requester.

**Access decisions:** `sx_private.authorize()` is the one decision function. Access is allowed only when all of these hold:
- the person is signed in and a member of the tenant
- the purpose comes from a real workflow, not a typed reason
- the record classification is allowed for that purpose
- an export, if requested, has its own permission
- a typed relationship exists: course staff, advisor assignment, case assignment, or a time-limited privileged grant

It logs every evaluation to `authorization_decisions`.

**Supporting tables:** classifications (including `personal`, never exposed through licensing), purpose policies, delegations, FERPA consents (records, purpose and recipients; signed, dated and authenticated), privileged grants (four hours at most, not self-approved, emergency needs a legal basis), and `disclosure_records`.

**LTI boundary:** an LTI session is course-scoped only. It never grants housing, dining, admissions or registrar access.

**Deep Linking:** `012_deep_linking.sql` adds pending selections, confirmation on first launch, a 14-day abandon sweep, and no direct column creation while pending.

**Audit:** `013_audit_logging.sql` adds append-only student-record audit events, scoped subject tokens, an allow-listed metadata write path, and a link to disclosure records. `housing_dining_erd.mmd` is the 55-entity logical ERD.

**Prototype:** `#/trust/matrix` (now with housing/dining, registrar and admissions tabs) and `#/operations/jwt`, the role × record matrix and an 8-condition decision simulator.

## Precedence (for the coding agent)
1. **The live repo** (`harrisonjrubin7-cmyk/semester`) wins wherever it already has the table or screen. See `../../REPO-CROSSWALK.md`.
2. **v4 is the cleanest compact reference** for shape, ownership and RLS. Its key ideas:
   - personal records in `sx_personal` keyed by `owner_id`, with no invented tenant
   - private grants, tokens and outbox in `sx_private`, never exposed through the API
   - `section.read` does not give `roster.read`
   - every client write goes through a command
3. **`semester-platform/` (227 tables)** covers the domains v4 leaves out: student life, admissions, aid, cases, the company OS and AI governance.
4. Earlier reference slices (v1, v2, enterprise-v3) are superseded by v4.

**Don't run v4 alongside the repo or semester-platform.** It is a fresh-database reference. Map its rules onto the existing tables.

## Required commands v4 leaves unbuilt
The billing PDF's transitions are specifications; CHECK lists don't enforce them. Each command needs:
- expected state and version
- a row lock
- idempotency
- immutable evidence
- audit and outbox records

| Area | Commands |
|---|---|
| Subscriptions | start_trial, activate, convert_trial, expire_trial, mark_past_due, restore, suspend, schedule_cancel, cancel_effective, renew |
| Invoices | issue, apply_allocation, apply_credit, void (only if lawful and no incompatible allocations), write_off (never claims cash received) |
| Payments, refunds | record_intent, settle, allocate, request_refund, approve_refund (second approver), settle_refund |
| Documents | submit_for_review, approve, publish, request_signature, record_signature_evidence, place_hold |

**Invariant carried from the PDF:** never delete or hide education records because of a billing state. Suspension restricts entitlements, effective-dated, under contractual grace.

## Screen coverage: v4 inventory → prototype (`ui_kits/semester-app/index.html#/…`)
69 of 69 v4 screens now have a prototype reference (13 added in `Gaps.jsx`; the billing state machine is `#/company/lifecycle`).

| Workspace | Screen | v4 route | Prototype |
|---|---|---|---|
| Student | Today | `/app/student` | `#/student/today` |
| Student | Action center | `/app/actions` | `#/student/actions` |
| Student | Courses | `/app/courses` | `#/student/courses` |
| Student | Course home | `/app/courses/:sectionId` | `#/student/courses/<id>` |
| Student | Lesson | `/app/content/:id` | `#/student/study` |
| Student | Assignment | `/app/assignments/:id` | `#/student/assignments/<id>` |
| Student | Submission receipt | `/app/submissions/:id` | `#/student/assignments/<id> (receipt)` |
| Student | Grades | `/app/grades` | `#/student/grades` |
| Student | Planner | `/app/planner` | `#/student/ai (assistant: plan week)` |
| Student | Notes | `/app/notes` | `#/student/toolkit (Work for this → Note)` |
| Student | Advising | `/app/advising` | `#/student/advising` |
| Student | Services | `/app/services` | `#/student/housing`, `#/student/dining` |
| Student | Account | `/app/account` | `#/student/account` |
| Student | Privacy | `/app/settings/privacy` | `#/student/privacy` |
| Faculty | Home | `/app/faculty` | `#/faculty/home` |
| Faculty | Course studio | `/app/teaching/:id` | `#/faculty/course` |
| Faculty | Roster | `/app/teaching/:id/roster` | `#/faculty/roster` |
| Faculty | Assignments | `/app/teaching/:id/assignments` | `#/faculty/course` |
| Faculty | Review queue | `/app/teaching/:id/submissions` | `#/faculty/grading`, `#/ta/queue` |
| Faculty | Gradebook | `/app/teaching/:id/gradebook` | `#/faculty/grading` |
| Faculty | Announcements | `/app/teaching/:id/announcements` | `#/faculty/announce` |
| Institution | Directory | `/institution/people` | `#/institution/people` |
| Institution | Catalog | `/institution/catalog` | `#/institution/registrar` |
| Institution | Enrollment | `/institution/enrollment` | `#/institution/registrar` |
| Institution | Services | `/institution/services` | `#/support/desk` |
| Institution | Entitlements | `/institution/account` | `#/institution/entitlements` |
| Company | Sales | `/company/sales` | `#/company/pipeline` |
| Company | Documents | `/company/documents` | `#/company/contracts` |
| Company | Implementation | `/company/implementations` | `#/company/os` |
| Company | Support | `/company/support` | `#/company/support` |
| Company | Billing | `/company/billing` | `#/company/invoices` |
| Company | Ledger | `/company/ledger` | `#/company/ledger` |
| Company | People | `/company/people` | `#/company/os` |
| Company | Vendors | `/company/vendors` | `#/company/vendors` |
| Operations | Health | `/ops/services` | `#/operations/command` |
| Operations | Releases | `/ops/releases` | `#/operations/releases` |
| Operations | Architecture | `/ops/architecture` | `#/operations/architecture` |
| Public | Home | `/` | `#/public/home` |
| Public | Solutions | `/solutions` | `#/public/solutions` |
| Public | Pricing | `/pricing` | `#/public/pricing` |
| Public | Demo | `/demo` | `#/public/pilot` |
| Public | Resources | `/resources` | `#/public/resources` |
| Public | Trust | `/trust` | `#/public/trust` |
| Identity | Sign in | `/auth/login` | `#/public/signup` |
| Identity | Invitation | `/invite/:token` | `#/institution/people (accept flow)` |
| Identity | Onboarding | `/onboarding` | `#/public/signup (steps 2–5)` |
| Identity | Recovery | `/auth/recovery` | `#/public/recover` |
| Company | Campaigns | `/company/marketing` | `#/company/os` |
| Company | Quotes | `/company/quotes` | `#/company/quotes` |
| Company | Customer success | `/company/success` | `#/company/os` |
| Company | Refund approvals | `/company/refunds` | `#/finops/queue (institution-side pattern)` |
| Company | Reconciliation | `/company/reconciliation` | `#/company/recon` |
| Company | Operating review | `/company/overview` | `#/company/os` |
| Company | Hiring | `/company/hiring` | `#/company/os` |
| Institution | Identity settings | `/institution/identity` | `#/institution/people (invitations)` |
| Institution | Integration status | `/institution/integrations` | `#/institution/integrations` |
| Institution | Academic approvals | `/institution/approvals` | `#/institution/registrar` |
| Institution | Reports | `/institution/reports` | `#/insights/readiness` |
| Operations | Webhook deliveries | `/ops/webhooks` | `#/operations/deadletters` |
| Operations | Audit | `/ops/audit` | `#/trust/audit` |
| Operations | Recovery | `/ops/recovery` | `#/operations/incidents` |
| Operations | Security/privacy | `/ops/security` | `#/operations/privacy`, `#/operations/access` |
| Account | Invoices | `/account/invoices` | `#/company/account` |
| Account | Subscription | `/account/subscription` | `#/company/account` |
| Account | Agreements | `/account/contracts` | `#/company/agreements` |
| Account | Support | `/account/support` | `#/company/support` |
| Student | Registration | `/app/registration` | `#/student/registration` |
| Student | Degree path | `/app/path` | `#/student/degree` |
| Student | Career | `/app/career` | `#/student/career` |
