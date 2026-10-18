package semester.access

import rego.v1

default allow_with_context := {
  "allow": false,
  "reasons": ["default_deny"],
  "obligations": [],
}

allow_with_context := {
  "allow": true,
  "reasons": ["tenant_match", "grant_present"],
  "obligations": build_obligations,
} if {
  input.actor.tenantId == input.resource.tenantId
  input.action == input.actor.grants[_]
}

build_obligations := ["audit"] if {
  input.resource.sensitivity == "high"
}

# `not` rather than `!=`: an omitted sensitivity leaves the comparison undefined,
# and only `not` succeeds on undefined.
build_obligations := [] if {
  not input.resource.sensitivity == "high"
}
