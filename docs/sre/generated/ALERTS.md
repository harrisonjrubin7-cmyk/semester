<!-- Generated from app/src/lib/sre by sre.test.ts. Edit the register, then run `npm run registers`. -->

# Alert register (generated)

32 alerts. defined 21 · manual 5 · wired 6 · delivery-tested 0.

States: **defined** the condition is written and nothing evaluates it; **manual** a person evaluates it on a schedule; **wired** a machine evaluates it; **delivery-tested** a safe trigger reached a named human who acknowledged it.

| Id | Route | Source | Component | Runbook | State | Condition |
| --- | --- | --- | --- | --- | --- | --- |
| `burn:sign_in` | page | burn | `supabase-auth` | RB-02 | defined | Sign in: error budget burning at 14.4× over 1 h and 5 m, or 6× over 6 h and 30 m (page); 3× over 1 d, or 1× over 3 d (ticket) |
| `burn:today_load` | page | burn | `web-app` | RB-01 | defined | Today dashboard load: error budget burning at 14.4× over 1 h and 5 m, or 6× over 6 h and 30 m (page); 3× over 1 d, or 1× over 3 d (ticket) |
| `burn:plan_save` | page | burn | `supabase-db` | RB-03 | defined | Plan save: error budget burning at 14.4× over 1 h and 5 m, or 6× over 6 h and 30 m (page); 3× over 1 d, or 1× over 3 d (ticket) |
| `burn:advisor_agenda_save` | page | burn | `supabase-db` | RB-03 | defined | Advisor agenda save: error budget burning at 14.4× over 1 h and 5 m, or 6× over 6 h and 30 m (page); 3× over 1 d, or 1× over 3 d (ticket) |
| `burn:search` | page | burn | `web-app` | RB-01 | defined | Search: error budget burning at 14.4× over 1 h and 5 m, or 6× over 6 h and 30 m (page); 3× over 1 d, or 1× over 3 d (ticket) |
| `burn:ask_semester` | page | burn | `fn:claude` | RB-05 | defined | Ask Semester: error budget burning at 14.4× over 1 h and 5 m, or 6× over 6 h and 30 m (page); 3× over 1 d, or 1× over 3 d (ticket) |
| `burn:assignment_draft_save` | page | burn | `supabase-db` | RB-03 | defined | Assignment draft save: error budget burning at 14.4× over 1 h and 5 m, or 6× over 6 h and 30 m (page); 3× over 1 d, or 1× over 3 d (ticket) |
| `burn:privacy_request_intake` | page | burn | `fn:delete-account` | RB-04 | defined | Data export or delete request intake: error budget burning at 14.4× over 1 h and 5 m, or 6× over 6 h and 30 m (page); 3× over 1 d, or 1× over 3 d (ticket) |
| `probe:public-failed` | page | synthetic | `pipeline:production-smoke` | RB-01 | wired | The hourly probe of the deployed bundle or the database REST API fails |
| `probe:half-configured` | ticket | synthetic | `pipeline:production-smoke` | RB-01 | wired | Only one of the two institutional production URLs is configured, so the institutional probe fails loudly instead of claiming health |
| `probe:no-recent-run` | ticket | absence | `pipeline:production-smoke` | RB-01 | defined | No probe result recorded in the last three hours (the scheduler skipped, or the record job lost its branch) |
| `deploy:schema-failed` | page | absence | `pipeline:schema-deploy` | RB-09 | manual | The `main` branch record in the Supabase dashboard reads MIGRATIONS_FAILED, or ledger.snapshot disagrees with the migrations directory |
| `deploy:ledger-drift` | ticket | ci | `pipeline:schema-deploy` | RB-09 | wired | migrationorder.test.ts finds a migration numbered below the ledger watermark |
| `deploy:ci-red-on-main` | ticket | ci | `pipeline:ci` | RB-08 | wired | The CI run on main fails, which also holds the Pages and function deploys |
| `deploy:functions-failed` | ticket | ci | `pipeline:functions` | RB-08 | defined | The function deploy workflow fails, or functions.snapshot disagrees with what was last deployed |
| `deploy:stale-release` | ticket | ci | `pipeline:pages` | RB-08 | wired | A deploy was refused because main moved on, and nobody re-ran it |
| `job:absent` | ticket | absence | `job:push` | RB-10 | manual | supabase/health.sql block 6: a scheduled job is missing, or has not run within twice its period |
| `job:integrity-failed` | page | integrity | `job:console-audit-integrity` | RB-10 | defined | console_audit_verify() or the ledger chain verification reports a break |
| `queue:push-backlog` | ticket | threshold | `queue:push_queue` | RB-07 | defined | Oldest unsent push_queue row older than 30 minutes |
| `queue:dead-letter` | ticket | threshold | `queue:support_notification_outbox` | RB-07 | defined | Any row dead-lettered in support_notification_outbox, or any new integration dead-letter event |
| `queue:emergency-lag` | page | threshold | `fn:push` | RB-11 | defined | An emergency notification not delivered to 95% of recipients within 60 seconds of dispatch |
| `billing:webhook-lag` | page | threshold | `fn:billing-webhook` | RB-06 | defined | A paid Stripe event unprocessed after 15 minutes, or signature failures above the baseline |
| `ai:spend-half-cap` | page | threshold | `fn:claude` | RB-05 | defined | Provider usage reaches half the provider spend cap (MONITORING.md: the one alert allowed to wake somebody) |
| `ai:kill-switch-engaged` | ticket | threshold | `fn:claude` | RB-05 | defined | kill.ai_generation is engaged, or its table is unreadable (which counts as engaged) |
| `cost:anomaly` | ticket | threshold | `supabase-db` | RB-15 | defined | Any cost driver in cost.ts above 150% of its trailing four-week mean |
| `security:rls-gap` | page | integrity | `supabase-db` | RB-03 | manual | supabase/health.sql blocks 4 or 5 return rows, or ensure_rls_present is not 1 |
| `security:auth-failure-rise` | ticket | threshold | `supabase-auth` | RB-02 | manual | Auth log failures rise on one provider over a week (usually a redirect URL, occasionally an attack) |
| `security:secret-exposed` | page | ci | `pipeline:ci` | RB-13 | wired | gitleaks finds a secret-shaped value, or a provider reports a leaked key |
| `connector:stale` | ticket | threshold | `fn:integration-tick` | RB-14 | defined | A connection is staler than its contracted freshness window (governance/data-contracts.ts) |
| `recovery:restore-overdue` | ticket | absence | `supabase-db` | RB-12 | defined | No successful provider-backed restore drill inside the class drill cadence |
| `capacity:db-connections` | page | threshold | `supabase-db` | RB-15 | defined | Database connections above 60% of the verified ceiling (capacity.ts TARGET_UTILISATION) |
| `edge:error-shape` | ticket | threshold | `supabase-edge-runtime` | RB-04 | manual | Dashboard → Logs → Edge Functions shows one error repeating over seven days |
