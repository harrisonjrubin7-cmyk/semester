package semester.course_grading
import rego.v1
default allow_release := false
allow_release if {
  input.actor.assigned_to_course
  input.actor.role == "instructor"
  input.entry.status in {"reviewed", "approved_for_release"}
  ai_ok
  input.entry.score != null
}
allow_release if {
  input.actor.assigned_to_course
  input.actor.role == "registrar"
  input.entry.status == "approved_for_release"
  ai_ok
  input.entry.score != null
}
ai_ok if not input.entry.ai_contribution.used
ai_ok if input.entry.ai_contribution.reviewed_by_instructor
