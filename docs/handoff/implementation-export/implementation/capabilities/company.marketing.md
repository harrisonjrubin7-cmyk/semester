# company.marketing — Marketing

Source-declared design contract, not current implementation proof.

routes: /company/campaigns
actors: marketer, marketing_approver
permissions: campaign.edit, content.publish
records: mkt.campaigns, cms.pages, growth.entry_contexts
commands: publish_content
events: content.published
screen_types: list, detail, edit, review

## Acceptance
- authorized complete job loop
- tenant/object negative access
- expiry/revocation enforcement
- source authority and freshness
- approval target/payload/version binding
- idempotent durable command
- outbox replay/reconciliation
- seven data-region states
- manual accessibility review
- exact-target deployment and applicable authority acceptance

Reconcile existing code and authority before adding or applying schemas. Production activation disabled.
