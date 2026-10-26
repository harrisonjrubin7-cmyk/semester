# Saga transition guard (Rego v1). Controls valid state progression; complements, never replaces,
# the PE access policy (policy_engine.rego) and PEP enforcement policy (policy_enforcement.rego).
# Prefer generating candidate transitions from typed result handlers; this is an extra guard,
# not a substitute for validating what each result means.
# Corrections vs the PDF: adds import rego.v1 and default allow := false; replaces the
# parenthesized boolean with the reactivation_blocked helper (as the PDF itself instructs).
package semester.saga

import rego.v1

default allow := false

terminal_states := {"DENIED", "CLOSED"}

edges := {
	"EVALUATING": {"EVALUATING", "WAITING", "PREPARING", "DENIED", "COMPENSATING"},
	"WAITING": {"WAITING", "EVALUATING", "COMPENSATING"},
	"PREPARING": {"PREPARING", "INSTALLING", "COMPENSATING"},
	"INSTALLING": {"INSTALLING", "VERIFYING", "RECONCILING", "COMPENSATING"},
	"VERIFYING": {"VERIFYING", "ACTIVE", "RECONCILING", "COMPENSATING"},
	"RECONCILING": {"RECONCILING", "ACTIVE", "COMPENSATING"},
	"ACTIVE": {"ACTIVE", "COMPENSATING"},
	"COMPENSATING": {"COMPENSATING", "RECOVERY_REQUIRED", "CLOSED"},
	"RECOVERY_REQUIRED": {"RECOVERY_REQUIRED", "COMPENSATING", "CLOSED"},
}

identity_stable if {
	input.contextVerified == true
	input.current.id == input.next.id
	input.current.tenantId == input.next.tenantId
	input.current.requestDigest == input.next.requestDigest
	input.next.revision == input.current.revision + 1
}

generation_valid if {
	input.next.generation == input.current.generation
}

generation_valid if {
	input.current.state == "WAITING"
	input.next.state == "EVALUATING"
	input.evidence.source == "verified_signal"
	input.next.generation == input.current.generation + 1
}

cancellation_monotonic if {
	input.current.cancellationRequested == false
}

cancellation_monotonic if {
	input.current.cancellationRequested == true
	input.next.cancellationRequested == true
}

participant_verified if {
	input.evidence.source == "participant"
	input.evidence.participantVerified == true
	input.evidence.commandMatched == true
	input.evidence.tenantMatched == true
	input.evidence.generationMatched == true
	input.evidence.expectedOperation == true
}

progress_verified if {
	input.next.state == input.current.state
}

progress_verified if {
	input.next.state in {"COMPENSATING", "RECOVERY_REQUIRED", "RECONCILING"}
}

progress_verified if {
	input.current.state == "WAITING"
	input.next.state == "EVALUATING"
	input.evidence.source == "verified_signal"
}

progress_verified if {
	participant_verified
}

activation_safe if {
	input.next.state != "ACTIVE"
}

activation_safe if {
	input.next.state == "ACTIVE"
	participant_verified
	input.next.cancellationRequested == false
}

closure_safe if {
	input.next.state != "CLOSED"
}

closure_safe if {
	input.next.state == "CLOSED"
	participant_verified
	input.evidence.cleanupVerified == true
	input.next.compensation.paRevoked == true
	input.next.compensation.pepRemoved == true
}

reactivation_blocked if {
	input.current.cancellationRequested == true
	input.next.state == "ACTIVE"
}

allow if {
	identity_stable
	generation_valid
	cancellation_monotonic
	progress_verified
	activation_safe
	closure_safe
	not input.current.state in terminal_states
	input.next.state in edges[input.current.state]
	not reactivation_blocked
}
