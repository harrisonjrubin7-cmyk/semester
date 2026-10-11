package semester.access_test

import rego.v1

import data.semester.access

# A registrar evaluating readiness in their own tenant: every condition met.
good := {
	"action": "registrar.readiness.evaluate.tenant",
	"actor": {
		"authenticated": true,
		"account_id": "acct-1",
		"tenant_id": "tenant-a",
		"scope_ids": ["tenant-a"],
		"grants": [{"permission": "registrar.readiness.evaluate.tenant", "state": "active"}],
	},
	"resource": {
		"tenant_id": "tenant-a",
		"scope": "tenant",
		"scope_id": "tenant-a",
		"owner_account_id": "acct-9",
		"requires_consent": false,
		"authority": "institution_sis",
		"requires_fresh_integration": false,
	},
	"risk_tier": 1,
}

test_every_condition_met_allows if {
	access.allow with input as good
	count(access.deny) == 0 with input as good
}

test_default_is_deny if {
	not access.allow with input as {}
}

test_unauthenticated_is_denied if {
	bad := object.union(good, {"actor": object.union(good.actor, {"authenticated": false})})
	not access.allow with input as bad
	"unauthenticated" in access.deny with input as bad
}

test_other_tenant_is_denied_before_anything_else if {
	bad := object.union(good, {"resource": object.union(good.resource, {"tenant_id": "tenant-b"})})
	not access.allow with input as bad
	"tenant_mismatch" in access.deny with input as bad
}

test_grant_for_a_different_action_is_no_grant if {
	bad := object.union(good, {"actor": object.union(good.actor, {"grants": [{"permission": "registrar.readiness.read.tenant", "state": "active"}]})})
	not access.allow with input as bad
	"no_active_grant" in access.deny with input as bad
}

test_expired_or_inactive_grant_is_no_grant if {
	expired := object.union(good, {"actor": object.union(good.actor, {"grants": [{"permission": good.action, "state": "active", "expired": true}]})})
	not access.allow with input as expired
	suspended := object.union(good, {"actor": object.union(good.actor, {"grants": [{"permission": good.action, "state": "suspended"}]})})
	not access.allow with input as suspended
}

test_missing_grants_field_is_no_grant if {
	# object.union merges nested objects, so the actor is replaced whole rather than merged.
	actor := object.remove(good.actor, ["grants"])
	bad := object.union(object.remove(good, ["actor"]), {"actor": actor})
	not access.allow with input as bad
	"no_active_grant" in access.deny with input as bad
}

test_tenant_scope_requires_the_actor_to_hold_that_scope if {
	bad := object.union(good, {"actor": object.union(good.actor, {"scope_ids": ["tenant-z"]})})
	not access.allow with input as bad
	"out_of_scope" in access.deny with input as bad
}

test_own_scope_requires_ownership if {
	own := object.union(good, {
		"action": "student.course.read.own",
		"actor": object.union(good.actor, {"grants": [{"permission": "student.course.read.own", "state": "active"}]}),
		"resource": object.union(good.resource, {"scope": "own", "owner_account_id": "acct-1", "authority": "student"}),
	})
	access.allow with input as own
	other := object.union(own, {"resource": object.union(own.resource, {"owner_account_id": "acct-2"})})
	not access.allow with input as other
	"out_of_scope" in access.deny with input as other
}

consent_input := object.union(good, {
	"resource": object.union(good.resource, {"requires_consent": true}),
	"consent": {"state": "active", "scope": ["registrar.readiness.evaluate.tenant"], "expires_at_ns": 2000},
})

test_live_consent_for_the_exact_action_allows if {
	access.allow with input as consent_input with time.now_ns as 1000
}

test_expired_consent_is_denied if {
	not access.allow with input as consent_input with time.now_ns as 3000
	"consent_required" in access.deny with input as consent_input with time.now_ns as 3000
}

test_consent_for_another_action_is_denied if {
	bad := object.union(consent_input, {"consent": object.union(consent_input.consent, {"scope": ["registrar.readiness.read.tenant"]})})
	not access.allow with input as bad with time.now_ns as 1000
}

test_revoked_consent_is_denied if {
	bad := object.union(consent_input, {"consent": object.union(consent_input.consent, {"state": "revoked"})})
	not access.allow with input as bad with time.now_ns as 1000
	"consent_required" in access.deny with input as bad with time.now_ns as 1000
}

test_external_read_only_authority_refuses_a_write_and_permits_a_read if {
	write := object.union(good, {"resource": object.union(good.resource, {"authority": "external_read_only"})})
	not access.allow with input as write
	"authority_read_only" in access.deny with input as write
	read := object.union(write, {
		"action": "registrar.readiness.read.tenant",
		"actor": object.union(good.actor, {"grants": [{"permission": "registrar.readiness.read.tenant", "state": "active"}]}),
	})
	access.allow with input as read
}

test_fresh_integration_required_means_healthy_or_denied if {
	needs := object.union(good, {"resource": object.union(good.resource, {"requires_fresh_integration": true})})
	not access.allow with input as needs
	"integration_unhealthy" in access.deny with input as needs
	stale := object.union(needs, {"integration": {"health": "stale"}})
	not access.allow with input as stale
	healthy := object.union(needs, {"integration": {"health": "healthy"}})
	access.allow with input as healthy
}

test_risk_tier_two_needs_an_approval if {
	risky := object.union(good, {"risk_tier": 2})
	not access.allow with input as risky
	"approval_required" in access.deny with input as risky
	pending := object.union(risky, {"approval": {"status": "pending"}})
	not access.allow with input as pending
	approved := object.union(risky, {"approval": {"status": "approved"}})
	access.allow with input as approved
}

test_deny_names_every_failed_condition_not_just_the_first if {
	bad := object.union(good, {
		"risk_tier": 3,
		"actor": object.union(good.actor, {"authenticated": false, "grants": []}),
	})
	access.deny == {"unauthenticated", "no_active_grant", "approval_required"} with input as bad
}

test_action_verb_is_the_segment_before_the_scope if {
	access.action_verb("student.course.read.own") == "read"
	access.action_verb("faculty.grade_release.submit.assigned_section") == "submit"
	not access.action_verb("read")
}
