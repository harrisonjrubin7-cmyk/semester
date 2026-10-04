output "environments" {
  description = "Deployment environments this module guarantees exist."
  value = [
    github_repository_environment.staging.environment,
    github_repository_environment.production.environment,
    github_repository_environment.infrastructure_plan.environment,
    github_repository_environment.infrastructure.environment,
  ]
}

output "required_status_checks" {
  description = "The checks the default-branch ruleset requires, as read from the ruleset file."
  value       = [for c in local.required_checks.required_status_checks : c.context]
}
