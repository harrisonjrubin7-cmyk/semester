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
`auth_login_url` and `jwks_url` constrained to `https`. `tenant_id` names the
Semester school the deployment belongs to and `connection_id` its approved
integration connection
(`20260927180000_lti_integration_binding.sql`; removing the school sets
`tenant_id` null rather than deleting the registration). The school's LMS
administrator supplies the platform fields, and none of them is secret. Semester's own key
(`LTI_PRIVATE_KEY`) is needed only to call back, for Deep Linking responses and
AGS.

Add the school's LMS origin (for example `https://brightspace.vanderbilt.edu`)
to `frame-ancestors` in both `app/vercel.json` and `app/public/_headers`. A
course link opens Semester inside the LMS's iframe, and a host that sends
those headers refuses to be framed by any origin not listed. `hostheaders.test.ts`
keeps the two files equal.

## Launch validation

`startLogin` and `checkLaunch` refuse by named reason. These are the codes in
`lti.ts`, and `lti.test.ts` walks each one:

`no-iss` `unknown-iss` `wrong-iss` `no-login-hint` `client-mismatch`
`deployment-mismatch` `no-aud` `wrong-aud` `no-azp` `wrong-azp` `no-exp`
`expired` `no-iat` `future` `no-nonce` `wrong-nonce` `wrong-version`
`no-deployment` `wrong-deployment` `no-sub` `no-target` `foreign-target`
`no-roles`

The function shell spends the launch state (`lti_nonce`) first, atomically,
through `spend_lti_nonce`, before it fetches the registration or verifies the
signature against the platform's JWKS. Two POSTs carrying the same state would
race otherwise, and the loser of that race would be a replayed launch that both
halves believe; the RPC does the check and the write in one statement
(`spent_at is null` in its `update … returning`), and `lti.check.sql` spends a
live state once, asserts the same state spends a second time for nobody, and
asserts an expired or never-issued state is refused. So a token that fails a
later rule has already spent its state, and the student starts again from
`/login`, which issues a fresh one. The registration comes from the flight
that was recorded, never from the token in hand.

## Which account a launch opens

Looked up by `(issuer, subject)` in `lti_identity`, **never by email**. A new
person gets an account whose address is synthesised under `lti.invalid`, which
can never receive mail or be recovered into. Attaching an account the student
already has needs a single-use `lti_link_ticket` *and* a signed-in session.

## Joining a membership

Every launch asks `public.lti_launch_membership`
(`20260927235930_lti_launch_membership.sql`) which `institution_membership` it
belongs to, through exactly one path:

```text
lti_platform (issuer, client, deployment) → tenant_id
lti_identity (issuer, subject), origin = 'linked' → user_id
institution_membership (tenant_id, auth_user_id = user_id)
```

| Answer | Meaning |
| --- | --- |
| `joined` | Active membership in the registration's school; returns its id and **current** roles |
| `unbound` | The registration has no school recorded |
| `no-registration` | No registration for that issuer, client and deployment |
| `no-identity` | This LMS person has never launched |
| `identity-not-linked` | The account is the launch's own `lti.invalid` one; the student has not linked it to their campus account |
| `no-membership` | Linked, but no membership in *this* school |
| `membership-<status>` | `pending`, `suspended` or `deprovisioned`; no roles returned |

- **It never matches on email, `lis_person_sourcedid` or an SIS id.** Each is a
  string a registered platform chooses.
- **It reads and never writes.** A launch never creates, reactivates or widens a
  membership; SCIM is the lifecycle.
- **It limits the session to the membership.** When the join reaches a
  membership in this school that is not active (`membership-suspended`,
  `-deprovisioned`, `-pending`), no session is minted. The student sees a 403
  page, "Your school access is not active", with the reason as a reference, and
  nothing about the course is recorded. `sessionDecision` in
  `_shared/ltimembership.ts` is the rule.
- **A school that has said nothing does not block.** `unbound`,
  `no-registration`, `no-identity`, `identity-not-linked` and `no-membership`
  all open a session as before.
- **It fails closed on an untrustworthy answer, open on a missing one.**
  `lookup-failed` and `unreadable` refuse, because a gate that opens when it
  cannot read is not one. `unavailable` (the function not deployed yet) allows,
  so the gap between migration and function deploys does not break every
  launch.
- **Roles come from the membership, never from the LMS `roles` claim.**

`supabase/lti-membership.check.sql` walks every answer. Its controls: an active
membership in another school does not join, a provisioned identity does not
join even with a membership, and no call changes a membership.
`ltimembership.test.ts` proves the shell cannot read a partial row as a join.

### What the joined roles scope

- **Institutional data.** An admitted session reaches it only through the
  gateway, which re-reads the membership's current roles on every request and
  never reads the LMS role claim. A joined launch opens the student's own
  linked campus account, so the gateway already applies exactly the joined
  roles. An unlinked `lti.invalid` account reaches no institutional data at
  all, because the gateway accepts only campus-SSO accounts.
- **Placing activities (Deep Linking).** This was the one thing the LMS role
  claim granted by itself. `mayPlace` still requires the LMS to say instructor.
  When the launch joins a membership, `placementDecision` also requires that
  membership to hold `faculty` or `teaching_assistant`. Otherwise it refuses
  with `membership-not-instructor` and a 403 page, "This activity could not be
  added". Both checks are required: a faculty member enrolled as a learner in
  someone else's course is not an instructor there. An inactive or unreadable
  membership refuses placement exactly as it refuses a session. A launch that
  reached no membership keeps the LMS rule alone.

**The entitlement order runs in shadow on every launch** and logs `lti entitlement (shadow): …`. It refuses nothing. See [ENTITLEMENT-RESOLUTION.md](ENTITLEMENT-RESOLUTION.md#on-an-lti-launch-in-shadow).

## Minimum claims

Kept: opaque subject, issuer, deployment, context ID and title, resource link,
role (teaches or not). The name and email travel only into `user_metadata`,
prefixed `lti_`, for display. Semester does not request a roster, gradebook,
submissions or accommodations. NRPS is not implemented.

## Grade passback

AGS posts a score only when the platform granted the score scope at launch (a
`lti_line_item` row was captured), `LTI_PRIVATE_KEY` is set, the course code
matches exactly one line item, **and** `lti_passback_decision` allows it. That
database gate applies kill switches to every registration, and for a bound one
also the school's `integration.lms_lti` and `writeback.lms_grade_passback`
flags, an approved write connection and an approved `scope.lms.score_publish`.
An unbound registration is `registration-unbound` and is not sent. Any
refusal answers "not reported" with the reason.
See [INTEGRATION-OPERATOR-RUNBOOK.md](INTEGRATION-OPERATOR-RUNBOOK.md).

## Gaps

- **Unbound registrations are refused.** A registration installed before
  `tenant_id` existed has none. Grade passback fails closed as
  `registration-unbound` until an operator binds it to the correct school and
  approved connection. Launch diagnostics still identify the issuer, client
  and deployment that need binding; an unbound launch is never treated as
  belonging to a default school.
- The membership join is logged but not yet acted on. See
  **Joining a membership** above.
- Launch refusals are logged, not persisted to an audit table.
