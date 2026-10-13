# Unit tests for policy_engine.rego and policy_enforcement.rego (Rego v1). Not yet run here.
# opa test . -v
package semester.policy_test

import rego.v1

import data.semester.pe
import data.semester.pep

policy_data := {
	"policy_revision": "pilot-1",
	"actions": {
		"registration.readiness.view": {
			"capability": "registration.readiness.view",
			"relationships": ["student_self", "assigned_advisor"],
			"authentication_level": 1,
			"approval_required": false,
		},
		"registration.override.approve": {
			"capability": "registration.override.approve",
			"relationships": ["authorized_registrar"],
			"authentication_level": 2,
			"approval_required": true,
			"approval_rule_id": "override.two_person",
		},
	},
}

pe_input := {
	"action": "registration.readiness.view",
	"request_digest": "sha256:abc",
	"context": {"verified": true, "policy_revision": "pilot-1", "now_epoch": 100, "expires_epoch": 200},
	"subject": {"id": "u1", "authenticated": true, "active": true, "authentication_level": 1, "capabilities": ["registration.readiness.view", "registration.override.approve"]},
	"membership": {"active": true, "subject_id": "u1", "tenant_id": "vu"},
	"resource": {"id": "r1", "tenant_id": "vu", "version": "v3"},
	"relationships": ["student_self"],
}

pep_input := {
	"action": "registration.readiness.view",
	"context": {"verified": true, "now_epoch": 100, "access_revision": "a7"},
	"subject": {"id": "u1", "active": true},
	"membership": {"active": true, "subject_id": "u1", "tenant_id": "vu"},
	"resource": {"id": "r1", "tenant_id": "vu"},
	"grant": {"verified": true, "subject_id": "u1", "tenant_id": "vu", "resource_id": "r1", "actions": ["registration.readiness.view"], "generation": 3, "expires_epoch": 200, "policy_revision": "pilot-1", "access_revision": "a7"},
	"revocation": {"verified": true, "fresh": true, "revoked": false, "revoked_through_generation": 2},
	"current_policy": {"outcome": "allow", "policy_revision": "pilot-1"},
	"enforcement": {"audit_available": true, "supports_required_obligations": true},
}

# --- Policy Engine ---

test_baseline_allows if {
	pe.outcome == "allow" with input as pe_input with data.semester as policy_data
}

test_missing_context_denies if {
	inp := json.remove(pe_input, ["context"])
	pe.outcome == "deny" with input as inp with data.semester as policy_data
}

test_unknown_action_denies if {
	inp := json.patch(pe_input, [{"op": "replace", "path": "/action", "value": "grades.export"}])
	pe.outcome == "deny" with input as inp with data.semester as policy_data
}

test_wrong_tenant_denies if {
	inp := json.patch(pe_input, [{"op": "replace", "path": "/resource/tenant_id", "value": "fisk"}])
	pe.outcome == "deny" with input as inp with data.semester as policy_data
}

test_unrelated_resource_denies if {
	inp := json.patch(pe_input, [{"op": "replace", "path": "/relationships", "value": ["support_agent"]}])
	pe.outcome == "deny" with input as inp with data.semester as policy_data
}

test_insufficient_authentication_requires_step_up if {
	inp := json.patch(pe_input, [
		{"op": "replace", "path": "/action", "value": "registration.override.approve"},
		{"op": "replace", "path": "/relationships", "value": ["authorized_registrar"]},
	])
	pe.outcome == "require_step_up" with input as inp with data.semester as policy_data
}

test_missing_approval_requires_approval if {
	inp := json.patch(pe_input, [
		{"op": "replace", "path": "/action", "value": "registration.override.approve"},
		{"op": "replace", "path": "/relationships", "value": ["authorized_registrar"]},
		{"op": "replace", "path": "/subject/authentication_level", "value": 2},
	])
	pe.outcome == "require_approval" with input as inp with data.semester as policy_data
}

test_stale_approval_does_not_allow if {
	inp := json.patch(pe_input, [
		{"op": "replace", "path": "/action", "value": "registration.override.approve"},
		{"op": "replace", "path": "/relationships", "value": ["authorized_registrar"]},
		{"op": "replace", "path": "/subject/authentication_level", "value": 2},
		{"op": "add", "path": "/approval", "value": {
			"verified": true, "status": "approved", "rule_id": "override.two_person",
			"subject_id": "u1", "resource_id": "r1", "action": "registration.override.approve",
			"request_digest": "sha256:abc", "resource_version": "v2",
			"approver_eligible_now": true, "approver_id": "u9", "expires_epoch": 200,
		}},
	])
	pe.outcome != "allow" with input as inp with data.semester as policy_data
}

test_self_approval_does_not_allow if {
	inp := json.patch(pe_input, [
		{"op": "replace", "path": "/action", "value": "registration.override.approve"},
		{"op": "replace", "path": "/relationships", "value": ["authorized_registrar"]},
		{"op": "replace", "path": "/subject/authentication_level", "value": 2},
		{"op": "add", "path": "/approval", "value": {
			"verified": true, "status": "approved", "rule_id": "override.two_person",
			"subject_id": "u1", "resource_id": "r1", "action": "registration.override.approve",
			"request_digest": "sha256:abc", "resource_version": "v3",
			"approver_eligible_now": true, "approver_id": "u1", "expires_epoch": 200,
		}},
	])
	pe.outcome != "allow" with input as inp with data.semester as policy_data
}

# --- Policy Enforcement Point ---

test_pep_baseline_allows if {
	pep.allow with input as pep_input
}

test_pep_expired_grant_denies if {
	inp := json.patch(pep_input, [{"op": "replace", "path": "/grant/expires_epoch", "value": 50}])
	not pep.allow with input as inp
}

test_pep_revoked_generation_denies if {
	inp := json.patch(pep_input, [{"op": "replace", "path": "/revocation/revoked_through_generation", "value": 3}])
	not pep.allow with input as inp
}

test_pep_stale_revocation_state_denies if {
	inp := json.patch(pep_input, [{"op": "replace", "path": "/revocation/fresh", "value": false}])
	not pep.allow with input as inp
}

test_pep_unavailable_audit_denies if {
	inp := json.patch(pep_input, [{"op": "replace", "path": "/enforcement/audit_available", "value": false}])
	not pep.allow with input as inp
}

test_pep_wrong_tenant_denies if {
	inp := json.patch(pep_input, [{"op": "replace", "path": "/resource/tenant_id", "value": "fisk"}])
	not pep.allow with input as inp
}

test_pep_policy_now_denies if {
	inp := json.patch(pep_input, [{"op": "replace", "path": "/current_policy/outcome", "value": "deny"}])
	not pep.allow with input as inp
}
