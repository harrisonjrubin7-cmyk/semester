# SSO security and session management

What protects an institutional session, and where each control is.

## Sessions

- **Validated over the network every request.** `auth.ts` calls `getUser`
  rather than decoding the JWT, so a revoked or signed-out session is refused
  at once rather than at expiry.
- **Access is reloaded, not cached.** `membership.ts` reads the provider and the
  membership from Postgres on each authorization. Suspension or
  deprovisioning takes effect on the next request. Stale token claims never
  decide a role.
- **The server client holds nobody's session.** Persistence, refresh and URL
  detection are all off.
- **Every decision is audited** with a reason: `missing-provider`,
  `ambiguous-provider`, `provider-not-authorized`, `missing-membership`,
  `ambiguous-membership`, `membership-not-active`, `invalid-membership-roles`,
  `current-membership`.

## Credentials and secrets

- **SCIM bearer:** shown once, stored as salt + SHA-256, compared in constant
  time, tenant-bound server-side, revocable, with optional expiry.
  Rate-limited per credential.
- **LTI:** the platform's key is never held. `LTI_PRIVATE_KEY` is used only for
  callbacks. Nonces are single-use.
- **Service-role key** is server-only and never a `VITE_` variable.
  [SECRETS.md](../SECRETS.md) is the list and [SECURITY.md](../SECURITY.md)
  is the rotation procedure.

## Refusal-first surfaces

| Surface | Refuses |
| --- | --- |
| `/v1/auth/config` | Returns a campus button only when exactly one matching provider is `authorized`. Never returns metadata, IDs or keys |
| SCIM | Missing or invalid bearer (401), rate limit (429), missing `Idempotency-Key` (400), body over 128 KB (413) |
| LTI | 23 named launch refusals ([LTI runbook](LTI-1.3-LAUNCH-RUNBOOK.md)) |
| Provider row | An attribute mapping outside the allowlist or naming a protected record |

## Gaps

- No automated SAML certificate-expiry alert.
- No persisted `session_security_events`. The authorization audit hook exists
  but its sink is whatever the gateway is configured with.
- IdP-initiated single logout is not handled. Logout ends the Semester session
  only, and the acceptance checklist records the campus's behaviour.
