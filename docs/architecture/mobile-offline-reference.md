# Mobile, offline, encrypted-storage and CRDT reference

Status: **reference design plus a tested platform-neutral core.** There is still no native app, no SQLCipher binding, no gateway sync endpoint and no CRDT service in this repository. What exists is [`packages/offline-sync`](../../packages/offline-sync): the queue, protocol, conflict rules, device lease, key hierarchy, attachment cache and a reference CRDT, written against interfaces a phone supplies, and run in tests against an in-memory gateway. Nothing here changes the public claim in [`offline-sync-contract.md`](offline-sync-contract.md): *"responsive installable PWA with limited offline behavior,"* not *"encrypted FERPA offline mobile client."*

The CTO target-architecture pack ([`docs/target-architecture/`](../target-architecture/README.md), D-1144) *proposes* the same platform and storage direction — **P-07** (Capacitor shell, `@capacitor-community/sqlite` with encryption, 30-day go/no-go spike) and **P-08** (`packages/offline-sync` with a store port, command queue and conflict policy; Yjs for text; server-authoritative commands with idempotency keys). This document does not replace those proposals; it is the executable and protocol-level detail beneath them, and it follows them where they are specific. Names map as follows: P-08's `LocalStore` is `LocalStore` here, its `CommandQueue` is the outbox inside `SyncEngine`, its `ConflictPolicy` is `policy.ts`.

This document implements the contract; where they disagree the contract wins and this document is the bug. Read it with:
[`offline-sync-contract.md`](offline-sync-contract.md) (data classes, queue states, delivery sequence) ·
[`crdt-replication.md`](crdt-replication.md) (update envelope, CRDT scope) ·
[`native-baseline-and-connected-mode.md`](native-baseline-and-connected-mode.md) ·
`app/src/lib/sync/classes.ts` (the write classes already in force) ·
D-055 / D-056 (offline reuses the device as the queue; high-risk actions are refused, never queued).

## 0. What is true today, and what this adds

| | Today (`main`) | This change |
| --- | --- | --- |
| Client | React 19 / Vite PWA, no native wrapper | unchanged; core is importable by the PWA now |
| Local store | IndexedDB `semester-store`, ~60 localStorage feature stores, **no encryption** | schema, key hierarchy and open sequence for SQLCipher, tested against real SQLite |
| Sync | `cloud.ts` compare-and-swap on `updated_at`, whole-student blob + per-course rows; no cursor, no idempotency key | command queue, idempotency, cursor, backoff, reconciliation. **Wired for personal tasks only, behind a device-local opt-in, over `public.tasks`** (§10a); everything else still rides `cloud.ts` |
| Conflicts | `merge.ts` per-field, `conflicts.ts` whole-version choice, base fingerprint | same philosophy, formalised per data class; HLC for clock-ordered classes |
| Devices | `push_devices` (Web Push endpoint only); `signOutOtherDevices()` | registration, trust states, lease, wipe — types and decision logic only |
| CRDT | none | reference sequence CRDT, add-wins set, and the server gate every update must pass |
| Attachments | device-only IndexedDB (`semester-files`), "nothing is uploaded" | encrypted cache with quota, revocation, scan gating — for *server-sourced* files |
| Malware scanning | `mediascan.ts` exists, **not deployed** | cache refuses anything the server has not scanned clean |

Not done, and not claimed: native shells, SQLCipher/Keychain/Keystore adapters, passkey enrolment, the gateway endpoints, any migration, wiring `cloud.ts` or the existing outbox onto the engine, physical-device benchmarks, a threat model sign-off.

## 1. Mobile architecture and platform choices

### Options

| | A. Native (Swift + Kotlin) | B. Capacitor shell around the existing client, native plugins for the hard parts | C. React Native / Expo | D. Tauri 2 mobile | E. PWA only |
| --- | --- | --- | --- | --- | --- |
| Reuses the ~100-screen React client | no | **yes** | partly (logic, not DOM) | yes | yes |
| SQLCipher, Keychain/Keystore, biometrics, passkeys | first-class | via native plugins we own | via native modules | thinner ecosystem | **not available** |
| Hardware-backed key custody | yes | yes, in our Swift/Kotlin module | yes | maturing | no (WebCrypto key in browser storage) |
| Background sync | BGTaskScheduler / WorkManager | same, through a plugin | same | limited | unreliable, browser-dependent |
| Accessibility | best | WebView a11y; needs device testing | good | WebView | browser |
| Cost / team | two codebases | **one UI + two small native modules** | rewrite screens | new runtime risk | none |
| Store/review risk | normal | normal (must be more than a website) | normal | less proven | n/a |

### Recommendation (an assumption, needs the owner's decision)

**B for launch, with the native modules written in Swift and Kotlin behind the adapter interfaces in `sdk.ts`**, and a stated escape hatch: if the physical-device benchmark (§2) or assistive-technology testing fails on a WebView screen, rebuild *that screen* natively; the engine, protocol and storage do not change. Reasons: the product's breadth is its React client; the parts that must not be web code (keys, database, passkeys, background tasks) are small and are exactly what the adapter interfaces isolate; and the protocol is identical on all three surfaces, so it is tested once.

P-07's **go/no-go gate is adopted as written** and is the acceptance test for this choice: Today cold start under 3 s and 60 fps scroll on a reference low-end Android, TalkBack/VoiceOver audits passing on Today, Calendar and Tasks, and the encrypted-store round trip, all inside a 30-day spike; a fail moves *shells and navigation only* to React Native and keeps `packages/offline-sync` and the domain packages. Further decision criteria that would change this: a benchmark showing unlock/first-query latency above the budget on the slowest supported device; a platform review rejection of the shell; or a plugin we would have to depend on without being able to audit. Plugin maturity for SQLCipher in Capacitor is **unverified here** and is the first task of the spike (§10).

### Surfaces and the assurance each can honestly give

| Surface | Store | Key custody | Official-record cache | Label |
| --- | --- | --- | --- | --- |
| iOS app | SQLCipher | Secure Enclave key wraps DEK; biometric/passcode gated | tenant opt-in only | "Encrypted on this device" |
| Android app | SQLCipher | Keystore (StrongBox where present) wraps DEK; `BiometricPrompt` | tenant opt-in only | "Encrypted on this device" |
| Web / PWA | IndexedDB + WebCrypto adapter | non-extractable key in the browser profile — **protects against casual inspection, not a hostile profile** | **never** | "Saved in this browser" — never described as encrypted-at-rest equivalent to native until security review says so |

The web surface keeps today's behaviour for personal data and gets *less* offline reach than native for anything institutional. That is deliberate: a browser profile cannot be wiped remotely.

Platform notes the adapters must respect: iOS Secure Enclave holds only P-256 keys, so it wraps the DEK (ECIES) rather than holding it; the database file uses the strongest data-protection class that still allows the background-sync window the product decides it needs, and is excluded from backup; Android disables auto-backup/device-transfer for the database and files; both set the app-switcher snapshot to blank for sensitive screens (`FLAG_SECURE` on Android); notification previews carry no record content.

## 2. Encrypted local storage

```
hardware KEK (Keychain/Secure Enclave · Android Keystore; non-exportable; user-presence gated)
  └─ wraps → DEK  random 256-bit, one per environment + tenant + person + device installation
       ├─ SQLCipher key for the content database  (raw key, no password KDF in the path)
       └─ wraps → FEK  random 256-bit per cached file, AES-256-GCM, AAD = tenant|user|device|file|sha256
```

Implemented in `vault.ts` (wrap/seal/open, attachment cache) and `schema.ts` (open sequence, DDL).

- **One database per environment + tenant + person + device installation.** A tenant switch or a second person on the same phone is a different database and a different key. Never copied between devices, never backed up (the contract's rule 6).
- **Open sequence** (`openSequence`): `PRAGMA key = "x'<64 hex>'"` first, then `cipher_memory_security`, WAL, `secure_delete`, foreign keys, and a read that fails on a wrong key before anything is trusted. KDF iterations and page size are **deliberately not set**: the contract requires starting from SQLCipher's supported defaults and recording p50/p95/p99 unlock latency on the slowest supported physical devices before changing anything, with security approval for any reduction. A test fails if the open sequence sets any of them, so a change has to be made on purpose, with the benchmark in hand.
- **What is in it:** `entities`, `outbox`, `cursors`, `crdt_updates`, `crdt_snapshots`, `attachments` (wrapped keys and facts only; ciphertext lives in the files directory). The DDL is run against real SQLite in `schema.test.ts`, including the unique idempotency key and the phase `CHECK` — an acknowledged row is *deleted*, so the check refuses it.
- **What is never in it** (`policy.ts` `NEVER_CACHED`): case notes, wellness, conduct, payments, ledger entries, consent, guardian projections, approvals. Credentials and provider tokens live only in the secure credential store.
- **Logs, crash reports, analytics, notification previews, clipboard:** contain command ids, data-class names, phases and counts — never payloads or record text. `payload_json` is never serialised into a log line by the SDK.
- **Rekey and migration:** schema upgrades are forward-only, one transaction; the queue must survive (no command lost to an upgrade). A rekey creates a new database and copies, then destroys the old file and key; benchmark it. Do **not** take a "safety copy" of the encrypted file before migrating — an extra copy is another thing to wipe.
- **Wipe** (`device.ts` `wipeDevice`): delete the wrapping key **first** (crypto-erase: everything left is noise), then credentials, database + `-wal` + `-shm`, attachment files, then write a content-free tombstone (`{reason, at}`) so the screen can say why. Every step runs even if an earlier one fails, and failures are reported. Triggers (`WIPE_TRIGGERS`): remote revoke, access expired, logout, membership removed, account deleted, tenant switch.

Open items for the spike: Secure Enclave/Keystore behaviour after biometric re-enrolment (a changed fingerprint set invalidates a `biometryCurrentSet` key — decide whether that forces re-registration), StrongBox availability matrix, SQLCipher licence and distribution terms (**flag for counsel**), and the cost of the data-protection class on background wake.

## 3. Device registration, trust, revocation, passkeys, sessions, local expiry

A device is an **installation**: a random id and a hardware-held signing keypair created on first run. Never a hardware serial, IMEI or advertising id.

### Registration

```
signed-in person ─► server: challenge
device           ─► generate keypair in Keychain/Keystore (non-exportable)
device           ─► RegistrationRequest { challenge, deviceId, publicKey, platform, appVersion,
                      attestation (App Attest | Play Integrity | none), userVerification (passkey assertion) }
server           ─► verify attestation, verify the passkey assertion over the challenge (a present, verified person),
                    check tenant device policy, write DeviceRecord(trust='trusted'), audit event
server           ─► DeviceLeaseGrant { hardExpiresAt, policyVersion, permissionEpoch, accessTokenTtl }
```

- **Passkeys** (WebAuthn/FIDO2 through `ASAuthorization` on iOS, Credential Manager on Android, WebAuthn on the web) are the primary credential; a fresh assertion is required to register a device, to raise a lease on a stale one, and for any step-up the policy engine's "fresh MFA" obligation asks for. **Biometrics are a local unlock of the key, never an identity proof to the server** — the server sees a passkey assertion or a signed request, not "fingerprint OK".
- **Attestation** raises trust, it does not grant it: `none` is allowed only for web and is recorded as lower trust the policy engine can act on (for example, no official-record cache).
- **Trust states:** `unregistered → pending → trusted ⇄ suspect → revoked`. `suspect` (failed attestation on refresh, impossible travel, refresh-token reuse) stops sync and asks for re-verification; it does not wipe by itself.

### Sessions

- Short access tokens (15 minutes), **bound to the device key** and signed per request (DPoP-style, RFC 9449): a stolen token without the key is not a session.
- Rotating refresh tokens with **reuse detection**: a second use of a spent token revokes the whole family and marks the device `suspect`.
- The app asks the person again (biometric/passcode, or passkey) after `idleLockMs`; the database stays on disk and is not readable while locked. An accessibility note: the idle lock must be configurable upward within tenant limits and always offer the device passcode as a fallback — a lock a person cannot pass is a data-loss bug.

### Revocation, and what it can and cannot do

Channels, fastest first: silent push → the next sync response (`device_revoked`) → the next pull → any 401/403. On any of them the engine calls `onWipe` once, then refuses all further work (`stopped: 'wiped'`).

**An offline device cannot be wiped remotely.** The honest guarantee is *bounded exposure*, and `evaluateAccess` enforces it on the device itself:

| Condition (default policy) | Decision | Effect |
| --- | --- | --- |
| revocation signal seen | `wipe` | destroy key, db, files |
| past `hardExpiresAt` | `wipe` | |
| unverified for 30 days | `wipe` | |
| unverified for 7 days | `reauth` | data kept, unreadable until a server round trip |
| idle 5 minutes | `locked` | biometric/passkey to continue |
| clock earlier than the latest time ever seen | `reauth` | a clock set back cannot stretch any limit above |

Tenants may tighten these (a registrar's device gets a shorter lease than a student's); they may not loosen them past the defaults without a recorded exception. Per-class freshness (`policy.ts`) applies on top. Grades, transcripts, financial aid and guardian projections are online-only and cannot be enabled by tenant opt-in.

**Lost or stolen device runbook** (to live in `docs/operations/`): the person (or support under JIT access) revokes the installation → server sets `revoked` and queues the push → the next time the phone sees the network it wipes; until then the data is protected by hardware-wrapped keys, the biometric gate and the offline ceiling above. Revocation latency (p50/p95 from revoke to wipe-observed) is an SLO.

### Server tables (proposed, **not a migration**)

`device_installation(device_id pk, tenant_id, user_id, public_key, platform, app_version, attestation_kind, attestation_verified_at, trust, registered_at, last_seen_at, revoked_at, revoked_reason)`; `device_refresh_family(family_id, device_id, current_hash, revoked_at)`; both under RLS as the person's own rows, with writes through `security definer` functions in the repository's existing pattern (`set search_path = ''`, `auth.uid()`), and an audit event per transition. A migration needs the repository's definer register entry and RLS negative tests before it is written.

## 4. Offline synchronization protocol

Three calls, all authenticated, device-signed, rate-limited, and tenant-scoped on the server:

| Call | Purpose |
| --- | --- |
| `POST /sync/v1/commands` | apply a batch of commands in `seq` order |
| `POST /sync/v1/status` | what became of these keys — never applies anything |
| `GET /sync/v1/changes?cursor=&limit=` | authorised changes after a cursor, plus a `revoked` list |

### The command (`Command` in `types.ts`)

`id` (the idempotency key) · tenant · user · device installation · data class · entity · `op` (`create|patch|delete|submit`) · payload · `baseVersion` · `hlc` · policy version · permission epoch · created / **expires** · per-device `seq`. Matches the contract's mutation fields.

### Rules

1. **One key, one meaning.** A command's id never changes across retries. Any change to its content or base — coalescing aside — mints a new id (`resolveConflict` does). Coalescing applies only to a command that has never left the device.
2. **Idempotent.** The server remembers *applied* keys and answers a repeat with `duplicate` and the same version. It does **not** remember refusals or conflicts: they depend on state that moves, and replaying one for a re-sent key would answer a new question with an old answer. (Found by a failing test, kept as a rule.) Receipts are retained past the longest accepted command lifetime plus skew (default 14 days).
3. **Sent is written before the call.** The engine persists `sent` before the network call; a crash or lost response then reads as `pending_reconciliation` — *unknown*, never *failed* and never *synced*. Recovery asks `status` first; `unknown` means resend, same key.
4. **Order.** One device's commands apply in `seq` order; per entity, one command is in flight and a stuck earlier command holds later ones. After an acknowledgement the next command's `baseVersion` is rebased onto the returned version.
5. **Answers carry the merged value.** `applied` returns the server's resulting value, because another device's edit may be inside it; the device does not guess.
6. **Cursor.** The cursor advances in the same transaction as the changes it covers; a crash between them cannot skip or repeat. A cursor the server no longer honours (`cursorExpired`) or no cursor at all returns a **snapshot** of present state plus a new cursor — that is also how a new device bootstraps.
7. **Expiry.** A command carries `expiresAt` (default 3 days). A late apply can contradict the world it was made in, so an expired command is dropped as `rejected: expired`, kept visible, never sent.
8. **Retry and backoff.** Full-jitter exponential (base 2 s, cap 15 min, 12 attempts); a server `Retry-After` wins up to the cap; after the limit the command is `rejected: dead_letter` with the work intact. Session expiry (`reauth`) and offline never spend an attempt.
9. **Reconciliation.** `acknowledged` becomes `reconciled` when the feed shows the version. Where the device's value and the feed disagree after that, the feed wins and the person is told only if it changed something they had unsent.
10. **Held sends.** For classes in `held-send` (submissions, support cases) the command waits as a local draft until the person taps; the engine will not send it before, even if something moves it into the queue. A receipt exists only after the server accepts.

### Phases and the five states

Queue phases follow the contract; the screen shows five states, derived by `PHASE_TO_STATE` (the only place a phase becomes a word):

| State | Phases | Meaning shown | Person must act |
| --- | --- | --- | --- |
| **local** | `draft` | On this device. Not sent. | no (held sends: tap to send) |
| **pending** | `queued`, `sent`, `pending_reconciliation` | Saved here. Semester has not confirmed it yet. | no |
| **synced** | `acknowledged`, `reconciled` | Confirmed by Semester. | no |
| **rejected** | `rejected` | Semester refused this. It is still saved here. | yes — retry (if allowed) or discard |
| **conflicted** | `conflict_requires_copy` | Changed somewhere else too. Both versions kept. | yes — mine / theirs / merged |

`synced` is reachable only through an acknowledgement (`status.test.ts` walks every transition). Relationship to today's `SyncStatus` (`lib/syncstatus.ts`): `off/signed-out → local`; `queued/syncing/offline → pending`; `synced → synced`; `error/read-only → rejected`; `conflict/review → conflicted`. Today's UI has no "rejected" and uses "queued" for what is really pending; adopting the five states is a copy change that must pass `lint:labels` and keep the existing rule that a failure always says the work is still saved on the device.

### Network transitions

| Event | Behaviour |
| --- | --- |
| online → offline mid-push | rows `pending_reconciliation`, backoff, nothing lost, nothing shown as synced |
| offline → online | sync runs once (single-flight); then on schedule; never a burst from many devices (jitter) |
| captive portal / 200 with wrong body | treated as transport failure, not as an answer |
| weak network | batch size and timeouts shrink; a command is never split |
| background | iOS `BGTaskScheduler` / Android `WorkManager` are *hints*; the app never promises sync happened while closed |
| session expired | `reauth`; queue kept; no attempts spent |
| device revoked | one wipe, then nothing |

## 5. Conflict resolution by data type

Encoded in `policy.ts`; the table in the audit and the contract is the source, this is the executable form.

| Data | Offline | Model | Same-field clash |
| --- | --- | --- | --- |
| Tasks, personal plans, calendar annotations | read/write, auto-sync | field merge | server-clamped HLC settles it; the loser is kept as visible evidence |
| Personal notes, study artifacts, portfolio drafts | read/write, auto-sync | field merge, versioned | **ask** (conflicted) — a person's writing is not settled by a clock |
| Shared documents, shared notes, comments, group work | read/write, auto-sync | **CRDT** (§6) | converges; no prompt |
| Assignment drafts, support drafts, AI drafts | local draft only | field merge | ask |
| Submissions, support cases | draft; **held send** | server-authoritative | receipt only after server acceptance |
| Assignment metadata, course content | read cache, short expiry | source wins | none; authoritative fields overwritten |
| Grades, transcripts, financial aid, guardian projections | **never persisted**; tenant opt-in cannot override | server-authoritative | none; online only |
| Billing summary, accommodations, registration (read) | **denied by default**; tenant opt-in gives an expiring read cache | server-authoritative | none; never written offline |
| Case notes, wellness, conduct | never in the database | online only | — |
| Payments, ledger, permissions, consent, approvals, grade changes, record amendments | **never queued** | server-authoritative | — |
| Audit events | never from a device | append-only, server-written | — |

Notes on the table: the launch boundary supersedes the earlier proposed grade cache. Source-issued grades, transcripts, financial aid and guardian projections are now unconditionally online-only. Tenant opt-in cannot admit them. A tenant may opt in only the remaining `tenant-opt-in` classes, shorten their limits and never lengthen them.

**Clock honesty.** HLC ordering (`hlc.ts`) is used only where losing a field is cheap to see and cheap to undo. The server clamps a client clock to the moment the command *arrived*, so a phone set a year ahead cannot beat an edit that reaches the server after its own, and a clock set back only hurts its owner. No scheme can stop a device that simply syncs last without trusted time; that is why anything a person would mind losing asks instead. (`engine.test.ts` covers both skew directions.)

**Deletes** are settled the way `lib/deletions.ts` already does, against the base: a delete against an edited record is a conflict, not a silent win.

## 6. CRDT design

**Scope (the contract's rule, enforced in code).** Student-authored shared text and its annotations: shared documents, shared notes, comments, group work. `assertCrdt` throws for every other class, and a test fails if a server-authoritative class could ever be marked CRDT. A CRDT merges anything, which is exactly why it must never hold a grade, balance, seat, consent, entitlement or permission — it would converge on a wrong answer.

**Engine.** `crdt.ts` is a reference: an RGA sequence (`TextDoc`) and an add-wins set (`AddWinsSet`, for comments and checklist items), with idempotent, order-tolerant `apply` and causal buffering. Convergence is tested under random edits, reordering and duplicated delivery across three replicas (40 seeds). **Production should adopt Yjs (P-08's choice; Automerge is the stated alternative)** after the benchmark and threat model `crdt-replication.md` requires (large documents, tombstone growth, interleaving, memory on low-end phones); this reference exists to fix the *envelope and the gate*, which do not change with the engine.

**Update envelope and gate** (`CrdtUpdate`, `gateUpdate`). Every update — including one queued days ago and replayed now — passes, in order: CRDT class → tenant match → active membership → role (viewers cannot write) → **permission epoch not older than the document's** → size and rate limits → payload hash → idempotency. A person removed, or demoted, since they queued an edit fails here and cannot merge; they keep a personal unsent copy (`rejected: membership_removed`, not retryable).

**Service rules** (from the contract, unchanged): append accepted updates, never replace history with a client snapshot; return accepted ids and the server state vector; encrypted snapshots after measured thresholds; compaction under a tenant/document lock only after a verified snapshot; document-class retention, deletion and legal hold apply; audit metadata is content-free.

**Sheets are not CRDT documents.** P-08 puts cell-level last-writer-wins registers with visible conflict history on sheets; in this policy table that is a `field-merge` class with `sameField: 'ask'` or `'hlc'` per tenant decision (no sheet class is defined yet — add one with the Sheet adoption, not before).

**States** (contract vocabulary → five): `saved_locally → local`, `queued → pending`, `accepted → synced`, `rejected → rejected`, `conflict_requires_copy → conflicted` — which for a CRDT means a *revoked collaborator's copy* or an engine fault, not a text clash.

**Still unproven (do not activate before):** snapshot restore, compaction correctness, large-document limits, replay resistance, revocation races at scale, deletion/hold behaviour. None is implemented.

## 7. What a device may never decide

The device may **ask**, **read an expiring copy where the tenant allows**, and **show the server's answer**. It may never confirm.

| Flow | Offline | Online path | Server authority already in the repo |
| --- | --- | --- | --- |
| Registration / enrolment | search/browse cache only; **no** queued request (D-056) | submit → server checks eligibility, holds, capacity, policy → confirmation | `20260929300000_registration_transaction.sql`, `private.registration_gate` |
| Grades | online only; never persisted offline | instructor workflow → dual-control change | `20260929310000_gradebook.sql` (append-only `grade_entries`); final-grade change needs approval |
| Student account, payments, refunds | summary read (opt-in); **no** payment data ever stored | secure processor flow online | `20260929220000_student_accounts.sql`, `ledger_chains` |
| Permissions, consent, guardian sharing | never cached, never queued | policy decision + audit | `packages/institution/src/policy.ts` `decide()` fails closed |
| Academic record / transcript | online only; never persisted offline | propose → approve → append | `academic_record_change_guard`, append-only entries |
| Financial aid | online only; never persisted offline | authoritative provider workflow | activation remains unverified |
| Approvals / break-glass / console actions | never | four-eyes, fresh MFA ≤15 min | `console_act`, `has_capability` |
| Submissions | local draft, **held send** | tap → server acceptance → receipt | — (to be built; today's held kinds are share/contribute) |

Enforced three times so one mistake does not open the door: the client policy (`assertQueueable` throws; the engine writes nothing), the gateway (`never-queued` and `draft` classes are rejected `server_authoritative` even if a device sends them — tested), and the database (the definer functions above, unchanged). The existing `OFFICIAL_PREFIXES` list in `lib/sync/classes.ts` is checked against the policy table by a test, so the two cannot drift. UI rule from the preamble: **no fake success** — a refused offline action says nothing was sent and nothing is waiting, in those words, and never leaves a spinner.

## 8. Attachment caching, encryption, quotas, revocation, malware

Applies to **server-sourced** files a person is allowed to read offline (course materials, shared documents). Today's student attachments are device-only and remain so; uploading them is a separate, later step.

- **Encrypted:** per-file random key (AES-256-GCM), wrapped by the database key; AAD binds tenant, user, device, file id and content hash, so a blob moved to another device, user or tenant does not decrypt. Plaintext is held only in memory while the viewer is open.
- **Admission:** class must be cacheable for the tenant; MIME must be on an allowlist (default: PDF, PNG, JPEG, WebP, plain text, Markdown); size capped (default 50 MB each, 250 MB total).
- **Quota:** least-recently-read eviction among **unpinned** files; a pinned file is never evicted; if pinned files leave no room the call fails `quota_full` and says so rather than silently dropping what the person kept.
- **Freshness and sweep:** each file expires with its data class; pinning protects against eviction, not expiry. `sweep()` runs on foreground and after every sync.
- **Revocation:** by file id, by owning entity (membership removed — the `revoked` list in a pull), by `aclEpoch` (a read with a newer epoch is refused), or all (wipe). Both ciphertext and wrapped key are deleted; an integrity check (hash after decrypt) catches tamper.
- **Malware:** the device never decides. The server scans; a file is **cached and opened only if the server's verdict is `clean`** (`pending`, `infected`, `unscannable` are refused). A later `infected` verdict (re-scan, new signature) arrives as a revocation and the bytes are erased. A mobile AV is not a control worth a claim. Upload of a person's own file: `local` → `pending` (queued) → server scan → `synced`, or `rejected: malware_detected`. **Gate:** `supabase/functions/_shared/mediascan.ts` exists but no scanning function is deployed; until one is, nothing in this section may be enabled for user-uploaded content.

## 9. Offline test matrix

"Impl." = covered by the reference tests in this change. "Device" = needs the native adapters and real hardware; **not done**.

### Network transitions
| Scenario | Expected | Cover |
| --- | --- | --- |
| write offline | state `pending`, value readable | Impl. `engine.test` |
| online → synced | `synced` only after ack; one server record however many syncs | Impl. |
| response lost after server applied | `pending_reconciliation` → `status` → `duplicate` → one record | Impl. |
| crash with a row left `sent` | recovered as ambiguous, reconciled | Impl. |
| same key arrives twice | applied once, `duplicate` | Impl. (gateway) |
| two syncs overlap | one run | Impl. |
| `Retry-After` | no resend before it | Impl. |
| attempts exhausted | `rejected: dead_letter`, work intact | Impl. |
| command too old | `rejected: expired`, never sent | Impl. |
| session expiry | stops for reauth, no attempt spent, no loss | Impl. |
| captive portal, slow link, background kill, airplane-mode toggling, tunnel on a train | — | Device |

### Device and account changes
| Scenario | Expected | Cover |
| --- | --- | --- |
| revoked by server | one wipe; nothing else touched | Impl. |
| lease expired / unverified too long | wipe without contacting server | Impl. |
| clock rolled back | `reauth` | Impl. |
| wipe step fails | the rest still run; failures reported; key first | Impl. |
| logout / membership removed / account deleted / tenant switch | all reach the wipe | Impl. (ports) · Device (real files) |
| lost device then found | wiped on first contact | Device |
| biometric re-enrolment invalidates key | decision recorded; re-register | Device |
| second person, same phone | separate database and key | Device |
| restore from cloud backup / device transfer | no database present; re-register | Device |

### Authorization changes
| Scenario | Expected | Cover |
| --- | --- | --- |
| removed from a shared note after queuing edits | record gone; edits `rejected: membership_removed`, not retryable, never merged | Impl. |
| role lowered / permission epoch advanced | queued update refused | Impl. (engine + CRDT gate) |
| official class sent by a modified client | gateway refuses `server_authoritative` | Impl. |
| tenant has not opted in | official classes refuse to cache | Impl. |
| cached file after revocation | refused; bytes erased | Impl. |

### Conflicts
| Scenario | Expected | Cover |
| --- | --- | --- |
| different fields | merged, no prompt | Impl. |
| same field, clock-ordered class | later *arrival* wins; future-clock phone cannot win | Impl. |
| same field, note | `conflicted`, both kept, editing blocked until resolved | Impl. |
| resolve mine / theirs | pending→synced with evidence / no command | Impl. |
| delete vs edit | conflict | partial (delete converges; edit-vs-delete asks: **to add**) |
| CRDT concurrent edits | all replicas equal under reorder + duplicates | Impl. |

### Storage, upgrade, scale
| Scenario | Expected | Cover |
| --- | --- | --- |
| schema builds; idempotency key unique; bad phase refused | | Impl. real SQLite |
| wrong key | open fails before any read | Device (SQLCipher) |
| app upgrade with queued commands | none lost | Device |
| downgrade | refused, data untouched | Device |
| quota pressure, pinned files | evict unpinned; `quota_full` | Impl. |
| low-end device unlock / first query / WAL recovery | within budget | Device |
| 10⁴ queued commands; large CRDT doc | bounded memory | Device |

## 10. Reference implementation and SDK

`packages/offline-sync` — no runtime dependencies, ESM, strict TypeScript, aliased as `@semester/offline-sync`.

| File | Role |
| --- | --- |
| `status.ts` | the five states, queue phases, transitions, copy |
| `policy.ts` | the central data-class allow/deny classifier, tenant opt-in, freshness, assertions |
| `storage-policy.ts` | startup/policy-change purge and content-free cleanup hook for dependent caches |
| `engine.ts` | `SyncEngine`: write, confirm, sync, resolve, retry, discard |
| `hlc.ts` | hybrid logical clock and the server clamp |
| `backoff.ts` | full-jitter backoff with `Retry-After` |
| `device.ts` | lease evaluation, clock-rollback guard, ordered wipe |
| `vault.ts` | key wrapping, sealing, attachment cache |
| `crdt.ts` | RGA, add-wins set, the update gate |
| `schema.ts` | SQLCipher open sequence and DDL |
| `sdk.ts` | adapter interfaces and the app-facing `SemesterOfflineSdk` |
| `testing/reference-gateway.ts` | the server half, executable |

### What a platform provides (`sdk.ts`)

`SecureKeystore` · `BiometricGate` · `PasskeyProvider` · `EncryptedDatabase` (opens with `openSequence`, returns a `LocalStore`) · `Connectivity` · `BackgroundScheduler` · a `BlobStore`. iOS, Android and web differ only here.

### What the app calls

```ts
const sdk = createOfflineSdk({ store, transport, identity, lease, wipe, now, newId, tenantPolicy })

const view = await sdk.write({ dataClass: 'task', entityId, op: 'create', payload })
view.state   // 'pending'  — never 'synced' from a write
view.label   // 'Waiting to sync'
view.detail  // 'Saved here. Semester has not confirmed it yet.'

const r = await sdk.read('task', id)
// { ok: true, view } | { ok: false, why: { verdict: 'locked' | 'reauth' | 'wipe' | 'expired' | 'missing' | ... } }
// There is no way to get a value without its state, label and freshness.

await sdk.confirm(commandId)                     // the tap that releases a held send
await sdk.resolveConflict(commandId, 'mine')     // | 'theirs' | { merged }
await sdk.sync()                                 // single-flight; reports why it stopped
sdk.onChange(listener)                           // drives live regions
```

### Adoption path (does not replace `cloud.ts` yet)

1. Contract-only: classify every IndexedDB/localStorage/Cache API write against `policy.ts` (delivery step 1 of the contract), centralise logout/revoke/tenant-switch purge on `wipeDevice`.
2. Introduce the sync envelope beside today's sync, **without enabling new offline classes** (step 2). *Started: §10a carries personal tasks through the engine over `public.tasks`, device-local opt-in, default off.*
3. Native secure-storage spike with synthetic data: SQLCipher, keystore wrapping, wipe, physical-device benchmarks (step 3).
4. Student-owned single-user data (tasks, plans, notes) on the encrypted store, with export/deletion/conflict semantics proven (step 4).
5. CRDT pilot on student-authored shared documents only (step 5).
6. Source-derived metadata, allowlisted and expiring, after institutional approval (step 6).

## 10a. The first wired slice: personal tasks through the engine

Status: **built, default off, behind a registered module flag and a per-device opt-in.** It replaces nothing for anyone who has not turned both on. The flag's rollout plan, success criteria, rollback and review date are in `docs/FEATURE-FLAG-REGISTRY.md`; setting `VITE_OFFLINE_ENGINE_TASKS` back to `off` returns every device to the account sync with no task lost, because the old half has pushed the task list in its blob all along. A task *deleted* while the engine was on can reappear on a device that had not opted in; the old merge has no record of that deletion.

**What it is.** `app/src/lib/sync/engine/` carries the student's tasks (the product calls them *actions*) through `SyncEngine` instead of the account's `state` blob, over the existing `public.tasks` table (`20260901000700_records.sql`: own-row RLS, `deleted_at` tombstone, `touch_updated_at` trigger, `(user_id, updated_at)` index — created for this and unused until now). **No migration, no new function, no new policy.**

| Piece | File | What it does |
| --- | --- | --- |
| Version codec | `stamp.ts` | `updated_at` ⇄ integer microseconds, exact, so a compare-and-swap can name the stamp the database wrote |
| Table port | `rows.ts` | five questions the transport asks (`get`, `insert`, `updateIf`, `byCommand`, `since`); `supabaseTaskRows` is the one file that talks to PostgREST |
| Transport | `tasks-transport.ts` | the engine's "server": idempotency, ordering, snapshot and cursor, over that port |
| Store on disk | `persistent.ts` | the engine's queue, rows and cursor as one IndexedDB record per account (`semester-engine`), written through on every commit; cleared by Erase from this device |
| Bridge | `tasks.ts` | adopts the student's list into engine writes, hands engine tasks back, `weave`s them against the live list, and folds the engine's counts into the sync line |
| Ownership | `ownership.ts` | the two switches — the build's module flag `offline_engine_tasks` (`VITE_OFFLINE_ENGINE_TASKS`) and the device's opt-in `semester.engine.tasks = on` — and what the old sync half may see |
| Hook | `state/useTaskEngine.ts` | adopt → send and take → weave, one pass at a time, 800 ms after the list settles and every 60 s |

**One owner, with a one-way mirror.** While a device has opted in, the engine is the only source of its tasks: `cloud.ts`'s `pull` no longer reads the account's old copy back (a stale mirror from another device must not resurrect what the engine deleted), and the old merge's base and local view leave tasks out (`forLegacy`, `baseForLegacy`). What the device *pushes* still carries its tasks, so a device that has not opted in keeps receiving them. The mirror is write-only: **edits made to tasks on a device that has not opted in do not reach an opted-in one.** Opt in on every device of an account, or accept that the others are read-through. With the switch off every call site receives the very same object it always did (`ownership.test.ts` asserts identity), and the whole existing suite passes unchanged.

**What the interim transport can and cannot promise** (it is the table, not the gateway):

- *Idempotency without a receipts table.* A command leaves its id in `data._cmd`. A repeat finds it and answers `duplicate`; a lost answer is found the same way by `status`. If another device has written the row since, the id is gone: the repeat is not recognised, but it is a patch of the same fields to the same values applied over the newer row, so it cannot double-apply.
- *Ordering is arrival order.* The database stamps each write and a patch is applied over the row's current state (compare-and-swap, retried up to four times). The later arrival wins a field; no device clock is consulted. A task never reaches `conflicted` through a patch. A create over an existing id does, and **there is no screen to resolve it yet** — ids are random, so this is a collision, not a workflow, but the state is surfaced on the sync line and the choice API (`resolveConflict`) is there for the screen that follows.
- *Not enforced here:* permission epoch, tenant, policy version, a server clock for expiry. Row-level security scopes rows to the person; the rest waits for the gateway.
- *Tombstones are removed after 90 days when `sweep_tombstones` runs* (whether and when it is scheduled is not established here). A device away longer than 80 days is sent a fresh snapshot, and anything confirmed that the snapshot does not name is dropped (`pruneUnnamed`) — otherwise a swept deletion would come back to life.
- *Unencrypted at rest on the web.* The store is IndexedDB, labelled "Saved in this browser" (§1). Tasks are the class the contract allows there; nothing in this slice widens what is cached.

**The seam, and the bug it was built to avoid.** The student can edit between the moment the engine is asked and the moment it answers. `weave` therefore replaces the list's copy of a task with the engine's **only if the list's copy is unchanged since it was adopted**; an edit made in between stays and is sent on the next pass. (A first version took the engine's copy unconditionally and lost that edit; the reducer test that would have enshrined it was rewritten, and a mutation that restores it is red.)

**Visible state.** `withEngine` folds the engine's counts into the existing sync line, the same move the store already makes for waiting choices: pending tasks make "Synced" read "Queued"; refused ones say *"N actions were not accepted by your account. Still saved on this device."*; a conflict says both versions are kept. Per-row labels (`TaskSync.states()`) exist but **no screen shows them yet**.

**Not in this slice:** notes, appointments and practice papers (the other three `public.*` tables and their policy classes); a per-school switch or tenant policy (the flag is a build decision); a screen for conflicts and rejections; the receipts table and gateway that make idempotency and ordering real; any native client.

## 11. Gaps that remain, open questions, and items for qualified counsel

1. **Platform choice (§1) is a recommendation**, not a decision; Capacitor SQLCipher plugin maturity is unverified.
2. Whether a biometric re-enrolment forces device re-registration.
3. Lease defaults (7/30/90 days, 5-minute idle) are proposals; they need the threat model and the institution's device policy.
4. The earlier proposed grade read cache is closed: grades, transcripts, aid and guardian projections are online-only (§5).
5. CRDT engine selection and the benchmark.
6. Edit-vs-delete conflict test is missing.
7. **Counsel:** biometric-data statutes and notice/consent for any server-side biometric handling (this design stores none — the server sees passkey assertions — but that must be confirmed); FERPA treatment of cached education records on personal devices and of a lost device; SQLCipher licence terms; encryption-export classification for store submission; retention periods for command receipts and update logs; guardian/minor rules for a shared family device. No legal conclusion is made here.

## 12. The preamble's required outputs

**Assumptions.** Capacitor shell with native modules (§1); lease defaults (§3); receipt retention 14 days; command lifetime 3 days; a tenant can opt in only classes marked `tenant-opt-in` and can only shorten limits.

**Risks.** Passing for done: the core is tested against its own reference gateway, so the protocol is only as right as that gateway's reading of the contract. The web store is weaker than native and must be labelled so. Remote wipe cannot reach an offline device (bounded exposure only). A WebView may fail assistive-technology testing. Tombstone and snapshot growth in the CRDT. The idle lock can lock out a person with a motor or cognitive disability if not configurable with a passcode fallback.

**Files changed.** `packages/offline-sync/**` (new); `app/vite.config.ts` (test include); `app/tsconfig.app.json` (include and alias); `docs/architecture/mobile-offline-reference.md` (this file); `docs/architecture/offline-sync-contract.md` (pointer); `docs/decisions/D-1162.md`.

**Tests added.** `packages/offline-sync/src/*.test.ts`: policy, status, engine, device, vault, crdt, schema (real SQLite), sdk. Each guard was reverted and watched fail (§ the pull request lists the mutations and results); no-op controls stayed green.

**Accessibility.** State is always text plus an icon, never colour alone; changes are announced through a polite live region fed by `onChange`; the conflict screen is keyboard- and screen-reader-complete with both versions readable as text and an explicit choice (no timed or gesture-only choice); reduced motion respected; the lock always offers the device passcode and its timeout is configurable within tenant limits; the "rejected" and "conflicted" copy names the next action.

**Security / privacy.** Data minimisation by class; keys random and hardware-wrapped; wipe key-first; no payloads in logs, previews or analytics; server never trusts the client's class, clock, epoch or hash; official data denied by default; revoked collaborators cannot merge.

**Operational / runbook.** New runbooks to write: lost or stolen device; mass revoke on tenant offboarding; dead-letter triage; CRDT snapshot/compaction restore. Proposed SLOs: sync success rate, queue age p95, conflict rate, dead letters per 1000 commands, revoke-to-wipe latency, cache hit rate offline. Alerts on a rising `pending_reconciliation` count and on any `device_revoked` followed by a later successful write from that installation.

**Traceability.** `docs/product/capability-registry.md` rows *Native secure storage* and *CRDT replication* stay **Absent**: a tested core is not a native store or a service, and the registry's own "required before live" evidence (device lifecycle; service, storage, revocation, recovery) is untouched. Launch readiness "Mobile/offline: Partial" is unchanged. When the spike lands, move the rows with evidence, not before.
