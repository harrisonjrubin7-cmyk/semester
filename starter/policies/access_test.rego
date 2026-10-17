package semester.access_test

import rego.v1

import data.semester.access

base := {
  "actor": {"accountId": "a1", "tenantId": "t1", "grants": ["student.tasks.create"]},
  "resource": {"tenantId": "t1", "sensitivity": "moderate"},
  "action": "student.tasks.create",
}

test_allow_when_tenant_and_grant_match if {
  access.allow_with_context.allow with input as base
}

test_deny_on_cross_tenant if {
  not access.allow_with_context.allow with input as object.union(base, {"resource": {"tenantId": "t2", "sensitivity": "moderate"}})
}

test_deny_without_grant if {
  not access.allow_with_context.allow with input as object.union(base, {"actor": {"accountId": "a1", "tenantId": "t1", "grants": []}})
}

test_deny_when_action_not_granted if {
  not access.allow_with_context.allow with input as object.union(base, {"action": "student.tasks.delete"})
}

test_high_sensitivity_requires_audit if {
  "audit" in access.allow_with_context.obligations with input as object.union(base, {"resource": {"tenantId": "t1", "sensitivity": "high"}})
}
