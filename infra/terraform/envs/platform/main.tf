# Repository-level controls. Not an "environment" in the staging/production
# sense — GitHub environments are repository objects — so it is its own root
# with its own state and its own, narrower, credential.

terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.13"
    }
  }
}

variable "github_owner" {
  type    = string
  default = "harrisonjrubin7-cmyk"
}

variable "repository" {
  type    = string
  default = "semester"
}

variable "production_reviewer_user_ids" {
  type = set(number)
}

variable "prevent_self_review" {
  type    = bool
  default = false
}

# Authenticated by GITHUB_TOKEN from the environment: a GitHub App installation
# token minted per run, with repository administration scope on this one
# repository. Not a personal access token, which would be the maintainer's
# whole account in a variable.
provider "github" {
  owner = var.github_owner
}

module "github_governance" {
  source = "../../modules/github_governance"

  repository                   = var.repository
  ruleset_file                 = "${path.root}/../../../../.github/rulesets/main.json"
  production_reviewer_user_ids = var.production_reviewer_user_ids
  prevent_self_review          = var.prevent_self_review
}

# No `import` blocks: creating a GitHub environment is an upsert, so applying
# over one that already exists (`staging`, `production`) adjusts it in place.
