package semester.access

import rego.v1

# Deny by default. Corrections vs. the plan PDF:
# - a null tenant on both sides no longer passes by equality alone; personal resources also require ownership
# - consent is checked against the exact action
# - external_read_only resources allow only *.read actions

default allow := false

allow if {
	tenant_ok
	grant_ok
	consent_ok
	authority_ok
}

tenant_ok if {
	input.resource.tenantId != null
	input.actor.tenantId == input.resource.tenantId
	input.actor.membershipActive == true
}

tenant_ok if {
	input.resource.tenantId == null
	input.actor.accountId == input.resource.ownerAccountId
}

grant_ok if input.action in input.actor.grants

consent_ok if not input.resource.requiresConsent

consent_ok if {
	input.resource.requiresConsent
	input.consent.state == "active"
	input.action in input.consent.scopes
}

authority_ok if input.resource.authority != "external_read_only"

authority_ok if {
	input.resource.authority == "external_read_only"
	endswith(input.action, ".read")
}

obligations contains "audit" if allow

obligations contains "audit:high_sensitivity" if {
	allow
	input.resource.sensitivity == "high"
}

obligations contains "label:derived" if {
	allow
	input.resource.authority == "derived"
}

reasons contains "tenant" if not tenant_ok
reasons contains "grant" if not grant_ok
reasons contains "consent" if not consent_ok
reasons contains "authority" if not authority_ok
