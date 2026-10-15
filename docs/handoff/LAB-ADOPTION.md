# Adopting the reference lab into the repo

`handoff/strengthened-package/lab/` (Python + SQLite) passes 34 unit tests on the author's machine. Port its **rules**, not its code — the repo is TypeScript + Supabase.

| Lab test | Rule to carry over | Repo home |
|---|---|---|
| cross_tenant, cross_student, course_scope | every read/command checks tenant + scope from the grant | RLS read policies + command preamble |
| grant_revoked, expired | access re-checked on every request, not from the token | `active_grant()` pattern (record-model ref) |
| faculty_cannot_approve, self_approval_even_after_role_change, reason_required | approval needs a different person, a reason, and binds to that person forever | release/override commands |
| changed_grade_binding, changed_hold_binding, version_conflict, expired_approval | approval binds to the exact record version; any change voids it | `expected_version` + approval digest |
| duplicate_receipt, key_conflict, empty_key | same key → same receipt; same key + different payload → refused | `live_record_command` pattern |
| released_grade_not_mutable, rejection_rolls_back | releases append-only; failed command leaves no trace | append-only triggers; single transaction |
| stale_source, readiness_confirmed, hold_clear_not_ready | stale → no definitive result; clearing one hold ≠ ready | `source-state.ts` |
| worker_replay, worker_role, worker_tenant | outbox worker is idempotent, scoped, tenant-bound | `publisher.ts` + consumer receipts |
| operator_business_only | operators see counts, never student rows | command-center views |
| restart_durable, onboarding_required, full_learning_loop | state survives restart; onboarding gates first action | integration tests |

Write each as a repo test (pgTAP for database rules, vitest for domain logic, Playwright for journeys). A rule counts as evidence only when the repo test passes on Semester-Platform.
