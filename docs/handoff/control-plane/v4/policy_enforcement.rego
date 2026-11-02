# PEP: per-request enforcement against a verified grant, fresh revocation state and current policy.
# verified flags come from trusted code, never request bodies. The PEP must actually perform obligations (masking, row limits, audit).
package semester.pep

import rego.v1

default allow := false

allow if {
	input.context.verified == true
	input.grant.verified == true
	input.revocation.verified == true
	input.revocation.fresh == true
	input.revocation.revoked == false
	input.grant.subject_id == input.subject.id
	input.grant.tenant_id == input.resource.tenant_id
	input.grant.resource_id == input.resource.id
	input.action in input.grant.actions
	input.grant.generation > input.revocation.revoked_through_generation
	input.context.now_epoch < input.grant.expires_epoch
	input.subject.active == true
	input.membership.active == true
	input.membership.subject_id == input.subject.id
	input.membership.tenant_id == input.resource.tenant_id
	input.current_policy.outcome == "allow"
	input.grant.policy_revision == input.current_policy.policy_revision
	input.grant.access_revision == input.context.access_revision
	input.enforcement.audit_available == true
	input.enforcement.supports_required_obligations == true
}
