<!-- Generated from app/src/lib/sre by sre.test.ts. Edit the register, then run `npm run registers`. -->

# Failure experiments (generated)

14 experiments, 2 executed. A planned experiment is a hypothesis, not evidence.

| Id | Component | Where | Status | Hypothesis | Abort when |
| --- | --- | --- | --- | --- | --- |
| CX-01 | `fn:claude` | staging | executed ([evidence](../../../docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json)) | Engaging kill.ai_generation stops model calls within one request, and the student sees the stated sentence; an unreadable switch table counts as engaged. | Any non-AI function begins failing. |
| CX-02 | `supabase-db` | staging | executed ([evidence](../../../docs/evidence/restore/2026-09-30-logical-rehearsal.md)) | A logical dump restores into an empty project with schema, rows, event trigger and RLS identical. | The target resolves to any non-scratch host. |
| CX-03 | `supabase-db` | staging | planned | A provider-backed point-in-time restore into an isolated project returns the pre-marker state in under the C0 RTO of 60 minutes, with RPO under 5. | The restore target is the production project, or any integration or notification fires from the target. |
| CX-04 | `supabase-db` | staging | planned | With the database unreachable the installed app keeps every local edit, shows queued-change state, and syncs on reconnect without duplication. | The test device holds data that is not synthetic. |
| CX-05 | `supabase-auth` | staging | planned | When auth is down, open sessions continue, new sign-ins fail with the stated message, and no flow falls back to a weaker check. | Any request is accepted without a valid session. |
| CX-06 | `supabase-edge-runtime` | staging | planned | When the function runtime errors, each function fails closed with a reference, the cron callers retry without duplicating work, and queues hold their rows. | A queue row is lost, or a retry sends a duplicate. |
| CX-07 | `fn:billing-webhook` | staging | planned | A delayed, duplicated and out-of-order Stripe event stream leaves entitlement correct and every payment applied exactly once. | Any live-mode key is configured on the target. |
| CX-08 | `queue:push_queue` | staging | planned | A push provider outage grows the queue without loss, and draining it after recovery sends each reminder once, oldest first, without a burst that trips the provider limit. | Real subscriptions exist in the target. |
| CX-09 | `pipeline:schema-deploy` | staging | planned | A failing migration is visible within one hour to the owner and does not leave production half-migrated. | The target branch is production. |
| CX-10 | `pipeline:production-smoke` | staging | planned | Taking the staging app down produces a failed probe and a recorded outage in the next hourly run, and the status page shows it from a clean browser. | The status page reads production. |
| CX-11 | `web-app` | staging | planned | With every adapter stubbed to fail, every native journey still passes (the native-first rule from the target architecture). | Any journey that needs a provider is not marked as such. |
| CX-12 | `fn:push` | staging | planned | An emergency broadcast to the full staging cohort reaches 95% of recipients within 60 seconds while every other queue is saturated. | Any message goes to a real device. |
| CX-13 | `fn:integration-tick` | staging | planned | A connector returning errors for a day marks its connection stale with a freshness label, opens no write-back, and recovers without replaying dead letters blindly. | A write-back is attempted. |
| CX-14 | `fn:delete-account` | staging | planned | A deletion interrupted midway fails closed, is retryable, and a restore afterwards does not resurrect the erased account. | The target holds non-synthetic accounts. |
