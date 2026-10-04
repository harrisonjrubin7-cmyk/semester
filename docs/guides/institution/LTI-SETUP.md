# LTI setup

> **Type:** runbook · **Audience:** implementers, institution-admins · **Owner:** `data` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This runbook says what an LMS administrator and Semester each do to register Semester as an LTI 1.3 tool, and what a launch does and does not do; stop reading if you need roster sync (Names and Roles is not implemented) or a launch from a real platform, which has not happened.

**Status:** `IMPLEMENTED_NOT_RELEASED` and blocked on a learning-system registration. Launch, Deep Linking and Assignment and Grade Services (AGS) score passback are built and tested against a test platform. No launch from a real institution's learning system has occurred, Semester is not 1EdTech-certified, and the public claims register lists LTI as "Planned".

<!-- status: LTI 1.3 (launch, deep link, AGS) = IMPLEMENTED_NOT_RELEASED -->
<!-- capabilities: integration:approve -->
<!-- roles: university_admin, faculty, teaching_assistant -->
<!-- claim: lti Planned -->
<!-- routes: /lti/jwks, /lti/login, /lti/launch, /score -->
<!-- paths: docs/LTI-1.3-LAUNCH-RUNBOOK.md, supabase/functions/lti/index.ts, supabase/functions/_shared/lti.ts, supabase/functions/_shared/ltimembership.ts, docs/INTEGRATION-OPERATOR-RUNBOOK.md, docs/institutional-readiness/LTI-READINESS.md -->

## What LTI does here

LTI opens Semester from a course and carries which course, which resource and which role. It is not institution-wide lifecycle: a launch never creates, reactivates or widens an institutional membership. SCIM is the lifecycle ([SCIM provisioning](SCIM-PROVISIONING.md)).

Endpoints on the `lti` edge function: `/lti/jwks` (Semester's public key set), `/lti/login` (the platform starts a login here), `/lti/launch` (the platform posts the signed token back) and `…/score` (AGS passback). Deep Linking arrives through the launch.

## Who does what

| Step | Institution (LMS administrator) | Semester |
| --- | --- | --- |
| 1. Register the tool | Supplies issuer, client ID, deployment ID, authentication URL and key-set URL. None of them is secret. Both URLs must be `https` | Inserts one `lti_platform` row per issuer, client ID and deployment ID |
| 2. Allow framing | Tells Semester the LMS origin | Adds the origin to `frame-ancestors` in both `app/vercel.json` and `app/public/_headers`; `hostheaders.test.ts` keeps them equal. A course link opens inside the LMS frame, and a host that sends those headers refuses any origin not listed |
| 3. Give the tool Semester's key set | Registers `/lti/jwks` in the platform | Sets `LTI_PRIVATE_KEY`, needed only to call back for Deep Linking responses and AGS |
| 4. Bind the registration to the school | Confirms which Semester school the deployment belongs to | An operator with the service role sets `tenant_id` and the approved integration connection. This is not a screen |
| 5. Approve passback, if wanted | A `university_admin` (holding `integration:approve`) approves the write scope and sets the flags | Leaves AGS off unless approved |

Do step 5 before step 4 if you rely on grade passback. Set `integration.lms_lti` and `writeback.lms_grade_passback` to `production` and approve `scope.lms.score_publish` first, or passback stops at the moment of binding ([`INTEGRATION-OPERATOR-RUNBOOK.md`](../../INTEGRATION-OPERATOR-RUNBOOK.md), section 2).

## What a launch does

1. The state is spent atomically before the signature is checked, so a replayed state is refused. A token that fails a later rule has already spent its state and the person starts again from `/login`.
2. The token is checked for issuer, audience, authorized party, expiry, issued-at, nonce, version, deployment, subject, target and roles. Each refusal has a named reason code.
3. The account is looked up by issuer and subject, never by email. A new person gets an account whose address is under `lti.invalid` and can never receive mail.
4. The launch asks which institutional membership it belongs to, through one path: registration to school, identity to account, account to membership. Roles come from the membership, never from the LMS role claim.
5. A membership that is `pending`, `suspended` or `deprovisioned` gets no session. The person sees a 403 page: "Your school access is not active".
6. Placing an activity through Deep Linking requires the LMS to say instructor and, when the launch joins a membership, that membership to hold `faculty` or `teaching_assistant`.

Minimum claims kept: opaque subject, issuer, deployment, context ID and title, resource link, and whether the person teaches. Name and email travel only into display metadata. Semester does not request a roster, gradebook, submissions or accommodations.

## Grade passback

AGS posts a score only when the platform granted the score scope at launch, `LTI_PRIVATE_KEY` is set, the course code matches exactly one line item and the database gate allows it. For a registration bound to a school, the gate also needs the school's two flags, an approved write connection and the approved scope. An unbound registration answers `allowed-unbound`: it is allowed, with a warning logged on every launch. Bind it, or engage `kill.writeback`, before any beta.

## What you can check

| Check | Expected |
| --- | --- |
| Launch from a course by a linked, active member | A session scoped to the membership's roles |
| Launch by a deprovisioned member | 403 page, no session |
| Launch by someone who never linked a campus account | A session on the `lti.invalid` account that reaches no institutional data |
| Instructor places an activity | Allowed only for `faculty` or `teaching_assistant` members |
| Kill switch engaged | Passback reports "not reported" with the reason |

## Not built or not proven

- Names and Roles Provisioning (NRPS) is refused. No roster comes from the LMS.
- No launch from a real platform. The pilot docs name Brightspace as the first target; registration is outstanding.
- Launch refusals are logged, not stored in an audit table.
- 1EdTech certification is not held.

## Read next

[`LTI-1.3-LAUNCH-RUNBOOK.md`](../../LTI-1.3-LAUNCH-RUNBOOK.md) for every reason code. [`LTI-READINESS.md`](../../institutional-readiness/LTI-READINESS.md) for readiness against the standard.
