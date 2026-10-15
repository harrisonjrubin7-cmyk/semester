package semester.delegation
import rego.v1
prohibited := {"gradebook_full_access", "advising_notes", "private_study_history", "private_messages", "broad_academic_record_export"}
default allow := false
allow if {
  some g in data.grants
  g.student_id == input.resource.student_id
  g.recipient_id == input.actor.id
  g.tenant_id == input.tenant_id
  input.scope in g.scopes
  not input.scope in prohibited
  not g.revoked_at
  time.parse_rfc3339_ns(g.expires_at) > time.now_ns()
}
deny_reason := "prohibited scope" if input.scope in prohibited
