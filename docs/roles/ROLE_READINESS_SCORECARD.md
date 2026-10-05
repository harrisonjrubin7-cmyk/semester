# Role readiness scorecard

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence. No row is marked ready for pilot, production or authoritative.

Role ladder counts are from [`ROLE-LAUNCH-REGISTER.md`](../ROLE-LAUNCH-REGISTER.md): 69 roles; 46 at provisionable, 3 at usable, 18 at secure, 2 at supportable, 0 launch-approved. A role is enabled for a customer only at launch-approved.

The classification names are the brief's. "Native and verified" requires a migration, a client path and a check file together; it is bounded by this pass having run no tests.

## By family

| Family | Class | Why | Blocking gaps |
| --- | --- | --- | --- |
| A. Learner and community | Native but incomplete | Student OS logic is local-first and tested; membership claim and enforcement have RPC, UI and checks. Official data cannot sync | RG-24, RG-26, RG-07 |
| B. Teaching and learning | Native but incomplete | Gradebook and Course Studio built; gradebook flag off everywhere; no faculty shell | RG-32, RG-12 |
| C. Student success and services | Mixed: native but incomplete (dining, support, moderation, listings); not started (advisor caseload) | Share-with-advisor is the only advisor flow | RG-27 |
| D. Academic and institutional administration | Native but incomplete | Registration transaction and control-plane backends exist; SSO, SCIM, rollout and offboarding have no screens | RG-24, RG-01, RG-37 |
| E. Commercial, partner, developer | Planned (developer, partner); native but incomplete (buyer intake, trust room) | No developer or partner principal | RG-22 |
| F. Semester company | Native but incomplete | Console approvals, audit, support, break-glass exist and have not run in production; most console views not started | RG-05, RG-06, RG-28 |

## P0 workflows

| # | P0 item | Class | Evidence | Needs |
| --- | --- | --- | --- | --- |
| 1 | Account, profile, tenant, membership, role, capability model | Native and verified at the model; needs migration and reconciliation across vocabularies | `role_grants`, `has_capability`, checks | RG-01, RG-02, RG-03 |
| 2 | Server-side policy, consent, classification checks | Native but incomplete | per-feature consent; no shared decision function | decision function |
| 3 | Audit standard and explorer | Native but incomplete | Console audit hash chain and explorer; no common schema | RG-19 |
| 4 | Tenant-aware shell, role navigation, states | Static prototype only for roles (preview); needs accessibility review | `RoleWorkspace` is fixtures | RG-12, RG-13, RG-25 |
| 5 | Student self-serve and linked accounts | Native but incomplete | `SchoolClaim`, carousel | RG-26 |
| 6 | Institution SSO, invitation, account linking | Native but incomplete (backend); needs institutional approval | SCIM and SSO policy tables, no admin UI | admin UI |
| 7 | Student onboarding to first action | Native but incomplete | carousel; no events | RG-26, RG-31 |
| 8 | Advisor basics | Not started (caseload); native (student share) | | RG-27 |
| 9 | Registrar registration readiness | Native but incomplete; integrated-only for official handoff | transaction, desk; no feed | RG-24 |
| 10 | Institution admin configuration | Native but incomplete | Modules, Configuration Studio, membership | RG-17, RG-37 |
| 11 | Ops Inbox, My Work, Approvals, Tenant and Customer 360, pilot, support | Mixed: support and approvals native; rest not started | | RG-28, RG-05 |
| 12 | Integration registry, source and freshness, health, reconciliation | Native but incomplete; no adapter | `IntegrationDashboard`, `lib/integration/*` | RG-24 |
| 13 | Rollout, flags, kill switch, incident runbook | Native but incomplete; static runbook | `tenant_rollout`, `feature_kill_switch` | RG-29, RG-30 |
| 14 | Activation analytics without record content | Designed or documented only | | RG-31 |
| 15 | Docs, tests, release gates, support procedures | Native but incomplete | 115 SQL checks; ruleset unconfirmed | RG-16 |

## Cross-cutting classifications

| Subject | Classification |
| --- | --- |
| Console `console_act` duties without an executor | Unsafe to activate for eight duties until executors exist (RG-05) |
| Operator writes to kill switch, provider and GTM tables | Needs security and privacy review (RG-06) |
| Anonymous table privileges | Fix landed on main as a migration (D-1306); application to the live project unverified (RG-08) |
| Edge Function authorization | Needs security and privacy review (RG-09) |
| Staff screens | Needs accessibility review; no automated coverage |
| `ControlPlane` consent and audit counts | Static prototype only (RG-17) |
| Institutional preview shell and role workspaces | Static prototype only |
| `ROLE-PERMISSION-MATRIX.md`, `SEMESTER_ROLE_CATALOG.md` counts | Duplicate or stale (RG-20) |
| `app_admins` | Duplicate or stale; unsafe to extend (RG-01) |
| Live domain versus canonical backend | Needs migration and reconciliation (RG-15) |

## Owners

Every seat names Harrison Rubin; every backup is unassigned; independent assessor, counsel, customer approver and backup cannot be the same person ([`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md)). Go or no-go for a paid pilot and broad sale is NO-GO as of 2026-10-03 ([`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)); nothing in this audit changes that.

## Release-gate criteria per role (minimum)

A role moves up the ladder only when the register's evidence for the next rung exists: usable needs role screens and workflow; secure needs positive and negative authorization tests; supportable needs training, runbook, audit trail, support routing and recovery; launch-approved needs the role's acceptance criteria and sign-off by someone other than its builder. This audit adds one requirement: the four-test set (provision, positive, negative, revocation) is sorted per role before a role is promoted past secure.
