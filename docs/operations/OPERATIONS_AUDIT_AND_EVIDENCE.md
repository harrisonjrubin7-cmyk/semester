# Operations audit and evidence

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision.

> **Claim ceiling.** The audit machinery is built and tested; it has not run in production. `private.console_audit_event` held **0 rows** at the Phase 0 read ([`OPERATIONS_CONSOLE_CURRENT_STATE.md`](../ops/OPERATIONS_CONSOLE_CURRENT_STATE.md)), and nearly every operational table is empty. Until a real action has been audited, sealed and verified end to end, no document may say the audit trail "works" in the operated sense. The independent review that would otherwise corroborate it does not exist.

## 1. What is built

| Mechanism | What it gives | Where |
| --- | --- | --- |
| `private.console_audit_event` | Append-only, hash-chained; HMAC-keyed daily seals (manifest); `console_audit_verify`; triggers `chain_…` and `keep_…_immutable` | `20260929100000_console_control_plane.sql` |
| `private.console_audit_write` | The only console writer, `private.record_audit` executable by service role only; **`console_act` writes the audit event first and fails closed** | `console_approvals_and_break_glass` |
| `public.audit_event` | General envelope (`tenant_id`, `correlation_id`, `action`, `object_sha256`, `actor_sha256`, `outcome`); `keep_audit_event_immutable`; read needs `audit:read` at the school | migrations |
| `private.ledger_chain*` | A second hash chain for the ledger; seals checked by `ledger-seals.check.sql` | migrations |
| Per-domain audit tables | `tenant_policy_audit_event`, `provisioning_audit_event`, `registration_audit_event`, `moderation_audit_event`, `support_access_event`, `role_grant_audit_event`, `family_access_events`, `trust_room_access_log`, `*_history` | various |
| Console Audit tab | Chain status (rows, head hash, last seal, last verification) + recent events; **every read is itself an audit event and the view says so** | `Console.tsx` |
| Erasure | Erasing a person scrubs their identifiers from audit copies (`20261004190000`), so audit is immutable *and* erasable by design | migration |

## 2. The audit event standard

One envelope for every operations event, regardless of which table stores it. The columns exist in `audit_event` and `console_audit_event`; where a domain table lacks one, the domain's events are mapped to the envelope by a projection, never by editing the domain table.

| Field | Rule |
| --- | --- |
| `event_id`, `occurred_at` | server-assigned |
| `tenant_id` | the tenant acted upon; null only for company-internal events |
| `actor` (hashed id) + `actor_role` + `session` | server-derived; never client-supplied; service actors named |
| `capability` + `scope` | the grant relied on (the one thing an auditor needs to ask "was this allowed?") |
| `action` | `domain.verb`, from the catalog in §3; a new action is added to the catalog in the same pull request |
| `subject` | canonical id of the row acted on; **never the row's content** |
| `preview_hash`, `approval_ids` | for controlled actions: what was previewed and who approved |
| `idempotency_key`, `correlation_id` | ties retries and the saga together |
| `outcome` | `allowed`, `denied`, `failed`, with a reason code |
| `source_system`, `authority`, `freshness_at_decision` | what data the decision relied on |
| `classification` | highest class touched (T0–T3; T4 never logged) |
| `prev_hash`, `hash` | chain |

**Content-free rule.** Audit rows carry identifiers, hashes and reason codes, never a student's text, grade value, message body or AI prompt. The AI audit tables already pass `ai-audit-content-free.check.sql`; every new event type gets the same check. A view of the subject goes through the subject's own RLS, so the audit explorer is not a back door to content.

**Sensitive-read events.** Reading a data class at or above T2, an amount, an export, or a support thread is itself an event (`*.viewed`). The explorer shows who looked.

## 3. Event catalog (operations)

Existing events are named by their table; proposed ones are marked ⊕. The catalog lives in code (a typed register with a test that every `console_act` executor, every `ops_*` sensitive read and every workflow in [`OPERATIONS_WORKFLOW_CATALOG.md`](OPERATIONS_WORKFLOW_CATALOG.md) emits a catalogued event), and this table is rendered from it once built.

| Domain | Events |
| --- | --- |
| Tenant | `tenant.created`⊕, `tenant.lifecycle_changed`⊕, `tenant.suspended` |
| Access | `role.granted/revoked/expired` (`role_grant_audit_event`), `break_glass.opened/closed/reviewed`, `access_review.attested`⊕, `support_access.granted/used/ended` |
| Approval | `approval.requested/decided/acted` |
| Config and flags | `config.version_published`, `module_mode.changed`, `rollout.cohort_changed`, `killswitch.engaged` |
| Integration | `connection.approved`, `mapping.approved`, `sync.exception_resolved`, `deadletter.replayed`⊕, `authority.switched`⊕ |
| Data rights | `dsr.received/answered`, `hold.placed/released`, `retention.policy_changed`⊕, `offboarding.*` |
| Commercial | `quote.issued`⊕, `contract.recorded`⊕, `entitlement.changed`, `invoice.issued`, `refund.requested/issued`⊕ |
| Release and incident | `release.promoted/rolled_back`, `incident.declared/escalated/resolved`⊕, `postmortem.published`⊕ |
| Institution | `registration.readiness_viewed`⊕, `registration.override_granted`, `requirement.version_published`, `grade.released`⊕, `outreach.sent`⊕, `moderation.*`, `account.*`⊕ |
| Console itself | `audit.read`, `audit.export`⊕, `evidence.released` |

## 4. Audit explorer

A Console view (`audit`, exists in part). Target contract (`ops_audit_search`, P0): filter by tenant (scope-bound), actor, action, subject id, capability, outcome, time; each row shows the envelope above and a "verify chain" affordance; export is a **controlled read** (capability + audit event + watermark + row cap). A tenant's own admin sees only that tenant's events at `audit:read`; Semester staff see platform events with `console:operate` + ⊕`audit:platform`. Fields the caller's capability does not cover are omitted and listed in `warnings`, per the console convention.

## 5. Tamper evidence and verification

1. Chain hash on every insert; daily HMAC seal over the day's head; `console_audit_verify` recomputes.
2. **Verification must be run on a schedule and its result recorded** (today it is a function and a button). The cadence and the alert on failure are a P0 task: a seal that is never verified is decoration.
3. Seal keys are held outside the database's client roles; rotation and the key custodian are an open decision (OD-8). With one person, the custodian is the founder, recorded as such.
4. An export of the chain head and seals to an external write-once location would make the founder-as-custodian risk visible to a third party; recommended before the first pilot, not yet decided.

## 6. Evidence

Evidence is what lets a statement be made. It is distinct from audit: audit records what the *system* did; evidence records what was *shown to be true* (a restore exercise, an access review, a pen-test, a signed agreement).

- **Register.** Console Evidence view and [`docs/EVIDENCE-REGISTER.md`](../EVIDENCE-REGISTER.md) / [`docs/trust/EVIDENCE-REGISTER.md`](../trust/EVIDENCE-REGISTER.md). Each record: id, what it supports (claims, controls, gates), owner seat, collected at, **expires at**, escalation step, location/hash, independence (`self-attested` vs `independent`), and the claims resting on it.
- **Rule.** Expired or missing evidence turns the gate and any claim resting on it red; the Command center already does this for release evidence (a missing restore proof renders NOT GO).
- **Independence is stated.** One-person company: every evidence record is `self-attested` until an external party reviews it. That is a label, not a failure, and it must be on screen.
- **External evidence queue.** 0 of 18 items closed at the last count (3 partial, 8 open, 7 blocked): [`docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md`](../finalization/EXTERNAL-EVIDENCE-QUEUE.md). Those, not new documents, are what move a readiness score.
- **Release.** Releasing evidence to a customer's reviewer is the `evidence-release` duty and a time-limited trust-room grant with an access log.
- **Public claims.** A public statement must trace to an approved row in [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md); withdrawal follows [`CLAIM-WITHDRAWAL-RUNBOOK.md`](../CLAIM-WITHDRAWAL-RUNBOOK.md).

## 7. Risk

Five risk registers exist as documents (`LAUNCH-RISK-REGISTER.md`, `docs/program/RISK_REGISTER.md`, `docs/company/RISK-REGISTER.md`, `docs/strategy/RISK-REGISTER.md`, [`docs/master/SEMESTER_RISK_REGISTER.md`](../master/SEMESTER_RISK_REGISTER.md)); the master one says *source rows win*. The Risk Register view (P1) reads one projection built from those source rows with owner, review date and linked evidence, and does not introduce a sixth list. Until then, risks specific to this operating system are in [`OPERATIONS_ROADMAP.md`](OPERATIONS_ROADMAP.md#risk-register) and are *additive rows to propose upstream*, not a parallel register.

## 8. Retention and legal holds

Audit retention is set per class by counsel (none engaged). Defaults proposed for review: security and access events seven years; operational events two years; outbox published rows ninety days (B-05). A legal hold suspends every sweep (`hold-*-sweeps` checks prove it for the existing sweeps; a new sweep adds its check). Erasure scrubs identifiers in audit copies and leaves the event, so the chain remains valid.

## 9. Acceptance

The audit and evidence layer is *operated* when: a real controlled action has produced a chained event, been sealed, and verified on the schedule; the explorer returned it to an authorised tenant admin and refused it to another tenant's; the export left a `audit.export` event; the evidence register shows one independent item; and the sensitive-read events appear for a support-content view. Each of these is a single gate line in [`OPERATIONS_RELEASE_GATES.md`](OPERATIONS_RELEASE_GATES.md).
