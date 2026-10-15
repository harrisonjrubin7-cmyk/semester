# The edge in front of the institution gateway: the web application firewall,
# a rate limit and bot filtering. The SPA itself is served from GitHub Pages
# today, which has no WAF; the SPA's headers are policy in `app/vercel.json`
# and `app/public/_headers`, not something this module can add to Pages. That
# gap is recorded in `docs/infrastructure/SECURITY-CONTROLS.md` rather than
# papered over.

resource "vercel_firewall_config" "this" {
  project_id = var.project_id
  team_id    = var.team_id

  managed_rulesets {
    owasp {
      xss  = { action = "deny" }
      sqli = { action = "deny" }
      rce  = { action = "deny" }
      lfi  = { action = "deny" }
      rfi  = { action = "deny" }
      php  = { action = "deny" }
      gen  = { action = "deny" }
      ma   = { action = "deny" }
      sd   = { action = "deny" }
      java = { action = "deny" }
    }
    bot_protection {
      active = true
      action = "challenge"
    }
    ai_bots {
      active = true
      action = "deny"
    }
  }

  rules {
    rule {
      name        = "rate-limit-institution-gateway"
      description = "Refuse floods at the edge before a function is invoked."
      active      = true

      condition_group = [{
        conditions = [{
          type  = "path"
          op    = "pre"
          value = "/api/institution/"
        }]
      }]

      action = {
        action = "rate_limit"
        rate_limit = {
          algo   = "fixed_window"
          limit  = var.rate_limit_requests
          window = var.rate_limit_window_seconds
          keys   = ["ip"]
          action = "deny"
        }
      }
    }
  }

  dynamic "ip_rules" {
    for_each = length(var.blocked_ips) > 0 ? [1] : []
    content {
      dynamic "rule" {
        for_each = var.blocked_ips
        content {
          action   = "deny"
          hostname = "*"
          ip       = rule.value.ip
          notes    = rule.value.notes
        }
      }
    }
  }

  lifecycle {
    # Turning the firewall off is a change with its own record, not a side
    # effect of a refactor.
    prevent_destroy = true
  }
}

# Deployments are kept long enough to roll back to, and not forever: an old
# deployment is an old attack surface with old secrets baked into it.
resource "vercel_project_deployment_retention" "this" {
  project_id = var.project_id
  team_id    = var.team_id

  expiration_preview    = "1m"
  expiration_production = "1y"
  expiration_canceled   = "1m"
  expiration_errored    = "1m"
}
