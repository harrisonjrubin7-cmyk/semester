package semester.registration_test

import rego.v1

import data.semester.access

student := {"accountId": "s1", "tenantId": "vu", "membershipActive": true, "grants": ["student.registration.read", "student.registration.submit"]}

sis_record := {"tenantId": "vu", "authority": "external_read_only"}

semester_request := {"tenantId": "vu", "authority": "native"}

test_student_can_submit_a_semester_request if access.allow with input as {"actor": student, "resource": semester_request, "action": "student.registration.submit"}

test_student_cannot_write_sis_enrollment_directly if not access.allow with input as {"actor": student, "resource": sis_record, "action": "student.registration.submit"}

test_student_can_read_sis_enrollment if access.allow with input as {"actor": student, "resource": sis_record, "action": "student.registration.read"}

test_student_cannot_apply_override if not access.allow with input as {"actor": student, "resource": semester_request, "action": "registrar.registration.override"}

test_other_institution_denied if not access.allow with input as {"actor": student, "resource": {"tenantId": "other", "authority": "native"}, "action": "student.registration.submit"}

test_ai_actor_without_grant_denied if not access.allow with input as {
	"actor": {"accountId": "ai-gateway", "tenantId": "vu", "membershipActive": true, "grants": ["student.registration.read"]},
	"resource": semester_request,
	"action": "student.registration.submit",
}
