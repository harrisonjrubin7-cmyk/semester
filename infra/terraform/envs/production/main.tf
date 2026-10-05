terraform {
  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.11"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.17"
    }
  }
}

# Credentials arrive as SUPABASE_ACCESS_TOKEN and VERCEL_API_TOKEN from the
# `infrastructure-production` environment — scoped tokens, one per environment, so the
# staging pipeline cannot touch production by being misconfigured.
provider "supabase" {}

provider "vercel" {
  team = var.vercel_team_id
}

variable "vercel_team_id" {
  type    = string
  default = null
}

variable "vercel_project_id" {
  type = string
}

variable "supabase_organization_id" {
  type    = string
  default = null
}

variable "supabase_project_ref" {
  type    = string
  default = null
}

variable "database_password" {
  type      = string
  default   = null
  sensitive = true
}

variable "db_allowed_cidrs" {
  type    = list(string)
  default = []
}

variable "auth_settings_json" {
  type    = string
  default = null
}

module "supabase" {
  source = "../../modules/supabase_project"

  environment        = "production"
  create_project     = false
  project_ref        = var.supabase_project_ref
  organization_id    = var.supabase_organization_id
  project_name       = "semester-production"
  database_password  = var.database_password
  db_allowed_cidrs   = var.db_allowed_cidrs
  auth_settings_json = var.auth_settings_json
}

module "edge" {
  source = "../../modules/vercel_gateway"

  environment = "production"
  project_id  = var.vercel_project_id
  team_id     = var.vercel_team_id
}

# Adopt the live project. `import` blocks are inert once the object is in
# state, and a plan that wants to *create* either of these instead means the
# import was skipped — the policy in `infra/policy` refuses that plan.
import {
  to = module.supabase.supabase_settings.this
  id = var.supabase_project_ref
}
