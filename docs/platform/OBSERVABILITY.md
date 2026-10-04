# Observability standards and operational metadata

`packages/platform/src/observability/` · `observability/observability.test.ts`

The law this implements: *every capability has telemetry, SLOs, runbooks and
on-call ownership; a feature with no monitoring or recovery plan does not ship.*

## Logs

A log line has `at, level, service, msg, correlationId` and, when there is one,
`requestId` and `tenantId`. **Logs carry ids, never content.** Fields go through
`redact` *before* they are written: keys that look like secrets
(`password, token, apiKey, authorization, cookie, credential, …`) and personal
fields (`email, phone, dob, firstName, address, student number, …`) become
`[redacted]`; free-text keys (`body, content, text, note, message, prompt,
response, essay, answer, comment, transcript`) become `[N chars]`; depth, string
and array length are bounded. Redaction is **by key** — by value is a guess — so a
new free-text field name that is not on the list will pass through: add it to
`redact.ts` when you meet one. A student's essay in a log is a record disclosure
to everyone with log access.

## Metrics

Names are `semester_snake_case`. **A metric may not carry a tenant, person,
session, email, correlation or request id, or an IP, as a label**
(`defineMetric` refuses): per-tenant labels are unbounded cardinality, and a label
per person is a profile. Per-tenant questions are answered from logs and traces,
where the tenant id belongs; metrics take a bounded `tier` or `region`. At most 6
labels.

| Metric | Kind | Labels | Why it exists |
| --- | --- | --- | --- |
| `semester_command_total` | counter | command, result, tier | throughput and error ratio per command |
| `semester_command_duration_seconds` | histogram | command, tier | latency SLO |
| `semester_policy_decision_total` | counter | action, outcome, reason | spot a rule suddenly denying (or allowing) |
| `semester_idempotent_replay_total` | counter | command | retry storms; client bugs |
| `semester_outbox_pending` | gauge | producer | publisher health |
| `semester_outbox_dead_lettered_total` | counter | producer | parked rows need an operator |
| `semester_tenant_isolation_violation_total` | counter | layer | **any non-zero value pages** |
| `semester_connector_failures_total` | counter | provider, state | connector health |

## Traces

Propagate the **correlation id** as the trace's baggage; attributes follow the log
rules (ids, never content). The `tenantId` is an attribute on the root span so a
support engineer can filter a tenant's traces without it ever being a metric label.

## Operational metadata

A service is not shippable without a `ServiceDescriptor`
(`descriptorProblems` is the check):

| Field | Rule |
| --- | --- |
| `id` | kebab-case, unique |
| `owner` | a team (a seat), never empty |
| `tier` | 0 = records, auth, billing, audit (page immediately) … 3 = internal tooling |
| `slos` | at least one; target between 0 and 1 **and not below the tier's floor** (tier 0 ≥ 0.999, 1 ≥ 0.995, 2 ≥ 0.99, 3 ≥ 0.95); a 7–90 day window; a written indicator |
| `runbook` | a `docs/*.md` path |
| `dataClasses` | what it touches, from the classification list |
| `dependsOn` | other service ids; no self-dependency |
| `degradesToNative` | whether the capability still works natively if every external dependency is down |

### Platform services

| Service | Tier | SLO (30 days) | Depends on |
| --- | --- | --- | --- |
| `gateway` | 0 | 99.9% non-5xx at the edge, excluding 429 | identity, policy |
| `identity` | 0 | 99.9% successful session verifications | — |
| `policy` | 0 | 99.9% of decisions in < 50 ms (p99) | identity |
| `audit` | 0 | 99.99% audit rows committed with their command | — |
| `outbox-publisher` | 1 | 99.5% of rows published within 60 s | audit |
| `notifications` | 1 | 99.5% of non-deferred deliveries handed to a channel within 60 s | outbox-publisher |
| `files` | 1 | 99.5% signed-URL issuances succeed | policy |
| `search` | 2 | 99% of queries without a 5xx | policy |
| `integrations` | 2 | 99% of healthy connections synced within interval | outbox-publisher |

**These are targets, not measurements.** Nothing here has been run in production;
no SLO has a measured baseline. Each becomes a claim only when the indicator is
being collected and a period has passed (see [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md)
for how a number becomes public).

## Standard fields on every operation

`service`, `version`, `region`, `commit` (deployment metadata, set once at boot,
not per call), plus per request: `correlationId`, `requestId`, `tenantId`,
`actor.type` (never the person id in a metric), `action`, `decision`, `reasonCode`,
`durationMs`. The audit row and the outbox event carry the same correlation id, so
one id joins the tap, the log line, the audit row and the event.
