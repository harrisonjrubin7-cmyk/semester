# Field lineage and source freshness

Part 1, items 3 and 4. Phase 1a. **Waits for #779.** Nothing here is built yet.

## What exists on main

- The expansion tables carry a `source_label` column constrained to
  `institution_verified`, `imported`, `student_entered`, `estimated`,
  `needs_review` (`supabase/migrations/20260926150000_expansion_roles_and_features.sql`).
- `app/src/intelligence/contracts.ts` `EvidenceReference` records origin,
  authority and when it was verified, for what the assistant cites.
- `app/src/lib/subscribe.ts` has `STALE_HOURS` for the outbound calendar feed;
  `app/src/lib/refresh.ts` says how long ago a pull happened.
- `public.approved_source` (`supabase/migrations/20260923210000_intelligence_policy.sql`)
  has an authority but no owner beyond `created_by`.

## In flight

#779 adds `source_records`, `source_snapshots`, `source_freshness_events`, the
`source_freshness` enum, and `lib/integration/freshness.ts` with
`freshnessFromAge(lastSuccess, targetMinutes, now, live)` — the freshness target
already exists as an argument; this part gives it an owner and a home.
#766 adds `lib/source.ts`, one source label for the whole app.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `field_lineage_records` | **New**, narrow | One row per canonical field *per mapping version*, not per value: provider, source entity and field, transform, classification, source of truth. Per-value lineage is `source_records` + the mapping version already |
| `source_owners` | **New** | Owner, backup owner, review cadence, escalation path, correction route per source or domain |
| `source_freshness_slas` | **Columns on `source_owners`** | Target and stale threshold belong to the same row as the person answerable for them |
| `source_freshness_breaches` | **Reuse** `source_freshness_events` (#779) | A breach is a freshness event of kind `breach` |

## Capabilities and flags

- Read lineage: `audit:read` (exists). Edit owners and targets: `source:approve`
  (exists) at `school` scope.
- Flag: rides `module.integration_quality`.

## Hard boundaries

- Students see "Up to date / Recently updated / May be out of date / Source
  unavailable / Entered by hand / Estimate / Needs confirmation" and the source
  name — never field names, mapping versions or transforms.
- An owner is alerted before the threshold (at 80 %) and at it. Nobody is
  alerted about a student.
- A source with no owner cannot be marked official.

## Tests

- Every canonical field in the mock SIS has exactly one lineage row for the
  active mapping version (a structural test over the mapping, not a sample).
- Freshness at each boundary: target − 1 minute, target, threshold, threshold + 1.
- A breach produces one owner alert, not one per record.
- A student-facing render of a stale value contains the words "Not the official
  current record" (#779's `freshnessSentence`).
