# One Supabase project per environment. The database holds every tenant; the
# project boundary is therefore the largest isolation line we have, and the
# reason staging is a separate project rather than a schema in production.
#
# Production is *adopted*, not created: the project already exists and holds
# real data, so the platform root imports it and this module only manages the
# settings that are safe to express as code. Nothing here can delete it
# (`prevent_destroy` below); removing a project is a decision, not a diff.

resource "supabase_project" "this" {
  count = var.create_project ? 1 : 0

  organization_id   = var.organization_id
  name              = var.project_name
  database_password = var.database_password
  region            = var.region

  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = var.organization_id != null && var.project_name != null && var.database_password != null
      error_message = "creating a project needs organization_id, project_name and database_password."
    }
  }
}

locals {
  project_ref = var.create_project ? supabase_project.this[0].id : var.project_ref

  network = jsonencode({
    db_allowed_cidrs    = var.db_allowed_cidrs
    db_allowed_cidrs_v6 = []
  })
}

resource "supabase_settings" "this" {
  project_ref = local.project_ref

  # TLS to Postgres is not optional in either environment.
  ssl_enforcement = true

  network = length(var.db_allowed_cidrs) > 0 ? local.network : null
  api     = var.api_settings_json
  auth    = var.auth_settings_json

  lifecycle {
    precondition {
      condition     = local.project_ref != null
      error_message = "set project_ref, or create_project = true."
    }
    precondition {
      condition     = var.environment != "production" || length(var.db_allowed_cidrs) > 0
      error_message = "production must restrict direct database access; set db_allowed_cidrs."
    }
  }
}
