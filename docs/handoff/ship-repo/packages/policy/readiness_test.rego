package semester.readiness_test

import rego.v1
import data.semester.readiness

ok := {"action": "readiness.evaluate", "actor": {"authenticated": true, "tenant_id": "t1", "membership_active": true, "account_id": "s1", "role": "student"}, "record": {"tenant_id": "t1", "student_id": "s1", "authority": {"owner_type": "institution", "freshness_state": "current"}}}

test_own_current_allowed if readiness.allow with input as ok
test_stale_blocked if {
	not readiness.allow with input as object.union(ok, {"record": object.union(ok.record, {"authority": {"owner_type": "institution", "freshness_state": "stale"}})})
	readiness.deny_reason == "FRESHNESS_BLOCKED" with input as object.union(ok, {"record": object.union(ok.record, {"authority": {"owner_type": "institution", "freshness_state": "stale"}})})
}
test_other_tenant_denied if readiness.deny_reason == "TENANT_SCOPE_MISMATCH" with input as object.union(ok, {"record": object.union(ok.record, {"tenant_id": "t2"})})
test_other_student_denied if readiness.deny_reason == "RECORD_SCOPE_DENIED" with input as object.union(ok, {"record": object.union(ok.record, {"student_id": "s2"})})
test_advisor_caseload if readiness.allow with input as object.union(ok, {"actor": object.union(ok.actor, {"account_id": "a1", "role": "advisor", "caseload": ["s1"]})})
test_advisor_outside_caseload if not readiness.allow with input as object.union(ok, {"actor": object.union(ok.actor, {"account_id": "a1", "role": "advisor", "caseload": ["s9"]})})
test_stale_and_wrong_tenant_no_conflict if readiness.deny_reason == "TENANT_SCOPE_MISMATCH" with input as object.union(ok, {"record": {"tenant_id": "t2", "student_id": "s1", "authority": {"owner_type": "institution", "freshness_state": "stale"}}})
