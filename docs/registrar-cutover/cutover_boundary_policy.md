# Cutover policy and integration boundary
Draft for institution acceptance; no external configuration changed.

## Point of no return
The operational no-automatic-return boundary is the earliest native authoritative commit or externally effective consequence in the transferred scope. Unknown dispatched outcomes must be treated conservatively as possibly crossing the boundary. Crossing it forbids destructive automatic rollback; it does not forbid an approved return after preservation, reverse mapping and reconciliation.
Before it: fence candidate, verify no native commits or uncertain operations, record final source checkpoint, return authority to legacy, preserve candidate/evidence.
After it: hold affected commands, preserve accepted decisions, classify uncertain execution, seek registrar/IT/incident authority, choose forward repair or verified reverse replay, reconcile then declare one writer.
Approval: institutional registrar + IT change authority + Semester release authority. Privacy/security joins disclosure incidents. Record institution/domain/cohort, source checkpoint, fencing epoch, manifest, first native decision and external effects.

## Integration modes
Connect/read: legacy owns official records; Semester maintains permitted projections; no official native writes.
Connect/delegated: scoped server commands may execute in legacy; only legacy confirmation is official; timeout after dispatch becomes reconcile_required.
Shadow: compute/compare, no official write in either destination from comparison workflow.
Core/native: Semester owns accepted domain after evidence-bound approval; old writer fenced; downstream failures do not reverse native truth.
Held: prohibit consequential commands, allow only authorized reads and recovery.
Transition guard: exact approved scope, current membership/grants, allowlisted operation and fields, source freshness, idempotency, expected version, actual writer fencing. Recheck queued jobs. API mode flags alone are not sufficient fencing.
Existing integration scope exclusions must not be removed to enable registrar replacement. Create separately reviewed institutional academic contracts and gateways. No student records to AI, no company access by default.
