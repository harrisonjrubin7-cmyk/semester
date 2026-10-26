# Semester access policy (Rego v1). Input MUST be assembled by trusted server code.
# Never pass browser-supplied authenticated flags, capabilities, trust scores or approval flags.
# Not compiled or tested here: run `opa check --strict access.rego` before use.
package semester.access

import rego.v1

default outcome := "deny"

action_policy := data.semester.actions[input.action]

valid_context if {
	input.context.verified == true
	input.subject.authenticated == true
	input.subject.active == true
	input.membership.active == true
	input.subject.id == input.membership.subject_id
	input.membership.tenant_id == input.resource.tenant_id
	input.context.access_revision == input.subject.access_revision
	input.context.policy_revision == data.semester.policy_revision
	input.context.now_epoch < input.context.expires_epoch
	input.context.now_epoch < input.subject.session_expires_epoch
	is_string(input.request_digest)
	input.request_digest != ""
}

capability_ok if {
	action_policy.required_capability in input.subject.capabilities
}

relationship_ok if {
	some relationship in input.relationships
	relationship in action_policy.allowed_relationships
}

sharing_ok if {
	action_policy.requires_sharing_grant == false
}

sharing_ok if {
	action_policy.requires_sharing_grant == true
	input.sharing.verified == true
	input.sharing.active == true
	input.sharing.subject_id == input.subject.id
	input.sharing.resource_id == input.resource.id
	input.sharing.action == input.action
	input.context.now_epoch < input.sharing.expires_epoch
}

trust_ok if {
	input.trust.verified == true
	input.trust.status == "valid"
	input.trust.model_version == action_policy.trust_model_version
	input.context.now_epoch < input.trust.expires_epoch
	input.trust.score >= action_policy.minimum_score
}

base_ok if {
	valid_context
	capability_ok
	relationship_ok
	sharing_ok
	trust_ok
}

authentication_ok if {
	input.subject.authentication_level >= action_policy.required_authentication_level
}

approval_ok if {
	action_policy.requires_approval == false
}

approval_ok if {
	action_policy.requires_approval == true
	input.approval.verified == true
	input.approval.status == "approved"
	input.approval.rule_id == action_policy.approval_rule_id
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
	base_ok
	not authentication_ok
}

outcome := "require_approval" if {
	base_ok
	authentication_ok
	not approval_ok
}

outcome := "allow" if {
	base_ok
	authentication_ok
	approval_ok
}

reason_codes contains "CONTEXT_INVALID" if not valid_context
reason_codes contains "CAPABILITY_MISSING" if not capability_ok
reason_codes contains "RELATIONSHIP_NOT_PERMITTED" if not relationship_ok
reason_codes contains "SHARING_NOT_PERMITTED" if not sharing_ok
reason_codes contains "TRUST_ASSESSMENT_INVALID_OR_LOW" if not trust_ok

reason_codes contains "STEP_UP_REQUIRED" if {
	base_ok
	not authentication_ok
}

reason_codes contains "APPROVAL_REQUIRED" if {
	base_ok
	authentication_ok
	not approval_ok
}

decision := {
	"outcome": outcome,
	"reason_codes": sort(reason_codes),
	"policy_revision": data.semester.policy_revision,
	"obligations": {
		"audit_required": true,
		"enforce_current_resource_version": true,
	},
}
