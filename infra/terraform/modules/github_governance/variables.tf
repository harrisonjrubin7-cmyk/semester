variable "repository" {
  description = "Repository name, without the owner."
  type        = string
}

variable "ruleset_file" {
  description = <<-EOT
    Path to the ruleset JSON that is the single source of truth for the
    default-branch rules (`.github/rulesets/main.json`). Terraform reads it
    rather than restating it, so the file in the repository and the rules on
    GitHub cannot be two different statements.
  EOT
  type        = string
}

variable "production_reviewer_user_ids" {
  description = "Numeric GitHub user IDs who must approve a deployment to the production environment. Never empty: an environment with no reviewer is a button anyone with write access can press."
  type        = set(number)

  validation {
    condition     = length(var.production_reviewer_user_ids) > 0
    error_message = "production needs at least one required reviewer."
  }
}

variable "prevent_self_review" {
  description = <<-EOT
    Whether the person who triggered a production deployment may approve it.
    `true` is the four-eyes control and needs a second reviewer to be usable.
    The repository has one maintainer today, so the shipped value is `false`;
    that is a recorded exception (`infra/README.md`, risk R-1), not a default.
  EOT
  type        = bool
  default     = true
}

variable "allowed_action_patterns" {
  description = "Third-party actions the repository may run, besides GitHub's own. Each is also required to be pinned to a commit SHA."
  type        = set(string)
  default = [
    "gitleaks/gitleaks-action@*",
    "supabase/setup-cli@*",
    "stackhawk/hawkscan-action@*",
    "hashicorp/setup-terraform@*",
  ]
}
