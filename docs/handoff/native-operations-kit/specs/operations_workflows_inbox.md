# Operations OS, workflow runner and Inbox
Existing #/console and RPC/client/policy model must be extended. Design /app/ops/* routes are information-architecture targets, not verified new router roots. route.ts is custom hash router; known view allowlists do not prove console authorization. Existing docs describe Console.tsx, console/client.ts, lib/ops/console.ts and request_approval/decide_approval/console_act. Revalidate current code before patching. SQL authorization is final; menu visibility never grants data access.

## Controlled actions
Request -> authoritative policy/records -> impact preview -> required approvals -> exact command digest -> dispatch recheck -> fail-closed durable audit -> atomic domain mutation/outbox -> reconciled receipt -> history/notifications -> compensation if authorized. Current console paths are reusable; proposed 14-check chain reconciles different existing checks, not a claim the source runner already implements exactly fourteen.

## Inbox
Canonical work_item has security scope, business/tenant, source event, kind, severity, owner queue/person, required capability, deadline/calendar/timezone, correlation, version, evidence refs and action refs. Store no duplicated student payload. My Work/team/unassigned/overdue/held views. Claim assignment uses optimistic version/lease; no duplicate execution. SLA timers use server time and business calendar. Closing requires resolution/receipt; escalation and notification minimize context.

## Workflow runner
Each step pins workflow version, actor lane, allowed route/screen IDs, data authority, required capabilities/checks, input/output schema, approval rules, dependencies, idempotency, failure class, rollback/compensation and evidence. Prefer explicit actor mappings over regex source heuristics. Simulator cannot mark official completion without durable runtime evidence. View -> draft -> request -> decide -> execute -> reconcile are different transitions.

## Console admission
Fetch current capabilities and scoped workspace discovery. Show Operations only when an eligible workspace is returned. Signed-out/loading/denied/expired/revoked states explicit. #/console deep links repeat checks. Resolve discrepancy between my_capabilities role-grant view and database break-glass-derived capability decisions with a scoped decision endpoint; no broad data fallback. Fresh MFA, independent approvers, break-glass expiry/review and audit-failure denial tested.

## Read models
Return canonical IDs, source, authority, freshness, model version, generated_at/watermark, correlation and accepted completeness. Outbox publisher needs retries/DLQ/checkpoints/monitoring. Bootstrap/rebuild projections in scope; source DB grant boundaries remain authoritative.
