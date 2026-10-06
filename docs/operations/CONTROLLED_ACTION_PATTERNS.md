# Controlled action patterns

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision.

Every high-impact change in either operating system uses one eleven-step pattern. It already exists in part in `public.request_approval`, `decide_approval` and `console_act` ([`docs/OPERATIONS-CONSOLE-MAP.md`](../OPERATIONS-CONSOLE-MAP.md), [`docs/DECISION-RIGHTS.md`](../DECISION-RIGHTS.md)). This page names the pattern once, says which steps are built, and gives each high-impact action its row. It does not replace the console map, which is rendered from `app/src/lib/ops/console.ts` and wins on any disagreement.

## 1. The pattern and where each step stands

```
request → policy/capability/consent validation → authoritative-data check → impact preview
→ approval if required → idempotent command → immutable audit → outbox/domain event
→ read-model update → notification → receipt/history → rollback or remediation path
```

| # | Step | Mechanism today | State |
| --- | --- | --- | --- |
| 1 | Request | `request_approval(duty, subject, evidence, ticket)`; tenant and operator derived server-side | Built |
| 2 | Policy, capability, consent | In-body `private.has_capability(cap, scope_kind, scope_id)`; `console:operate` is a read key only, never a write key; consent for support via `support_access_grant` | Built; `my_capabilities()` ignores break-glass (defect) |
| 3 | Authoritative-data check | Not a step in `console_act` | **Missing** — the command must re-read the source row and refuse if its version/freshness differs from the preview |
| 4 | Impact preview | `ActionPreview` exists in `components/unity/` for students; no operator preview | **Missing** for operators |
| 5 | Approval | `decide_approval`: requester ≠ approver, two distinct approvers where the duty says so, fresh MFA (15 min) | Built |
| 6 | Idempotent command | `console_act` records `console_action_record`; platform primitive `gateway/idempotency.ts` | Built for 3 duties; no client idempotency key on the others |
| 7 | Immutable audit | `private.console_audit_write` first; if it fails nothing else happens | Built; **0 production rows** |
| 8 | Outbox/domain event | `private.domain_outbox_events` + unique index on (aggregate, idempotency key) | Table built; **no producer for console actions, no relay** |
| 9 | Read-model update | None | **Missing** (projection foundation) |
| 10 | Notification | `support_notification_outbox` worker is the only real one | Missing for approvals |
| 11 | Receipt, history, rollback | `console_action_record`; rollback is per action (§3) | Partial |

**Executors.** `console_act` executes only `role-grant`, `tenant-suspension` and `break-glass`. The other eight duties (`tenant-policy`, `integration-config`, `release`, `data-deletion`, `ai-provider`, `evidence-release`, `refund`, `support-access`) are approved and recorded but have **no executor**, and several have a direct write path that skips approval entirely (F-1, [`SECURITY_EXPOSURE_CLASSIFICATION.md`](../ops/SECURITY_EXPOSURE_CLASSIFICATION.md)). Until F-1 is closed, no screen may say an action "cannot bypass approval".

## 2. Contract for a controlled action

A new controlled action is specified with this sheet, in the pull request, before code:

| Field | Content |
| --- | --- |
| Action id and duty | e.g. `release.cohort_deploy` → duty `release` |
| Requester capability and scope | existing capability from the permission matrix, or a ⊕ proposal with its reason |
| Subject | the row(s) changed, by canonical id |
| Authority check | which source is authoritative and how stale it may be; `unknown` blocks |
| Impact preview | a count, a diff, and the named people/tenants affected; computed server-side, hashed, and bound into the approval |
| Approval class | none / one / two-person / two-person + counsel; per [`coo/03`](coo/03-raci-and-decision-rights.md) |
| Idempotency | client key + server key; a replay returns the original receipt |
| Audit events | names, minimum fields (actor, tenant, subject, preview hash, outcome, correlation id); **no content** |
| Event | outbox event name and consumers |
| Read models invalidated | projection names |
| Notification | who, via which consented channel |
| Receipt | what the operator sees and keeps |
| Rollback or remediation | reversal command, its own approval class, and what cannot be reversed |
| Test | authorisation, scope, replay, audit-before-effect, preview-hash mismatch, expiry |

Two rules from the brief that are enforced by test, not by convention: **audit is written before the effect and the call fails if it cannot be**, and **a preview whose hash no longer matches the live state refuses the command** (the second is new work).

## 3. High-impact actions

"Reversible" is the strongest honest word: *reversible* (undo restores the prior state), *compensable* (a new action offsets it, history retained), *irreversible* (needs the highest class and a wait).

| Action | Duty | Approval | Preview shows | Rollback | Today |
| --- | --- | --- | --- | --- | --- |
| Enable a module for an institution | `tenant-policy` | one + entitlement present | modules, mode (observe/assist/author), data classes touched, students affected | reversible — previous `tenant_module_mode` | direct write (F-1) |
| Grant elevated support access | `support-access` / `break-glass` | student consent / two-person + ticket + MFA | student, scope, expiry ≤ 4 h, review due | reversible — close grant; review mandatory | built |
| Change a degree-requirement rule | `tenant-policy` (academic) | two-person: registrar + academic affairs ⊕ | requirement, students whose audit changes (count + sample ids) | reversible — prior config version; **student-visible results recompute** | Configuration Studio two-person publish built |
| Release grades | ⊕`grade-release` | faculty + department rule | section, count, release time, notification list | compensable — correction record; a release cannot be silently withdrawn | not built |
| Issue a large credit or refund | `refund` | two-person above threshold (OD-4) | account, amount, reason, ledger effect | compensable — reversing entry | no executor; commercial tables append-only |
| Switch integration from observation to authoritative sync | `integration-config` | two-person + dual-run gate passed | mapping version, row counts, reconciliation delta, source freshness | reversible — back to observation; SIS stays authority during dual run | direct DML (F-1) |
| Activate AI tools for a course or institution | `ai-provider` | one + privacy review class | surfaces, data sources, budget, provider | reversible — per-tenant off | direct write (F-1) |
| Migrate academic records | ⊕`records-migration` | two-person + counsel for authoritative cutover | source snapshot hash, counts, exceptions | irreversible once authoritative; reversible only before cutover gate | planning only |
| Change a retention policy | `tenant-policy` (retention) | two-person + counsel | classes, shortened/lengthened, records that would become eligible | compensable only if lengthening; **shortening can destroy** → irreversible class | sweeps exist; policy write unspecified |
| Deploy a feature cohort | `release` | one for standard, two for high-risk flags | flag, cohort, tenants, kill-switch path tested | reversible — kill switch | read-only tab; direct kill-switch write |
| Declare or resolve an incident | ⊕`incident:command` | declare: one; resolve SEV1–2: second person where one exists | affected tenants and capabilities | n/a (status change; history retained) | no table |
| Suspend a tenant | `tenant-suspension` | two-person | users affected, in-flight actions | reversible | built |
| Grant a role | `role-grant` | per scope; platform scope two-person | grants after the change | reversible — revoke | built |

## 4. Patterns that sit around the action

- **Read-only by default.** Every console opens read-only; write controls appear only with the capability, and say *Production change. This will affect a live customer.* ([console map](../OPERATIONS-CONSOLE-MAP.md#the-context-bar)).
- **Optimistic UI allow-list.** Only acknowledge, assign, personal view, internal note, mark seen, non-sensitive draft. Everything else waits for the server (permission matrix §5).
- **Dual control with one person.** While a seat is `UNASSIGNED`, a two-person duty cannot complete. That is the correct outcome: the console must show "waiting for a second approver" rather than offer a bypass. The decision on a temporary external approver is OD-5.
- **Expiry over revocation.** Elevated access, preview tokens and approvals all expire; none is open-ended.
- **Receipts are content-free.** A receipt names the action, the subject id, the preview hash and the outcome. It never contains a student's data.
