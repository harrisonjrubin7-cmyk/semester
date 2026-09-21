# 0003 · No application server; edge functions instead

**Status:** Accepted. Will be genuinely tested by Phases 6–15.

## Decision

The app has no backend of its own. Server-side work is done by Supabase edge
functions — six of them — plus a prepare-only institution gateway under
`app/server/institution/` that drafts and hands off rather than transacting.

## Why

Three reasons, in order of weight:

1. **There was nothing for a server to do** that Postgres and a function could
   not. Authorization is in policies ([0002](0002-rls-is-the-authorization-boundary.md)),
   the working copy is on the device ([0001](0001-local-first-with-supabase.md)),
   and the two jobs that genuinely need a server — holding an API key and
   reaching a host the browser cannot — are each one function.
2. **A server is a thing to operate.** One founder, zero users: the failure mode
   of premature infrastructure is that it is neglected rather than that it is
   absent.
3. §45 of the transformation command says this outright: no microservices, no
   Kubernetes, no event bus, no second database. Simple, modular, secure,
   scalable *enough*.

## The functions, and what each exists for

| Function | Why it cannot be in the page |
| --- | --- |
| `claude` | Holds the Anthropic key; see [0004](0004-ai-through-a-metered-gateway.md) |
| `fetchcal` | Calendar servers send no CORS headers |
| `canvas` | Canvas sends no CORS headers on any API response, on every instance |
| `calendar` | Serves a feed the browser cannot author |
| `push` | Web Push needs a server-held VAPID private key |
| `lti` | An LTI launch is a server-to-server handshake |

Each is a **refusal-first** design rather than a proxy. `fetchcal` takes https
to a public host only, requires the body to begin `VCALENDAR`, and bounds the
read to 1 MB and 15 seconds — because `vite --host` is how this app is opened on
a phone, and at that point an unguarded forwarder belongs to everyone on the
wifi. `canvas` is stricter still: GET under `/api/v1/` and nothing else, because
a Canvas token can write.

## Where this will not stretch

Named now so a later phase does not discover it:

- **Messaging fan-out** (Phase 6) and **notification digests** (Phase 9) want
  scheduled and triggered work. Both are functions, but they are the first that
  need *scheduling* rather than answering a request.
- **Payment webhooks** (Phase 15) need an endpoint with an idempotency store.
- **Moderation queues** (Phase 10) need a worker, or an admin surface that does
  the work synchronously and says so.

None of those justifies a service yet. The trigger to revisit would be a job
that cannot be expressed as one bounded request or one scheduled run.

## The gap this decision currently has

**No function is declared in `config.toml`**, so Supabase preview branches
deploy the database and none of the six. Every preview branch therefore
exercises the schema and never the request path — including the Claude gateway
and the LTI handshake. This is a configuration omission rather than an
architectural one, and it is the cheapest high-value fix in the plan.
