# Policy for a Terraform plan. Input: `terraform show -json plan.out`.
# Context (not part of the plan) comes from `data.run`:
#
#   {"run": {"environment": "production", "approved_destroys": ["address", …]}}
#
# These rules do not restate what the modules already refuse at plan time with
# variable validations and preconditions; they check what the plan *resolved
# to*, which is what would actually be applied — including a module edited, a
# variable overridden on the command line, or an import skipped.
package semester.terraform

import rego.v1

changes := [rc |
	some rc in input.resource_changes
	not rc.change.actions == ["no-op"]
	not rc.change.actions == ["read"]
]

of_type(t) := [rc | some rc in changes; rc.type == t]

after(rc) := object.get(rc.change, "after", {})

# ── Nothing protective is destroyed or replaced as a side effect ─────────────

protected := {
	"supabase_project",
	"supabase_settings",
	"vercel_firewall_config",
	"github_repository_ruleset",
	"github_repository_environment",
	"github_actions_repository_permissions",
}

deny contains msg if {
	some rc in changes
	rc.type in protected
	"delete" in rc.change.actions
	not rc.address in object.get(data.run, "approved_destroys", [])
	msg := sprintf("%s would be destroyed or replaced (%v); removal of a protective control needs its own change record and `approved_destroys`", [rc.address, rc.change.actions])
}

# ── No escape hatches ────────────────────────────────────────────────────────

deny contains msg if {
	some rc in changes
	rc.type in {"null_resource", "terraform_data"}
	msg := sprintf("%s: %s can run arbitrary commands outside the provider's schema; model it as a resource or do it in the pipeline", [rc.address, rc.type])
}

# ── Production is adopted, never created ─────────────────────────────────────

deny contains msg if {
	data.run.environment == "production"
	some rc in changes
	rc.type in {"supabase_project", "supabase_settings"}
	"create" in rc.change.actions
	msg := sprintf("%s would be created in production; the live project is adopted by `import`, so a create means the import was skipped", [rc.address])
}

# ── GitHub ───────────────────────────────────────────────────────────────────

deny contains msg if {
	some rc in of_type("github_repository_environment")
	after(rc).environment in {"production", "infrastructure-production"}
	count(object.get(after(rc), "reviewers", [])) == 0
	msg := sprintf("%s: environment '%s' has no required reviewers", [rc.address, after(rc).environment])
}

deny contains msg if {
	some rc in of_type("github_repository_environment")
	after(rc).environment in {"production", "infrastructure-production"}
	after(rc).can_admins_bypass != false
	msg := sprintf("%s: administrators can bypass the '%s' gate", [rc.address, after(rc).environment])
}

deny contains msg if {
	some rc in of_type("github_actions_repository_permissions")
	after(rc).sha_pinning_required != true
	msg := sprintf("%s: SHA pinning is not required for actions", [rc.address])
}

deny contains msg if {
	some rc in of_type("github_actions_repository_permissions")
	after(rc).allowed_actions == "all"
	msg := sprintf("%s: every action on the marketplace is allowed", [rc.address])
}

deny contains msg if {
	some rc in of_type("github_workflow_repository_permissions")
	after(rc).default_workflow_permissions != "read"
	msg := sprintf("%s: the default workflow token can write", [rc.address])
}

deny contains msg if {
	some rc in of_type("github_workflow_repository_permissions")
	after(rc).can_approve_pull_request_reviews == true
	msg := sprintf("%s: workflows can approve pull requests, which defeats required review", [rc.address])
}

deny contains msg if {
	some rc in of_type("github_repository_ruleset")
	after(rc).enforcement != "active"
	msg := sprintf("%s: ruleset enforcement is '%s', not 'active'", [rc.address, after(rc).enforcement])
}

deny contains msg if {
	some rc in of_type("github_repository_ruleset")
	some actor in object.get(after(rc), "bypass_actors", [])
	actor.bypass_mode == "always"
	msg := sprintf("%s: a bypass actor can skip the ruleset without a pull request", [rc.address])
}

# ── Supabase ─────────────────────────────────────────────────────────────────

deny contains msg if {
	some rc in of_type("supabase_settings")
	after(rc).ssl_enforcement != true
	msg := sprintf("%s: TLS to the database is not enforced", [rc.address])
}

deny contains msg if {
	data.run.environment == "production"
	some rc in of_type("supabase_settings")
	not restricted(after(rc))
	msg := sprintf("%s: direct database access is open to any address", [rc.address])
}

restricted(settings) if {
	net := json.unmarshal(settings.network)
	count(net.db_allowed_cidrs) > 0
	not "0.0.0.0/0" in net.db_allowed_cidrs
}

# ── Vercel ───────────────────────────────────────────────────────────────────

deny contains msg if {
	some rc in of_type("vercel_firewall_config")
	after(rc).enabled == false
	msg := sprintf("%s: the firewall is switched off", [rc.address])
}

deny contains msg if {
	some rc in of_type("vercel_firewall_config")
	some name, rule in after(rc).managed_rulesets.owasp
	rule.action == "log"
	msg := sprintf("%s: OWASP rule '%s' only logs; it must deny", [rc.address, name])
}
