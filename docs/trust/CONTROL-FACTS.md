# Control facts

> **Type:** reference · **Audience:** security-reviewers, buyers · **Owner:** `security` · **Truth:** generated · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/trust-docs.test.ts`

Counts and lists read from the repository when the test runs; stop reading here if you need to know whether any of it operates in production, which no row on this page shows.

<!-- Rendered from supabase/, app/public/_headers, app/vercel.json, SECURITY.md, packages/institution/src and app/src/lib by app/src/lib/docs/trust-docs.test.ts. Edit the code, then run `REGISTERS=write npx vitest run src/lib/docs/trust-docs.test.ts` from app/. -->

Every table is a measurement of text in the tree. A count here says a file, row or line exists. It does not say the control runs against a production project; for that, see [docs/EVIDENCE-REGISTER.md](../EVIDENCE-REGISTER.md) and [`EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md).

## Row-level security posture, counted from migrations

| Measure | Count |
| --- | --- |
| Migration files | 200 |
| Tables created in `public` and not later dropped | 330 |
| … of which enable row-level security in a migration | 330 |
| Tables created in `private` and not later dropped | 35 |
| … of which enable row-level security in a migration | 35 |
| Tables with no `enable row level security` statement found | 0 |
| Tables named by at least one literal `create policy` statement | 276 |
| Tables with RLS found and no literal policy statement | 89 |
| Migration installs the `ensure_rls` event trigger (`rls_auto_enable`) | yes |

**How counted.** Each migration is read in filename order with SQL comments removed. A table counts when `create table` names it (schema defaults to `public`) and no later `drop table` removes it. It has RLS when an `alter table … enable row level security` names it. The name `as` is skipped because it is the SQL phrase `create table as`. Policies count only as literal `create policy … on <table>` statements.

**What this does not prove.** It does not see tables created or altered inside `format()` or `execute` loops, so a table that gets RLS only that way is counted as having none and a table that gets a policy only that way is counted as having none. It reads migrations, not the live schema: it cannot say which migrations are applied to a project (see [DEFINER-RLS-REGISTER.md](../DEFINER-RLS-REGISTER.md), which records the files not yet applied). RLS enabled is not RLS correct; the second-account suites below are what test that. The count differs from other pages (for example `DATA-INVENTORY.md` reports 301 `public` tables) because the methods differ; none is a live catalogue reading.

## Policy and invariant suites (`supabase/*.check.sql`)

128 files. `supabase/check.sh` runs every `*.check.sql` file by glob, and `.github/workflows/ci.yml` runs it as the step "Check the database policies".

| Suite | What it proves (first sentence of its opening comment, verbatim) |
| --- | --- |
| `supabase/academic-record.check.sql` | The academic-record ledger (D-145): who may propose, decide and read; that nobody writes the ledger but the approval of someone other than the proposer; that each entry names the entry and value it r… |
| `supabase/access.check.sql` | The log of who read your rows, which is only worth anything if it is yours. |
| `supabase/activity.check.sql` | The pilot's three figures: what the ping may write, and what it may not. |
| `supabase/admins.check.sql` | The admin list, and the account_role column that is deliberately not it. |
| `supabase/advisor-reconciliation.check.sql` | The production-advisor reconciliation of 30 September 2026 (D-1026): that a table with row-level security on and no policy is unreachable by any client role — the fact that lets the advisor's 49 noti… |
| `supabase/advisor.check.sql` | Advisor Meeting Mode shares (Phase G, D-016): who can share with whom, who can read, and that expiry and revocation stop reading. |
| `supabase/ai-audit-content-free.check.sql` | The AI audit tables hold no prompt and no answer. |
| `supabase/ai-spend.check.sql` | The dollar meter on the shared key (20261004170000_ai_spend_meter). |
| `supabase/answer-rights-requests.check.sql` | Answering a rights request: who may, which moves are legal, and what is left behind. |
| `supabase/approved-source-policy-scope.check.sql` | Disposable/local database only, after applying the source-scope migration. |
| `supabase/audit-and-subject-requests.check.sql` | The common audit envelope (audit_event) and the rights-request queue (data_subject_request). |
| `supabase/beta.check.sql` | The invite-only private beta (20260928220000_private_beta.sql). |
| `supabase/calendar.check.sql` | The one table in this schema a stranger is meant to be able to read. |
| `supabase/canonical-display.check.sql` | What an imported fact may say, and who may take a student's away. |
| `supabase/capabilities.check.sql` | The permission matrix, and the four things that make it a matrix rather than a ladder. |
| `supabase/classmates.check.sql` | Two people in one room, without needing two people. |
| `supabase/client-privileges.check.sql` | The browser's roles hold no table privilege that row-level security does not govern. |
| `supabase/commercial-automation.check.sql` | The commercial core's moving parts (20260929080000_commercial_automation): checkout, the webhook's writes, the dunning worker, contract → tenant, site lead intake and the nightly account-health job. |
| `supabase/commercial.check.sql` | The commercial core: catalog, billing accounts, subscriptions, invoices, dunning, cancellation, delivery records and the governance registers. |
| `supabase/community.check.sql` | Community: every permission in 20260928032000_community.sql walked as the account it is about, and every refusal attempted as the account that should be refused. |
| `supabase/company-roles-student-data.check.sql` | No company role reads a student's rows. |
| `supabase/configuration-studio.check.sql` | The Configuration Studio (D-1011): who may draft and who may publish a school's configuration, that whoever drafted it does not publish it, that a published version is never edited or deleted, that e… |
| `supabase/connections.check.sql` | Does '20260922003000_connections.sql' do what it says? |
| `supabase/console-approvals.check.sql` | The operations console's writes: approvals, the fail-closed action, break-glass, and the commercial core (20260929110000). |
| `supabase/console-command-center.check.sql` | Live command-center read model (20260930180000). |
| `supabase/console-control-plane.check.sql` | The operations console's control plane: preferences, seats, fresh MFA, the duty matrix, the audit chain, figures with provenance, and the demo flag. |
| `supabase/console-integration-health.check.sql` | Credential-free, exact-school integration health. |
| `supabase/console-no-student-rows.check.sql` | No console function hands an operator a student's data. |
| `supabase/console-release-incidents.check.sql` | Release and incident console read model. |
| `supabase/console-scoped-tenant-access.check.sql` | Scoped Operations Console read template (20261005120000). |
| `supabase/console-security-reads.check.sql` | Who may read the approval and break-glass records — beyond their own. |
| `supabase/console-tenant-operations.check.sql` | Tenant/pilot operations workspace (20261005121000). |
| `supabase/coursestudio.check.sql` | who may publish for a course, and who reads it. |
| `supabase/definer-sweep.check.sql` | Every definer function a signed-in account can call, called by one that holds nothing. |
| `supabase/deletion.check.sql` | What "Delete my account" actually empties, walked as the account doing it. |
| `supabase/demand.check.sql` | Course demand forecasting (Phase K, D-051): a student contributes only by consenting, only at their own school, and can stop; a count is published only at ten or more and only from live consent; staf… |
| `supabase/dining.check.sql` | who may order, give, move and read, in dining. |
| `supabase/emit-domain-event.check.sql` | The outbox's one SQL writer (backlog P1-02): what it refuses, what it makes idempotent, who may call it, and that an event leaves with the transaction that wrote it. |
| `supabase/erasure-clears-consent-snapshots.check.sql` | Erasing an account must not leave its consent history behind in a copy. |
| `supabase/evidence-graphs.check.sql` | Learning, skill and capture evidence must stay inside both its tenant and its person boundary. |
| `supabase/expansion.check.sql` | Expansion roles and features: every new permission walked as the account it is about, and every refusal attempted as the account that should be refused. |
| `supabase/export-withholds-guardian-restrictions.check.sql` | An account export must not carry a guardian restriction. |
| `supabase/family.check.sql` | What a parent can see, and the four states in which the answer is nothing. |
| `supabase/familyinvites.check.sql` | the share codes behind supporter sharing. |
| `supabase/familyshare.check.sql` | what a supporter reads, and the log of it. |
| `supabase/feature_cohorts.check.sql` | who is in a release cohort, and what it admits. |
| `supabase/feedback.check.sql` | What a student said was wrong, and what the database refuses to keep. |
| `supabase/financial-retention.check.sql` | Financial records kept seven years after the end of their year, then removed (20260929130000_financial_retention, D-132). |
| `supabase/forms.check.sql` | The second table in this schema a stranger is meant to be able to reach, and the first one they are meant to be able to *write* to. |
| `supabase/gateway-journal.check.sql` | Shared action state must remain tenant-scoped, atomic and conservative. |
| `supabase/governance.check.sql` | Governance registries: every rule 20260927235000_governance_registries.sql claims, walked as the account it is about, and every refusal attempted as the account that should be refused. |
| `supabase/gradebook.check.sql` | who enters, moderates, releases and reads a grade, and that no grade is ever rewritten. |
| `supabase/grants.check.sql` | Which functions a client may call at all. |
| `supabase/groups.check.sql` | Four people and two groups, without needing four people. |
| `supabase/gtm.check.sql` | The go-to-market foundation: the rules in app/src/lib/gtm, held by the database. |
| `supabase/help-requests.check.sql` | Help requests: a student asks a person for help, and nothing else happens. |
| `supabase/hold-aware-sweeps.check.sql` | School and account holds reaching the AI-runtime and Community sweeps: that a school hold keeps that school's AI metadata and every account's Community rows in it; that an account hold keeps that acc… |
| `supabase/hold-blind-sweeps.check.sql` | A legal hold reaching the last three sweeps that deleted without asking (20261004150000_holds_reach_the_last_three_sweeps.sql): student tombstones, individual subscribers' financial records, and the… |
| `supabase/hold-gated-sweeps.check.sql` | The AI-runtime and Community sweeps behind a platform-wide legal hold: that each runs when there is no hold, is skipped (and says so) while one is live, runs again once it is released, and that a sch… |
| `supabase/human-overrides.check.sql` | The shared override log: that a correction of a grade already on the record is logged by the ledger itself, whatever a client does; that the log says what was decided, what replaced it and why; that… |
| `supabase/identity-provisioning.check.sql` | Institutional identity and SCIM lifecycle checks. |
| `supabase/indexes.check.sql` | Every foreign key has an index that covers it. |
| `supabase/institutional-foundation.check.sql` | Institutional foundation: two synthetic campuses, one exact-scope grant, and no client-selected shortcut around either boundary. |
| `supabase/integration-control-plane.check.sql` | Integration control plane: every boundary the migration claims, walked as the account it is about, and every refusal attempted as the account that should be refused. |
| `supabase/integration-hardening.check.sql` | Retention, legal hold and health for the integration tables, run as the service role that will call them. |
| `supabase/integration-quality.check.sql` | Integration quality: every boundary 20260928040000_integration_quality.sql claims, walked as the account it is about. |
| `supabase/integration-rls-matrix.check.sql` | The permission matrix, walked table by table rather than case by case. |
| `supabase/integration-tick-auth.check.sql` | The scheduler's token check for the integration-tick Edge Function, run as the roles that will and must not call it. |
| `supabase/intelligence-policy.check.sql` | Semester Intelligence tenant policy: real school-scoped grants are the boundary. |
| `supabase/invites.check.sql` | The gate that decides whether an account can exist at all. |
| `supabase/k12-guardians.check.sql` | K–12 guardian links (K12-002): who may record a guardian, who may read the link, and when the link stops counting. |
| `supabase/ledger-chains.check.sql` | The hash chain over the academic-record and student-account ledgers: that a normal flow builds a chain the verifier accepts; that each kind of tampering it claims to catch is caught, and reported as… |
| `supabase/ledger-seals.check.sql` | Signing the ledger chains: that a day is sealed once, per ledger and school, under a key no API role can read; that the seal check catches the attacker the link check cannot (one who rewrites an entr… |
| `supabase/legal-holds.check.sql` | Legal holds (RM-02, RM-05): who may place one and over what, that it is released only by someone else with a reason, that it is never deleted or edited, that a held account cannot be deleted, and tha… |
| `supabase/listings.check.sql` | Verified listings: who drafts, who publishes, who reads, and https only. |
| `supabase/lti-capability.check.sql` | Whether an LTI launch's account holds lti:launch at the school, as the launch facts report it. |
| `supabase/lti-integration.check.sql` | LTI bound to the integration control plane: the passback gate walked one gate at a time, the pre-binding behaviour kept, and the launch's context recorded only when every condition holds. |
| `supabase/lti-membership.check.sql` | Joining an LTI launch to an institutional membership. |
| `supabase/lti.check.sql` | The two tables an LTI launch runs on, and the four ways they are meant to refuse. |
| `supabase/ltiags.check.sql` | The table a grade finds its way back through, and the ways it refuses. |
| `supabase/ltiidentity.check.sql` | Which account a Brightspace launch opens, and the two proofs it takes to change that. |
| `supabase/mentor-rosters.check.sql` | Mentor rosters, and consent on both sides (20260928021700). |
| `supabase/migration-center.check.sql` | The Migration Center (D-144): who may see and run a school's migrations, that a migration moves one stage at a time and only on the evidence its stage asks for, that going back restarts that evidence… |
| `supabase/minimum-age.check.sql` | Minimum age 13, and minors (13–17) out of discovery, matching, messaging and employer visibility until they turn 18 (20260929150000_minimum_age). |
| `supabase/moderation-audit.check.sql` | Moderation actions must leave immutable, metadata-minimized evidence. |
| `supabase/module_mode.check.sql` | The per-school, per-module Connect / Core switch (20260930010000). |
| `supabase/my-capabilities.check.sql` | Who the app is told holds which capability — 'public.my_capabilities()'. |
| `supabase/my-sessions.check.sql` | Where a student is signed in (stream 02): 'my_sessions()' lists the caller's own live sessions and 'end_my_session()' ends one of them. |
| `supabase/offboarding-grants.check.sql` | A person deprovisioned by their school stops holding that school's authority. |
| `supabase/officeactions.check.sql` | The campus office action feed (Phase J, D-048): who may publish as which office, the draft → review → published workflow, who a published action reaches, and that an office learns a completion count… |
| `supabase/onboarding-journeys.check.sql` | Onboarding journeys and the one-use hand-off (20261006000000_onboarding_journeys_and_handoff). |
| `supabase/organizations.check.sql` | Who may say what about whom, in an organization. |
| `supabase/outbox.check.sql` | The transactional outbox and the consumer receipts: service-role only, and the constraints that make a mislabelled or a duplicated event fail in the transaction that tried to write it. |
| `supabase/payment-inbox.check.sql` | The payment-rail registry and the verified-event inbox (20261006090000_payment_rails_and_event_inbox, D-1319). |
| `supabase/privacy-case-actions.check.sql` | Privacy case lifecycle, holds, approvals and certificates. |
| `supabase/privacy-case-workspace.check.sql` | Scoped, identity-minimized privacy queue. |
| `supabase/productivity-commands.check.sql` | The storage half of the productivity command API: that the commit function is atomic, idempotent, gapless and refuses a stale writer; that row-level security lets a person read their own live rows in… |
| `supabase/productivity.check.sql` | Include owner isolation, optimistic revisions, tenant membership, aggregate suppression, and account-link preservation in the standard policy harness. |
| `supabase/projection-foundation.check.sql` | The projection tables and the outbox's claim columns (backlog P1-01). |
| `supabase/rate-limits.check.sql` | Rate limits on the browser's direct writes, and what they must not touch. |
| `supabase/records.check.sql` | Does 'records.sql' do what it says? |
| `supabase/referrals.check.sql` | Referral links: what an ambassador may learn, and what they may not. |
| `supabase/registration_transaction.check.sql` | the official registration transaction. |
| `supabase/reports.check.sql` | Who may read a report, and the four states one can be in. |
| `supabase/retention-sweeps.check.sql` | The three retention sweeps from 20260929030000_retention_sweeps.sql. |
| `supabase/rls-coverage.check.sql` | Row-level security holds across the whole schema, not only where a suite happened to look. |
| `supabase/role-grant-audit.check.sql` | Role changes must be append-only, metadata-minimized and tenant-isolated. |
| `supabase/rolegrants.check.sql` | The role grants, and the two locks that make them mean something. |
| `supabase/rooms.check.sql` | Reactions, with the second person a reaction needs. |
| `supabase/roster-import.check.sql` | Roster import staging: staged not written, manifest-checked, held on a large removal, idempotent, reversible, per school, and closed to every client. |
| `supabase/school-membership.check.sql` | Course rooms limited to one university at a time (full-beta G-03). |
| `supabase/school-offboarding.check.sql` | A school leaves in steps (full-beta gate G3, 20260930200000). |
| `supabase/schools.check.sql` | What removing a university does to the people who studied there. |
| `supabase/scim-gateway.check.sql` | The SCIM gateway wrappers (20260928200000_scim_gateway.sql). |
| `supabase/share-audit.check.sql` | The advisor-share lifecycle on the common audit record (20260930190000). |
| `supabase/space-availability.check.sql` | Room availability is a mapping target, and only one check guards the list. |
| `supabase/student-accounts.check.sql` | Student accounts (D-146): nobody writes the ledger but the approval of someone other than the requester; above the threshold only a high-value approver approves; whoever put a payment on the ledger d… |
| `supabase/student-payment-plans.check.sql` | Payment plans on student accounts (D-146): a plan is asked for only by the student it concerns or by Student Accounts; the database reads the balance from the ledger and writes the schedule by the sc… |
| `supabase/support-access.check.sql` | Student-granted, time-boxed and audited support access. |
| `supabase/support-case-access.check.sql` | Identity-free support-case metadata and consent-bound aggregate reads. |
| `supabase/support-tickets.check.sql` | Support tickets (20260928210000_support_tickets.sql). |
| `supabase/supportshares.check.sql` | an athlete's share with academic support. |
| `supabase/sync.check.sql` | Two devices on one account, without needing two devices. |
| `supabase/tenancy.check.sql` | Which university the server believes you belong to. |
| `supabase/tenant-plan.check.sql` | The plan a school is on (tenant_plan) and its history. |
| `supabase/tenant-rollout.check.sql` | Where a school stands in the pilot-to-production lifecycle (tenant_rollout), the evidence behind each move, and the history. |
| `supabase/tenant-sso-policy.check.sql` | Whether a school requires campus SSO (tenant_sso_policy), its history, and the launch facts that read it. |
| `supabase/trust-room.check.sql` | The procurement room: an NDA-gated, expiring, logged link to exact versions of the trust packet. |
| `supabase/workflow-builder.check.sql` | The Workflow Builder (D-1018): who may draft and who may publish a school's workflow definition, that whoever drafted it does not publish it, that a published version is never edited or deleted, that… |

**How counted.** Files in `supabase/` whose names end in .check.sql. The text is the first comment paragraph of the file up to its first full stop, with a leading `supabase/<name> —` path removed, cut at 200 characters.

**What this does not prove.** A suite existing is not the suite passing; CI history shows that. The first sentence is the author's description, not a measured list of assertions, and a suite can describe more than it asserts. The suites run on a throwaway Postgres built from the migrations, not on a customer environment.

## Security response headers

| Header | In `app/public/_headers` | In `app/vercel.json` (all-paths rule) |
| --- | --- | --- |
| Content-Security-Policy | yes | yes |
| Permissions-Policy | yes | yes |
| Referrer-Policy | yes | yes |
| Strict-Transport-Security | yes | yes |
| X-Content-Type-Options | yes | yes |

| Short values | Value in `_headers` |
| --- | --- |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(self), microphone=(self), display-capture=(self), geolocation=(self), clipboard-read=(self), clipboard-write=(self), screen-wake-lock=(self), payment=(), usb=(), serial=(), hid=(), bluetooth=()` |

Content-Security-Policy directive names in `_headers`: `default-src`, `base-uri`, `object-src`, `form-action`, `script-src`, `style-src`, `style-src-attr`, `style-src-elem`, `img-src`, `font-src`, `media-src`, `worker-src`, `manifest-src`, `connect-src`, `frame-ancestors`.

`app/index.html` carries a Content-Security-Policy meta tag: yes.

**How counted.** The two header files are parsed as text: `_headers` as indented `Name: value` lines, `app/vercel.json` as the `headers` array of its `/(.*)` rule. Directive names are the first word of each `;`-separated part of the policy.

**What this does not prove.** Both files take effect only on a host that reads them (Netlify or Cloudflare Pages for `app/public/_headers`, Vercel for `app/vercel.json`). The header comment of `app/src/lib/hostheaders.test.ts` says neither does anything on GitHub Pages, where the app is served today, and that the go-live line for host-configured headers stays unticked until a probe of the live response shows them. A value present here is not a value observed on a response. `app/src/headers.ts` is not part of this table: it names the on-screen titles of app screens, not HTTP headers.

## Vulnerability disclosure facts

| Fact | Value |
| --- | --- |
| `security.txt` fields present | Canonical, Contact, Expires, Policy, Preferred-Languages |
| `Contact` scheme | mailto (address not reproduced here) |
| `Expires` | 2027-03-31T00:00:00.000Z |
| `Canonical` | https://harrisonjrubin7-cmyk.github.io/semester/.well-known/security.txt |
| `Policy` points at `SECURITY.md` | yes |
| `SECURITY.md` states a notice clock of 72 hours | yes |
| `SECURITY.md` says the day counts are accepted internal targets | yes |
| `SECURITY.md` has a safe-harbour wording | no (it says so) |

| Severity | Fixed within (SECURITY.md table) |
| --- | --- |
| Critical | 2 days |
| High | 14 days |
| Medium | 60 days |
| Low | 180 days |

**How counted.** `security.txt` lines of the form `Field: value` are read from `app/public/.well-known/security.txt`; severity rows are the cells of the table in `SECURITY.md` that begin `| **Critical** |` and so on.

**What this does not prove.** The same file says the day counts are accepted internal targets, that nobody has yet held a finding against them, and that nothing is a customer commitment until a contract says so. It also says that the origin-root discovery path scanners use is not served. The 72-hour clock is about notice, not repair. The notice-law paragraph is marked by its own file as unverified by counsel.

## Retention classes and data classifications

Retention classes (`RETENTION_CLASSES` in `packages/institution/src/events.ts`): `operational`, `student_record`, `audit`, `commercial`.

Data classifications (`RESOURCE_CLASSIFICATIONS` in `packages/institution/src/policy.ts`), least to most sensitive: `public`, `internal`, `student_private`, `education_record`.

| Catalogued event types | Count |
| --- | --- |
| All | 61 |
| retention `operational` | 13 |
| retention `student_record` | 16 |
| retention `audit` | 27 |
| retention `commercial` | 5 |
| classification `public` | 0 |
| classification `internal` | 22 |
| classification `student_private` | 27 |
| classification `education_record` | 12 |

**How counted.** The two constant arrays are imported and printed; event types are counted from the `EVENT_TYPES` catalogue by the retention class and classification floor each declares.

**What this does not prove.** These are the vocabularies of the institution event envelope. The comment in `packages/institution/src/events.ts` says durations are policy in `RETENTION.md`, not code. The classes label rows; they do not delete anything, and the app's student data on the device is outside them.

## Edge functions and JWT verification

| Function | `verify_jwt` in `supabase/config.toml` | `getUser` in its entry file | Comment above its config block |
| --- | --- | --- | --- |
| `billing-cancel` | false | yes | Stripe has no Supabase token; the Stripe-Signature over the raw body is the credential, and the function answers 503 until STRIPE_WEBHOOK_SECRET is s… |
| `billing-checkout` | false | yes | (none) |
| `billing-portal` | false | yes | (none) |
| `billing-webhook` | false | no | (none) |
| `calendar` | false | no | (none) |
| `canvas` | false | yes | (none) |
| `claude` | false | yes | (none) |
| `delete-account` | false | yes | Delete my account. The caller is a signed-in student and the function checks their token itself, like `claude`; see DEPLOY.md → delete-account. |
| `fetchcal` | false | yes | (none) |
| `integration-tick` | false | no | (none) |
| `lead-intake` | false | no | The company site's visitors have no Semester account. The site's own origins are built in; SITE_ORIGINS only adds. See DEPLOY.md → lead-intake. |
| `lti` | false | yes | (none) |
| `productivity-sourcecheck` | false | yes | CORS preflight is unauthenticated; the function validates every POST with auth.getUser. |
| `push` | false | no | (none) |
| `support-reply-notify` | false | yes | A support agent's browser records the in-app reply first, then this function sends a generic email hint. It checks the caller's token and support gra… |
| `trust-room` | false | no | The caller is a reviewer at a university with no Semester account; the link token in the POST body is the credential. See DEPLOY.md → trust-room. |

16 function directories; 16 set `verify_jwt = false`; 0 set it to true.

**How counted.** Directories of `supabase/functions/` other than `_shared`, joined to the `[functions.<name>]` blocks of `supabase/config.toml`. The comment is the lines directly above the block.

**What this does not prove.** `verify_jwt = false` turns off the platform's token check. The header comment of `supabase/config.toml` says this is deliberate for every function listed: each checks the credential itself, because the platform check would reject the CORS preflight, which carries no `Authorization` header. The comments above individual blocks name the credential where it is not a user token (a Stripe signature, a link token). "`getUser` in its entry file" is a text search of the function's entry file only: a function may delegate the check to a `_shared` module or use a non-user credential. Neither column proves the check is correct; each function's own tests do.

## Security-definer function register

| Measure | Count |
| --- | --- |
| Rows in `app/src/lib/definerregister.ts` (the data behind `docs/DEFINER-RLS-REGISTER.md`) | 226 |
| Callable `security definer` functions derived from migrations ∩ `supabase/grants.check.sql` allowlist | 226 |
| Derived set equals the register's names | yes |
| Policy-less tables pinned in the register (production reading of 2026-09-30: 49) | 49 |
| Functions in the first production reading / the second (2026-09-30) | 151 / 180 |
| Tables in the first production reading | 45 |
| Register rows in category `self-service` | 65 |
| Register rows in category `sharing` | 21 |
| Register rows in category `admin` | 85 |
| Register rows in category `integration` | 6 |
| Register rows in category `financial` | 3 |
| Register rows in category `moderation` | 15 |
| Register rows in category `read-helper` | 31 |

**How counted.** The register rows are imported from the data module. The derived set repeats the register test's method: the winning `create function` in `public` for each name across migrations in filename order, kept when it says `security definer`, intersected with the names in the allowlist of `supabase/grants.check.sql`.

**What this does not prove.** The 151, 180, 45 and 49 figures are readings of a production project on dated days, recorded in `docs/DEFINER-RLS-REGISTER.md`; this test does not query any project. The register has more rows than the readings because later migrations added functions, as that page explains. A listed function having a gate is checked by the register's own test, not here.

## Third parties and kill switches

| Measure | Count |
| --- | --- |
| Parties in `docs/SUBPROCESSORS.md` (data in `app/src/lib/trust/subprocessors.ts`) | 19 |
| … kind `subprocessor` | 6 |
| … kind `institution-directed` | 2 |
| … kind `student-directed` | 11 |
| Kill switches in `app/src/lib/flags.ts` (`kill.integration_sync`, `kill.ai_generation`, `kill.data_upload`, `kill.code_execution`, `kill.sharing`, `kill.writeback`, `kill.core_modules`) | 7 |

**How counted.** Parties are imported from the data module that renders the subprocessor page; kill-switch keys are read from the `KILL_SWITCHES` array in the flags source text.

**What this does not prove.** The `kind` is an engineering classification that the subprocessor page says counsel has not reviewed. A kill switch existing in code is not a statement about its state in any environment.
