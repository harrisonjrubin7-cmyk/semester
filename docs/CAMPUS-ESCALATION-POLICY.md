# Campus escalation policy

Code: `prepareEscalation` in `app/src/community/crisis.ts`, and the same rules
enforced in the database by `request_community_escalation` and
`decide_community_escalation` (`20260928032000_community.sql`, section 14).
Flag: `VITE_INSTITUTION_ESCALATION` (high-risk, off, production refused).
Server switch: the school's `community_programs` row for
`institution_escalation`, which only the service role writes, plus an active
agreement (`community_escalation_policies`), recorded on the Agreements screen
by two different people (below).

`prepareEscalation` refuses every escalation unless all of these hold:

- the flag is on;
- the tenant has a policy with `enabled`, an `agreementRef` for a written
  agreement, and a delivery `channel`;
- the case is P0 or P1, in a category the agreement covers;
- two **different** professionals have approved it, each with a written
  reason, and no automation or volunteer approval is attached;
- the case has not been escalated before.

## Payload (minimum necessary)

The payload is an allowlist:

- `caseId`
- `tenantId`
- `category`
- `severity`
- a summary of at most 500 characters
- `occurredAt`
- `agreementRef`

It adds `vaultRef` only when the agreement requires identity, and even then it
is a reference, never a name or an email.

There is no dashboard, no standing feed and no bulk export to institutions.

## In the database

- **Two people, told apart by hash.** A reviewer requests with a reason; a
  different reviewer approves or refuses with their own. The row stores
  SHA-256 hashes of both, never account ids, and the function compares them.
- **Asked again at approval.** If the switch, the agreement or the case
  changed after the request, approval is refused. Refusing is always allowed.
- **One live escalation per case,** by the function and by a unique index.
- **Built, not supplied.** `decide_community_escalation` assembles the
  payload itself from the case and the agreement. When the agreement requires
  identity it adds `subject_ref`, a hash of the escalation and the author that
  only the service role can resolve by recomputing it against the case.
- **One queued delivery.** Approval writes one row to
  `community_escalation_deliveries`. Reviewers see whether it went, not what
  it said. Only the service role takes and marks deliveries. A delivered copy
  is swept after 90 days; the escalation itself goes with its case.
- **In the case history.** Requests, approvals and refusals are case events.

`programs.test.ts` holds the SQL to the TypeScript: severities, the
500-character summary and the payload keys.

## In the console

`components/community/Escalation.tsx`, inside the moderation console. It
appears on P0 and P1 cases only where `VITE_INSTITUTION_ESCALATION` is set and
the case's school has switched escalation on. `escalationBlock` asks the same
questions as `private.escalation_allowed`, in the same order, and shows the
one reason a case can't be escalated instead of a button. Before anyone asks,
it lists what would be sent. The person who asked sees "You asked for this
one", not approval buttons. An approved escalation shows whether it has been
delivered, or that delivery failed five times.

## Delivery

`supabase/functions/_shared/escalation.ts` sends what two reviewers
approved. A parked pg_cron job, `escalation-delivery`, calls it every five
minutes (`supabase/scheduler.sql`).

- **Channels are names.** An agreement's `channel` must be `webhook:<name>`,
  for example `webhook:vu_dos`. Its URL and signing key are function secrets,
  `ESCALATION_WEBHOOK_VU_DOS_URL` and `ESCALATION_WEBHOOK_VU_DOS_KEY`. A name
  with no configured address is not sent. A raw URL, plain http, credentials
  in the URL or a key under 32 characters are all refused.
- **Checked on the way out.** The payload must have exactly the allowlisted
  keys, with `subject_ref` only as a 64-character hash. Anything else is
  refused for good and never retried.
- **Held, not sent,** while the school's switch is off, its agreement is
  disabled, or the agreement now names a different channel than the one
  approved. A held delivery isn't charged an attempt.
- **One sender per delivery.** Each run claims up to 20 rows for five
  minutes, with `skip locked`, so overlapping runs never send the same row.
- **Retries** back off at 4, 16, 64 and 256 minutes, five attempts in all. An
  unconfigured channel retries too, so an operator can fix it. What's recorded
  is a code (`http_502`, `timeout`, `network`, `channel_not_configured`,
  `payload_rejected`), never the receiver's reply. The console says which,
  and when the next try is.

### What the receiver gets

    POST <configured URL>
    Content-Type: application/json
    Idempotency-Key: <delivery id>          same on every retry
    X-Semester-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.<body>">

    {"case_id": …, "tenant_id": …, "category": …, "severity": "P0"|"P1",
     "summary": …, "occurred_at": …, "agreement_ref": …[, "subject_ref": …]}

The receiver should recompute the signature with the shared key, reject a
timestamp more than five minutes old, and treat a repeated
`Idempotency-Key` as the same escalation. Any 2xx marks it delivered.
Redirects are refused, and the reply body is never read.

### Deploying it (not done; do it only with a signed agreement)

1. Create `supabase/functions/escalate/index.ts`:

       import { createClient } from 'jsr:@supabase/supabase-js@2';
       import { handle } from '../_shared/escalation.ts';
       const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
       const rpc = async (fn: string, args?: object) => { const { data, error } = await db.rpc(fn, args); if (error) throw error; return data; };
       Deno.serve((req) => handle(req, {
         secret: Deno.env.get('ESCALATION_CRON_SECRET') ?? '',
         take: () => rpc('take_escalation_deliveries'),
         delivered: (id) => rpc('mark_escalation_delivered', { want_delivery: id }),
         failed: (id, code, final) => rpc('mark_escalation_failed', { want_delivery: id, want_error: code, want_final: final }),
         env: (k) => Deno.env.get(k), fetch, now: () => new Date(),
       }));

2. Add `[functions.escalate]` with `verify_jwt = false` to `supabase/config.toml`.
   It's called by the scheduler with its own secret, like `push`. Once it's
   live, add it to DEPLOY.md's "What is live". `functionconfig.test.ts` holds
   all three to each other.
3. Set `ESCALATION_CRON_SECRET` to the Vault value `escalation_cron_secret`,
   and set the channel's `_URL` and `_KEY`.
4. Have two people record and activate the school's agreement on the
   Agreements screen. Then switch `institution_escalation` on for that school
   (service role).
5. Unpark the job: `select cron.alter_job((select jobid from cron.job where
   jobname = 'escalation-delivery'), active := true);`

## Recording an agreement

On the Agreements screen, opened from the moderation console by a holder of
`community:escalation_agreements` (senior Trust & Safety staff only; never
anyone at the school the agreement is with):

1. **One person records it.** They enter the signed agreement's reference, the
   office that receives escalations, the kinds of case it covers, whether it
   requires an identity reference, the delivery channel name, and when it
   ends (at most three years out). It saves as an inactive draft.
2. **A different person activates it,** after writing down what they checked
   against the signed copy. The database compares the two by hash.
3. **Any edit makes it a draft again,** and escalations to that school stop
   until someone other than the editor activates it.
4. **One person can retire it.** Switching off is always safe. Deliveries not
   yet sent are held.
5. **An agreement past its end date is off everywhere:** requests, approvals
   and deliveries all refuse it.

Every step is kept in `community_escalation_agreement_events`. The screen
never touches the school's `community_programs` switch.

