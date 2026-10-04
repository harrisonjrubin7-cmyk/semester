<!-- Generated from app/src/lib/sre by sre.test.ts. Edit the register, then run `npm run registers`. -->

# Service catalog (generated)

66 components. Criticality classes: C0 data loss or exposure, or the emergency path; C1 a core daily journey or the only monitor; C2 can wait hours; C3 deferrable.

| Id | Name | Kind | Class | Role | Journeys | Depends on | Kill switch | Runbook |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `supabase-auth` | Supabase Auth | external | C0 | platform | sign_in | — | — | RB-02 |
| `supabase-db` | Postgres and the REST API | database | C0 | data | plan_save, advisor_agenda_save, assignment_draft_save, privacy_request_intake, today_load | — | `SEMESTER_READ_ONLY` | RB-03 |
| `supabase-edge-runtime` | Supabase Edge Functions runtime | external | C0 | platform | — | — | — | RB-04 |
| `github-pages` | GitHub Pages (serves the app) | static_hosting | C1 | platform | today_load | — | — | RB-01 |
| `vercel` | Vercel (previews and institution gateway) | external | C3 | platform | — | — | — | RB-01 |
| `stripe` | Stripe | external | C1 | billing | — | — | — | RB-06 |
| `anthropic` | Anthropic API | external | C2 | ai | ask_semester | — | `kill.ai_generation` | RB-05 |
| `openai` | OpenAI API (institution gateway) | external | C2 | ai | ask_semester | — | `kill.ai_generation` | RB-05 |
| `resend` | Resend (email) | external | C2 | support | — | — | — | RB-07 |
| `web-push` | Web Push (VAPID) | external | C1 | platform | — | — | — | RB-07 |
| `web-app` | The Semester web app | client | C1 | platform | sign_in, today_load, search, plan_save, assignment_draft_save, ask_semester | `github-pages`, `supabase-auth`, `supabase-db` | `VITE_READ_ONLY` | RB-01 |
| `status-page` | Public status page | static_hosting | C1 | support | — | `github-pages` | — | RB-01 |
| `institution-gateway` | Institution gateway | gateway | C2 | integrations | advisor_agenda_save | `supabase-db`, `supabase-auth` | `SEMESTER_READ_ONLY` | RB-14 |
| `fn:claude` | AI proxy (shared key, metered) | ai_route | C2 | ai | ask_semester | `supabase-edge-runtime`, `supabase-db`, `anthropic` | `kill.ai_generation` | RB-05 |
| `fn:billing-checkout` | Start checkout | edge_function | C2 | billing | — | `supabase-edge-runtime`, `supabase-db`, `stripe` | — | RB-06 |
| `fn:billing-cancel` | Cancel at period end | edge_function | C2 | billing | — | `supabase-edge-runtime`, `supabase-db`, `stripe` | — | RB-06 |
| `fn:billing-portal` | Receipts and payment methods | edge_function | C2 | billing | — | `supabase-edge-runtime`, `supabase-db`, `stripe` | — | RB-06 |
| `fn:billing-webhook` | Stripe webhook receiver | edge_function | C1 | billing | — | `supabase-edge-runtime`, `supabase-db`, `stripe` | — | RB-06 |
| `fn:calendar` | Published calendar feed | edge_function | C2 | platform | — | `supabase-edge-runtime`, `supabase-db` | — | RB-04 |
| `fn:fetchcal` | Calendar feed fetch | edge_function | C3 | platform | — | `supabase-edge-runtime` | — | RB-04 |
| `fn:canvas` | Canvas read proxy | edge_function | C2 | integrations | — | `supabase-edge-runtime` | `kill.integration_sync` | RB-14 |
| `fn:lti` | LTI 1.3 launch | edge_function | C2 | integrations | — | `supabase-edge-runtime`, `supabase-db`, `supabase-auth` | `kill.integration_sync` | RB-14 |
| `fn:push` | Web Push sender | edge_function | C1 | platform | — | `supabase-edge-runtime`, `supabase-db`, `web-push`, `queue:push_queue` | — | RB-07 |
| `fn:support-reply-notify` | Support reply email | edge_function | C2 | support | — | `supabase-edge-runtime`, `supabase-db`, `resend`, `queue:support_notification_outbox` | — | RB-07 |
| `fn:integration-tick` | Integration sync tick | edge_function | C2 | integrations | — | `supabase-edge-runtime`, `supabase-db` | `kill.integration_sync` | RB-14 |
| `fn:lead-intake` | Company-site lead intake | edge_function | C3 | support | — | `supabase-edge-runtime`, `supabase-db` | — | RB-04 |
| `fn:trust-room` | Procurement trust-room links | edge_function | C3 | security | — | `supabase-edge-runtime`, `supabase-db` | — | RB-04 |
| `fn:delete-account` | Account erasure | edge_function | C0 | data | privacy_request_intake | `supabase-edge-runtime`, `supabase-db`, `supabase-auth` | — | RB-04 |
| `fn:productivity-sourcecheck` | Source availability check | edge_function | C3 | platform | — | `supabase-edge-runtime` | — | RB-04 |
| `queue:push_queue` | Push queue | queue | C1 | platform | — | `supabase-db` | — | RB-07 |
| `queue:support_notification_outbox` | Support notification outbox | queue | C2 | support | — | `supabase-db` | — | RB-07 |
| `queue:integration_dead_letter_events` | Integration dead letters | queue | C2 | integrations | — | `supabase-db` | — | RB-14 |
| `queue:community_escalation_deliveries` | Community escalation deliveries | queue | C2 | support | — | `supabase-db` | — | RB-07 |
| `job:push` | Send due reminders (every 15 min) | job | C1 | platform | — | `fn:push` | — | RB-10 |
| `job:support-reply-notify` | Drain support outbox (every minute) | job | C2 | support | — | `fn:support-reply-notify` | — | RB-10 |
| `job:escalation-delivery` | Community escalation delivery (parked) | job | C2 | support | — | `queue:community_escalation_deliveries` | — | RB-10 |
| `job:media-scan` | Community media scan (parked) | job | C2 | security | — | `supabase-db` | — | RB-10 |
| `job:integration-sync` | Integration tick (four times an hour) | job | C2 | integrations | — | `fn:integration-tick` | `kill.integration_sync` | RB-10 |
| `job:tombstones` | Sweep tombstones (weekly) | job | C3 | data | — | `supabase-db` | — | RB-10 |
| `job:ai-runtime-metadata` | AI runtime metadata refresh (daily) | job | C3 | ai | — | `supabase-db` | — | RB-10 |
| `job:institution-gateway-retention` | Purge gateway journal (hourly) | job | C1 | data | — | `supabase-db` | — | RB-10 |
| `job:community-retention` | Community retention (daily) | job | C1 | data | — | `supabase-db` | — | RB-10 |
| `job:integration-retention` | Integration retention (daily) | job | C1 | data | — | `supabase-db` | — | RB-10 |
| `job:lti-nonce` | Sweep LTI nonces (hourly) | job | C2 | security | — | `supabase-db` | — | RB-10 |
| `job:lti-link-ticket` | Sweep LTI link tickets (hourly) | job | C2 | security | — | `supabase-db` | — | RB-10 |
| `job:capture-expiry` | Expire captures (hourly) | job | C2 | data | — | `supabase-db` | — | RB-10 |
| `job:invite-retention` | Invite retention (daily) | job | C3 | data | — | `supabase-db` | — | RB-10 |
| `job:abandoned-signups` | Remove abandoned sign-ups (daily) | job | C3 | data | — | `supabase-db` | — | RB-10 |
| `job:audit-retention` | Audit retention (daily) | job | C1 | security | — | `supabase-db` | — | RB-10 |
| `job:console-audit-integrity` | Seal and verify console audit chain (daily) | job | C1 | security | — | `supabase-db` | — | RB-10 |
| `job:ledger-chain-integrity` | Verify ledger chains (daily) | job | C1 | security | — | `supabase-db` | — | RB-10 |
| `job:commercial-dunning` | Run dunning (hourly) | job | C2 | billing | — | `supabase-db` | — | RB-10 |
| `job:commercial-financial-retention` | Financial retention (monthly) | job | C2 | billing | — | `supabase-db` | — | RB-10 |
| `job:account-health` | Compute account health (daily) | job | C3 | support | — | `supabase-db` | — | RB-10 |
| `pipeline:ci` | CI (the merge gate) | pipeline | C2 | platform | — | `github-pages` | — | RB-08 |
| `pipeline:pages` | Deploy to Pages | pipeline | C2 | platform | — | `github-pages` | — | RB-08 |
| `pipeline:functions` | Deploy Edge Functions | pipeline | C2 | platform | — | `supabase-edge-runtime` | — | RB-08 |
| `pipeline:schema-deploy` | Schema deploy (Supabase Branching, db push) | pipeline | C1 | data | — | `supabase-db` | — | RB-09 |
| `pipeline:production-smoke` | Hourly production probe (the only automated monitor) | pipeline | C1 | platform | — | `github-pages`, `supabase-db` | — | RB-01 |
| `pipeline:drift` | Daily infrastructure drift check | pipeline | C1 | security | — | — | — | RB-16 |
| `pipeline:infra-apply` | Infrastructure apply (the one governed way to change production infrastructure) | pipeline | C2 | platform | — | — | — | RB-16 |
| `pipeline:infra` | Infrastructure pull-request checks (read-only) | pipeline | C3 | platform | — | — | — | RB-08 |
| `pipeline:supply-chain` | Signed, reproducible build with provenance and SBOM | pipeline | C3 | security | — | — | — | RB-08 |
| `pipeline:docs` | Documentation impact check (pull requests) | pipeline | C3 | platform | — | — | — | RB-08 |
| `pipeline:contrast` | Daily contrast sweep | pipeline | C3 | platform | — | — | — | RB-08 |
| `pipeline:hawkscan` | Dynamic security scan | pipeline | C3 | security | — | — | — | RB-08 |

## Role holders

| Role | Primary | Backup |
| --- | --- | --- |
| platform | Harrison Rubin | **none** |
| data | Harrison Rubin | **none** |
| security | Harrison Rubin | **none** |
| billing | Harrison Rubin | **none** |
| ai | Harrison Rubin | **none** |
| integrations | Harrison Rubin | **none** |
| support | Harrison Rubin | **none** |

## Proposed recovery targets by class

Targets, not readings. The last column is what a drill has measured.

| Class | RTO target | RPO target | Drill | Measured RTO / RPO |
| --- | --- | --- | --- | --- |
| C0 | 60 min | 5 min | every 90 d | unmeasured / unmeasured |
| C1 | 240 min | 15 min | every 180 d | unmeasured / unmeasured |
| C2 | 1440 min | 60 min | every 365 d | unmeasured / unmeasured |
| C3 | 4320 min | 1440 min | every 365 d | unmeasured / unmeasured |
