# Semester security finish line

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin (single owner; the security contact is a personal mailbox) |
| **Method** | Static scan of `supabase/migrations/` (182 files), code reads, and read-only GitHub API calls by an audit agent. The 111 `.check.sql` suites were **not** executed for this document. Counts from the scan are approximate (comments stripped, last definition wins, overloads collapsed by arity). |
| **Principle** | Do not remove or weaken a control to pass a test. Do not expose a sensitive table for convenience. Browser state is never the authority for a permission or a transaction. |

## Launch gates (from the finish-line brief)

| Gate | State | Evidence or gap |
| --- | --- | --- |
| No critical unresolved authorization issue | **Unknown.** None found by static read; no independent review | needs EXT-006 |
| No known cross-tenant access defect | **None known**, but no generic sweep proves it | TI-01/TI-04 absent |
| No secrets in source, history or deployment logs | **Source: none found** (static grep, gitleaks in CI). History and deployment logs: gitleaks scans the tree and a range, not provider stores | `docs/evidence/security/2026-10-02-*` |
| All privileged functions have documented scope checks | **Partial.** Register covers 205 client-callable definers; ~15 policy-less tables post-date it; DR-01 open | `docs/DEFINER-RLS-REGISTER.md` |
| All sensitive tables have intentional exposure classification | **Partial.** `table-classification.json` held both ways by test; GraphQL exposure unmitigated | F09 |
| All high-risk actions have audit and approval | **Partial.** Console break-glass and approvals have both; five-plus audit streams, gateway streams unchained | F11 |
| Restore test passes | **Not met.** Logical rehearsal only; production never restored | F15 |
| Incident tabletop passes | **Partial.** Founder repository-only tabletop 2026-10-03 | `docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md` |
| Access review completed | **Not found** as a dated artifact beyond owner attestations | `docs/evidence/` attestations |
| Security contact and vulnerability process exist | **Partial.** `SECURITY.md` has severity clocks; contact is a personal Gmail | `SECURITY.md` |

## Live GitHub state (read 2026-10-05)

| Fact | Source |
| --- | --- |
| `main`: branch protection returned 404; ruleset list `[]` | GitHub API, by the audit agent |
| `.github/rulesets/main.json` is defined (requires `build`, `account-sync`, `secrets`, code-owner review) and not applied | repository file |
| The repository is public | GitHub API |
| Secret scanning, push protection and Dependabot security updates enabled | GitHub API |
| 26 of the latest 30 `main` runs red on 4 October | `docs/evidence/operations/2026-10-04-main-ci-red-diagnosis.md` |
| CodeQL and HawkScan run history not confirmed (code-scanning alerts returned 403) | audit |

The code-owner review in the ruleset cannot be satisfied by a one-person
repository without a second reviewer or a bypass. Applying it as written would
block every merge. That is a decision, not a technicality
([action 1](SEMESTER_90_DAY_FINISH_LINE_PLAN.md#the-next-25-actions)).

## The 18-step program, status

| # | Step | State |
| --- | --- | --- |
| 1 | Asset inventory | `partial`: `docs/DATA-INVENTORY-AND-LINEAGE.md` counts are stale (302 vs 322 public tables) |
| 2 | Data inventory | `partial`: table classification tested; field-level inventory absent (register B02) |
| 3 | Threat models | `documented`: `docs/SECURITY-THREAT-MODEL.md`, `docs/integration threat model`; not reviewed independently |
| 4 | RLS / authorization audit | `verified` in CI for sweeps; generic A/B sweep absent |
| 5 | Function-grant audit | `verified` in CI (`grants.check.sql`: anon callable none) |
| 6 | GraphQL / PostgREST exposure audit | `partial`: GraphQL not disabled; TRUNCATE-class privileges revoked 2026-10-05 (D-1251); `anon` DML on 32 tables and the `authenticated` allowlist still need decisions |
| 7 | Secrets audit | `verified` (static + CI); browser-held tokens are a finding |
| 8 | Dependency audit | `partial`: `npm audit --audit-level=high` is non-blocking in `ci.yml`; `supply-chain.yml` blocks on critical but is not a required check |
| 9 | SAST / DAST | `partial`: CodeQL conditional, HawkScan needs a key; EXT-007 blocked |
| 10 | Penetration-test readiness | `documented`: no test commissioned (EXT-006 open) |
| 11 | Vulnerability management | `partial`: severity clocks in `SECURITY.md`, held by test; no ticketed register in use beyond `docs/security/FINDINGS-REGISTER.md` |
| 12 | Incident response | `partial`: see [support](SEMESTER_SUPPORT_AND_INCIDENT_READINESS.md) |
| 13 | Backup and restore | `open` |
| 14 | Access review | `open`: attestations only; no dated review |
| 15 | Vendor risk | `partial`: `docs/SUBPROCESSORS.md`; EXT-017 provider DPAs open |
| 16 | Secure SDLC | `partial`: actions pinned by SHA, Dependabot, CODEOWNERS; `main` unprotected |
| 17 | Audit-log integrity | `partial`: chains for 3 streams; hand-applied verifier jobs |
| 18 | Security metrics and executive review | `absent` |

## Foundation gates (Phase 2) — verified and open

| Gate | Class | Verified by | Open |
| --- | --- | --- | --- |
| Authentication | verified | `auth.test`, `membership.test`, `gateway.test` | MFA only on console |
| Tenant isolation | verified (per feature) | 111 suites incl. `tenancy`, `rls-coverage`, `integration-rls-matrix` | generic sweep; enforcement off |
| Roles / capabilities | verified | `rolegrants.check.sql` (28), `capabilities.ts` | 69 DB roles, 0 launch-approved |
| RLS | verified | `rls-coverage.check.sql` | 80 tables RLS-on with no static policy (~19 covered by loop policies); 49 register-listed; ~15 unlisted |
| SECURITY DEFINER review | verified | `definerregister.test`, `definer-sweep.check.sql` | DR-01; register proves presence, not correctness |
| GraphQL / PostgREST | **partial** | `client-privileges.check.sql` (TRUNCATE-class, D-1251) | disable GraphQL; decide anon DML |
| Secrets | verified | `secrets.test`, gitleaks | browser tokens; no rotation drill |
| Audit logging | partial | `audit-and-subject-requests.check.sql`, chain suites | unchained streams; service-role delete |
| Data classification | partial | `tableclassification.test` | field-level |
| Consent | partial | `consent.test`, `erasure-clears-consent-snapshots.check.sql` | no `purpose`/`legal_basis`; `decide()` is dead code |
| Retention | verified | `retention.test`, sweep suites | cron applied by hand |
| Legal holds | verified | `legal-holds.check.sql` | — |
| Export / erasure | verified | `deletion.check.sql`; erasure drill 2026-09-30 | browser-store residue |
| Integration boundaries | verified | `integration-rls-matrix.check.sql` | no real adapters to test against |
| Feature flags / rollouts / kill switches | verified | `flags.test`, `tenant-rollout.check.sql`, AI drill | client-side evaluation; device-key bypass |
| Backups / restore tests | **open** | CI logical rehearsal | PITR, production, RTO/RPO |
| Incident response | partial | tabletop | on-call |
| SLOs | defined, unmeasured | `error-budgets.test` | measurement |
| Support escalation | partial | queue code | staffing |
| Accessibility primitives | verified | axe and smoke tests | see [accessibility](SEMESTER_ACCESSIBILITY_FINISH_LINE.md) |
| Analytics taxonomy | partial | three marks | taxonomy |
| Observability | open | hourly probes | errors, logs, traces, paging |
| CI/CD | partial | 12 workflows | branch protection |
| Dependency scanning | partial | `npm audit`, SBOM | blocking, required |
| Security scanning | partial | gitleaks, CodeQL (conditional), HawkScan (needs key) | confirm runs |

## Findings, ranked

| ID | Sev | Finding | Evidence | Repair | Test to write first |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | P0 | `main` unprotected, 26/30 red | API; F-09 | apply a satisfiable ruleset; green the runs | none (settings change); record the API read |
| SEC-02 | P0 | Generic cross-tenant sweep absent; membership enforcement off | `TENANT-ISOLATION-VERIFICATION.md` TI-01/04/06/07/08/10/12 "Add" | build TI-01/TI-04 over every tenant table; enable enforcement on a staging school | a table with a deliberately missing policy must fail the sweep |
| SEC-03 | P1 | `fetchcal` request precedes redirect check; no DNS-resolution check | `supabase/functions/fetchcal/index.ts:194,207`, confirmed in this audit | `redirect: 'manual'`, check each hop before the request, resolve and check addresses | a public host redirecting to `169.254.169.254` must be refused **before** a request is made |
| SEC-04 | P1 | No restore proof | F15 | `restore-drill.sh` into the second project; PITR test; record | n/a (drill) |
| SEC-05 | P1 | No alert delivery; personal mailbox contact | F-08 | route probe failure to a person; non-personal address | synthetic failure must reach the recipient |
| SEC-06 | P1 | Gateway audit tables grant `service_role` DELETE and are unchained | F-10 | revoke; chain; schedule the verifier by migration | `service_role` delete must fail |
| SEC-07 | P1 | OAuth tokens and BYO AI keys in `localStorage`; no response headers on GitHub Pages | F-02, F-06, F-07 | server-side token handling; headers via a host that sets them | CSP present on deployed response |
| SEC-08 | P1 | SAML has no IdP round trip, no cert-expiry alert, no single logout; no OIDC | `INSTITUTIONAL-SSO-LAUNCH-READINESS.md` | one real-IdP acceptance run | n/a (acceptance) |
| SEC-09 | P1 | Device-key AI routes bypass kill switch and AI-off policy | F-04, `claude.ts` | refuse when policy says off | route must refuse under `aiOff` |
| SEC-10 | P2 | GraphQL not disabled; `anon` DML on 32 tables and the `authenticated` allowlist undecided. The TRUNCATE, TRIGGER, REFERENCES and MAINTAIN part is **closed** (D-1251, applied to production 2026-10-05, `supabase/client-privileges.check.sql`, seen red on the unmigrated schema per the decision) | F09; `database/GRANT_ALLOWLIST.md` | disable GraphQL; decide and apply the DML reduction | extend `client-privileges.check.sql` to the chosen DML allowlist |
| SEC-11 | P2 | `npm audit` non-blocking; `supply-chain`, HawkScan, CodeQL not required | `ci.yml`, `supply-chain.yml` | make blocking and required where run history exists | CI fails on a seeded high advisory |
| SEC-12 | P2 | Hand-applied pg_cron jobs (retention, verifiers) | `supabase/scheduler.sql`, `DEPLOY.md` | apply by migration or prove they run | job-existence check |
| SEC-13 | P2 | No penetration test; no independent accessibility review | EXT-006/008 | commission | n/a |
| SEC-14 | P2 | Consent/decision records lack purpose and legal basis; `decide()` unused | `SECURITY-GAP-AUDIT-2026-09-30.md` | add columns; wire or delete `decide()` | consent row without a basis refused |
| SEC-15 | P2 | SCIM deprovision does not revoke org, course, department, office grants | same | extend revoke | deprovision must clear every scope |
| SEC-16 | P2 | DR-01 `kill_switch_engaged` discloses other tenants' state | register | scope the argument to the caller's tenant | cross-tenant call must return nothing |

**Test discipline.** Per `CLAUDE.md`, each new guard is shown to go red against
a faithful revert of the fix, then restored, and carries a control so a broken
probe cannot read as clean.

## Order of work

1. SEC-03, SEC-09, SEC-10, SEC-16: small, customer-independent, each with a
   failing test first.
2. SEC-01 and SEC-05: settings and wiring.
3. SEC-02: the largest piece and the gate for a second real tenant.
4. SEC-04, SEC-08, SEC-13: need a drill, an IdP or a vendor.
