# Semester access policy v3 (Rego v1). OPA is the decision engine only: not the authenticator or enforcement point.
# Trusted server code validates input, collects context, verifies provenance. Not compiled: run `opa check --strict semester_access.rego` and `opa test . -v`.
package semester.access

import rego.v1

default outcome := "deny"

action_rule := data.semester.actions[input.action]

context_valid if {
	input.context.verified == true
	input.subject.authenticated == true
	input.subject.active == true
	input.subject.id == input.membership.subject_id
	input.membership.active == true
	input.membership.tenant_id == input.resource.tenant_id
	input.context.policy_revision == data.semester.policy_revision
	input.context.access_revision == input.subject.access_revision
	input.context.now_epoch < input.context.expires_epoch
	input.context.now_epoch < input.subject.session_expires_epoch
	input.request_digest != ""
}

capability_valid if {
	action_rule.capability in input.subject.capabilities
}

relationship_valid if {
	some relation in input.relationships
	relation in action_rule.relationships
}

risk_valid if {
	input.risk.verified == true
	input.risk.status == "valid"
	input.risk.model_version == action_rule.risk_model
	input.context.now_epoch < input.risk.expires_epoch
	input.risk.score >= action_rule.minimum_score
}

sharing_valid if {
	action_rule.sharing_required == false
}

sharing_valid if {
	action_rule.sharing_required == true
	input.sharing.verified == true
	input.sharing.active == true
	input.sharing.subject_id == input.subject.id
	input.sharing.resource_id == input.resource.id
	input.sharing.action == input.action
	input.context.now_epoch < input.sharing.expires_epoch
}

base_valid if {
	context_valid
	capability_valid
	relationship_valid
	risk_valid
	sharing_valid
}

authentication_valid if {
	input.subject.authentication_level >= action_rule.authentication_level
}

approval_valid if {
	action_rule.approval_required == false
}

approval_valid if {
	action_rule.approval_required == true
	input.approval.verified == true
	input.approval.status == "approved"
	input.approval.rule_id == action_rule.approval_rule_id
	input.approval.subject_id == input.subject.id
	input.approval.resource_id == input.resource.id
	input.approval.action == input.action
	input.approval.request_digest == input.request_digest
	input.approval.resource_version == input.resource.version
	input.approval.approver_eligible_now == true
	input.approval.approver_id != input.subject.id
	input.context.now_epoch < input.approval.expires_epoch
}

outcome := "require_step_up" if {
	base_valid
	not authentication_valid
}

outcome := "require_approval" if {
	base_valid
	authentication_valid
	not approval_valid
}

outcome := "allow" if {
	base_valid
	authentication_valid
	approval_valid
}

decision := {
	"outcome": outcome,
	"policy_revision": data.semester.policy_revision,
	"obligations": {
		"audit_required": true,
		"resource_version_check": true
	}
}
