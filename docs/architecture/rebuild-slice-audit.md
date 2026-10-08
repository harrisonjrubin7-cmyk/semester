# First-slice audit — what exists, what was missing, what this change adds

Written 4 October 2026 against `origin/main` `7287ddc`, in answer to a brief
asking for a clean-platform rebuild whose first production slice is *identity +
tenancy + policy engine + audit ledger + student home + task/calendar core +
offline encrypted local store + integration control plane + observability*.

The brief assumed these were largely absent. Most are not, and rebuilding them
would have been the duplicated work `CLAUDE.md` opens with. This page says what
is **fact** (read from the tree), what is a **design decision**, and what is a
**legal-review item**, per component. It restates no register; it points at them.

## Scorecard

| Component | Verdict | Evidence (read, not remembered) | What is still open |
| --- | --- | --- | --- |
| Identity, tenancy | Built | `schools`, `role_grants`, SSO policy, SCIM gateway, membership enforcement, offboarding: `supabase/migrations/20260921*`–`20260930*`; `server/institution/{auth,membership,scim}.ts`; ADR 0002 and 0005. Operator second factor is enforced in the database (`private.assert_fresh_mfa`, TOTP/WebAuthn/phone, `20260929100000_console_control_plane.sql`; UI `components/MfaStep.tsx`) | Student-facing passkey enrolment: not found (the only factor UI is the operator console's TOTP step). The policy layer's `require_fresh_mfa` *obligation* still has no enforcement point on the gateway routes (`ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md`) |
| Policy decision | Built, adopted by route incrementally | `packages/institution/src/policy.ts` `decide()`, fails closed; ADR 0007 | The roadmap's own "Open" cells: support read path, AI source retrieval and LTI grade passback still decide for themselves |
| Audit ledger | Built | `20260930110000_ledger_chains.sql` (hash chain), `20260930150000_ledger_chain_seals.sql` (HMAC daily manifest, nightly verify), `20260930100000_legal_holds.sql` | Chains cover the academic-record and student-account ledgers; whether every consequential action writes one is the roadmap's audit-coverage row, not re-audited here |
| Student home, tasks, calendar | Built as the app's core | `screens/Today.tsx`, `screens/Calendar.tsx`; CAP-001/003 in `docs/institutional-rollout/generated/requirements-traceability.md` | Device-first (ADR 0001): server-authoritative task/calendar commands are not the model for personal data, deliberately |
| Integration control plane | Built | `20260927170000_integration_control_plane.sql` and six follow-ups; `server/integration/{registry,tick,worker}.ts`; `supabase/functions/integration-tick` | Per-adapter health/cursor/dead-letter coverage across *every* adapter was not re-verified here |
| Observability, SLOs | Targets and checks exist; measurements do not | `docs/operating-model/SLOS-AND-ERROR-BUDGETS.md` with `lib/governance/error-budgets.ts` (eight journeys, e.g. sign-in 99.95%, Today 99.9%, Ask Semester 99.5%); `MONITORING.md`; `docs/INCIDENT-RECOVERY-PLAYBOOK.md`; `ops/` | The file itself says these are targets with no measured history. The brief's journeys that are absent from it: calendar, course access, grade retrieval, registration, billing, communications, integrations |
| Traceability matrix | Built, generated | `docs/institutional-rollout/generated/requirements-traceability.md` (CAP-001…), `capability-disposition.md` | It is keyed to the rollout spec's capabilities, not to the brief's thirteen-point completeness standard |
| **Offline encrypted local store** | **Was documented-only; web half built by this change** | `docs/architecture/offline-sync-contract.md` said "Not implemented" for encryption, HLC, and a single classification gate | Native SQLCipher, hardware key wrapping and any CRDT runtime are still not built (below) |

## What this change adds: `app/src/lib/vault/`

| File | Does |
| --- | --- |
| `classes.ts` | One table, from the contract's data-class table: which classes may be kept on a device. Official, financial, protected, raw-source, guardian and credential classes are **refused**, not encrypted. Assignment metadata is allowlisted by field and expires after 14 days |
| `hlc.ts` | Hybrid logical clock; refuses a remote stamp more than a day ahead so one bad clock cannot fix every later write |
| `vault.ts` | AES-256-GCM per record, random non-extractable key per tenant+person+device, namespace/id/class/stamp bound as AAD, key-first wipe, age expiry |
| `queue.ts` | The contract's state machine (`saved_locally → queued → accepted / rejected / conflict_requires_copy`), caller-supplied idempotency keys, backoff, dead-letter after 6 attempts, expiry, per-record ordering, field-level LWW merge that reports the loser |
| `idb.ts` | IndexedDB storage in its own database `semester-vault`, cleared by Erase device (`lib/erase.ts`, and the existing guard that reads every `store(...)` call now lists it) |

**What it is not.** It is not the contract's SQLCipher database. The key lives
in the browser's key storage, in software, so it defeats a copied profile or a
shared computer's leftover disk and does **not** defeat script running in the
page. **Public wording must stay "encrypted at rest in the browser's storage",
not "encrypted FERPA offline mobile client".** (Legal-review item, below.)

**One store uses it.** The task engine's local snapshot is sealed in the vault
as class `personal_plan` (`sealedSnapshotPort`), on a device where the engine
owns tasks. A plain snapshot is migrated once and removed only after the sealed
copy reads back identical; if the browser cannot seal, the snapshot stays plain
rather than dropping an edit. Turning the engine off after a device has migrated
returns it to the account sync, and unsent offline edits on that device are the
only thing lost. Tasks in the `localStorage` state blob, drafts and every other
store are unchanged and still unsealed: moving them is a migration with its own
data-loss risk and wants its own change.

## Verification, and what the tests found

- `npx vitest run src/lib/vault src/lib/erase.test.ts`: 55 + new tests green.
- **A bug the first test run caught in the first draft:** the namespace joined
  its parts with `.`, which `encodeURIComponent` does not escape, so tenant
  `a.b` + person `c` and tenant `a` + person `b.c` shared one namespace — and
  one key. The separator is now `|`, which it always escapes.
- **Four guards were reverted to prove they bite:** the class gate (14 failures),
  AAD binding (2), age expiry (1), and key-first wipe. The last **passed** the
  reverted code at first: both test storages happen to list `…/key` before
  `…/r/…`, so the loop deleted the key first by coincidence. The test now uses
  a storage that lists records first, and fails on the revert.
- A plaintext probe has a control (it finds the marker in a plaintext store),
  so "no plaintext on disk" is not a probe that reads nothing.

## Decisions (design, with the alternatives)

1. **Extend `main`; do not restructure into `apps/ services/ packages/`.**
   Alternatives: (a) greenfield monorepo per the brief, (b) extend in place,
   (c) strangler — new services beside the old. Chosen: (b) for this slice,
   with (c) as the route for anything that outgrows `app/server`. Criteria: the repository's PR numbers
   run past #1,100 and a roughly hundred-screen app depends on current paths; `check:university`
   already enforces a package boundary (`packages/institution`); and a rebuild
   would discard the tests, which are most of the evidence. *Hypothesis, not
   fact:* the brief's premise that the repo is "a client-side React/Vite
   experience with…" understates the gateway, RLS and ledger work; a reader who
   disagrees should say which component they mean.
2. **Web vault first, native SQLCipher later.** SQLCipher needs an iOS/Android
   client that does not exist in this repo. Building the web half now fixes the
   classification gate, the wire format and the queue semantics the native client
   must also honor.
3. **Refuse, don't encrypt, the official classes.** See `classes.ts`.

## Legal-review queue (for qualified counsel; none decided here)

- Any public statement about offline storage, encryption or "FERPA" posture on
  mobile or web. Wording above is a recommendation, not an approval.
- Whether assignment titles and due dates are education records in a given
  tenant's agreement, which governs whether the 14-day allowlisted cache is
  acceptable by default or opt-in.
- Device-wipe duties on membership removal for a tenant under a DPA.

## The remainder of the brief

The brief also asks for an actor/job map, a company operating plan, unit
economics, hiring plan, and delivery plan. The repo already carries large
documents for most (`MARKET-POSITION.md`, `COMMERCIAL-CORE.md`,
`30-60-90-DAY-EXECUTION-PLAN.md`, `OWNER-AND-ACCOUNTABILITY-MATRIX.md`,
`docs/90-DAY-LAUNCH-PROGRAM.md`). Re-deriving them in one session would produce
numbers with no evidence behind them. They were **not** redone; the useful next
step is a review of which of them still disagree with `GO-NO-GO-DECISION.md`.

## Next slices, in order

1. Move one store (tasks) onto the vault behind a flag, with a `localStorage`
   → vault migration and a restore path.
2. Enforcement point for `require_fresh_mfa` on gateway routes; student passkey enrolment.
3. Extend `SLOS-AND-ERROR-BUDGETS.md` to the brief's journeys it lacks, then measure.
4. Adopt `decide()` on the three roadmap "Open" routes.
