package semester.readiness

import rego.v1

default allow := false

allow if {
	input.actor.authenticated
	input.actor.tenant_id == input.record.tenant_id
	input.actor.membership_active
	input.record.authority.owner_type == "institution"
	input.action == "readiness.evaluate"
	input.record.authority.freshness_state == "current"
	subject_ok
}

subject_ok if input.actor.account_id == input.record.student_id
subject_ok if {
	input.actor.role in {"registrar", "advisor"}
	input.record.student_id in input.actor.caseload
}

obligations contains "WRITE_AUDIT_EVENT" if allow
obligations contains "SHOW_SOURCE_LINE" if allow
obligations contains "ISSUE_RECEIPT" if allow

# Ordered: the first matching reason wins, so two true conditions can't conflict.
deny_reason := "AUTHENTICATION_REQUIRED" if not input.actor.authenticated
else := "TENANT_SCOPE_MISMATCH" if input.actor.tenant_id != input.record.tenant_id
else := "MEMBERSHIP_REQUIRED" if not input.actor.membership_active
else := "RECORD_SCOPE_DENIED" if not subject_ok
else := "FRESHNESS_BLOCKED" if input.record.authority.freshness_state != "current"
else := "AUTHORITY_REQUIRED" if input.record.authority.owner_type != "institution"
else := "ALLOWED" if allow
else := "ROLE_REQUIRED"
