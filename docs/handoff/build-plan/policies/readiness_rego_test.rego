package semester.readiness_test

import rego.v1

import data.semester.readiness

actor := {"authenticated": true, "membership": {"active": true}, "tenant_id": "vu", "account_id": "s1", "permissions": {}}
reg := object.union(actor, {"account_id": "r1", "permissions": {"registrar.readiness.case.route": true, "registrar.readiness.override.decide": true}})

test_student_evaluates_own if readiness.allow with input as {"command": "readiness.evaluate", "actor": actor, "resource": {"tenant_id": "vu", "student_account_id": "s1"}, "source_context": {"required_sources_known": true}}
test_student_cannot_evaluate_other if not readiness.allow with input as {"command": "readiness.evaluate", "actor": actor, "resource": {"tenant_id": "vu", "student_account_id": "s2"}, "source_context": {"required_sources_known": true}}
test_unknown_sources_denied if not readiness.allow with input as {"command": "readiness.evaluate", "actor": actor, "resource": {"tenant_id": "vu", "student_account_id": "s1"}, "source_context": {"required_sources_known": false}}
test_route_requires_needs_review if not readiness.allow with input as {"command": "readiness.case.route", "actor": reg, "resource": {"tenant_id": "vu", "state": "blocked"}}
test_route_ok if readiness.allow with input as {"command": "readiness.case.route", "actor": reg, "resource": {"tenant_id": "vu", "state": "needs_review"}}
test_self_approval_denied if not readiness.allow with input as {"command": "override.decide", "actor": reg, "resource": {"tenant_id": "vu", "requested_by_account_id": "r1"}}
test_two_reasons_no_conflict if {
	r := readiness.deny_reasons with input as {"command": "readiness.case.route", "actor": object.union(actor, {"tenant_id": "x"}), "resource": {"tenant_id": "vu"}}
	"tenant_scope_mismatch" in r
	"missing_permission" in r
}
test_stale_adds_block_obligation if {
	o := readiness.obligations with input as {"command": "readiness.evaluate", "actor": actor, "resource": {"tenant_id": "vu", "student_account_id": "s1"}, "source_context": {"required_sources_known": true, "any_required_stale": true}}
	"block_definitive_outcome" in o
}
