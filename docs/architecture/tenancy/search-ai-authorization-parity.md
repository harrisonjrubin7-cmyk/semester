# Search and AI authorization parity

**Status:** repository contract implemented; production search, deployment and tenant activation are not verified.

Search and AI context now share one result-label contract in
`packages/platform/src/engines/search.ts`. A result records the verified tenant,
server-selected purpose, source identity and freshness state. Callers do not
construct an unscoped query, and downstream AI cannot reinterpret those facts.

## Contract

1. The server derives `RequestContext` from authenticated membership.
2. The route chooses `search` or `ai_context`; a client header cannot choose it.
3. `scopeFor` derives tenant, person, live role grants and purpose, then the
   index applies tenant, ACL, purpose, role and classification predicates.
4. Each result carries `RetrievalLabels` with tenant, purpose, source and
   freshness.
5. AI generation accepts only a label matching its canonical context, requested
   source id and `current` freshness state.

The institution gateway uses the same shape even though its approved-source
repository is relational rather than a search index. The repository takes the
canonical context, filters rows by the verified tenant, and labels the returned
source. `respond` checks the labels immediately before policy, budget and
provider work proceed.

## Negative evidence

- `packages/platform/src/engines/engines.test.ts` proves tenant, purpose, ACL,
  classification and every university-role refusal, plus a positive control.
- `app/server/institution/intelligence.test.ts` proves refusal for another
  tenant, purpose, source id, stale content and a non-AI request context before
  a provider is called.
- `app/server/institution/context.test.ts` proves the purpose is server-selected.

## Claim boundary

This is source and test evidence only. The product still has a client-only
search experience and no production server search adapter or deployed shared
index. The institution AI repository uses a service-role database client, so
its tenant predicate remains application-enforced. The `claude` Edge Function
is a separate AI path and is not evidence of parity. Green tests, a merged PR
or a deployment do not establish institutional approval, tenant activation or
general availability.
