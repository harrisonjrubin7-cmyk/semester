package semester.workflows_test

import rego.v1

import data.semester.workflows

sha := "3d3c42e5aac5ba805825da76410c181273ba90b1"

good := {
	"permissions": {"contents": "read"},
	"on": {"push": {}},
	"jobs": {"build": {"steps": [{"uses": sprintf("actions/checkout@%s", [sha])}, {"run": "npm test"}]}},
}

test_clean_workflow_passes if {
	count(workflows.deny) == 0 with input as good with data.workflow_file as "ci.yml"
}

test_tag_pinned_action_is_denied if {
	bad := object.union(good, {"jobs": {"build": {"steps": [{"uses": "actions/checkout@v4"}]}}})
	some m in workflows.deny with input as bad with data.workflow_file as "ci.yml"
	contains(m, "not pinned")
}

test_branch_pinned_action_is_denied if {
	bad := object.union(good, {"jobs": {"build": {"steps": [{"uses": "actions/checkout@main"}]}}})
	count(workflows.deny) > 0 with input as bad with data.workflow_file as "ci.yml"
}

test_local_action_needs_no_pin if {
	ok := object.union(good, {"jobs": {"build": {"steps": [{"uses": "./.github/actions/x"}]}}})
	count(workflows.deny) == 0 with input as ok with data.workflow_file as "ci.yml"
}

test_missing_permissions_is_denied if {
	bad := object.remove(good, ["permissions"])
	some m in workflows.deny with input as bad with data.workflow_file as "ci.yml"
	contains(m, "no top-level `permissions:`")
}

test_write_all_is_denied if {
	bad := object.union(object.remove(good, ["permissions"]), {"permissions": "write-all"})
	count(workflows.deny) > 0 with input as bad with data.workflow_file as "ci.yml"
}

test_top_level_id_token_is_denied if {
	bad := object.union(good, {"permissions": {"contents": "read", "id-token": "write"}})
	some m in workflows.deny with input as bad with data.workflow_file as "ci.yml"
	contains(m, "id-token")
}

test_pull_request_target_is_denied if {
	bad := object.union(good, {"on": {"pull_request_target": {}}})
	some m in workflows.deny with input as bad with data.workflow_file as "ci.yml"
	contains(m, "pull_request_target")
}

test_the_yaml_1_1_on_key_is_still_read if {
	# OPA hands `on:` over as "true"; a policy blind to that passes everything.
	bad := object.union(object.remove(good, ["on"]), {"true": {"pull_request_target": {}}})
	some m in workflows.deny with input as bad with data.workflow_file as "ci.yml"
	contains(m, "pull_request_target")
}

test_pr_title_in_a_shell_is_denied if {
	bad := object.union(good, {"jobs": {"x": {"steps": [{"run": "echo ${{ github.event.pull_request.title }}"}]}}})
	some m in workflows.deny with input as bad with data.workflow_file as "ci.yml"
	contains(m, "interpolated straight into a shell")
}

test_pr_title_through_env_is_fine if {
	ok := object.union(good, {"jobs": {"x": {"steps": [{"env": {"T": "${{ github.event.pull_request.title }}"}, "run": "echo \"$T\""}]}}})
	count(workflows.deny) == 0 with input as ok with data.workflow_file as "ci.yml"
}

test_workflow_input_in_a_shell_is_denied if {
	bad := object.union(good, {"jobs": {"x": {"steps": [{"run": "deploy ${{ inputs.target }}"}]}}})
	count(workflows.deny) > 0 with input as bad with data.workflow_file as "ci.yml"
}

test_secrets_inherit_is_denied if {
	bad := object.union(good, {"jobs": {"x": {"uses": sprintf("org/repo/.github/workflows/w.yml@%s", [sha]), "secrets": "inherit"}}})
	some m in workflows.deny with input as bad with data.workflow_file as "ci.yml"
	contains(m, "secrets: inherit")
}

test_deploy_workflow_without_environment_is_denied if {
	some m in workflows.deny with input as good with data.workflow_file as "pages.yml"
	contains(m, "no job declares")
}

test_deploy_workflow_with_environment_passes if {
	ok := object.union(good, {"jobs": {"deploy": {"environment": "production", "steps": [{"run": "x"}]}}})
	count(workflows.deny) == 0 with input as ok with data.workflow_file as "pages.yml"
}

exc := [{"workflow": "pages.yml", "match": "no job declares", "expires": "2030-01-01", "record": "r"}]

test_a_live_exception_silences_exactly_its_finding if {
	count(workflows.deny) == 0 with input as good with data.workflow_file as "pages.yml" with data.exceptions as exc with data.clock as {"now_ns": 1700000000000000000}
}

test_an_exception_does_not_cover_another_workflow if {
	count(workflows.deny) > 0 with input as good with data.workflow_file as "functions.yml" with data.exceptions as exc with data.clock as {"now_ns": 1700000000000000000}
}

test_an_exception_does_not_cover_a_different_finding if {
	bad := object.union(good, {"jobs": {"deploy": {"steps": [{"uses": "actions/checkout@v4"}]}}})
	some m in workflows.deny with input as bad with data.workflow_file as "pages.yml" with data.exceptions as exc with data.clock as {"now_ns": 1700000000000000000}
	contains(m, "not pinned")
}

test_an_expired_exception_is_a_violation_and_stops_covering if {
	late := {"now_ns": 1893542400000000000} # 2030-01-02T00:00:00Z
	msgs := workflows.deny with input as good with data.workflow_file as "pages.yml" with data.exceptions as exc with data.clock as late
	some m in msgs
	contains(m, "expired")
	some m2 in msgs
	contains(m2, "no job declares")
}
