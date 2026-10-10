# Native workflow catalog

**As of** 2026-10-05 · **Base** `origin/main` `3bd382dc`

> **Claim ceiling.** A workflow is "in code" when a command and a screen exist. It is not operating, reconciled, or authoritative. The design catalog's 319 steps and the 203 that are not fully built stay in [`docs/master/SEMESTER_GAP_REGISTER.md`](../master/SEMESTER_GAP_REGISTER.md). This file is the PDF's own workflows.

## 1. Student daily loop

PDF: open → situation → next priority → action → source-aware guidance → confirmation → progress → return.

| Step | Where | Class |
| --- | --- | --- |
| Open | `home` / `Today.tsx` | Native but incomplete |
| Situation | Today tabs: due, hours, week | Native but incomplete. Seeded data risk |
| Next priority | today-center | Native but incomplete |
| Action | Destination the card links | Varies by domain |
| Source-aware guidance | `lib/source.ts`, provenance chips | Native but incomplete until every card uses them |
| Confirmation | Per-screen toasts and receipts | Inconsistent |
| Progress | `brief` reports, pathway | Student-owned |
| Return | Same app | Native |

**Not ready for pilot.** The loop is the right product shape for invitation-only individual use (D01 conditional). It is not an institutional pilot.

## 2. Registration engine

PDF: section select → term → window → holds → prerequisites → co-requisites → credit limit → capacity → override → enrol / waitlist / deny / approval → ledger → receipt → plan refresh.

| Check | Evidence | Class |
| --- | --- | --- |
| Term and window | `registrar_put_term`, registration opening enforced on the server | Partial |
| Holds | Table exists, no client policy, adapter list empty | Not operating |
| Prerequisites | Codes on the section | Partial |
| Co-requisites | Not found | Not started |
| Credit limit | Not re-verified this pass | Unverified |
| Capacity | Section fields | Partial |
| Decision | `registration_enroll` / drop / withdraw, `registrar_decide` | Unsafe to activate |
| Audit and receipt | Audit pattern expected; projection worker absent | Incomplete |
| Plan refresh | No read-model refresh found | Not started |

**Authority:** SIS. **Class:** unsafe to activate. **Institutional approval, dual-run, rollback:** required and absent.

## 3. Academic record ledger

PDF: immutable entries, effective dates, source, approval, corrections, superseded values, rationale, audit, export, retention, legal hold.

| Piece | Evidence | Class |
| --- | --- | --- |
| Entries and changes | `academic_record_entries`, `academic_record_changes` | Schema present, estimated live rows not in the nonempty prefix list |
| Chain | `20260930110000_ledger_chains.sql`, seals migration | Native but incomplete |
| Legal hold | `legal_holds`, hold-aware sweeps | Native but incomplete |
| Transcript | Code says it does not issue one | Not a transcript |
| Two-person correction | Human override and approval tables exist | Not proven on this ledger |

**Class:** unsafe to activate. **Not authoritative.**

## 4. Support

PDF: question → search → request → category and urgency → safe context → office → owner → response → escalation → resolution → confirmation → quality.

| Step | Evidence | Class |
| --- | --- | --- |
| Search / help | `help`, `Help.tsx` | Native but incomplete |
| Request | `open_support_ticket`, `open_help_request` | Native but incomplete |
| Queue | `support_ticket_queue`, console Support tab if granted | Native but incomplete |
| Reply audit | `20261001221500_support_reply_audit.sql` | Present |
| Consent on notify | `20261003120000_support_notification_consent_boundary.sql` | Present |
| Escalation owner, quality, root cause | Gap register: root cause not stored; incident roles not assigned | Partial |

## 5. AI decision flow

PDF order: identity → tenant → role → course → classification → consent → policy → model → sources → tools → answer → citation → uncertainty → human handoff → audit.

| Stage | Evidence | Class |
| --- | --- | --- |
| Identity | Supabase auth | Native |
| Tenant and role | Membership and capabilities | Incomplete under F-01 |
| Course context | Ask and course screens | Partial |
| Classification and consent | Standards docs; not a single gateway predicate | Designed/documented |
| Model routing | `supabase/functions/claude`; shared-key fallback to Anthropic when gateway key unset (`fb64b65c`, `4dcd0efd`) | Native but incomplete |
| Spend | `20261004170000_ai_spend_meter.sql` | Schema; not an operating meter |
| Approved sources | `private.approved_source_content` has RLS and no policy | Default deny; retrieval not a product |
| Citation UI | Ask screen | Partial |
| Official handoff | Policy text | Not a tool-permission engine |
| Red team, eval harness, incident | Docs in finish-line AI program | Designed/documented |

**Rule that already matches the PDF:** AI does not issue grades, change records, enrol, approve money, discipline, or disclose protected data. That rule is a product constraint. It is not yet a single permission engine in front of every tool.

## 6. High-risk operator command

PDF: request → evidence → approval → impact preview → execution → audit → outbox → projection → UI.

| Stage | Evidence | Class |
| --- | --- | --- |
| Request and approval | `request_approval`, `decide_approval`, console Approvals | Native but incomplete |
| Break-glass | `close_break_glass`, `review_break_glass`, console tab | Native but incomplete |
| Audit read | `console_audit_read` | Native but incomplete |
| Outbox | `private.domain_outbox_events`, receipts | Writer without a consumer found |
| Projection / UI refresh | Not found | Not started |
| Impact preview | `components/unity/ActionPreview.tsx` | Component exists; not proven on every command |

## 7. Family grant

Invite → relationship check → scoped categories → time bound → share → history → revoke.

RPCs: `make_family_invite`, `claim_family_invite`, `accept_family_grant`, `make_family_share`, `read_family_share`. Export withholds guardian restrictions (`20261004160000`). **Class:** unsafe to activate. Billing handoff from a guardian was not found.

## 8. Dining order

`dining_place_order`, `dining_cancel_order`, `dining_advance_order`, `dining_order_queue`, balances, donate swipes. **Class:** native but incomplete, behind a module flag. Partner is the commerce record. No live partner was verified.

## 9. Grade release

`gradebook_enter`, `gradebook_moderate`, `gradebook_release`, `gradebook_file_regrade`, `gradebook_resolve_regrade`, `gradebook_queue_passback`. **Class:** unsafe to activate. LMS remains the gradebook of record. Passback is queued, not a proven live adapter.

## 10. Migration cutover

PDF gates: parity, authority, accessibility, security, privacy, isolation, audit, migration integrity, reconciliation, dual-run, institutional approval, support, incident/rollback, export, commercial readiness, outcome proof.

Factory docs: `docs/master/SEMESTER_MIGRATION_FACTORY.md`, `docs/finish-line/SEMESTER_MIGRATION_FACTORY.md`. Tables: `migration_*`. **No domain has passed the gates.** Legacy retirement is monitoring, not a decommission step (gap register).

## Workflows explicitly not started

TA endorsement, faculty rubric, assessment builder, office-hours scheduling by faculty, advisor caseload, success plan, housing maintenance, employer evidence review, partner OAuth app, marketplace listing, incident severity declaration, error-budget check, board report generation, alumni transition, continuing-education enrolment.

Priority and the search that established each absence: [`SEMESTER_GAP_REGISTER.md`](../master/SEMESTER_GAP_REGISTER.md). This pass did not repeat all 75 empty-step greps. Where this pass measured the symbol (`gradebook_release`, `registration_enroll`, `dining_place_order`), the table above replaces the older "nothing" reading.
