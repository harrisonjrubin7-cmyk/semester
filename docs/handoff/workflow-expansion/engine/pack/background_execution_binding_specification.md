# Background execution binding specification

Status: proposed binding contract and 17 draft registrations. Handler keys are symbolic proposed identifiers, not implemented handlers. Only existing handoff SQL/API/outbox names are evidence-backed. No live job or worker was verified. All example retry, timeout, cost and lease values are illustrative policy targets requiring environment review.

## Existing extension point

Extend the inspected handoff pattern: api.request_action -> api.decide_action -> api.execute_action -> ctl.outbox. Current execute_action records executed before domain work. Migrate that meaning to accepted/queued; keep immutable domain completion receipts separate. Do not build a second disconnected action engine. Inspect remaining repository and deployed schema before selecting migration names or modifying tables.

## Binding sequence

1. Validate event envelope, payload schema, tenant/resource scope and classification. Persist payload references, not credentials or unnecessary protected records.
2. Resolve handler registry key against reviewed code version, schema and capability policy. Draft/unresolved bindings cannot run.
3. Claim one durable job under transaction, record owner, lease expiry and increasing fencing token; schedule heartbeat. Inline guards use synchronous transport and do not need a new queue merely to be mapped.
4. Check consumer inbox using tenant + consumer + event ID. Bind command key to tenant + actor + capability + request key + payload hash. Reject conflicting payload and deduplicate prior effects.
5. Revalidate service-principal scope plus original actor delegation, current membership, approval, policy version, source freshness, resource version and domain authority. A service-role connection is not business authorization.
6. For a local database effect, atomically commit business effect, consumed-event marker, domain outcome, immutable audit and new outbox events. Do not mark inbox consumed before effect or domain outcome are durable.
7. For an external authority, submit with authority-supported idempotency and record dispatch intent. A lost result becomes result_unknown. Query definitive authoritative status; lack of a local row or nondefinitive not-found response is not proof of no commitment.
8. Create committed receipt only from effect proof. An accepted receipt cannot claim enrollment, payment or grade completion. If projections fail, retain authoritative commitment and enqueue projection repair.
9. ACK only after durable outcome. If ACK is lost, redelivery must observe the prior dedup/result record, not rerun the effect.
10. Retry bounded confirmed-transient failures with policy-approved exponential backoff and jitter. Stop retries on denied authorization, invalid payload, expired approval or unknown official-write outcome.
11. Route exhausted/unknown failures to an owned exception/dead-letter queue. Replay needs reviewed scope, original correlation, safe key semantics and an audit reason; it is not an unrestricted retry button.
12. Compensation is classification-specific: discard uncommitted staging; remove only proven provisional resources; repair projections; correct committed official records through a new authorized command. Preserve personal work and historical records.
13. Emit scoped Action Center/result updates and notifications. Delivery failure must not undo the official action. In-app durable status remains available.

## Lease/fencing acceptance

- At most one lease may authorize a commit for a job at a time.
- A stale fencing token cannot commit or overwrite current status.
- Lease expiry alone does not prove external noncommitment; takeover reconciles first.
- Heartbeat interval must be shorter than lease duration.
- Long work or provider latency must not silently outlive authority/grant validity.

## Control boundary

AI intent and permission validation are guarded-inline candidates; do not retrieve forbidden data before authorization. Model response generation and usage recording may use separate durable bindings. Retrying usage logging must never repeat the model request. Community listing checks concern public listing content, not private messages by default. Migration dual run compares results without allowing two official writers. Retention handles legal holds before destructive work. Analytics instrumentation includes an event-specific schema validator, not size checks alone.

## Activation gate

Reviewed real code and digest, definition/step linkage, identity delegation, schema resolution, CI evidence, privacy and accessibility evidence, worker/inbox/outbox tests, tenant authority, operational owner and kill switch. Run strict bundle validation in addition to runtime registry and grant verification. Draft bindings intentionally fail the strict resolved-binding gate.
