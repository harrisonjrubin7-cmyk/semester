variable "project_id" {
  description = "Vercel project that serves the institution gateway (app/api/institution). Adopted by import, never created here."
  type        = string
}

variable "team_id" {
  type    = string
  default = null
}

variable "environment" {
  type = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "rate_limit_requests" {
  description = "Requests per window per IP on the institution gateway before the edge answers 429. The gateway has its own per-tenant limits; this one exists so abuse is refused before a function is billed."
  type        = number
  default     = 300
}

variable "rate_limit_window_seconds" {
  type    = number
  default = 60
}

variable "blocked_ips" {
  description = "Addresses blocked at the edge. Each carries a note saying why; an unexplained block is how a list becomes archaeology."
  type = list(object({
    ip    = string
    notes = string
  }))
  default = []
}
