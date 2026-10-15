# Semester roommate and housing review

{
  "unit_tests_passed": 21,
  "weight_configurations": 1330,
  "A_B_min": 62.5,
  "A_B_max": 87.5,
  "winner_counts": {
    "C": 1026,
    "B": 273,
    "tie": 31
  },
  "missing_data_example": {
    "status": "recommendation_only",
    "score": 81.25,
    "coverage": 0.6667,
    "factors": {
      "noise": 0.875,
      "sleep": 0.75
    }
  },
  "database_tests_executed": 0,
  "database_projects_discovered": [
    "Semester2",
    "semester",
    "semester-restore-drill-2026-10-01",
    "Semester-Platform"
  ],
  "target_selected_for_metadata_only": "Semester-Platform",
  "isolated_branches_on_selected_project": 0,
  "live_schema_metadata": "NOT RETRIEVED; SQL connector confirmation required",
  "review_scope": "Reconstructed scoring and prior schema/contract text; original generated artifacts absent in current environment"
}

## Weight experiments
- Equal: A/B 75.0; A/C 83.33; preferred C.
- Lifestyle-heavy: A/B 68.75; A/C 91.67; preferred C.
- Noise-heavy: A/B 81.25; A/C 72.92; preferred B.
- Sleep-heavy: A/B 75.0; A/C 85.42; preferred C.
- Lifestyle-only: A/B 62.5; A/C 100.0; preferred C.
- Noise-only: A/B 87.5; A/C 62.5; preferred B.
- Sleep-only: A/B 75.0; A/C 87.5; preferred C.

## Findings
- P0 Allocation schema: Temporal claims under-specify identity consistency. Evidence: Application/student/period, group/period and contract/application can disagree despite same-tenant FKs. Fix: Add composite correspondence keys or transactionally verified controlled-command invariants; test forged linked IDs.
- P0 Allocation schema: Lifecycle lacks required contract and expiry transition checks. Evidence: Confirmed claim can omit accepted matching contract; reservation confirmation must reject expired state. Fix: Domain-specific constraints and state transition service; exact policy and audit.
- P1 Allocation schema: Blocked-bed closure cannot retire with null student under current CHECK. Evidence: state != blocked requires student, so transitioning a closure to cancelled/expired violates CHECK. Fix: Add immutable claim_kind(student/closure); apply student NULL rule by kind, not mutable state.
- P0 Allocation schema: Production authorization is not yet installed. Evidence: Default-deny RLS is intentionally not a complete policy; owner/BYPASSRLS paths differ. Fix: Reviewed scoped read policies; controlled server writes; runtime role denial tests.
- P0 Allocation schema: Audit/outbox/group atomicity are service promises, not schema proof. Evidence: Tables do not prove audit-first rollback, group commit, policy version or eligibility. Fix: Existing audit/outbox integration and DB/concurrency tests.
- P1 Roommate scoring: Missingness can raise normalized score. Evidence: Hide weaker lifestyle: 75 becomes 81.25 with only 66.67% compared-weight coverage. Fix: Do not compare across mismatched coverage as equivalent; show factor/item coverage and no-confidence label; configurable minimum comparable data.
- P1 Roommate scoring: Item-level coverage masked within lifestyle. Evidence: One disclosed field can count whole lifestyle feature weight. Fix: Track item-level coverage and defined denominator; label partial comparisons.
- P1 Roommate scoring: Noise scale compresses one-way maximum mismatch. Evidence: One direction worst violation yields noise score 50, not zero. Fix: Review averaging vs min/worst-direction policy; optional explainable conflict warning.
- P0 Sync contract: Actual endpoints/version/authority rules unresolved. Evidence: No verified vendor protocol, delete semantics or source ordering. Fix: Signed integration contract, field authority, schema fixtures, credential scopes and source-version tests.
- P0 Sync contract: External outcome and failure state not transactional guarantees. Evidence: Generic spec cannot ensure provider dedupe, business applied receipt or checkpoint atomicity. Fix: Durable inbox/outbox/receipts; atomic checkpoint; replay and unknown-outcome tests.

## Evidence boundary
Original prior generated archive unavailable; reference reconstructed from supplied conversation. Python local tests rerun. Static schema/contract review not an executed PostgreSQL audit. Project discovery performed via connector; no schema introspection succeeded, no DDL/DML executed. No production or restore target selected for fixture writes. Metadata query needs user confirmation before retry. All 13 database cases held.
