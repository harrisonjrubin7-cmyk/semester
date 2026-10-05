# ADR-0009 · Institution-sourced data on a device is persisted encrypted, cleared on sign-out, and synced under written rules

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Client platform owner |
| Deciders / reviewers | Founder; security owner; counsel (records on shared devices); accessibility owner for status messaging |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 (clear on sign-out, class rules); Phase 2 (encryption at rest) |
| Related | `docs/architecture/0001-local-first-with-supabase.md`; `docs/OFFLINE-MODE.md` (D-012, D-055, D-056); `app/src/lib/merge.ts`; `app/src/lib/sync/classes.ts`; `app/src/lib/sync/outbox.ts`; `findings-database.md` #17; `database/DATA_CLASSIFICATION_REGISTER.md`; ADR-0011 |
| Supersedes / superseded by | — (amends `0001` for institution-sourced data only; self-authored data stays as `0001`) |

## Context
- `docs/architecture/0001` (Accepted, "under review"): `localStorage` is the working copy, the app is usable signed out, signing in adds a Postgres copy, attached files live in IndexedDB and are never synced. "A private note never leaves the phone" is the promise.
- Sync: `app/src/lib/merge.ts` merges field by field; one record edited on both devices resolves to the later edit, and the UI says so (`0001`, after last-write-wins on the whole copy lost notes).
- Offline mode flag `offline_mode` is off by default (`docs/OFFLINE-MODE.md`, D-012). Snapshot in IndexedDB `semester-store` or `semester.v1`; two requests may be kept offline in IndexedDB `semester-outbox` (`app/src/lib/sync/outbox.ts`), never sent without a tap, a request older than three days never sent; publishing, account deletion, official sites and any official or financial write are refused and never held (`app/src/lib/sync/classes.ts`). "Erase device" clears it.
- Service worker caches shell, media and a share cache per device: `app/public/sw.js` (`SHELL`, `MEDIA`, `SHARE_CACHE`); only `app/src/lib/shared.ts:53` clears one. Whether sign-out or account switch clears the others is not established (`findings-database.md` #17; `tenant-boundary-map.md` §4 row 8).
- Encryption at rest of the working copy was not found: `grep -rliE 'crypto\.subtle|AES-GCM' app/src` lists `app/src/community/client.ts`, `app/src/lib/integration/crypto.ts`, `app/src/lib/fnv.ts`, `app/src/lib/history/evaluations.ts`, `app/src/lib/integration/redact.ts`; none is shown to wrap the store. Not verified beyond that grep.
- Institution data entering the device: the integration surfaces carry `source_label` values (`20260926150000_expansion_roles_and_features.sql`; `docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md`, "Nothing here is built yet"). Gateway not shown deployed (`findings-database.md` #7).

## Problem
When a school's records reach a device that may be shared, lost or offline, what is stored, in what form, for how long, and what may sync back?

## Decision drivers
1. A shared device does not leak one person's school records to the next.
2. The local-first promise for self-authored data is kept (`0001`).
3. Official and financial writes never queue offline (`classes.ts`).
4. Browser encryption has limits: it does not defend a compromised page; claims must say so.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Do not persist institution data offline (online-only) | Smallest exposure | Breaks offline study; contradicts `0001` value | Rejected for self-authored; adopted for classes marked online-only |
| B. Plaintext persistence + erase on sign-out (today in part) | Simple | Residual data after crash, lost device, SW caches | Rejected for institution-sourced classes |
| C. WebCrypto-encrypted store keyed from a credential or device-bound key; clear on sign-out/switch incl. SW caches; per-class rules | Addresses A and B | Key custody, recovery and performance to design | Chosen |
| D. Rely on OS disk encryption | Zero code | Not controllable; not evidence | Rejected as sole control |

## Decision
**Recommended, unratified; no agent can accept it. Counsel flagged for records-on-device obligations.**
1. Each class in `database/DATA_CLASSIFICATION_REGISTER.md` that can reach the device is labelled persist-encrypted, memory-only or never; institution-sourced classes are never plaintext at rest.
2. Sign-out, account switch and "Erase device" clear `semester-store`, `semester-outbox`, `localStorage` keys and all service-worker caches that hold account data.
3. Sync follows `classes.ts`: official, financial and deletion writes are refused offline; conflict resolution follows ADR-0011 precedence, and a conflict is shown, not hidden.
4. The UI states what is and is not protected in plain language; no "encrypted" claim until a test shows ciphertext at rest.

## Consequences
Positive: smaller residual-data surface. Negative: key recovery, startup cost, lost-key means lost offline data (server copy remains). Harder: debugging stored state.

## Impact
- **Data / tenancy:** account switch must not mix tenants in one store.
- **Security:** key custody decision; XSS still defeats it.
- **Privacy:** reduces residue on shared devices; counsel for institutional records.
- **Accessibility:** offline and conflict states must be announced (ADR-0013).
- **Operations (SLO, alert, runbook, support):** support runbook for "locked out of offline copy".
- **Cost / commercial:** none.

## Implementation
1. Trace sign-out and switch paths; list every store (`localStorage`, IndexedDB, SW caches). 2. Clear-on-sign-out and test. 3. Class labels. 4. Encrypted store behind a flag for institution-sourced classes only. 5. Conflict UI per ADR-0011.

## Tests and verification
- Sign in, load an institution-sourced record, sign out: no row in `semester-store`, no entry in `MEDIA`/`SHELL` containing it. Fails or unknown today (`findings-database.md` #17).
- Plaintext sentinel: store a record with a known string; scan IndexedDB/localStorage; a plaintext hit fails the encrypted-class test.
- Offline: an official write returns refused and is not in the outbox (existing `classes.ts` rule; test names refusal).
- Control: self-authored note remains available offline and unencrypted-by-class if the class says so.

## Fitness functions
None in `FITNESS_FUNCTIONS.md` covers client persistence; propose a new row `offline-persistence` (`scripts/architecture/offline-persistence.mjs`): a store written without a class label, or a sign-out path that does not call the clearing function. Nearest existing: `tenant-boundaries` (cache boundary), `accessibility-contracts`.

## Rollback / reversal
Flag off the encrypted store; clearing on sign-out stays. Not cheap after users hold encrypted-only offline data.

## Open questions
- Key source (credential-derived, passkey, device key) and recovery.
- Whether SW caches ever hold account data (unverified).
- Counsel: whether device-stored school records change the institution's obligations.

## Addenda
(none)
