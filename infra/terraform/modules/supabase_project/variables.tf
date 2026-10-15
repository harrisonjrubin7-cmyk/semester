variable "project_ref" {
  description = "Reference of an existing Supabase project to manage settings for. Leave null to create one (staging)."
  type        = string
  default     = null
}

variable "environment" {
  description = "staging or production. Decides the guard rails below, not just a label."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "create_project" {
  description = "Create the project (staging) instead of adopting one (production, which is imported)."
  type        = bool
  default     = false
}

variable "organization_id" {
  description = "Supabase organization that owns a created project. Required when create_project is true."
  type        = string
  default     = null
}

variable "project_name" {
  type    = string
  default = null
}

variable "region" {
  description = "Region of a created project. A tenant's data residency is decided per tenant (target-architecture P-12); this is the platform default only."
  type        = string
  default     = "us-west-2"
}

variable "database_password" {
  description = "Password for a created project. Supply from the secret manager via TF_VAR_ at apply time; never in a tfvars file."
  type        = string
  default     = null
  sensitive   = true
}

variable "db_allowed_cidrs" {
  description = <<-EOT
    IPv4 ranges allowed to open a direct Postgres connection. Empty means
    "no restriction", which production must not use — the check in
    `infra/policy` denies it. API traffic (PostgREST, Auth, Edge Functions)
    is not affected by this list; it is the door for `psql`, migrations and
    BI tools only.
  EOT
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for c in var.db_allowed_cidrs : c != "0.0.0.0/0"])
    error_message = "0.0.0.0/0 is the same as no restriction; list the ranges instead."
  }
}

variable "api_settings_json" {
  description = "JSON for the project's API settings (exposed schemas, max rows). Kept as data so the diff reads as data."
  type        = string
  default     = null
}

variable "auth_settings_json" {
  description = "JSON for Auth settings (MFA, password rules, redirect allow-list, JWT expiry). Reviewed like code: this is where a redirect-URI allow-list lives."
  type        = string
  default     = null
}
