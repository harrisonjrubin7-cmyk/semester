# Native student housing portal specification
Status: proposed implementation contract. No repository changes, migration, deployment or institutional activation. Build native; legacy is an approved transitional adapter.

## Screens and consoles
Student: overview; residence comparison; eligibility/application; opt-in roommate profile; invitations/group confirmation; selection window; eligible inventory; reservation/contract preview; acceptance/deposit; assignment; move-in/condition report; maintenance; room-change/cancellation; move-out/appeal.
Staff: inventory; applications; allocation; groups; contracts; occupancy; maintenance; accommodation fulfillment; finance/reconciliation; migration/assurance. Extend existing Institution OS and controlled-action services; no independent identity system.

## Policy inputs and precedence
Pin institution/occupancy period, inventory version, rule version, eligible cohort, approved operational accommodations, group membership version, reservation duration, lottery scheme and fairness tie-break. Mandatory safety/inventory/eligibility constraints precede soft preferences. Restricted accommodation review is separate; housing receives approved requirement, not clinical detail. Institution approval required for priority groups, reserved capacity, lottery and exception rules.

## Algorithms
Self-selection: server authenticates and derives scope; validates window and every group member's current eligibility/reciprocal consent; transaction locks requested beds in stable order; checks expected inventory/group versions and temporal conflicts; creates expiring reservation plus audit/outbox; returns idempotent receipt. Confirm rechecks contract/financial prerequisites and active reservation. Do not hold a DB transaction open during payment-provider calls.
Lottery: freeze eligible cohort and policy; controlled draw after freeze using independently reviewed randomness/seed procedure, preserve seed commitment/reveal and algorithm version where appropriate; publish selection order/appeal path without private data. A known seed chosen before eligible list freezes can be manipulated; reviewed draw controls matter.
Batch assignment: construct only feasible student-bed edges; pin objective/weights/ties; min-cost matching for individual compatible cases; group and coupled constraints require accepted constraint solver. Preserve solver status, feasibility, accepted objective, unassigned reasons and reviewer. Do not assert global optimum unless proved.
Group selection: atomically allocate complete accepted group under policy or return no allocation; partial split is allowed only by explicit consent/version. Member change invalidates locked-group assumptions. Group leader cannot forge acceptance.
Waitlist: stable approved rank, eligibility recheck, one active offer where policy requires, explicit acceptance deadline, expiration and next-offer audit.

## Invariants
At most one conflicting occupancy per bed/student over overlapping half-open periods [start,end). Active reservation participates in the same exclusion logic; expired entries explicitly retired. Database uniqueness/exclusion/transaction checks—not UI alone—enforce invariants. Closed/unavailable bed denied. Contract acceptance pins exact terms/rate/period; amendment never overwrites history. Same idempotency key with different digest rejected. Payment uncertainty cannot silently free an assigned room. Confirmed assignment is not an expiring cart.

## Roommates
Opt in; mutually disclosed comparable fields; explain score factors and missing-data coverage; no protected-attribute inference. Weighted compatibility compares disclosed preferences only; hard constraints remain separate. Missing data unknown, not low compatibility. Invitations reciprocal; group size/eligibility validated; membership versioned; blocks/reporting enforced. Do not allow unrestricted staff profile browsing.

## State
Available -> reserved -> contract_pending -> financial_prerequisite_pending (if required) -> confirmed -> occupied -> checked_out. Rejected/expired/cancelled/unknown/appeal explicit. Unknown provider outcome enters reconciliation; compensation separately authorized.

## Maintenance
Record scoped location, requester, category/severity, minimal description/attachments, access permission, ownership, due/calendar, status/version, evidence and work-order references. submitted -> triaged -> assigned -> scheduled -> in_progress -> awaiting_parts/vendor -> completed -> verified -> closed. Duplicate-linked, reopened, cancelled and emergency_handoff separate. Official staffed emergency path never represented as ordinary pending ticket. Technician/vendor gets assigned task and access procedure only; completion evidence and reopen supported.

## Acceptance
Race final bed; overlapping period denial and adjacent-period allowance; group consent/version invalidation; reservation expiry; payment-after-expiry uncertainty; no double assignment; accommodation privacy; lottery reproducibility/integrity; blocked invitation; technician scope; verified close/reopen; legacy occupancy/contract/charge/file reconciliation; restore + revoked access.
