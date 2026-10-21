# Baseline saga transition guard (Rego v1) for the baseline worker's state set.
# Narrow guard: complements zta.rego, never replaces current access checks.
# Input uses snake_case; ONE explicit adapter in the worker maps camelCase saga fields to it.
# The worker builds input from trusted state and verified receipts; callers can't submit producer_verified or cleanup flags.
package semester.saga

import rego.v1

default allow := false

terminal := {"DENIED", "CLOSED"}

cleanup := {"REVOKE_PA", "REMOVE_PEP", "VERIFY_CLEANUP"}

edges := {
	"EVALUATE": {"EVALUATE", "WAIT", "PREPARE", "DENIED", "REVOKE_PA"},
	"WAIT": {"WAIT", "EVALUATE", "REVOKE_PA"},
	"PREPARE": {"PREPARE", "INSTALL", "REVOKE_PA"},
	"INSTALL": {"INSTALL", "INSPECT", "REVOKE_PA"},
	"INSPECT": {"INSPECT", "ACTIVE", "REVOKE_PA"},
	"ACTIVE": {"ACTIVE", "REVOKE_PA"},
	"REVOKE_PA": {"REVOKE_PA", "REMOVE_PEP"},
	"REMOVE_PEP": {"REMOVE_PEP", "VERIFY_CLEANUP"},
	"VERIFY_CLEANUP": {"VERIFY_CLEANUP", "CLOSED", "REVOKE_PA"},
}

stable_identity if {
	input.context_verified == true
	input.current.id == input.next.id
	input.current.tenant_id == input.next.tenant_id
	input.current.request_digest == input.next.request_digest
	input.next.revision == input.current.revision + 1
}

reply_verified if {
	input.evidence.producer_verified == true
	input.evidence.command_matched == true
	input.evidence.generation_matched == true
	input.evidence.tenant_matched == true
	input.evidence.expected_operation == true
}

generation_valid if input.next.generation == input.current.generation

generation_valid if {
	input.current.state == "WAIT"
	input.next.state == "EVALUATE"
	input.evidence.signal_verified == true
	input.next.generation == input.current.generation + 1
}

progress_valid if input.next.state == input.current.state

progress_valid if {
	input.next.state == "REVOKE_PA"
	input.next.cancelled == true
}

progress_valid if {
	input.current.state == "WAIT"
	input.next.state == "EVALUATE"
	input.evidence.signal_verified == true
}

progress_valid if {
	not input.next.state in {"REVOKE_PA", "EVALUATE"}
	reply_verified
}

progress_valid if {
	input.current.state != "WAIT"
	input.next.state == "EVALUATE"
	reply_verified
}

cancellation_preserved if input.current.cancelled == false

cancellation_preserved if {
	input.current.cancelled == true
	input.next.cancelled == true
}

activation_valid if input.next.state != "ACTIVE"

activation_valid if {
	input.next.state == "ACTIVE"
	input.next.cancelled == false
	reply_verified
	input.evidence.enforcement_valid == true
}

closure_valid if input.next.state != "CLOSED"

closure_valid if {
	input.next.state == "CLOSED"
	input.current.state == "VERIFY_CLEANUP"
	reply_verified
	input.evidence.pa_revoked == true
	input.evidence.pep_absent == true
}

no_forward_after_cancel if input.current.cancelled == false

no_forward_after_cancel if {
	input.current.cancelled == true
	input.next.state in (cleanup | terminal)
}

allow if {
	stable_identity
	generation_valid
	progress_valid
	cancellation_preserved
	activation_valid
	closure_valid
	no_forward_after_cancel
	not input.current.state in terminal
	input.next.state in edges[input.current.state]
}
