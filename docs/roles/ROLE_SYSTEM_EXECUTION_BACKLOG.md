# Role system execution backlog

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** plan; nothing here is started except item 1.

**Branch labels.** The brief names branches such as `feat/canonical-identity-membership-capabilities`. This session works on its assigned branch `claude/hopeful-lamport-jat9bm`, so the names below are labels for work packages, and each becomes a pull request on whatever branch the session assigns. A real decision made along the way is written to `docs/decisions/D-<pull request number>.md` after the pull request is open ([`CLAUDE.md`](../../CLAUDE.md)). Check `origin/main` for the defect before each package: this repository takes many merges a day and duplicates have landed here before.

**Gates for each package** (from `app/`): `npx tsc -b`, `npm run lint`, `npm run check:university`, `npm test`, `npm run test:shuffle`, `npm run build`, `npm run design-system:check` for UI, and `supabase/check.sh` for any migration. A guard is demonstrated by reverting the fix and watching its test fail. Production migrations go through a Supabase preview branch first; none is applied blind.

## Exact P0 sequence

1. **Establish truth:** which backend serves the live domain, branch protection actually applied, the vocabulary decision (items 2 to 4).
2. **Make the access model single and safe:** retire `app_admins`, complete deprovision revocation, close the grant write path, fix operator bypass, tighten anonymous exposure, prove Edge authorization (items 5 to 11).
3. **Add the shared decision and audit foundation** (item 12 to 14).
4. **Make the shell role-aware and route authorization real** (items 15 to 17).
5. **Build onboarding and first value** (items 18 to 19).
6. **Build the three P0 role workspaces** in order registrar readiness, advisor, institution admin (items 20 to 23).
7. **Build Semester operations views and release controls** (items 24 to 25).

## First 25 work items, dependency ordered

| # | Work item | Depends on | Closes | Done when |
| --- | --- | --- | --- | --- |
| 1 | Merge this audit after human review | none | | Reviewer confirms facts; stale-doc defects (RG-20) noted |
| 2 | Owner decision: which Supabase project is canonical for the live domain; plan to move or retire Semester2 | 1 | RG-15 | Written decision; forward migration plan for anything needed from Semester2 |
| 3 | Owner action: apply the branch ruleset and record it; name a second reviewer or document the exception | 1 | RG-16 | "Applied" table filled with a date and a screenshot of the GitHub setting |
| 4 | ADR-0002: one role vocabulary, with a written mapping from `institution_membership.roles`, `UNIVERSITY_ROLES`, `FlightRole` to `app_roles` and the rule that SCIM groups create requests, not grants | 1 | RG-02 | ADR Accepted; test fails when a vocabulary value has no mapping |
| 5 | Replace `private.is_app_admin()` gates on schools, enforcement and offboarding with capabilities; keep `app_admins` read-only then drop | 4 | RG-01 | `capabilities.check.sql` extended; no migration references `is_app_admin()` in a policy or definer |
| 6 | Revoke every tenant-scoped grant on deprovision (all scope kinds) | 4 | RG-03 | `offboarding-grants.check.sql` adds course, department, office, organization cases that fail on the old trigger |
| 7 | Check proving `console_act` is the only non-service writer of `role_grants`; revoke direct client and definer paths | 5 | RG-04 | New check fails when a second writer is added |
| 8 | Executors for the eight Console duties without one, or fail closed with a visible "record only" status in the UI | 7 | RG-05 | Each duty has an effect test and a refusal test; Console shows which duties act |
| 9 | Move kill switch, provider registry, trust and GTM writes behind approval-gated functions; remove browser write privileges | 8 | RG-06 | Direct update by an operator account fails in a new check |
| 10 | Confirm `20261005200000_anon_keeps_only_its_public_catalog.sql` is applied to the live project (re-run the read-only advisor); change remaining `{public}`-role policies on advisor, family, registration tables to `authenticated`; settle the `schools` column question | 4 | RG-08 | Advisor "anon table exposed" falls to the allowlisted catalogue; `client-privileges.check.sql` already asserts the allowlist on main |
| 11 | Audit each Edge Function for in-code authorization; add checks for `trust-room`, `delete-account`, billing, `claude`; document each function's auth mode | none | RG-09 | Table of function → auth mode → test; unauthenticated call is refused in each test |
| 12 | One server decision function returning allow, deny, step-up or approval-required from capability, scope, consent, classification, policy, entitlement and workflow state; first adopters registration and advisor share | 5, 6 | consent and entitlement gaps | Positive and negative tests per input; no policy rewritten to bypass it |
| 13 | Step-up on `approve_offboarding`, `set_school_enforcement`, `set_member_capabilities` | 12 | RG-10 | `assert_fresh_mfa` call asserted by check |
| 14 | Audit standard: common event envelope for new writers; scheduled ledger verifier; outbox publisher and receipt for registration and `console_act` | 12 | RG-11, RG-19 | Outbox rows written in the same transaction; a worker drains them; replay is idempotent |
| 15 | ADR: tenant URL scheme (`/app/t/:tenantSlug` or hash with tenant context) and deployment rewrite plan | 2 | RG-25 | ADR Accepted with offline and service-worker scope handled |
| 16 | Central route guard fed by server capabilities, shared forbidden and loading states built on `PermissionNotice` and `ModuleGateState`; fix first-render and unknown-route behaviour | 12, 15 | RG-12, RG-13 | Route authorization tests per role; keyboard and 320 px tests; axe coverage for staff screens |
| 17 | Role-aware shell reusing `components/unity/*`; promote preview workspaces to real ones one role at a time; isolate demo storage from real storage | 16 | RG-14, RG-38 | A real faculty, advisor, registrar, admin shell renders from capabilities; demo cannot touch real data |
| 18 | Onboarding platform: extend `onboarding_progress`, add journey, version, step, assignment tables with RLS and checks | 12 | RG-26 | Journey assigned from account, tenant, role, entitlement; progress resumes across devices |
| 19 | Activation and first-value events with a content-free privacy test; operator view | 18 | RG-31 | Test fails if a payload has free text; counts appear in Console |
| 20 | First SIS read adapter (holds, completions) into the registry; sync health and freshness labels; registrar reconcile action | 14 | RG-24 | An adapter passes the integration matrix check and a conformance case; holds and completions arrive with source labels |
| 21 | Registrar readiness desk: holds, time tickets, drop on behalf, outbox-backed receipts | 20 | registration gaps | Registrar completes the readiness path without direct database access |
| 22 | Advisor P0: caseload, appointment, referral, notes with consent-aware sharing | 12, 17 | RG-27 | Caseload scoped by assignment; reads audited; referral reaches a named office |
| 23 | Institution control plane P0: real consent and audit counts, SSO policy and SCIM screens, rollout and offboarding views | 5, 6, 17 | RG-17, RG-37 | Control plane shows measured values; SSO policy change goes through approval |
| 24 | Operations P0 views over existing tables: Inbox, My Work, Tenant directory and 360, Customer 360, pilot, implementation, support | 14, 17 | RG-28 | Each view reads a real table; capability-gated; no student rows |
| 25 | Console controls for rollout, kill switch and release pause; incident declaration and commander; role release gates and test matrix documents | 8, 9, 24 | RG-29, RG-30, RG-23 | Kill switch flipped from the Console with audit; `docs/finish-line/ROLE_SYSTEM_*` written from real evidence |

## First ten branches with acceptance criteria

| Branch label | Acceptance criteria |
| --- | --- |
| `audit/role-system-reconciliation` (this work) | The sixteen `docs/roles/` files exist; every claim cites a path or a catalog reading; stale-doc defects listed; no code changed; a reviewer has read the gap register |
| `feat/canonical-identity-membership-capabilities` | Items 4 to 7: one mapped vocabulary; `app_admins` retired; deprovision revokes every tenant scope; one write path to `role_grants`; checks fail against the old behaviour |
| `feat/policy-consent-classification-audit-foundation` | Items 12 to 14: one decision function with step-up and approval outcomes; consent and classification inputs; common audit envelope; outbox written transactionally with a worker; idempotency tests |
| `design/role-aware-appshell-navigation` | Items 15 to 17: tenant URL decision recorded; central route guard; forbidden, empty, loading and error states shared; role shells from capabilities; keyboard and mobile tests; demo storage isolated |
| `feat/student-onboarding-and-first-value` | Items 18 to 19: versioned journeys; resume across devices; first-value events content-free; support handoff; accessible |
| `feat/institution-sso-invites-account-linking` | SSO policy and SCIM credential screens with approval; invitation entry for staff roles that creates a request, not a grant; account-linking confirmation; SSO claims never assign roles |
| `feat/advisor-student-success-p0` | Item 22 |
| `feat/registrar-registration-readiness-p0` | Items 20 to 21 |
| `feat/institution-control-plane-p0` | Item 23 |
| `feat/semester-ops-command-center-p0` | Items 8, 9, 24 |

Then, in order: `feat/integration-source-status-reconciliation-p0` and `feat/release-rollout-incident-controls-p0` (item 25), followed by the P1 packages in the brief. The P2 packages wait for evidence from earlier domains.

## Not done in this phase

Running the test suites; running migrations or advisors against staging; any product code; the ten `docs/platform/` and five `docs/finish-line/ROLE_SYSTEM_*` documents; the per-role thirty-field record for all 69 roles; accessibility review (no qualified evaluator is named); a read of the full `ROLE-LAUNCH-REGISTER.md` role-by-capability table beyond headings; and any check of whether the supplied PDFs are in the repository (they are not; the repository's own reconciliation says the relevant PDFs were not attached).
