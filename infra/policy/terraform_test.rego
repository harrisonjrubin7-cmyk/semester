package semester.terraform_test

import rego.v1

import data.semester.terraform

good := json.unmarshal(`{"resource_changes": []}`)

plan(rcs) := {"resource_changes": rcs}

rc(type, actions, after_) := {"address": sprintf("m.%s.this", [type]), "type": type, "change": {"actions": actions, "after": after_}}

has(rcs, needle) if {
	some m in terraform.deny with input as plan(rcs) with data.run as {"environment": "production"}
	contains(m, needle)
}

clean(rcs) if count(terraform.deny) == 0 with input as plan(rcs) with data.run as {"environment": "production"}

test_an_empty_plan_is_clean if clean([])

test_destroying_a_protective_control_is_denied if has([rc("vercel_firewall_config", ["delete"], {})], "would be destroyed")

test_replacing_one_is_denied if has([rc("github_repository_ruleset", ["delete", "create"], {"enforcement": "active"})], "would be destroyed")

test_an_approved_destroy_is_allowed if {
	count(terraform.deny) == 0 with input as plan([rc("vercel_firewall_config", ["delete"], {})]) with data.run as {"environment": "staging", "approved_destroys": ["m.vercel_firewall_config.this"]}
}

test_null_resource_is_denied if has([rc("null_resource", ["create"], {})], "arbitrary commands")

test_production_settings_create_is_denied if has([rc("supabase_settings", ["create"], {"ssl_enforcement": true, "network": "{\"db_allowed_cidrs\":[\"203.0.113.0/24\"]}"})], "import was skipped")

test_staging_settings_create_is_allowed if {
	count(terraform.deny) == 0 with input as plan([rc("supabase_settings", ["create"], {"ssl_enforcement": true, "network": "{\"db_allowed_cidrs\":[]}"})]) with data.run as {"environment": "staging"}
}

test_production_environment_without_reviewers_is_denied if has([rc("github_repository_environment", ["update"], {"environment": "production", "can_admins_bypass": false, "reviewers": []})], "no required reviewers")

test_staging_environment_needs_no_reviewers if clean([rc("github_repository_environment", ["update"], {"environment": "staging", "can_admins_bypass": true})])

test_admin_bypass_on_production_is_denied if has([rc("github_repository_environment", ["update"], {"environment": "production", "can_admins_bypass": true, "reviewers": [{"users": [1]}]})], "administrators can bypass")

test_unpinned_actions_are_denied if has([rc("github_actions_repository_permissions", ["update"], {"allowed_actions": "selected", "sha_pinning_required": false})], "SHA pinning")

test_all_actions_allowed_is_denied if has([rc("github_actions_repository_permissions", ["update"], {"allowed_actions": "all", "sha_pinning_required": true})], "every action")

test_writable_default_token_is_denied if has([rc("github_workflow_repository_permissions", ["update"], {"default_workflow_permissions": "write", "can_approve_pull_request_reviews": false})], "can write")

test_workflows_approving_prs_is_denied if has([rc("github_workflow_repository_permissions", ["update"], {"default_workflow_permissions": "read", "can_approve_pull_request_reviews": true})], "approve pull requests")

test_disabled_ruleset_is_denied if has([rc("github_repository_ruleset", ["update"], {"enforcement": "evaluate", "bypass_actors": []})], "not 'active'")

test_always_bypass_is_denied if has([rc("github_repository_ruleset", ["update"], {"enforcement": "active", "bypass_actors": [{"bypass_mode": "always"}]})], "without a pull request")

test_database_without_tls_is_denied if has([rc("supabase_settings", ["update"], {"ssl_enforcement": false, "network": "{\"db_allowed_cidrs\":[\"203.0.113.0/24\"]}"})], "TLS")

test_production_database_open_to_the_world_is_denied if has([rc("supabase_settings", ["update"], {"ssl_enforcement": true, "network": "{\"db_allowed_cidrs\":[\"0.0.0.0/0\"]}"})], "open to any address")

test_production_database_with_empty_allow_list_is_denied if has([rc("supabase_settings", ["update"], {"ssl_enforcement": true, "network": "{\"db_allowed_cidrs\":[]}"})], "open to any address")

test_disabled_firewall_is_denied if has([rc("vercel_firewall_config", ["update"], {"enabled": false})], "switched off")

test_owasp_rule_that_only_logs_is_denied if has([rc("vercel_firewall_config", ["update"], {"enabled": true, "managed_rulesets": {"owasp": {"xss": {"action": "log"}}}})], "only logs")

test_the_good_fixture_is_clean if {
	fixture := json.unmarshal(`{"resource_changes":[]}`)
	count(terraform.deny) == 0 with input as fixture with data.run as {"environment": "production"}
}

# ── Against a plan Terraform actually produced ───────────────────────────────
# `fixtures/plan-staging.json` is `terraform show -json` of the staging root
# (placeholder credentials, no network writes). The hand-written fixtures above
# test each rule in isolation; this one tests that the rules read the shape the
# provider really emits — the first draft of the firewall rule did not.

test_the_real_staging_plan_is_clean if {
	count(terraform.deny) == 0 with input as data.fixtures.plan_staging with data.run as {"environment": "staging"}
}

test_the_real_plan_with_a_logging_only_rule_is_denied if {
	mutated := json.patch(data.fixtures.plan_staging, [{"op": "replace", "path": "/resource_changes/0/change/after/managed_rulesets/owasp/xss/action", "value": "log"}])
	some m in terraform.deny with input as mutated with data.run as {"environment": "staging"}
	contains(m, "only logs")
}

test_the_real_plan_with_tls_off_is_denied if {
	i := [j | some j, rc in data.fixtures.plan_staging.resource_changes; rc.type == "supabase_settings"][0]
	mutated := json.patch(data.fixtures.plan_staging, [{"op": "replace", "path": sprintf("/resource_changes/%d/change/after/ssl_enforcement", [i]), "value": false}])
	some m in terraform.deny with input as mutated with data.run as {"environment": "staging"}
	contains(m, "TLS")
}
