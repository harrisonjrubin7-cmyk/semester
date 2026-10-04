# 02 · Model gateway architecture

**Builds on:** [`../architecture/0004-ai-through-a-metered-gateway.md`](../architecture/0004-ai-through-a-metered-gateway.md),
`supabase/functions/claude/index.ts`, `app/server/institution/intelligence.ts` and its runtime, repository and
provider, `packages/institution/src/intelligence.ts`, `app/src/lib/openai.ts`.
The rebuild brief asks for a "provider-agnostic model gateway; retrieval service; evaluation harness; policy
enforcement; tool broker; redaction and provenance service". This chapter is the gateway; retrieval, tools,
evaluation are the next three.

## What exists, as verified

There are two gateways, they do not share a contract, and neither is provider-agnostic.

| Property | `shared-key` function | Institutional gateway | `ask()` direct routes |
| --- | --- | --- | --- |
| Provider | Anthropic only | **OpenAI only**: the runtime returns the disabled service unless every configured model starts `openai:` | Anthropic or OpenAI, chosen by a setting |
| Identity | JWT, verified against the project | Verified university identity (`institutionId`, `userId`, `roles`) | None |
| Policy source | Activation gate `SHARED_AI_PROVIDER` and five owner decisions | `ai_policy` row per tenant, course policy per source scope | Per-school `aiOff` categories, built into context |
| Cost control | Monthly call cap per account, atomic in the database; request clamp | Per-request ceiling; tenant monthly budget with **reserve then settle**; a response that exceeds either is discarded | None; the student's own quota |
| Kill switch | Read, fail closed, drilled | Read, fail closed, tests | **Not read** |
| Failover | None | None. `chooseModel` picks the cheapest allowed candidate under the ceiling; a provider failure is a 503 | None; the setting is the provider |
| Region or data zone | None | **No field exists** in `ai_policy`, the contract or the provider | None |
| Output validation | Passes through | Strict JSON schema; every cited source id must be one the request named; usage must be authoritative | None |
| Tool path | Client-side tools | Client-built `proposedActions`, server-issued, expiring, single-use, confirm then readback; `execute` stubbed | Client-side tools |
| Observability | Logs | `IntelligenceAuditRecord`: category, provider, model, tokens, cost cents, policy decision, action id; no bodies | None |

The pieces are good. The ordered pipeline in `respond()` (scope, tenant state, role, mode, agent, sources,
course scope, course policy, model choice, budget reserve, generate, validate, settle, audit) is the right spine and
this chapter keeps it. The finding is structural: **two doors, two providers, no shared contract**, so every
property below would be built twice.

## Target: one contract, three route classes

One request contract and one pipeline, deployed as route classes that differ in *who holds the credential and who
may see the data*, which are exactly the three disclosures [chapter 09](09-user-transparency.md) must make.

| Route class | Credential held by | Data governed by | Enforced by |
| --- | --- | --- | --- |
| **Semester-managed** | Semester | Semester's terms and the user's account | The gateway, fully |
| **Institution-directed** | The institution's own provider account, or Semester's under the institution's contract | The institution's policy and approved sources | The gateway, fully, with tenant policy |
| **Student-directed** | The student | The student's agreement with the provider | The client door only: advisory ([chapter 07](07-incident-response-and-shutdown.md)) |

`ask()` becomes a client of the contract rather than a fork in front of three providers. It can still hold a
student's own key. What changes is that it asks the gateway for a **route decision** first where one is reachable, and
applies the tenant's policy pack and AI status where it is not.

## The pipeline

Each stage is a function with a typed input and a typed refusal, so the audit record can say which stage stopped a
request. Stages marked **built** exist in `respond()` or its service today.

| # | Stage | Decides | State |
| --- | --- | --- | --- |
| S0 | Authenticate; resolve tenant, role, age and consent from the **verified identity**, never the request body | Who is asking, as whom | built (`scope-refused`) |
| S1 | Kill switch, tenant state, feature state, role, mode | May this happen at all | built, except feature state |
| S2 | Policy decision: purpose, course policy, source scope, data class | May *this* data go to *any* model for *this* purpose | built for sources and course policy; **data class not enforced server-side** |
| S3 | Retrieval ([chapter 03](03-retrieval-policy.md)) | Which authorised, fresh chunks | selection by the client, approved server-side |
| S4 | Minimise and redact | What is actually sent | not started |
| S5 | Route selection | Which approved route | cheapest allowed only |
| S6 | Budget reserve | Whether the worst case is affordable | built |
| S7 | Provider call, with the instruction/data separation | The model's answer | built; sources are JSON and the instruction turn now says they are data |
| S8 | Output validation: schema, citations verified by Semester, secret and identifier scan, link and image allow-list | Whether the answer may be shown | schema and citations built; the scans are not |
| S9 | Action proposals ([chapter 04](04-tool-broker.md)) | What the user may be offered | client-built, server-held |
| S10 | Budget settle; audit | The record | built; a settle failure discards the answer |
| S11 | Response with provenance and route disclosure | What the user sees | sources and route; no data-zone or version |

## Routing

### The route table

A route is a row, not a string in a list. Today a route is `{ model, provider, estimatedCents }`.

| Field | Why |
| --- | --- |
| `route_id`, `provider`, `model` with a **pinned version identifier** | An alias is a silent model change. The change-management standard already says to treat one as such |
| `regions[]` the provider will process in; `zero_retention`, `training: none`, `retention_days` as *attested* values with the contract that attests them | Today `store: false` is the only data-handling control in code and is not proof of zero retention |
| `capabilities`: vision, structured output, long context, tool use | Hard constraints, not preferences |
| `price` (versioned) | Reserve and settle need a price; the audit needs the price used |
| `status`: `candidate`, `canary`, `active`, `deprecated`, `withdrawn` | A route is approved per tier and per tenant, and moves through statuses by a recorded decision |
| `approvals[]`: tier, tenant or class, evaluation artifact, decision record | An approval is scope-specific and does not transfer |

### Selection

1. **Filter on hard constraints:** tenant allow-list; tenant data zone ∈ the route's regions; capabilities the task
   needs; route status permits this tier; route not tripped by its breaker.
2. **Require evidence:** drop routes whose last evaluation for this feature is below its tier's thresholds or expired.
3. **Rank:** by cost, then by observed p95 latency, then by `route_id` so the choice is deterministic and testable.
4. **Fail closed:** nothing left is `model-unavailable`, as today. Never relax a constraint to find a route.

The existing `chooseModel` is step 3 with a cost ceiling and nothing before it.

## Failover

Failover is where a gateway most easily breaks its own policy, so the rules are strict. A provider outage is an
availability event; it is never a licence to move data somewhere the tenant did not approve.

| # | Rule |
| --- | --- |
| F1 | Fail over only to a route that passes **every filter above for this request**: same data zone, same approval scope, same capabilities |
| F2 | The tenant approves an **ordered fallback list** in advance ([chapter 08](08-tenant-ai-console.md)). A route not on the list is never a fallback, however cheap and however healthy |
| F3 | Fail over only **before the first byte** of a streamed answer and before any tool result has been used. A stream cut mid-answer is a failed answer, shown as one, never stitched from two providers |
| F4 | At most one retry on the same route for a timeout or 5xx, then the next route. The budget reservation covers the **worst route** in the chain, not the first |
| F5 | A per-route circuit breaker opens on error rate or latency; its state is visible in the console and to on-call and is manually settable (`S4` in the shutdown ladder) |
| F6 | **A refusal is not an outage.** A safety or policy refusal from a model never triggers failover: shopping for a model that complies defeats the refusal |
| F7 | A failover that moves a tenant's data to a different provider is **audited and surfaced to the tenant**, because it changes who processed their data |
| F8 | When no route remains, return the non-AI path message; never a partial answer |

Today none of this exists: a provider failure settles the reservation to nothing, audits `provider-refused` and
returns 503. That is the safe default, and it is also the whole of the current availability story.

## Cost controls

Layers, outermost first. Each is a hard stop, not a report.

| Layer | Control | State |
| --- | --- | --- |
| Request | Maximum output tokens by mode; input size cap; per-request cost ceiling; an over-ceiling response is discarded | built |
| User | Per-user daily and monthly call and cost caps | built for `shared-key` (monthly calls); not for the gateway |
| Feature | A budget per feature per tenant, so one feature cannot spend a tenant's month | not started |
| Tenant | Monthly budget with reserve-then-settle; a settle failure discards the answer | built |
| Evaluation | A separate budget and credential for evaluation runs, never a student's or a tenant's | designed (`AI-RECOMMENDATION-EVALUATION-HARNESS.md`) |
| Platform | A global ceiling per provider and an alert on spend velocity; hard stop at 100%, notify at 80% | not started |
| Cache | Prompt caching **within one tenant only**; never a cache key that can match across tenants or users | designed |

The price table is versioned and the audit record carries the version used, so a cost dispute can be replayed. Cost
per *passing* evaluation case is a release metric ([chapter 06](06-evaluation-framework.md)).

## Tenancy

- **Tenant comes from the verified identity.** The existing check (`request.tenantId !== identity.institutionId`
  refuses) is the template, and it extends to every new input: no tenant, person, course or role value is read from a
  model's output or a request field when the identity carries it.
- **Per tenant:** policy row, budgets, kill scope, route allow-list and fallback order, data zone, retention, cache
  namespace, audit partition, vector namespace, concurrency limit. A noisy tenant is bounded by its own concurrency
  limit and queue, not by sharing one.
- **Tenant-held credentials** (an institution that brings its own provider account) are stored encrypted, scoped to
  that tenant's routes, rotatable by the tenant, and never used for another tenant's request. Semester does not train
  on them and cannot read them back.
- **Isolation is tested through the AI path**, not only in the database: a tenant-A request must not be able to cause
  a tenant-B source, embedding, cache entry, audit row or budget to be read or written. This is the tier 2 gate item.

## Regional and data controls

Region is a first-class field and today it is nowhere.

- A tenant has a **data zone**. A route declares the regions it processes in. A request is routable only where the
  zone is inside the route's regions, and **no failover crosses a zone**.
- The zone governs everything derived from the request, not only the model call: embeddings, indexes, caches, audit
  records, evaluation samples and support access. A model in-zone with an index out-of-zone is out of zone.
- `zero_retention` and `training: none` are **attested values with a contract reference**. The route cannot become
  `active` for a tenant that requires them while the attestation is missing. Published provider language is not an
  executed contract; none is signed today ([`../trust/PROVIDER-TERMS.md`](../trust/PROVIDER-TERMS.md)).
- Region is a **tenant attribute chosen at onboarding and fixed**, and the router refuses a provider or zone not on the
  tenant's allow-list ([`../target-architecture/05-ENVIRONMENTS-AND-ROLLOUT.md`](../target-architecture/05-ENVIRONMENTS-AND-ROLLOUT.md) §7).
  Which zones exist is decision **P-12**, deferred to a person: the first customer's contract and counsel decide. This
  chapter specifies the field and the refusal and chooses no zone.
- Cross-border transfer and each jurisdiction's rules are a counsel determination. This design supplies the field and
  the enforcement point and makes no legal conclusion.

## Observability

Request spans carry identifiers and counts. **No prompt, source or answer body is logged by default** (`AI-DATA-USE-STANDARD`).

| Record | Fields beyond today's `IntelligenceAuditRecord` |
| --- | --- |
| Audit, per request | `route_id`, pinned model version, `prompt_version` and tool-set hash, `policy_version`, `data_zone`, retrieval-set hash and source ids, output hash, stage that stopped it, failover chain, correlation id |
| Audit, per action | proposal id, arguments hash, preview hash, approver, receipt id, rollback id |

| Metric | Use |
| --- | --- |
| Latency p50 and p95 per stage and per route | SLOs ([`../operating-model/SLOS-AND-ERROR-BUDGETS.md`](../operating-model/SLOS-AND-ERROR-BUDGETS.md)) |
| Tokens and cost per feature, tenant, route | Budgets; cost per passing case |
| Refusals by stage and reason, by role | Policy health; over- and under-refusal |
| Citation-verified rate; schema-failure rate; invalid-response rate | Drift and grounding |
| Failovers; breaker state | Availability and data-handling |
| Kill-switch, budget and policy denials | Controls doing their job |
| Injection-detector hits; canary leaks | [Chapter 07](07-incident-response-and-shutdown.md) signals |
| Proposals, confirmations, rejections, rollbacks | Oversight health; rubber-stamping |
| Feedback rate and category | [Chapter 09](09-user-transparency.md) |

The audit trail is **append-only and a precondition of generating** at tier 2 and above: if the record cannot be
written, the request is refused. Today `audit` is optional in `respond()`.

## Build order

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| P0 | Contract and route table in `packages/institution`; the existing OpenAI route expressed as a row; audit fields; audit-as-precondition | Existing gateway tests pass unchanged; a test refuses generation when audit cannot be written |
| P1 | Anthropic route behind the contract; failover rules F1–F8 with a fake provider that fails on demand | Failover tests: cross-zone and off-list refused, refusal never fails over, mid-stream never stitched |
| P2 | Data zone and attestations in `ai_policy` and the route table; selection filters | A tenant with a zone cannot be routed out of it by any fault injected |
| P3 | Client door as a contract client; AI status; managed accounts route through the gateway | Consumer features unchanged; `IR-01` drill |
| P4 | Feature budgets, per-user gateway caps, spend alerts; shared-key function folded into the contract | Budget tests at feature and user level |

## Requirements

| ID | Requirement | State |
| --- | --- | --- |
| `GW-01` | One request contract and pipeline for all three route classes | designed |
| `GW-02` | Provider-agnostic: a second provider is a route row and an adapter, not a fork | not started: runtime refuses non-OpenAI |
| `GW-03` | Routes pin a version identifier; an alias cannot be activated | not started |
| `GW-04` | Data zone on tenants and regions on routes; no route outside the zone | not started: no field exists |
| `GW-05` | `zero_retention` and `training: none` are attested with a contract reference | not started |
| `GW-06` | Route selection filters on policy, zone, capability, tier approval and evidence, then ranks | partial: allow-list and cost only |
| `GW-07` | Failover rules F1–F8 | not started |
| `GW-08` | Fallback list approved per tenant in advance | not started |
| `GW-09` | Per-route circuit breaker, visible and manually settable | not started |
| `GW-10` | Tenant isolation proven through the AI path | not started |
| `GW-11` | Per-feature state, per-feature budget | not started |
| `GW-12` | Per-user caps on the institutional gateway | not started |
| `GW-13` | Evaluation runs on a separate credential and budget | designed |
| `GW-14` | Audit carries route, pinned version, prompt and tool-set hash, policy version, zone, retrieval hash | not started |
| `GW-15` | Prompt cache scoped to one tenant | designed |
| `GW-16` | Audit write is a precondition of generation at tier 2 and above | not started |
| `GW-17` | Tenant-held provider credentials, encrypted, tenant-scoped | not started |
| `GW-18` | Response discloses route class and, where relevant, that a fallback processed the request | not started |
