# The access policy baseline from the inception execution specification, as
# policy-as-code with tests (`scripts/infra/policy.sh` runs `opa test infra/policy`).
#
# What it is: the eight conditions every allowance must satisfy — authenticated
# actor, same tenant, an active unexpired grant for the exact action, resource
# scope, consent where the resource requires it, write authority, integration
# freshness where the resource requires it, and an approval above risk tier 1 —
# written once, in the order the platform evaluator checks them, with a `deny`
# set that names which condition failed so an audit record can carry the reason.
#
# What it is not: the evaluator the gateway runs. That is
# `packages/platform/src/policy/engine.ts`, which is fail-closed in the same
# order (tenant first, then grant, then scope and consent, then obligations)
# and is held by its own tests. This file is the contract both are measured
# against; a divergence between them is a bug in one of them, never a feature.
#
# One deliberate difference from the specification's sketch: permissions are
# `resource.action.scope` and the resource may itself be dotted
# (`student.course.read.own`), so "is this a read" looks at the segment before
# the scope rather than comparing the whole key to `resource.read`.
package semester.access

import rego.v1

default allow := false

allow if {
	input.actor.authenticated == true
	input.actor.tenant_id == input.resource.tenant_id
	has_grant(actor_grants, input.action)
	resource_scope_allows
	consent_allows
	authority_allows
	integration_allows
	risk_obligations_satisfied
}

# Absent grants are an empty set, not an undefined expression: an actor with no
# grants field is denied *and* told why, rather than denied silently.
actor_grants := object.get(input, ["actor", "grants"], [])

has_grant(grants, action) if {
	some grant in grants
	grant.permission == action
	grant.state == "active"
	not grant.expired
}

resource_scope_allows if {
	input.resource.scope == "own"
	input.resource.owner_account_id == input.actor.account_id
}

resource_scope_allows if {
	input.resource.scope != "own"
	some id in input.actor.scope_ids
	id == input.resource.scope_id
}

consent_allows if not input.resource.requires_consent

consent_allows if {
	input.resource.requires_consent
	input.consent.state == "active"
	some scope in input.consent.scope
	scope == input.action
	time.now_ns() < input.consent.expires_at_ns
}

authority_allows if input.resource.authority != "external_read_only"

authority_allows if action_verb(input.action) == "read"

# The verb of `resource.action.scope`: the segment before the scope.
action_verb(action) := verb if {
	parts := split(action, ".")
	count(parts) >= 3
	verb := parts[count(parts) - 2]
}

integration_allows if not input.resource.requires_fresh_integration

integration_allows if {
	input.resource.requires_fresh_integration
	input.integration.health == "healthy"
}

risk_obligations_satisfied if input.risk_tier < 2

risk_obligations_satisfied if {
	input.risk_tier >= 2
	input.approval.status == "approved"
}

# Why not, for the audit record. Empty exactly when `allow` is true.
deny contains "unauthenticated" if not input.actor.authenticated == true

deny contains "tenant_mismatch" if input.actor.tenant_id != input.resource.tenant_id

deny contains "no_active_grant" if not has_grant(actor_grants, input.action)

deny contains "out_of_scope" if not resource_scope_allows

deny contains "consent_required" if not consent_allows

deny contains "authority_read_only" if not authority_allows

deny contains "integration_unhealthy" if not integration_allows

deny contains "approval_required" if not risk_obligations_satisfied
