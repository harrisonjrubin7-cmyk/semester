# Stream 30: Phased build — hand-off order for the whole program

Source: `docs/system/closeout/finish-semester-outline.pdf` (the finish outline). Prototype: `#/os/finish` (`FinishLine.jsx`) is the evidence register for every phase. This file **orders** streams 00–29. It doesn't replace them: each phase names the streams to run, the prototype routes to match, the repo targets, and the exit gate. Do not start a phase until the previous phase's exit gate has evidence attached in the register.

## Ground rules (all phases)
- Status ladder per capability: Designed → Implemented → Tested → Deployed → Authorized → Enabled. Each level needs its own evidence (commit, test run, release ID, approval reference). The prototype proves **Designed** only.
- Enabled needs all 11 universal gates: user outcome, authorization, correctness, failure handling, accessibility, privacy, AI quality, operations, reversibility, documentation, activation.
- A screen, migration file, passing build, deployed route, local prototype, generated doc or feature flag is **not** proof of completion.
- Server enforces authority; client tenant IDs, routes and hidden buttons never grant access.
- Never deploy, change secrets, contact vendors, or mark anything done without evidence. One branch + PR + report per stream (`docs/execute/<nn>-<slug>-report.md`); stop for human review.
- Prototype acceptance reference: `design/ui_kits/semester-app/` (open `index.html`; routes below are `#/<workspace>/<screen>`).

## Phase 0 — Audit and reconcile (finish-outline Stage 1)
Streams: **00** setup, **18** role system, **25** completion program.
Do:
1. Rebuild the capability register in the repo (`docs/execute/capability-register.csv`) from the 25 rows in `#/os/finish` → Register (columns: id, capability, domain, users_authority, prototype_route, status, dependencies, evidence, owner, backup, blockers, activation_gate, recovery). Use the prototype's Export CSV as the seed.
2. Map each capability to code, DB objects, routes and tests (`#/os/repo` lists 89 matched screens + 8 prototype-ahead areas as the starting map).
3. Diff deployed schema/config vs repo intent; list migrations actually applied.
4. Choose one canonical implementation where duplicates exist (task model, assignment model, notification model).
5. Name an owner **and backup** for every capability; flag the solo-founder approval bottleneck.
6. Record the AI student-record policy decision (strict vs governed) with owner + reference — `#/os/finish` → Intelligence. Rewrite the contradicting handoffs to match.
Exit gate: the team can tell designed / implemented / tested / deployed / authorized / enabled apart for every row; every row has an owner + backup; the open tenancy (RLS/security-definer) and tenant-AI-policy findings have named owners.

## Phase 1 — Foundation hardening (Stage 2a)
Streams: **01** platform core, **02** identity/SSO, **29** account/identity/mail (releases 0–1 only), **09** + **22** trust (tenant denial, FERPA flows), **24** shell/role resolver (skeleton only).
Prototype: `#/os/account` (Identity, Sign in, Security hardening, **Audit harness**), `#/os/controlchain`, `#/os/graph`, `#/operations/console`.
Repo targets: `supabase/migrations/*` (RLS, security-definer fixes), `app/src/lib/permissions.ts`, identity provider/BFF, `app/src/lib/rolejourney.ts`.
Must include:
- PKCE S256 everywhere; **validate the verifier before atomically consuming the code** (correction recorded in Audit harness); replay → only first succeeds; concurrent redemption → at most one; downgrade blocked.
- Exact redirect URIs (no wildcards — `partner-legacy` currently fails); host allowlist; host-scoped cookies.
- Audit harness in CI: nightly 05:17 UTC, read-only, exit 2 on fail / 1 on incomplete / 0 only all-pass, artifact kept 30 days, pinned action SHAs, no secrets/tokens/student data in logs. Port the 8 local OAuth tests from `AcxLane` to vitest against a local adapter, then a staging adapter.
- Cross-tenant denial on API, DB, storage, search, jobs, exports, AI (capability T01).
- AppSec assurance (`#/trust/appsec`): run the AppSec 10 runbook on staging with synthetic tenants (SQLi, XSS, RLS/BOLA, role escalation, JWT/session, export/file IDOR, uploads, CSRF, SSRF, secrets/CI); AC-03 on every path (DB policy via SET LOCAL role authenticated, API, RPC, export, search, storage, cache, realtime) with the 12-field evidence record; ASVS 5.0.0 matrix imported only from the hashed official release, chapter priority V8 → V6/7/9/10 → V14 → V4 → V1–3 → V5 → V13/15/16 → V11/12 → V17. Any FAIL is a release blocker.
- RLS audit in three layers (`#/os/tiers`): structural all-table checks, fixture-backed allow/deny, manifest runner that fails on missing fixtures. App roles and paid tiers stay independent; port the 13 tier scenarios to pgTAP.
- Role change / consent revocation removes access on every surface (F02).
Exit gate: T01, F01, F02 at **Tested** with CI evidence; tenancy NO-GO closed and re-verified.

## Phase 2 — Student daily loop (Stage 2b, first full verification path)
Streams: **03** student OS, **12** one place, **21** work studio (workspace + files only), **06** AI gateway (policy + disable switch), **24** shell (navigation, notifications).
Prototype loop (`#/os/finish` → Daily loop): `os/account` → `student/manual` → `student/masterplan` → `studio/workspace` → `student/cases` → `student/semplan` → `os/backbone`; plus **`student/closeout`**.
Hardening (all 8 must have recorded test results): interrupted onboarding resumes; failed imports create no deadlines; offline saved/pending states; duplicate source events don't multiply tasks; timezone/DST + changed deadlines reconcile; missed week → manageable recovery plan; student can override suggestions; private work stays separate from official records.
Closeout release (`#/os/finish` → Closeout release, from `semester_closeout_release_tracker.xlsx`): milestones M1–M6 dependency-gated; 10 P0 + 1 P1 integration tests (import merge, weight conversion + unknown weights, DST, capacity shortfall, cross-tenant denial, revocation blocks search/export, offline reconnect, CSV formula injection, backend kill switch, restore + migration rollback, untrusted course text can't change tool permissions). The prototype's 8 local logic checks count as "prototype check only", never Verified.
Exit gate: representative users complete the loop under normal **and** failure conditions; S01–S04, F03–F05 at **Tested**.

## Phase 3 — Cross-role workflows (Stage 3)
Run in this order (each needs both sides working, incl. approval, correction, escalation, lifecycle changes):
| Domain | Streams | Prototype | Completion proof |
| --- | --- | --- | --- |
| A Learning / faculty | 04, 19, 26 | `faculty/os`, `faculty/gradeflow`, `student/interview` (grading log) | Assignment create → submit → reviewed feedback → authorized release → appeal → archive, no permission bypass. Five separate dimensions (acceptance, activity, grading, publication, sync); publication + outbox in one transaction; AGS HTTP failure ≠ gradingProgress Failed; progress-only posts never clear an existing score |
| B Planning / registration | 19, 05 | `student/semplan`, `institution/console`, `student/transfer` | Stale/missing data can't produce false "ready"; saved plan ≠ enrollment; `outcome_unknown` reconciles, never resubmits |
| C Advising / support | 04, 19 | `student/cases` | Request reaches an accountable owner who acknowledges; student sees status |
| D Career / employer / alumni | 07, 28 | `student/interview` → Coach sync, `alumni/sellerverify` | Prepare → practice → share deliberately → coaching → revoke; practice never becomes employer assessment |
| E Campus / family | 07, 20 | `student/familyconsent`, `trust/safetycase` | Scoped expiring grants; revocation + access history; report → moderate → appeal |
| F Accounts / finance | 15, 04 | `operations/concurrency` | Amounts reconcile to source; reversals not edits; no inconsistent records on failure |
Career detail (stream 28 addendum, prototype Coach sync): Handshake EDU API is read-only; Notes Importer is create-only (repeat imports duplicate) → build a **review queue**, not a sync. Match by tenant + appointment + student ID only. Native appointment → `identifiable_id`; historical → its existing `import_identifier` (UUIDv5 from a permanent institution namespace + immutable source ID; never random on retry). Verbal metrics kept beside the STAR grade, never in it. Slack alerts: counts only, secret-managed webhook, admin-approved destination. 7 activation gates + 8 importer gates must be evidenced before any write.
Exit gate: each domain's proof row has evidence; L01, R01–R03, A01, C01–C02, E01–E02, M01 at **Tested**.

### Intelligence rollout (inside Phases 1–5)
Prototype `#/os/assistant` (Daily loop, Compare, Approvals, Roadmap, Activation). Shared release train, separate Business OS / Institution OS gates: verify → trust foundation → read and draft → controlled-action pilot (impact preview, distinct approver, version-bound approval with expiry, idempotent command, audit + domain event, receipt submitted vs confirmed, rollback/remediation) → expansion → governed scale → authoritative replacement as a separate program. Incidents use scoped responder capabilities, not ordinary approval.

## Phase 4 — Institutional operation (Stage 4)
Streams: **05** integrations, **08** + **16** ops, **13** platform maturity, **23** reliability, **10** launch, **29** releases 2–3.
Prototype: `#/os/finish` → Integrations (13-field matrix × SIS, LMS/LTI 1.3, Handshake, Big Interview, payments, SSO/SCIM), Trust & ops, `#/os/recovery`, `#/executive/decisions`.
Must include: SSO + provisioning; approved integration access per vendor; reconciled data; training; support coverage; backup **restore rehearsal** and rollback rehearsal in staging; recovery targets chosen for the real deployment (don't claim a spec's uptime number); institutional acceptance.
Exit gate: an authorized launch decision with evidence attached; G01, O01, O02 at **Authorized**. The Vanderbilt pilot in the launch handoff is a planning artifact until a signed agreement exists.

## Phase 5 — Enable and replace by domain (Stage 5)
Streams: **14**, **15**, **17**, **11**, **20**, **27**, **29** releases 4–6.
Replacement ladder per domain (`#/os/finish` → Integrations): Observe → Shadow → Assist → Dual run → Gate → Authoritative → Archive → Retire. Moving past Dual run requires all 8 cutover items: record-count + field reconciliation, workflow comparison, permission equivalence, historical validation, exception handling, recovery rehearsal, institutional acceptance, a named authoritative source per phase.
Exit gate per domain: Semester is the accepted authoritative system for that domain; capability rows at **Enabled** for named users only.

## Prototype QA status (7 Oct 2026)
Automated sweep over all 386 prototype screens: every tab rendered, then ~11,400 clicks/selects/inputs (latest full regression after dark-theme token fixes, AppSec, GradeFlow, Tiers). Only harness-limit reports remain (file inputs on social/compose, executive/decisions). business/* doc links and Backbone route links navigate by design. Fixed: FinishLine/Roles global-name collision (finops queue crash), RepoVerify duplicate global, Billing lifecycle crash on machine switch, Operations console screens missing `go`, Master plan "Forget" erased without confirmation (now two-step). Remaining reports were harness limits (file inputs can't be filled programmatically). Harness: `scraps/smoke.js` (`__reset()`, `__next()`, `__skip()`, `__show()`). Re-run it before each phase review to catch regressions in the acceptance reference.

## What a phase report must contain
1. Capabilities moved, with old → new level and the evidence link for each level.
2. Gates still open per capability (from the 11).
3. Tests run with actual results (not "should pass").
4. Migrations applied (environment + release ID), not just written.
5. Rollback performed or rehearsed.
6. Open blockers with owner + backup.
