# Illustrative tests for saga.rego. No results are claimed: run against your pinned OPA version.
# Added beyond the PDF: missing-field, generation-jump, signal-wake and cancellation-reversal tests.
package semester.saga_test

import rego.v1

base := {
	"contextVerified": true,
	"current": {"id": "saga-1", "tenantId": "tenant-a", "requestDigest": "digest-1", "generation": 1, "revision": 4, "state": "VERIFYING", "cancellationRequested": false},
	"next": {"id": "saga-1", "tenantId": "tenant-a", "requestDigest": "digest-1", "generation": 1, "revision": 5, "state": "ACTIVE", "cancellationRequested": false, "compensation": {"paRevoked": false, "pepRemoved": false}},
	"evidence": {"source": "participant", "participantVerified": true, "commandMatched": true, "tenantMatched": true, "generationMatched": true, "expectedOperation": true, "cleanupVerified": false},
}

test_valid_activation if {
	data.semester.saga.allow with input as base
}

test_cross_tenant_denied if {
	next := object.union(base.next, {"tenantId": "tenant-b"})
	not data.semester.saga.allow with input as object.union(base, {"next": next})
}

test_stale_revision_denied if {
	next := object.union(base.next, {"revision": 4})
	not data.semester.saga.allow with input as object.union(base, {"next": next})
}

test_unverified_reply_denied if {
	evidence := object.union(base.evidence, {"participantVerified": false})
	not data.semester.saga.allow with input as object.union(base, {"evidence": evidence})
}

test_cancelled_activation_denied if {
	current := object.union(base.current, {"cancellationRequested": true})
	next := object.union(base.next, {"cancellationRequested": true})
	not data.semester.saga.allow with input as object.union(base, {"current": current, "next": next})
}

test_closed_cannot_reactivate if {
	current := object.union(base.current, {"state": "CLOSED"})
	not data.semester.saga.allow with input as object.union(base, {"current": current})
}

test_cleanup_requires_evidence if {
	current := object.union(base.current, {"state": "COMPENSATING"})
	next := object.union(base.next, {"state": "CLOSED", "compensation": {"paRevoked": true, "pepRemoved": true}})
	not data.semester.saga.allow with input as object.union(base, {"current": current, "next": next})
}

test_verified_cleanup_closes if {
	current := object.union(base.current, {"state": "COMPENSATING"})
	next := object.union(base.next, {"state": "CLOSED", "compensation": {"paRevoked": true, "pepRemoved": true}})
	evidence := object.union(base.evidence, {"cleanupVerified": true})
	data.semester.saga.allow with input as object.union(base, {"current": current, "next": next, "evidence": evidence})
}

test_missing_context_flag_denied if {
	not data.semester.saga.allow with input as json.remove(base, ["contextVerified"])
}

test_generation_jump_without_signal_denied if {
	next := object.union(base.next, {"generation": 2})
	not data.semester.saga.allow with input as object.union(base, {"next": next})
}

test_verified_signal_wakes_waiting if {
	current := object.union(base.current, {"state": "WAITING"})
	next := object.union(base.next, {"state": "EVALUATING", "generation": 2})
	evidence := object.union(base.evidence, {"source": "verified_signal", "participantVerified": false})
	data.semester.saga.allow with input as object.union(base, {"current": current, "next": next, "evidence": evidence})
}

test_cancellation_cannot_be_cleared if {
	current := object.union(base.current, {"state": "COMPENSATING", "cancellationRequested": true})
	next := object.union(base.next, {"state": "COMPENSATING", "cancellationRequested": false})
	not data.semester.saga.allow with input as object.union(base, {"current": current, "next": next})
}

test_illegal_edge_denied if {
	current := object.union(base.current, {"state": "EVALUATING"})
	not data.semester.saga.allow with input as object.union(base, {"current": current})
}
