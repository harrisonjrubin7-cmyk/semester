# Provider maturity, certification and partnerships

Part 1, item 10. Phase 1a. **Waits for #779.** Nothing here is built yet.

## What exists on main

- `app/src/lib/readiness.ts` `mayClaimConnection` already refuses to call a
  connection real until it is — the rule this part generalizes to providers.
- `app/src/lib/connect.ts` `PROVIDERS` lists Brightspace, Outlook, Google and
  Zoom with their auth flows; `app/src/lib/canvas.ts` is Canvas.
- `private.gateway_health_probe`
  (`supabase/migrations/20260924184500_gateway_action_journal.sql`) records
  gateway health.
- `public.ai_policy.allowed_providers` covers AI providers per school.

## In flight

#779's `lib/integration/catalog.ts` is a connector catalog. The registry below
should be that catalog's server-side record, not a second list.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `provider_registry` | **New** | One row per provider: identity, maturity, connector owner, support owner, compatibility version, last validated, data scope, roadmap note |
| `provider_connector_maturity` | **Column** on `provider_registry` | `planned · manual · read_only · incremental · event_driven · authorized_writeback`. One value per provider |
| `provider_certifications` | **New** | Evidence rows: what was certified, by whom, when, expiring when, document reference |
| `provider_partnerships` | **Merged into `provider_certifications`** with `kind = 'partnership'` | Same shape: a claim, its evidence, a verifier and an expiry |

## Capabilities and flags

- Read: any school staff role. Write: `platform:configure` (exists) — this is
  Semester's claim about a vendor, not a school's.
- No flag. It is a record, and nothing turns on because of it.

## Hard boundaries

- **Nothing is called certified, partnered or live without an evidence row
  whose verifier is a person.** The public site, the in-app provider list and
  sales material all read the same row; none of them has a hard-coded claim.
- `authorized_writeback` maturity does not turn writeback on. Writeback remains
  a separate school flag and approval in #779.
- An expired certification reverts the display to the provider's maturity
  alone.

## Tests

- A provider with no evidence renders no "certified" or "partner" wording
  anywhere (a text search over the rendered list).
- An evidence row past its expiry drops the claim the next day.
- Setting maturity to `authorized_writeback` leaves every writeback flag off.
