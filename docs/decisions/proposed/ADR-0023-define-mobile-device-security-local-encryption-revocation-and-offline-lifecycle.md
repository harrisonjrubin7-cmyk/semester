# ADR-0023 · Offline and device data follow a classed, encrypted, revocable lifecycle; the shipped PWA is claimed only as what it is

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Mobile and client-platform owner (founder until another is named) |
| Deciders / reviewers | Founder; security owner; privacy owner; accessibility owner; counsel for device storage notices, minors' data on devices, retention on device and app-store terms (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 2 (before any native or encrypted-offline claim); Phase 1 for service-worker cache clearing |
| Related | [`docs/architecture/mobile-offline-reference.md`](../../architecture/mobile-offline-reference.md); [`docs/architecture/offline-sync-contract.md`](../../architecture/offline-sync-contract.md); `docs/architecture/native-baseline-and-connected-mode.md`; `docs/OFFLINE-MODE.md`; D-055, D-056, D-1144 (P-07, P-08); ADR-0017, ADR-0020, ADR-0021; legal rows Q-02, Q-04, Q-08, Q-09 |
| Supersedes / superseded by | — |

> **Counsel required.** Cookie/storage notice wording, local retention periods, minors' data on shared devices, FERPA offline posture, student-held AI keys, app-store terms: `LEGAL_REVIEW_QUEUE.md` Q-02, Q-04, Q-08, Q-09; `docs/legal/COOKIE-AND-STORAGE-NOTICE-DRAFT.md`.

## Context
- Shipped client: React 19 / Vite PWA, no native wrapper; local store is IndexedDB `semester-store` plus about 60 localStorage feature stores, **no encryption** (`docs/architecture/mobile-offline-reference.md` §0 table, lines 18-27). Public claim is "responsive installable PWA with limited offline behavior", not "encrypted FERPA offline mobile client" (same file, line 3; `offline-sync-contract.md`).
- Reference core exists and is tested: `packages/offline-sync` (queue, protocol, conflict rules, device lease, key hierarchy KEK -> DEK -> FEK, attachment cache, `vault.ts`, `schema.ts` run against real SQLite in `schema.test.ts`). Not done: native shells, SQLCipher/Keychain/Keystore adapters, passkeys, gateway sync endpoints, any migration, wiring `cloud.ts`, physical-device benchmarks, threat-model sign-off (line 27).
- Write classes in force: `app/src/lib/sync/classes.ts`; D-055 (device is the queue) and D-056 (high-risk actions are refused offline, never queued) (`docs/DECISION-LOG.md:1054,1088`).
- Device registry: `push_devices` (Web Push endpoint only) and `signOutOtherDevices()`; registration, trust states, lease and wipe are "types and decision logic only" (mobile reference line 22).
- Native baseline: grades are an unofficial personal tracker; "exclude raw grades from default offline storage" (`native-baseline-and-connected-mode.md`).
- Service-worker caches `SHELL`, `MEDIA`, `SHARE_CACHE` (`app/public/sw.js`); only `app/src/lib/shared.ts:53` clears `SHARE_CACHE`; sign-out and account switch behaviour not established (findings-database #17).
- Revocation levers: `signOutOtherDevices()`; session-invalidation lever "never exercised" (findings-platform #13; `SECURITY.md:190`); SCIM deprovision revokes `role_grants` (`20260930210000_deprovision_revokes_grants.sql`, `supabase/offboarding-grants.check.sql`) but nothing revokes data already on a device.
- Student device AI keys sit on the device and are outside any server kill switch (`app/src/lib/claude.ts:886`, `app/src/lib/openai.ts:182`; ADR-0014).
- Attachments are device-only IndexedDB `semester-files`, "nothing is uploaded" (mobile reference line 24).
- Capacitor shell, SQLCipher and Yjs are proposals (D-1144 P-07 with a 30-day go/no-go spike, P-08), not decisions on main.

## Problem
What data may be stored on a device, in what form, for how long, and how is it revoked or wiped when a session, device, membership or tenant ends?

## Decision drivers
1. Do not claim encrypted offline until encryption exists and is tested on a device.
2. Data classes (ADR-0017) decide what may go offline; raw grades and education records default to online-only.
3. Revocation reaches the device, not only the server grant.
4. Shared and managed devices are first-class (cache clearing on sign-out).
5. Accessibility and low-end performance must not regress.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. PWA only with documented limits | No new platform | No hardware-backed keys; browser storage unencrypted | Valid for individual tier; **recommended for now** |
| B. Capacitor shell with SQLCipher and hardware-wrapped keys (P-07) | Reuses client; encrypted store | Spike not done; plugin maintenance; store-review obligations | **Recommended** as the path, gated on the spike |
| C. Native Swift/Kotlin | Best platform fit | Two codebases for one operator | Not chosen |
| D. React Native / Tauri | Alternatives in the reference | New client stack; thinner ecosystem for the needed plugins | Not chosen |

## Decision
**Recommended, unratified.** (1) Until a device-tested encrypted store ships, all public wording says PWA with limited offline behaviour and names that data is stored unencrypted in the browser; no "encrypted offline" claim (ADR-0022). (2) Offline eligibility is by data class from ADR-0017: person-private study material may be offline; education records and raw grades are online-only by default; tenant opt-in required for anything else; high-risk actions are refused offline (D-056). (3) Revocation lifecycle: session end, device unenrolment, membership end or tenant offboarding triggers a wipe command honoured on next contact plus a lease expiry after which the local store refuses to open; the lease length is the owner's decision. (4) Sign-out and account switch clear `SHELL`, `MEDIA`, `SHARE_CACHE` and in-memory state on shared devices. (5) The native path is the P-07 spike: it must produce a physical-device benchmark, a threat model signed by the security owner, a key-loss recovery design and a wipe-drill before ratifying B. (6) Student-held AI keys are documented as outside server control (ADR-0014). Not ratified.

## Consequences
Positive: honest claims; wipe path defined. Negative: encrypted offline is delayed until the spike; online-only rule limits some offline use. Harder: caching server-sourced files offline for managed tenants.

## Impact
- **Data / tenancy:** DEK per environment + tenant + person + device installation (reference design); wipe keyed by tenant and device.
- **Security:** hardware key wrap, lease, remote wipe; rotation exercised.
- **Privacy:** storage notice and retention on device are counsel items (Q-02, Q-08); minors on shared devices (Q-04).
- **Accessibility:** wipe and lock screens must meet existing a11y contracts; not assessed; native adds assistive-technology testing.
- **Operations (SLO, alert, runbook, support):** support needs a "lost device" runbook; offline conflict reports.
- **Cost / commercial:** store accounts and review; mobile entitlements in the price book (ADR-0016).

## Implementation
1. Cache-clear on sign-out in `app/public/sw.js` and the auth module; add the test. 2. Add data-class offline eligibility check at the local store boundary. 3. Run the P-07 spike behind a flag; produce evidence in `docs/evidence/`. 4. Implement device registration and wipe on the gateway (new endpoints; migrations roll forward). 5. Update `mobile-offline-reference.md` status lines when each lands.

## Tests and verification
- `app/src/lib/signout-caches.test.ts` (proposed): after sign-out, `SHELL`/`MEDIA`/`SHARE_CACHE` are empty; fails today if only the share cache is cleared. Control: caches intact for a normal session.
- Wipe test: a revoked device cannot open its store after lease expiry (`packages/offline-sync` test, real SQLite).
- Offline-eligibility test: a record of class education-record is rejected by `LocalStore.put` unless the tenant opted in.
- Spike evidence: key-loss recovery and a wipe-drill on a physical device.

## Fitness functions
- `accessibility-contracts` (#9): wipe/lock flows meet contracts.
- `public-claims-evidence` (#12): fails on any "encrypted offline" string without a passing device test record.
- `release-evidence` (#11): native release candidate bound to a dated threat model.
- `secrets-and-rotation` (#19): rotation of device-wrapped keys is logged.
- Proposed `scripts/architecture/offline-eligibility.mjs`.

## Rollback / reversal
Cache and eligibility rules are reversible. After an encrypted store ships to users, changing the key hierarchy needs migration and a user-visible re-encrypt; not cheap.

## Open questions
Whether sign-out clears the service-worker caches (not established); lease length; recovery on key loss; whether native is wanted before the first pilot; app-store policy review.

## Addenda
None.
