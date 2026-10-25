# Dependency plan (next phases, in order)

Each phase lists its exit evidence. Nothing is enabled for real students until launch-gates.md says go.

0. **Decisions (founder):** production platform (C5), publish approval (C6), first cohort, label vocabulary (C7). These unblock everything below.
1. **Close Zite gaps or choose an external backend:** a permissioned file store; staging (a second workspace with synthetic data); append-only audit (a write-only endpoint plus restricted editors); an outbox table with a scheduled worker. *Exit:* a negative test for each.
2. **Two-account test harness:** create test users (student, advisor, faculty, registrar) in a staging workspace; script cross-student and cross-tenant negative tests. *Exit:* a red/green run for each protected endpoint.
3. **SIS fixture adapter** (blueprint Prompt 4): connector contract, identity mapping, reconciliation, freshness labels, official-hold source. *Exit:* acceptance run with stale, duplicate and missing records.
4. **Company OS lifecycle:** account → opportunity → proposal → approval → agreement → implementation → activation → renewal, with no student-record access. *Exit:* agreement-to-activation test.
5. **Billing:** the payer/beneficiary model, entitlements separate from authorization, verified webhooks. *Exit:* duplicate-webhook, failed-payment and refund tests.
6. **AI gateway evaluation:** use-case registry, evaluation fixtures, prompt-injection tests, kill switch.
7. **Remaining education domains** (student prompts 5–9): study and productivity, campus, community, career, marketplace.
8. **Hardening:** accessibility audit, restore drill, monitoring and alerting, go/no-go.
