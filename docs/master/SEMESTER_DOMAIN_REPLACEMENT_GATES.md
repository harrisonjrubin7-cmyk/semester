# Semester domain replacement gates

<!-- Rendered from docs/master/tools/domains.py by docs/master/tools/render.py. Edit the data, then run `python3 docs/master/tools/render.py` from the repository root. -->

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** Everything here is a reading of the repository at origin/main 790ebbf on 2026-10-05, from read-only audits. Nothing was run in production, and no row is evidence of an activated tenant, a customer, or an approved claim. "Verified" means held by an automated test in this repository. It does not mean operating, supported, secure, accessible or approved. The repository's own registers hold the same ceiling ([`PRODUCT-STATUS-MAP.md`](../PRODUCT-STATUS-MAP.md), [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)).

## Doctrine

**Build everything natively. Integrate responsibly. Replace only with proof. Operate every domain as one system.**

This page makes "only with proof" testable. It extends, and does not replace, [`docs/DOMAIN-REPLACEMENT-REGISTER.md`](../DOMAIN-REPLACEMENT-REGISTER.md) (rendered from `app/src/lib/replaceregister.ts`), which already counts a domain replaceable only when its native row and all fifteen replaceability requirements are `tested`. **Today: 0 of 14.** The five requirements that stop every domain are `r-lifecycle`, `r-migration`, `r-change`, `r-contract` and `r-exit`.

Do not replace official institutional records, identity, registration, grades, financial accounts, legal processes or high-stakes decisions without formal institutional authority, migration, reconciliation, audit, rollback and operational readiness. Semester never replaces an emergency-response system.

## Four ways a domain runs

From D-143: (1) Semester runs it natively; (2) Semester synchronises and governs a transitional external domain; (3) a partner supplies regulated infrastructure; (4) an official handoff until native replacement is authorised. A domain is in exactly one mode per tenant.

## The four stages a capability passes

| Stage | Meaning | Exit evidence (all current, under `docs/evidence/`) |
| --- | --- | --- |
| G-A Ready for pilot | A named tenant and cohort can use it with synthetic or approved data, without it becoming the record | Signed pilot agreement; approved data scope and map; named customer and Semester owners (both seats filled, a backup each); accessibility evaluation of the in-scope screens; tenant-isolation negative suite green for every object class touched; restore of the touched data measured; support route staffed; kill switch drilled; claims limited to the claim library; counsel-reviewed paper (EXT-002, EXT-003) |
| G-B Ready for production | Pilot exit criteria met; may serve the tenant's real users | Pilot scorecard met against pre-agreed outcomes (docs/commercial/PILOT-SCORECARD.md); no open High finding; independent security assessment complete (EXT-006); alerts reach a person and were tested (EXT-010); target-environment drills (EXT-011); SLO measured for 30 days; DPA executed; subprocessors approved; rollback rehearsed |
| G-C Ready to become authoritative system of record | Institution may retire the external system for this domain | All fifteen replaceability requirements tested; institution's board or officer authorises in writing; reconciliation clean for the agreed number of terms; two-person approvals enforced in the database; rollback rehearsed within the last 90 days; exit and offboarding export verified; named steward; legal review; auditor or registrar sign-off where the domain is regulated |
| G-D Repeatable | A second tenant adopts it without bespoke engineering | Time-to-activate measured on two tenants; runbook used by someone other than its author (L9) |

Nothing has passed G-A. The paid institutional pilot and broad enterprise sale are NO-GO / RED and the design-partner pilot is GO / GREEN for non-activation engagement only (`GO-NO-GO-DECISION.md`, 2026-10-03).

## The twenty release and replacement gates

No feature, domain, migration or institutional capability is complete until it has all twenty (master brief, section 16). The "where it is held" column says what in this repository would carry the evidence; "typical gap" is true of most domains today.

| # | Gate | Where it is held | Typical gap today |
| ---: | --- | --- | --- |
| 1 | Product requirement | `docs/product/capability-registry.md` | requirement exists; no named customer need |
| 2 | Design specification | `docs/design/`, domain design pages | present for most domains |
| 3 | Accessibility review | `app/src/a11y/` (automated); EXT-008 (human) | **no human evaluation; no ACR** |
| 4 | Data classification | `database/DATA_CLASSIFICATION_REGISTER.md` | classes rule-derived, not reviewed |
| 5 | Permission model | `docs/ROLE-PERMISSION-MATRIX.md` (69 roles, 84 capabilities) | present; attribute rules live in policies |
| 6 | Tenant isolation | `database/TENANT_ISOLATION_MATRIX.md`; `docs/security/TENANT-ISOLATION-VERIFICATION.md` | **no negative suite per object class; isolation off for every school (F-01)** |
| 7 | Source authority | `docs/platform/PRIMITIVES.md`; source states | label exists; not a rule |
| 8 | Audit model | `audit_event`; ADR-0007 | not tamper-evident everywhere (F-10) |
| 9 | Security threat model | `docs/security/THREAT-RECORD-TEMPLATE.md`; `docs/trust/THREAT-MODEL.md` | template; few per-feature records |
| 10 | Privacy/retention plan | `docs/trust/DATA-RETENTION-AND-DELETION-STANDARD.md` | counsel review open |
| 11 | AI policy, if AI is involved | `docs/ai-toolkit/`, `docs/operating-model/AI-LIFECYCLE-GATES.md` | evals thin; BYOK bypass (F-04) |
| 12 | Integration plan | `docs/INTEGRATION-CONTROL-PLANE.md` | no real connection |
| 13 | Migration plan | `docs/DATA-MIGRATION-PLAN.md`; `docs/platform/MIGRATION.md` | no rehearsal with real data |
| 14 | Rollback plan | `ROLLBACK.md`; `RESTORE.md` | **restore never run on production** |
| 15 | Support playbook | `docs/support/` | one person; no staffed route |
| 16 | Monitoring/SLO | `docs/sre/` | **RTO/RPO unmeasured; no alert reaches a person** |
| 17 | Test suite | `app/src/**/*.test.*` (1,340 files); `supabase/*.check.sql` (111) | strong at repo level; main CI red 26 of last 30 |
| 18 | Documentation | `docs/` (about 300 pages) | drift between registers (see capability matrix) |
| 19 | Release evidence | `docs/evidence/` | a handful of repo-scoped or one-observation items; no external evidence |
| 20 | Owner and review date | `OWNER-AND-ACCOUNTABILITY-MATRIX.md`; `docs/documentation/` cards | one person is owner and reviewer; backups unassigned |

## The fifteen replaceability requirements

Verbatim ids from `replaceregister.ts` as of its 2026-09-29 reading.

| Id | Requirement | Status | Gap |
| --- | --- | --- | --- |
| `r-record` | Authoritative data ownership | tested | every domain names an external record-holder |
| `r-lifecycle` | Lifecycle management | building |  |
| `r-roles` | Roles and permissions | tested |  |
| `r-approvals` | Approvals and separation of duties | tested |  |
| `r-audit` | Audit | tested |  |
| `r-migration` | Migration | building |  |
| `r-parallel` | Parallel run | tested |  |
| `r-reconcile` | Reconciliation | tested |  |
| `r-reporting` | Reporting | tested |  |
| `r-export` | Export and portability | tested |  |
| `r-a11y` | Accessibility | tested |  |
| `r-recovery` | Recovery | tested | production has never been restored |
| `r-change` | Change management and training | designed | no training exists for any role |
| `r-contract` | Contract and SLA | building | no signed SLA |
| `r-exit` | Exit and offboarding | building |  |

## Per-domain gate status

Readiness and open review flags come from `domains.py`. "Authority gate" is what the institution or a regulator must supply and the product cannot.

| ID | Domain | Mode today | Readiness | Open review flags | Authority gate |
| --- | --- | --- | --- | --- | --- |
| D01 | Student OS | Split | Conditional: invitation-only individual validation | SEC, PRIV, A11Y | n/a |
| D02 | Workspace and productivity | Native (own data) | Conditional: invitation-only individual validation | SEC, PRIV, A11Y | n/a |
| D03 | Path and degree planning | Handoff / connect (external is record) | Not ready | SEC, PRIV, A11Y, INST, MIG, REC | Institution approves catalog and rule authoring; registrar signs the audit parity report; two-person approval for rule publication. |
| D04 | Course Studio and LMS | Handoff / connect (external is record) | Unsafe to activate | SEC, PRIV, A11Y, INST, MIG, REC, RBK | LMS replacement for a course needs: faculty adoption sign-off, assessment/gradebook parity (D05), accessibility evaluation, records retention parity, rollback to LMS. |
| D05 | Learning evidence, assessment and gradebook | Handoff / connect (external is record) | Unsafe to activate | SEC, PRIV, A11Y, INST, REC, RBK | Institutional authority to hold the gradebook of record; registrar sign-off; immutable version history verified; passback reconciled for a full term. |
| D06 | AI gateway and copilot | Native (own data) | Not ready | SEC, PRIV, A11Y, INST | n/a |
| D07 | Search and knowledge graph | Native (own data) | Not ready | SEC, PRIV, A11Y | n/a |
| D08 | Faculty experience | Handoff / connect (external is record) | Not ready | SEC, PRIV, A11Y, INST | n/a |
| D09 | Advisor and student success | Handoff / connect (external is record) | Not ready | SEC, PRIV, A11Y, INST | Office head approves case workflow; privacy review of notes retention. |
| D10 | Registrar and academic operations | Handoff / connect (external is record) | Unsafe to activate | SEC, PRIV, A11Y, INST, MIG, REC, RBK | Institution board or registrar authorises; effective-dated policy versioning; two-person approvals; reconciliation for two terms; rollback rehearsed. |
| D11 | Academic records and grade ledger | Handoff / connect (external is record) | Unsafe to activate | SEC, PRIV, A11Y, INST, MIG, REC, RBK | All 15 replaceability requirements tested; institutional authority; legal review; reconciliation; rollback; named steward. |
| D12 | Registration and enrollment | Handoff / connect (external is record) | Unsafe to activate | SEC, PRIV, A11Y, INST, MIG, REC, RBK | As D10 plus load evidence and a registrar-run rehearsal. |
| D13 | Student finance, accounts and payment plans | Handoff / connect (external is record) | Unsafe to activate | SEC, PRIV, A11Y, INST, MIG, REC, RBK | Institutional finance authority; auditor review; reconciliation for a full term; payment-provider contract; rollback. |
| D14 | Financial aid and scholarship handoffs | Handoff / connect (external is record) | Not ready | SEC, PRIV, A11Y, INST | Counsel; aid-office authority; regulator-aware controls. |
| D15 | Campus life and services | Handoff / connect (external is record) | Not ready | SEC, PRIV, A11Y, INST | n/a |
| D16 | Housing | Handoff / connect (external is record) | Not ready | SEC, PRIV, A11Y, INST | Institution authority; partner contract. |
| D17 | Dining | Handoff / connect (external is record) | Not ready | SEC, PRIV, A11Y, INST | Partner contract; institutional approval. |
| D18 | Events | Handoff / connect (external is record) | Not ready | SEC, PRIV, A11Y, INST | n/a |
| D19 | Community and organizations | Native (own data) | Unsafe to activate | SEC, PRIV, A11Y, INST | n/a |
| D20 | Accessibility services | Handoff / connect (external is record) | Not ready | SEC, PRIV, A11Y, INST | Institution DS authority; legal review. |
| D21 | Safety and emergency handoffs | Handoff / connect (external is record) | Unsafe to activate | SEC, PRIV, A11Y, INST | Never replaces emergency response. |
| D22 | Library and research | Handoff / connect (external is record) | Not ready | SEC, PRIV, A11Y, INST | n/a |
| D23 | Career, employer and alumni | Split | Not ready | SEC, PRIV, A11Y, INST | n/a |
| D24 | Family and guardian grants | Native (own data) | Unsafe to activate | SEC, PRIV, A11Y, INST | n/a |
| D25 | Institutional governance and configuration | Native (own data) | Not ready | SEC, PRIV, A11Y, INST | n/a |
| D26 | Identity, SSO and SCIM | Handoff / connect (external is record) | Unsafe to activate | SEC, PRIV, A11Y, INST, MIG | IdP replacement is not proposed: Semester integrates with the institution's identity provider. |
| D27 | Integrations, LTI, OneRoster and Edu-API | Native (own data) | Unsafe to activate | SEC, PRIV, INST, MIG, REC | n/a |
| D28 | Privacy, retention and legal holds | Native (own data) | Not ready | SEC, PRIV, INST | n/a |
| D29 | Security, audit and incident response | Native (own data) | Not ready | SEC, PRIV | n/a |
| D30 | Trust, compliance and HECVAT | Native (own data) | Not ready | SEC, PRIV, A11Y, INST | n/a |
| D31 | Operations Command Center | Native (own data) | Not ready | SEC, PRIV, A11Y | n/a |
| D32 | Commercial, billing and customer success | Native (own data) | Not ready | SEC, PRIV, INST | n/a |
| D33 | Marketing, sales and the company site | Company-internal | Not ready | SEC, PRIV, A11Y | n/a |
| D34 | Developer platform | Native (own data) | Not ready | SEC | n/a |
| D35 | Marketplace and partners | Native (own data) | Not ready | SEC, PRIV, INST | n/a |
| D36 | Data, analytics and outcomes | Native (own data) | Not ready | SEC, PRIV, A11Y, INST | n/a |
| D37 | Reliability, SLO and release operations | Company-internal | Not ready | SEC, RBK | n/a |
| D38 | People, hiring and company operations | Company-internal | Not ready | none | n/a |
| D39 | Finance, runway and board reporting | Company-internal | Not ready | PRIV | n/a |
| D40 | Globalization, localization and accessibility expansion | Company-internal | Not ready | PRIV, A11Y, INST | n/a |

## Regulated and never-native domains

| Domain | Position |
| --- | --- |
| Emergency response (D21) | Semester is a handoff to the institution's protocol and never the system. |
| Financial aid (D14) | Handoff. The register says not to claim native until regulatory expertise exists. |
| Payments (D13) | Hosted provider only; raw card data is never stored; Semester stays out of PCI scope. |
| Identity provider (D26) | Not replaced; Semester integrates with the institution's IdP. |
| Health and counselling records | Out of scope; handoff only (`docs/DO-NOT-BUILD.md`). |
| Legal processes | Counsel owns; Semester provides workflow and evidence only. |

## Pilot checklist (G-A) as a form

```
Tenant:                      Cohort:                    Domain(s):
[ ] signed pilot agreement   [ ] data scope + map       [ ] named owner (both sides) + backups
[ ] isolation negatives green for touched objects         [ ] restore measured for touched data
[ ] accessibility evaluation of in-scope screens          [ ] kill switch drilled
[ ] support route staffed + status page                   [ ] claims limited to the library
[ ] counsel-reviewed paper                                [ ] exit/offboarding export rehearsed
Reviewer who is not the owner: ______   Date: ______
```
