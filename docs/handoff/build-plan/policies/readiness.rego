package semester.readiness

import rego.v1

# Corrections vs. the PDF: deny reasons are a SET (multiple single-value rules with := raise an evaluation
# conflict when two apply at once), and actor permissions come from the server's grant lookup, never the client.

default allow := false

allow if {
	input.command == "readiness.evaluate"
	base_ok
	input.actor.account_id == input.resource.student_account_id
	input.source_context.required_sources_known
}

allow if {
	input.command == "readiness.case.route"
	base_ok
	input.actor.permissions["registrar.readiness.case.route"]
	input.resource.state == "needs_review"
}

allow if {
	input.command == "override.decide"
	base_ok
	input.actor.permissions["registrar.readiness.override.decide"]
	input.actor.account_id != input.resource.requested_by_account_id
}

base_ok if {
	input.actor.authenticated
	input.actor.membership.active
	input.actor.tenant_id == input.resource.tenant_id
}

deny_reasons contains "not_authenticated" if not input.actor.authenticated
deny_reasons contains "inactive_membership" if { input.actor.authenticated; not input.actor.membership.active }
deny_reasons contains "tenant_scope_mismatch" if input.actor.tenant_id != input.resource.tenant_id
deny_reasons contains "missing_permission" if { input.command == "readiness.case.route"; not input.actor.permissions["registrar.readiness.case.route"] }
deny_reasons contains "self_approval" if { input.command == "override.decide"; input.actor.account_id == input.resource.requested_by_account_id }
deny_reasons contains "sources_unknown" if { input.command == "readiness.evaluate"; not input.source_context.required_sources_known }

obligations contains "write_audit_event" if allow
obligations contains "issue_receipt" if allow
obligations contains "require_source_disclosure" if input.command == "readiness.evaluate"
obligations contains "block_definitive_outcome" if input.source_context.any_required_stale

decision := {"result": result, "reasons": deny_reasons, "obligations": obligations}
result := "allow" if allow
result := "deny" if not allow
