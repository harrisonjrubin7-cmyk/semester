# Semester — ship program & launch runbook

**Status:** proposed, not executed · October 2026 · Source: `Semester_Ship_Program_and_Launch_Runbook` (uploaded HTML, transcribed to Markdown without changing substance)
**Companion:** [`SHIP_PROGRAM_REGISTER.md`](SHIP_PROGRAM_REGISTER.md) — the workspace × operating-proof register and this session's gate evidence.

Nothing in this document has been executed. It is the working standard; each step is complete only when its evidence is recorded.

**Current status (per the source):** Signed paid pilot with Vanderbilt — launch Spring 2027, pending institutional activation. All workspaces are designed. The app is deployed with every capability off.

---

## 1. The rule

A workspace is active only when it is enabled for an approved institution and cohort, monitored, and supported by named people. Deployment, a working demo, an approved document or a successful build does not make anything active. Production states are locked until at least 10 of the 12 operating-proof items are evidenced; active is locked until all 12 are.

## 2. Promotion states

| # | State | Means |
| --- | --- | --- |
| 1 | designed | Flows, roles, states, accessibility and copy are specified and reviewed. |
| 2 | implemented | Frontend, backend, persistence, authorization and audit are wired to durable state. |
| 3 | contract-validated | API and event contracts pass compatibility tests against consumers. |
| 4 | tested | Functional, negative-access, accessibility, concurrency and recovery tests pass. |
| 5 | staging-ready | Migrations, config and secrets prepared for staging; rollback target named. |
| 6 | staging-verified | Smoke, connected-journey and drill results recorded in staging. |
| 7 | production-deployed | Exact release is on production with capabilities off. |
| 8 | production-smoke-passed | Read-only and authorized-write smoke tests pass on production. |
| 9 | active | Enabled for an approved tenant and cohort, monitored, with staffed support. |

## 3. Operating proof — 12 items per workspace

| # | Item | Evidence |
| --- | --- | --- |
| 1 | Route exists | Platform shell |
| 2 | Guard exists | Server + DB, not just UI |
| 3 | Capability registry entry | Capability registry |
| 4 | API contract | OpenAPI / AsyncAPI |
| 5 | Data model | Migration + RLS |
| 6 | Audit path | Audit events emitted |
| 7 | Named owner | A person, not a team |
| 8 | Runbook | Ops + rollback |
| 9 | Tests | Incl. negative access |
| 10 | Release evidence | Run links, SHA, deploy id |
| 11 | Monitoring | Alerts routed |
| 12 | Operator view | Ops console coverage |

## 4. Workspace × operating proof

Tick an item only when its evidence reference is recorded in the completion register. Only "route" is evidenced today, through the platform shell. The per-workspace matrix, with evidence references, lives in [`SHIP_PROGRAM_REGISTER.md`](SHIP_PROGRAM_REGISTER.md).

| Workspace | Phase | State |
| --- | --- | --- |
| Public web | 3 | designed |
| Student OS | 3 | designed |
| Faculty OS | 4 | designed |
| Advisor OS | 4 | designed |
| Registrar OS | 4 | designed |
| Finance OS | 4 | designed |
| Student Affairs OS | 4 | designed |
| Institution console | 3 | designed |
| Community & marketplace | 5 | designed |
| External portals (family, alumni, employer, board) | 6 | designed |
| Company OS | 6 | designed |
| Developer & partner portal | 6 | designed |
| Operations OS | 2 | designed |
| Library & design system | 1 | designed |

## 5. Authority boundaries

These are boundaries inside the existing app — schemas, edge functions, workers — not new deployables.

| Boundary | Owns | Must never own | Lives in |
| --- | --- | --- | --- |
| Identity | Accounts, memberships, sessions, grants | Student academic facts | `live_workspace_grants`, Supabase Auth |
| Access | Access operations, revocation, grant checks | Domain business records | `gate.ts` `requireGrant` |
| Policy | Authorization decisions, obligations, policy versions | UI/session state | `live_tenant_capabilities` (+ OPA later if earned) |
| Audit | Immutable trail, evidence references | Domain writes | `live_workflow_steps`, `audit_events` |
| Learning | Source extraction, study assets, citations | Official grades | course + study tables |
| Registrar | Readiness, overrides, requests, reconciliation | Payment records | `live-institution-command` |
| Advising | Caseloads, plans, referrals, appointments | Official enrollment advising tables | — |
| Finance | Payment intents, refunds, ledgers | Degree rules | `live-payments`, `live_payments` |
| Campus | Service requests, events, resources | SIS authority | campus tables |
| Career | Employers, opportunities, consented sharing | Academic grading | career tables |
| Community | Groups, posts, reports, moderation | Official institution records | groups/rooms migrations |
| Marketplace | Listings, offers, disputes, fulfillment | Institutional student records | — |
| Integrations | Adapters, sync cursors, credentials | Product UX logic | `live-sis-sync`, `live-lti`, `live_integration_health` |
| AI gateway | Policy-bounded requests, guards, logging | Source-of-record data | `supabase/functions/claude` (≈38 bypass sites to close) |
| Operations | Incidents, releases, queues, operator actions | Business domain authority | ops consoles, release registry |

## 6. Build phases

| Phase | Scope |
| --- | --- |
| 1. Foundations | Identity, tenancy, memberships, grants · Policy engine + policy data · Audit, evidence, release registries · Core schema + RLS harness · Shared contracts + event envelope · Common frontend shell |
| 2. Shared platform | Files + object storage · Notifications · Search · Integration service · Workflow worker + outbox · AI gateway · Operations inbox + release console |
| 3. Core user surfaces | Public web · Student OS · Learning OS · Institution console · Role onboarding + workspace switcher |
| 4. Institutional operations | Admissions · Faculty · Advising · Registrar · Finance · Student affairs / campus support · IT / security / privacy consoles |
| 5. Extended lifecycle | Career · Family · Housing / dining / campus · Alumni · Community · Marketplace |
| 6. Company + ecosystem | Company OS · Customer implementation / success · Developer portal · Partner portal · Employer portal · Investor / board portal |
| 7. Hardening | Reconciliation · Chaos + recovery drills · Access-review automation · Backup / restore proof · Accessibility passes · Pilot tenant cutover readiness |

## 7. Launch runbook

### 7.1 Release identity — record before anything moves

Commit SHA · build digest · hosting project and deployment ID · database project and region · schema fingerprint and migration checksums · edge-function and worker versions · environment fingerprint (names only, no values) · policy and flag versions · tenant, cohort and allowed operations · approvers · evidence expiry · predecessor release and rollback compatibility.

### 7.2 Pre-deploy

1. Authorize the candidate and the target. Confirm backups and stored files are restorable.
2. Review every pending migration and any automatic deploy path (including Supabase Branching). A merge can have side effects even if the workflow has no migration step.
3. Expand the schema additively; rehearse against production-like, authorized data.
4. Test the old app against the new schema and the new app against the compatible schema. Freeze incompatible contract changes.
5. Deploy dark with new flags off. Run read-only and authorized-write smoke tests on the target.
6. Verify direct API and worker denial, telemetry, alert routing, and the primary and backup on-call.
7. Approve tenant and cohort activation only after the evidence matches the release identity.

### 7.3 Rollout

Synthetic / staging → named operators → approved small cohort → approved broader cohort. Advance on accepted observations against approved thresholds. No unapproved official writes. Missing evidence holds the rollout.

Stop immediately for any tenant leak, unauthorized official or financial action, identity disclosure or data corruption. Also stop for failed reconciliation, missing alerts or coverage, revoked approval, an exceeded error budget, schema drift or an AI gateway bypass. Blank thresholds block activation.

### 7.4 Rollback order

1. Declare the incident and its scope. Keep exact release and policy versions and the audit trail.
2. Engage the server-side tenant or operation kill switch first; global only if the incident requires it. Verify that direct API calls and queued work are denied. Keep the authorized refund and cancellation path working.
3. Pause affected producers and consumers. Checkpoint in-flight transaction IDs and quarantine uncertain outcomes. Never delete outbox or dead-letter evidence.
4. Disable the affected tenant flag and invalidate policy caches. An old app must still honor the current kill state.
5. If needed, engage both read-only holds: client `VITE_READ_ONLY` (build time) and server `SEMESTER_READ_ONLY` (runtime). Verify coverage across functions, workers and storage — neither has been drilled in production.
6. Restore the known-good app, functions and workers independently. An app rollback does not restore the database, functions, external records or file bytes.
7. Reconcile outcomes with the source system before any replay. Keep committed official writes; corrections need fresh authority.
8. Prefer a forward schema repair. Database restore is its own incident procedure — never blindly restore a snapshot over newer legitimate writes.
9. Check cache, session and service-worker behavior and client-version compatibility. Don't wipe personal drafts.
10. Run regression, smoke, negative-access and privacy tests. Confirm support communications.
11. Re-enable only through a new, scope-bound acceptance. Record detection time, kill propagation, restore time, RTO/RPO and what's still uncertain.

### 7.5 Host notes

- **Vercel (if it is the confirmed host):** roll back to a known-good deployment. Environment changes apply to new deployments, not previous builds.
- **Supabase:** an app rollback does not revert the schema. Storage metadata backups don't contain file bytes.
- **GitHub Pages / Edge Functions:** the repo's `pages.yml` and `functions.yml` roll back independently to an approved prior ref.

### 7.6 Drill assertions — each must be shown, not assumed

- Unknown flag denied · missing target denied · stale, withdrawn or cross-target receipt denied
- Global and tenant kill switches take precedence; role, cohort and scope limits persist
- Direct and queued operations stop; in-flight outcomes reconcile; refunds stay authorized
- No identity disclosure; the old app stays compatible; restored files match checksums
- Restoring old permissions does not reinstate revoked access

## 8. Vanderbilt activation checklist

| Done | Item | Owner |
| --- | --- | --- |
| ☐ | Cyber + E&O insurance bound | Founder |
| ☐ | DPA mapped to the actual data flow | Founder + counsel |
| ☐ | HECVAT in the version Vanderbilt requires | Security lead |
| ☐ | SAML SSO working with the university IdP (sandbox, then production) | Engineering + VU IT |
| ☐ | OneRoster read connection in sandbox; staging reconciled | Engineering + Registrar |
| ☐ | Accessibility conformance report for pilot journeys | Accessibility lead |
| ☐ | Tenant-isolation and connected-journey tests pass on the release | Engineering |
| ☐ | Restore, rollback and kill-switch drills recorded | Operations |
| ☐ | Named support primary and backup; incident contacts exchanged | Operations + VU |
| ☐ | Pilot measures and stop criteria agreed | Founder + VU sponsor |
| ☐ | Vanderbilt's written approval to activate the named cohort | VU sponsor |
| ☐ | Repo `GO-NO-GO-DECISION.md` updated to match the signed pilot | Founder |

Evidence references for each item are recorded in the register, not here.

## 9. Sign-off

Activation of any capability for any institution requires each signature below, recorded against the release identity in §7.1.

- Release manager · name, date
- Security owner · name, date
- Operations / support owner · name, date
- Institution sponsor · name, date
