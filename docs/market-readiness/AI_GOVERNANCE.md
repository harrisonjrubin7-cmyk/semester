# AI Governance

**Repository status: `IMPLEMENTED_NOT_PRODUCTION_APPROVED`**

Semester has one authenticated institutional intelligence gateway. It verifies
tenant and person scope, loads feature and AI policy server-side, limits roles
and academic-integrity modes, routes only to operator- and tenant-approved
models, retrieves only server-held approved source text, requires
provider-declared citations, meters usage and requires explicit confirmation
plus authoritative readback before an action can become a receipt.

The OpenAI adapter uses the Responses API in foreground mode with `store: false`,
a 20-second cancellation boundary, bounded output, structured grounded
answers and authoritative token usage. Provider errors are converted to a
generic response; prompts, answers and source bodies are not written to the
gateway audit journal.

## Enforcement boundaries

- Browser flags cannot enable intelligence. Missing server credentials,
  Supabase service access, configured model routes or cost ceilings produce a
  policy-disabled runtime.
- Source metadata is tenant-scoped. Source bodies live in
  `private.approved_source_content`, are inaccessible to browser roles and are
  joined only after the gateway verifies every requested source identifier.
- Provider output may cite only source identifiers included in that request.
  Semester maps those citations back to its own evidence identifiers; the
  provider never becomes citation authority.
- Every request atomically reserves tenant budget before provider work.
  Successful metering settles the reservation; failures release it; abandoned
  reservations stop counting after five minutes.
- The daily `ai-runtime-metadata` job removes usage metadata according to the
  tenant AI policy's retention-days setting. It never removes approved source
  content.
- Provider-generated actions are prepare-only until a separately approved
  institutional adapter supplies a verified write and authoritative readback.

## Required production approval

Code completion is not Vanderbilt approval. Before changing a Vanderbilt
tenant feature policy to `production`, the operator still needs:

1. A Vanderbilt-approved OpenAI project, data-processing terms and documented
   data-control configuration. `store: false` disables response application
   storage; it does not itself establish Zero Data Retention.
2. Production Supabase credentials, applied migrations, the scheduler job and
   a populated tenant policy with approved sources.
3. Vanderbilt-approved models, integrity modes, roles, monthly budget,
   per-request ceiling and retention period.
4. Security, accessibility, privacy and legal sign-off, plus a tested incident
   and rollback owner.
5. A staging proof that cross-tenant source identifiers, unapproved citations,
   concurrent budget exhaustion, provider outages and expired confirmations
   all fail closed.

Until those controls are observed in the actual Vanderbilt environment, the
truthful state is configured sandbox or policy-disabled—not production.
