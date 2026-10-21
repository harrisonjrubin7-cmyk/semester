# Transition tests for saga.rego, including the six the PDF lists. Not executed here.
package semester.saga_test

import rego.v1

fixture := {
	"context_verified": true,
	"current": {"id": "s1", "tenant_id": "t1", "request_digest": "d1", "revision": 3, "generation": 1, "state": "INSPECT", "cancelled": false},
	"next": {"id": "s1", "tenant_id": "t1", "request_digest": "d1", "revision": 4, "generation": 1, "state": "ACTIVE", "cancelled": false},
	"evidence": {"producer_verified": true, "command_matched": true, "generation_matched": true, "tenant_matched": true, "expected_operation": true, "enforcement_valid": true, "signal_verified": false, "pa_revoked": false, "pep_absent": false},
}

part(key, patch) := object.union(fixture, {key: object.union(fixture[key], patch)})

two(c, n) := object.union(fixture, {"current": object.union(fixture.current, c), "next": object.union(fixture.next, n)})

test_verified_activation_allowed if { data.semester.saga.allow with input as fixture }

test_prepare_to_active_denied if { not data.semester.saga.allow with input as two({"state": "PREPARE"}, {}) }

test_inspect_to_active_without_enforcement_denied if { not data.semester.saga.allow with input as part("evidence", {"enforcement_valid": false}) }

test_active_to_revoke_on_cancellation_allowed if {
	x := two({"state": "ACTIVE"}, {"state": "REVOKE_PA", "cancelled": true})
	data.semester.saga.allow with input as x
}

test_cleanup_close_without_proof_denied if { not data.semester.saga.allow with input as two({"state": "VERIFY_CLEANUP"}, {"state": "CLOSED"}) }

test_confirmed_cleanup_closes if {
	x := object.union(two({"state": "VERIFY_CLEANUP", "cancelled": true}, {"state": "CLOSED", "cancelled": true}), {"evidence": object.union(fixture.evidence, {"pa_revoked": true, "pep_absent": true})})
	data.semester.saga.allow with input as x
}

test_closed_to_install_denied if { not data.semester.saga.allow with input as two({"state": "CLOSED"}, {"state": "INSTALL"}) }

test_wrong_tenant_denied if { not data.semester.saga.allow with input as part("next", {"tenant_id": "other"}) }

test_stale_revision_denied if { not data.semester.saga.allow with input as part("next", {"revision": 3}) }

test_unverified_producer_denied if { not data.semester.saga.allow with input as part("evidence", {"producer_verified": false}) }

test_cancellation_cannot_be_cleared if { not data.semester.saga.allow with input as two({"state": "REVOKE_PA", "cancelled": true}, {"state": "REVOKE_PA", "cancelled": false}) }

test_cancelled_saga_cannot_go_forward if { not data.semester.saga.allow with input as two({"state": "PREPARE", "cancelled": true}, {"state": "INSTALL", "cancelled": true}) }

test_verified_signal_restarts_evaluation if {
	x := object.union(two({"state": "WAIT"}, {"state": "EVALUATE", "generation": 2}), {"evidence": object.union(fixture.evidence, {"signal_verified": true, "producer_verified": false})})
	data.semester.saga.allow with input as x
}

test_unverified_signal_denied if { not data.semester.saga.allow with input as two({"state": "WAIT"}, {"state": "EVALUATE", "generation": 2}) }

test_missing_context_denied if { not data.semester.saga.allow with input as {} }
