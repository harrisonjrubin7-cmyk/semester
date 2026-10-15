package semester.access_test

import rego.v1

import data.semester.access

base := {
	"actor": {"accountId": "a1", "tenantId": "t1", "membershipActive": true, "grants": ["grades.read", "grades.release"]},
	"resource": {"tenantId": "t1", "authority": "native"},
	"action": "grades.release",
}

test_allows_granted_native_action if access.allow with input as base

test_denies_other_tenant if not access.allow with input as object.union(base, {"resource": {"tenantId": "t2", "authority": "native"}})

test_denies_inactive_membership if not access.allow with input as object.union(base, {"actor": object.union(base.actor, {"membershipActive": false})})

test_denies_missing_grant if not access.allow with input as object.union(base, {"action": "grades.delete"})

test_null_tenants_do_not_match_by_equality if not access.allow with input as {
	"actor": {"accountId": "a1", "tenantId": null, "grants": ["notes.read"]},
	"resource": {"tenantId": null, "ownerAccountId": "a2", "authority": "native"},
	"action": "notes.read",
}

test_personal_owner_allowed if access.allow with input as {
	"actor": {"accountId": "a1", "tenantId": null, "grants": ["notes.read"]},
	"resource": {"tenantId": null, "ownerAccountId": "a1", "authority": "native"},
	"action": "notes.read",
}

test_external_read_only_blocks_writes if not access.allow with input as object.union(base, {"resource": {"tenantId": "t1", "authority": "external_read_only"}})

test_external_read_only_allows_read if access.allow with input as object.union(base, {"resource": {"tenantId": "t1", "authority": "external_read_only"}, "action": "grades.read"})

test_consent_required_and_revoked if not access.allow with input as object.union(base, {
	"resource": {"tenantId": "t1", "authority": "native", "requiresConsent": true},
	"consent": {"state": "revoked", "scopes": ["grades.release"]},
})

test_consent_wrong_scope if not access.allow with input as object.union(base, {
	"resource": {"tenantId": "t1", "authority": "native", "requiresConsent": true},
	"consent": {"state": "active", "scopes": ["grades.read"]},
})

test_high_sensitivity_adds_audit_obligation if {
	obs := access.obligations with input as object.union(base, {"resource": {"tenantId": "t1", "authority": "native", "sensitivity": "high"}})
	"audit:high_sensitivity" in obs
}
