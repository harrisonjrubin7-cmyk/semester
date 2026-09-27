# OIDC implementation runbook

Status: **NOT BUILT.** `institution_identity_provider.provider_type` admits only
`'saml'`, and `auth.ts` recognises only `sso:` sessions. This page is the
specification for when a campus needs OIDC, so the work starts from the rules
rather than from a library's defaults.

## Why it is not built

Supabase Auth's enterprise SSO speaks SAML. An OIDC campus would need either a
Supabase Auth OIDC provider bound to the tenant, or a broker that presents the
campus OIDC IdP as SAML. Both are real choices with real operating costs, and
neither should be made before a campus asks for one.
([ADR 0003](architecture/0003-no-application-server.md) is why a hand-rolled
token endpoint is not the default answer.)

## What any implementation must do

Authorization Code flow, with PKCE (`S256`) for every public client.

| Validate | Refuse when |
| --- | --- |
| `state` | Absent or not the one this browser was issued |
| `nonce` | Absent, not the one issued, or already spent |
| PKCE verifier | Does not hash to the stored challenge |
| `iss` | Not exactly the tenant's configured issuer |
| `aud` / `azp` | Does not include our client ID; several audiences and no matching `azp` |
| Signature | Not verifiable against the issuer's JWKS; `alg` is `none` or not the configured one |
| `exp` / `iat` | Expired, or issued in the future beyond a small skew |
| Redirect URI | Not an exact match to a registered one |
| `sub` | Absent. This is the durable link, never `email` |

`supabase/functions/_shared/lti.ts` already implements most of this table for
LTI launches, which are OIDC-initiated. Its refusal-per-rule shape is the model
to copy.

## Data model change when it lands

- Widen `provider_type` to `('saml', 'oidc')`, and add issuer, JWKS URI and
  client ID columns that are `https`-checked, as `lti_platform` does.
- Reuse `attribute_mapping` and its constraint unchanged. Claim minimization
  does not depend on the protocol.
- Bind first login exactly as SAML does: to a SCIM identity, never by email
  match alone.
