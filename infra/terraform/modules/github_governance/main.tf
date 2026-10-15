# What this module owns: the controls that decide who can change production and
# by which path — default-branch rules, deployment environments, and what the
# workflow token and third-party actions are allowed to do.
#
# What it deliberately does not own: the repository itself (name, visibility,
# Pages) — those predate this code and are imported by the platform root, not
# recreated — and any secret value. Secrets are set in the GitHub UI or by the
# secret manager, never by a `.tfvars` file in git.

locals {
  ruleset = jsondecode(file(var.ruleset_file))

  rules             = { for r in local.ruleset.rules : r.type => r }
  pull_request      = try(local.rules["pull_request"].parameters, null)
  required_checks   = try(local.rules["required_status_checks"].parameters, null)
  protected_by_rule = toset([for r in local.ruleset.rules : r.type])
}

# The workflow token starts read-only and cannot approve pull requests. A job
# that needs more says so in its own `permissions:` block, where review sees it.
resource "github_workflow_repository_permissions" "this" {
  repository                       = var.repository
  default_workflow_permissions     = "read"
  can_approve_pull_request_reviews = false
}

# Only GitHub's own actions plus the named list, and every one pinned to a full
# commit SHA — a tag can be moved after review, a SHA cannot.
resource "github_actions_repository_permissions" "this" {
  repository           = var.repository
  enabled              = true
  allowed_actions      = "selected"
  sha_pinning_required = true

  allowed_actions_config {
    github_owned_allowed = true
    verified_allowed     = false
    patterns_allowed     = var.allowed_action_patterns
  }
}

resource "github_repository_ruleset" "default_branch" {
  name        = local.ruleset.name
  repository  = var.repository
  target      = local.ruleset.target
  enforcement = local.ruleset.enforcement

  conditions {
    ref_name {
      include = local.ruleset.conditions.ref_name.include
      exclude = local.ruleset.conditions.ref_name.exclude
    }
  }

  dynamic "bypass_actors" {
    for_each = local.ruleset.bypass_actors
    content {
      actor_type  = bypass_actors.value.actor_type
      actor_id    = bypass_actors.value.actor_id
      bypass_mode = bypass_actors.value.bypass_mode
    }
  }

  rules {
    deletion         = contains(local.protected_by_rule, "deletion")
    non_fast_forward = contains(local.protected_by_rule, "non_fast_forward")

    dynamic "pull_request" {
      for_each = local.pull_request == null ? [] : [local.pull_request]
      content {
        required_approving_review_count   = pull_request.value.required_approving_review_count
        dismiss_stale_reviews_on_push     = pull_request.value.dismiss_stale_reviews_on_push
        require_code_owner_review         = pull_request.value.require_code_owner_review
        require_last_push_approval        = pull_request.value.require_last_push_approval
        required_review_thread_resolution = pull_request.value.required_review_thread_resolution
      }
    }

    dynamic "required_status_checks" {
      for_each = local.required_checks == null ? [] : [local.required_checks]
      content {
        strict_required_status_checks_policy = required_status_checks.value.strict_required_status_checks_policy
        do_not_enforce_on_create             = required_status_checks.value.do_not_enforce_on_create

        dynamic "required_check" {
          for_each = required_status_checks.value.required_status_checks
          content {
            context        = required_check.value.context
            integration_id = required_check.value.integration_id
          }
        }
      }
    }
  }
}

# `staging` deploys on any main commit that passed CI. `production` is the only
# gate a human stands in: reviewers, no admin bypass, and only the default
# branch (or a release tag) may deploy to it.
resource "github_repository_environment" "staging" {
  repository  = var.repository
  environment = "staging"

  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
}

resource "github_repository_environment" "production" {
  repository          = var.repository
  environment         = "production"
  can_admins_bypass   = false
  prevent_self_review = var.prevent_self_review

  reviewers {
    users = var.production_reviewer_user_ids
  }

  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
}

# Read-only plans (the daily drift check and the plan that precedes an apply)
# run here, without a reviewer, because they change nothing. They still only
# run from the default branch, so a pull request cannot borrow the credential.
resource "github_repository_environment" "infrastructure_plan" {
  repository  = var.repository
  environment = "infrastructure-plan"

  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
}

# Infrastructure applies are a third kind of deploy and get their own
# environment, so the approval for "change the platform" is never the same
# click as the approval for "ship the app".
resource "github_repository_environment" "infrastructure" {
  repository          = var.repository
  environment         = "infrastructure-production"
  can_admins_bypass   = false
  prevent_self_review = var.prevent_self_review

  reviewers {
    users = var.production_reviewer_user_ids
  }

  deployment_branch_policy {
    protected_branches     = true
    custom_branch_policies = false
  }
}
