# LTI 1.3 launch runbook

Status: **BUILT** for core launch, Deep Linking and AGS score passback.
Function: `supabase/functions/lti`. Rules: `supabase/functions/_shared/lti.ts`,
`ltideeplink.ts`, `ltiags.ts`, `ltikey.ts`, `ltiaccount.ts`. Background:
[GRADESCOPE-TURNITIN.md](../GRADESCOPE-TURNITIN.md).

## What LTI is for here

LTI opens Semester from a course and carries which course, which resource and
which role. It is not institution-wide lifecycle, and a launch never creates an
`institution_membership`.

## Registration

One `lti_platform` row per issuer × client ID × deployment ID, with
`auth_login_url` and `jwks_url` constrained to `https`, and `tenant_id` naming
the Semester school the deployment belongs to. Removing that school removes its
registrations. The school's LMS
administrator supplies all of it, and none of it is secret. Semester's own key
(`LTI_PRIVATE_KEY`) is needed only to call back, for Deep Linking responses and
AGS.

## Launch validation

`startLogin` and `checkLaunch` refuse by named reason. These are the codes in
`lti.ts`, and `lti.test.ts` walks each one:

`no-iss` `unknown-iss` `wrong-iss` `no-login-hint` `client-mismatch`
`deployment-mismatch` `no-aud` `wrong-aud` `no-azp` `wrong-azp` `no-exp`
`expired` `no-iat` `future` `no-nonce` `wrong-nonce` `wrong-version`
`no-deployment` `wrong-deployment` `no-sub` `no-target` `foreign-target`
`no-roles`

The function shell verifies the signature against the platform's JWKS. It
spends the nonce (`lti_nonce`) only after `checkLaunch` returns ok, so a token
failing a later rule cannot burn the nonce a real launch still needs.

## Which account a launch opens

Looked up by `(issuer, subject)` in `lti_identity`, **never by email**. A new
person gets an account whose address is synthesised under `lti.invalid`, which
can never receive mail or be recovered into. Attaching an account the student
already has needs a single-use `lti_link_ticket` *and* a signed-in session.

## Minimum claims

Kept: opaque subject, issuer, deployment, context ID and title, resource link,
role (teaches or not). The name and email travel only into `user_metadata`,
prefixed `lti_`, for display. Semester does not request a roster, gradebook,
submissions or accommodations. NRPS is not implemented.

## Grade passback

AGS posts a score only when all three hold: the platform granted the score
scope at launch (a `lti_line_item` row was captured), `LTI_PRIVATE_KEY` is set,
and the course code matches exactly one line item. Otherwise it answers
"not reported" with the reason. **Gap:** there is no per-tenant switch. The
control is the deployment's key and the platform's scope grant.

## Gaps

- `lti_platform.tenant_id` records which school a deployment belongs to. It is
  nullable, because registrations installed before it have none, and a launch
  through such a registration is **allowed, with a warning**: `launchTenant`
  never refuses, and the function logs `lti launch unbound: …` naming the
  issuer, client and deployment whose school needs recording. Nothing
  downstream uses the tenant yet, so a launch still cannot be joined to an
  institutional membership or to the entitlement chain's course steps. An
  unbound launch must never be treated as belonging to a default school.
- Launch refusals are logged, not persisted to an audit table.
