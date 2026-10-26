# Unified PE / PA / PEP policy (Rego v1). Semester-specific, inspired by NIST roles — not "NIST-certified".
# One input contract assembled by trusted server code; booleans are verified facts, never browser or broker values.
# conditions.satisfied comes from a reviewed conditions evaluator (approval, sharing, workflow, institutional constraints).
# pa_revoke is deliberately independent of the student's membership: cleanup must stay possible after authority ends.
package semester.zta

import rego.v1

default pe_allow := false

default pa_prepare := false

default pa_revoke := false

default pep_allow := false

identity_valid if {
	input.context.verified == true
	input.subject.authenticated == true
	input.subject.active == true
	input.membership.active == true
	input.membership.subject_id == input.subject.id
	input.membership.tenant_id == input.resource.tenant_id
	input.context.now < input.context.expires_at
	input.context.now < input.subject.session_expires_at
}

pe_allow if {
	identity_valid
	rule := data.semester.actions[input.action]
	rule.capability in input.subject.capabilities
	input.subject.authentication_level >= rule.authentication_level
	some relation in input.relationships
	relation in rule.relationships
	input.context.policy_revision == data.semester.policy_revision
	input.conditions.satisfied == true
}

pa_prepare if {
	input.context.verified == true
	input.workload.verified == true
	input.workload.id == "access-orchestrator"
	"grant.prepare" in input.workload.capabilities
	input.decision.verified == true
	input.decision.outcome == "allow"
	input.decision.subject_id == input.subject.id
	input.decision.tenant_id == input.resource.tenant_id
	input.decision.resource_id == input.resource.id
	input.decision.action == input.action
	input.decision.request_digest == input.request_digest
	input.decision.policy_revision == data.semester.policy_revision
	input.decision.access_revision == input.context.access_revision
	input.context.now < input.decision.expires_at
	input.revocation.verified == true
	input.revocation.fresh == true
	input.generation > input.revocation.revoked_through_generation
}

pa_revoke if {
	input.context.verified == true
	input.workload.verified == true
	"grant.revoke" in input.workload.capabilities
	input.workload.tenant_id == input.resource.tenant_id
	input.revocation_request.verified == true
	input.revocation_request.saga_id == input.saga_id
	input.revocation_request.tenant_id == input.resource.tenant_id
}

pep_allow if {
	pe_allow
	input.grant.verified == true
	input.grant.subject_id == input.subject.id
	input.grant.tenant_id == input.resource.tenant_id
	input.grant.resource_id == input.resource.id
	input.action in input.grant.actions
	input.grant.policy_revision == data.semester.policy_revision
	input.grant.access_revision == input.context.access_revision
	input.context.now < input.grant.expires_at
	input.revocation.verified == true
	input.revocation.fresh == true
	input.grant.generation > input.revocation.revoked_through_generation
	input.enforcement.required_obligations_supported == true
	input.enforcement.required_audit_available == true
}
