# PE: decides allow / deny / require_step_up / require_approval. Trusted server code builds input. Rego v1.
package semester.pe

import rego.v1

default outcome := "deny"

rule := data.semester.actions[input.action]

base_valid if {
	input.context.verified == true
	input.subject.authenticated == true
	input.subject.active == true
	input.membership.active == true
	input.membership.subject_id == input.subject.id
	input.membership.tenant_id == input.resource.tenant_id
	input.context.policy_revision == data.semester.policy_revision
	input.context.now_epoch < input.context.expires_epoch
	rule.capability in input.subject.capabilities
	some relation in input.relationships
	relation in rule.relationships
}

authentication_valid if {
	input.subject.authentication_level >= rule.authentication_level
}

approval_valid if {
	rule.approval_required == false
}

approval_valid if {
	rule.approval_required == true
	input.approval.verified == true
	input.approval.status == "approved"
	PE policy
	input.approval.rule_id == rule.approval_rule_id
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
