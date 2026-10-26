# Unit tests for zta.rego. Not executed here. Run: opa test policies/ --verbose --fail-on-empty
# Corrections vs the PDF fixture (its happy-path tests could not pass as written): adds subject.authentication_level,
# context.policy_revision, decision.policy_revision, grant.policy_revision, grant.generation and top-level generation.
# Added beyond the PDF (it asks for these): unknown action, capability removal, policy revision, grant subject,
# malformed input and unauthorized-workload tests.
package semester.zta_test

import rego.v1

fixture := {
	"context": {"verified": true, "now": 100, "expires_at": 200, "access_revision": "access-1", "policy_revision": "pilot-1"},
	"subject": {"id": "student-1", "authenticated": true, "active": true, "session_expires_at": 200, "authentication_level": 1, "capabilities": ["registration.readiness.view"]},
	"membership": {"active": true, "subject_id": "student-1", "tenant_id": "tenant-1"},
	"resource": {"id": "readiness-1", "tenant_id": "tenant-1"},
	"action": "registration.readiness.view",
	"relationships": ["student_self"],
	"conditions": {"satisfied": true},
	"request_digest": "digest-1",
	"saga_id": "saga-1",
	"generation": 1,
	"workload": {"id": "access-orchestrator", "verified": true, "tenant_id": "tenant-1", "capabilities": ["grant.prepare", "grant.revoke"]},
	"decision": {"verified": true, "outcome": "allow", "subject_id": "student-1", "tenant_id": "tenant-1", "resource_id": "readiness-1", "action": "registration.readiness.view", "request_digest": "digest-1", "policy_revision": "pilot-1", "access_revision": "access-1", "expires_at": 200},
	"grant": {"verified": true, "subject_id": "student-1", "tenant_id": "tenant-1", "resource_id": "readiness-1", "actions": ["registration.readiness.view"], "policy_revision": "pilot-1", "access_revision": "access-1", "generation": 1, "expires_at": 200},
	"revocation": {"verified": true, "fresh": true, "revoked_through_generation": 0},
	"revocation_request": {"verified": true, "saga_id": "saga-1", "tenant_id": "tenant-1"},
	"enforcement": {"required_obligations_supported": true, "required_audit_available": true},
}

with_part(key, patch) := object.union(fixture, {key: object.union(fixture[key], patch)})

test_pe_valid_access if { data.semester.zta.pe_allow with input as fixture }
test_pa_valid_preparation if { data.semester.zta.pa_prepare with input as fixture }
test_pep_valid_enforcement if { data.semester.zta.pep_allow with input as fixture }
test_pa_valid_revocation if { data.semester.zta.pa_revoke with input as fixture }

test_missing_input_denied if {
	not data.semester.zta.pe_allow with input as {}
	not data.semester.zta.pa_prepare with input as {}
	not data.semester.zta.pa_revoke with input as {}
	not data.semester.zta.pep_allow with input as {}
}

test_wrong_tenant_denied if {
	x := with_part("resource", {"tenant_id": "tenant-2"})
	not data.semester.zta.pe_allow with input as x
	not data.semester.zta.pa_prepare with input as x
	not data.semester.zta.pep_allow with input as x
}

test_expired_decision_denied if {
	not data.semester.zta.pa_prepare with input as with_part("decision", {"expires_at": 99})
}

test_digest_mismatch_denied if {
	not data.semester.zta.pa_prepare with input as object.union(fixture, {"request_digest": "other"})
}

test_revoked_generation_denied if {
	x := with_part("revocation", {"revoked_through_generation": 1})
	not data.semester.zta.pa_prepare with input as x
	not data.semester.zta.pep_allow with input as x
}

test_stale_revocation_denied if {
	not data.semester.zta.pep_allow with input as with_part("revocation", {"fresh": false})
}

test_expired_grant_denied if {
	not data.semester.zta.pep_allow with input as with_part("grant", {"expires_at": 99})
}

test_unsupported_obligations_denied if {
	not data.semester.zta.pep_allow with input as with_part("enforcement", {"required_obligations_supported": false})
}

test_revocation_survives_membership_end if {
	x := with_part("membership", {"active": false})
	not data.semester.zta.pep_allow with input as x
	data.semester.zta.pa_revoke with input as x
}

test_unverified_workload_cannot_revoke if {
	not data.semester.zta.pa_revoke with input as with_part("workload", {"verified": false})
}

test_unknown_action_denied if {
	x := object.union(fixture, {"action": "grades.export"})
	not data.semester.zta.pe_allow with input as x
	not data.semester.zta.pep_allow with input as x
}

test_capability_removed_denied if {
	x := with_part("subject", {"capabilities": []})
	not data.semester.zta.pe_allow with input as x
	not data.semester.zta.pep_allow with input as x
}

test_old_policy_revision_denied if {
	x := with_part("grant", {"policy_revision": "pilot-0"})
	not data.semester.zta.pep_allow with input as x
	not data.semester.zta.pa_prepare with input as with_part("decision", {"policy_revision": "pilot-0"})
}

test_grant_for_other_subject_denied if {
	not data.semester.zta.pep_allow with input as with_part("grant", {"subject_id": "student-2"})
}

test_malformed_types_denied if {
	x := with_part("context", {"verified": "true", "now": "100"})
	not data.semester.zta.pe_allow with input as x
	not data.semester.zta.pep_allow with input as x
}

test_unauthorized_workload_cannot_prepare if {
	not data.semester.zta.pa_prepare with input as with_part("workload", {"id": "some-other-service"})
	not data.semester.zta.pa_prepare with input as with_part("workload", {"capabilities": ["grant.revoke"]})
}

test_cross_tenant_workload_cannot_revoke if {
	not data.semester.zta.pa_revoke with input as with_part("workload", {"tenant_id": "tenant-2"})
}
