# Schema drift and contract testing

Part 1, items 2 and 6. Phase 1a. **Waits for #779.** Nothing here is built yet.

## What exists on main

- `supabase/fingerprint.sql` fingerprints **our own** schema with five hashes,
  and `supabase/schema.snapshot.sql` is compared against it in the deploy
  rehearsal (`supabase/rehearse.sh`). That is drift detection pointed inward;
  this part points the same idea at providers.
- Provider fixtures exist informally: `app/src/lib/canvas.ts` and the LTI
  modules (`app/src/lib/ltiarrival.ts`, `app/src/lib/ltiscore.ts`) are tested
  against recorded payloads in their own test files.

## In flight

#779 adds `lib/integration/adapter.ts`, `mock-adapter.ts` and `mock-sis.ts` — a
mock SIS behind an adapter interface. Contract tests are written against that
interface, so they run unchanged against the mock in CI and a real adapter in a
school's sandbox.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `schema_fingerprints` | **New** | Provider, object, version, hash of the field set and types, first/last seen |
| `schema_drift_events` | **New** | Added, removed, renamed, type-changed, enum-changed; breaking or not; who was told |
| `connector_contracts` | **Not a table** | A contract is a test file beside the adapter. Its pass/fail at a version is recorded on the provider registry (`last_validated_at`, `compatibility_version`) |
| `connector_contract_test_runs` | **Not a table** | CI keeps the run history. The registry keeps the latest result |
| `connector_fixtures` | **Files**, under the adapter's directory | Fixtures must change in the same commit as the code that reads them |

## Capabilities and flags

- `integration:reconcile` (see [reconciliation](INTEGRATION-QUALITY-AND-RECONCILIATION.md))
  also acknowledges drift events.
- No separate flag: drift detection runs whenever a connection runs, and its
  only effect is to make a connection safer.

## Hard boundaries

- A **breaking** drift (a required field removed or retyped) moves the
  connection to `degraded` and stops processing that object. It never guesses a
  mapping.
- A non-breaking drift (a new optional field) is recorded and ignored until a
  mapping version uses it.
- Fixtures are sanitized: synthetic names, `example.edu` addresses, no real
  student identifier. A lint in the test file refuses anything shaped like a
  real email domain.
- A connector release or upgrade does not ship with a failing contract test —
  this is CI, not a policy document.

## Tests

- Each drift kind against a fixture pair produces the right event and the right
  breaking flag.
- A breaking drift degrades the connection; the student surface then shows
  "Source unavailable" through #779's freshness words, not an empty screen.
- Contract suite per adapter: auth failure, expired token, pagination cursor,
  rate-limit retry, webhook replay, deletion upstream.
- The fixture lint fails on a planted real-looking address (the guard is shown
  to go red once, then the fixture is fixed).
