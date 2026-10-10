# Offline and synchronization contract

Status: target contract. Current implementation is a PWA/local-first foundation, not a native SQLCipher or CRDT system. Since 4 October 2026 `app/src/lib/vault/` implements the web half of the device-database contract (classification gate, hybrid logical clock, AES-GCM at rest, the queue state machine); see [`rebuild-slice-audit.md`](rebuild-slice-audit.md). The one store that uses it is the task engine's local snapshot (`sealedSnapshotPort` in `app/src/lib/sync/engine/persistent.ts`), and only on a device where the engine owns tasks; no other store does yet.

A tested platform-neutral core and a reference design for this contract now exist: [`mobile-offline-reference.md`](mobile-offline-reference.md) and `packages/offline-sync`. They change none of the status below — no native client, SQLCipher binding, gateway endpoint or CRDT service has been built. One device-local, default-off slice now carries personal tasks through the engine over `public.tasks` (§10a of that document); it is not the encrypted native store the contract describes.

## Current evidence

- Implemented: service worker/PWA, browser offline detection, cached assets/media, local student-state stores, export/restore paths, some queued replay and merge tests.
- Partial: durable sync semantics vary by feature. Browser persistence is not one classified offline database with a central policy gate.
- Not implemented: native per-tenant/person/device SQLCipher database, hardware-backed key wrapping, remote wipe of database/WAL/SHM, general CRDT registry/update/snapshot/compaction service. Implemented as a library but not yet adopted by any screen: hybrid logical clocks and a software-keyed encrypted browser store (`lib/vault`).
- External approval required: mobile threat model, supported-device matrix, mobile MDM expectations, retention, accessibility, provider offline terms, and institutional acceptance.

The current web persistence path includes the `semester-store` IndexedDB database and multiple localStorage-backed feature stores; `db.ts` can fall back to localStorage. These stores are not encrypted by SQLCipher and are not mediated by one classification policy. Therefore the current mobile claim is “responsive installable PWA with limited offline behavior,” not “encrypted FERPA offline mobile client.”

## Data classes

| Data | Default offline policy | Conflict authority |
| --- | --- | --- |
| Tasks, personal plans, personal calendar annotations | Allowed, encrypted | Field-aware LWW with hybrid logical clock; preserve user intent |
| Student notes/drafts/study guides/portfolio drafts | Allowed, encrypted | CRDT only when collaborative; otherwise versioned student-owned record |
| Short-lived assignment metadata | Allowlisted fields only, encrypted, expiring | LMS/source wins authoritative fields |
| Official grades, transcripts, aid, billing, conduct, wellness, accessibility/health | Denied by default | Online authoritative source |
| Raw SIS/LMS records and submission receipts | Denied by default | SIS/LMS |
| Guardian projections and institution controls | Online only | Transactional server decision |
| Credentials, provider tokens, service-role secrets | Never in content database | Secure credential store only |

## Device database contract

When a native client is introduced:

1. Create one encrypted database per environment + tenant + person + device installation.
2. Generate a random 256-bit database key; never derive it from a password, email, student ID, tenant ID, or other deterministic value.
3. Wrap key material with iOS Keychain/Secure Enclave or Android Keystore, hardware-backed and non-exportable where practical.
4. Apply the SQLCipher key before the first read and validate the supported cipher configuration.
5. Delete key, database, WAL, and SHM on logout, membership removal, remote revoke, account deletion, or security wipe.
6. Never sync encrypted database files between devices. Sync authorized records or CRDT updates through the server.
7. Benchmark cold/warm startup, first query, memory, CPU, WAL recovery, migration, and rekey on the supported device matrix.

PBKDF2/SQLCipher parameters must not be selected from a desktop-only paper benchmark. Start from the supported SQLCipher default, measure on the slowest supported physical devices, record cipher/KDF versions and p50/p95/p99 unlock latency, and require security approval for any reduction. The database key remains random and hardware-wrapped; the PBKDF is not a substitute for device key custody.

## Queue state machine

`draft -> queued -> sent -> acknowledged -> reconciled`

`queued` or `sent` is never equivalent to an authoritative submission. Ambiguous results move to `pending_reconciliation`. Each mutation includes tenant, person, device installation, record, operation, base version/state vector, hybrid logical clock, idempotency key, classification, policy version, and created/expiry times.

## Conflict rules

- Personal simple state: merge independent fields; same-field conflicts use HLC ordering and retain conflict evidence.
- Derived plans: recompute from current sources while preserving explicit student overrides.
- Collaborative student documents: Yjs/Automerge-compatible CRDT updates, permission checked per update.
- SIS/LMS records: source wins; never push a local conflict into the source without a separately approved writeback workflow.
- Guardian consent, marketplace final submission, institutional policy, and official writes: online-only transaction with confirmation and audit.

## CRDT minimum before activation

- Tenant/person-scoped document registry and collaborator roles.
- Append-only idempotent update log with state vectors.
- Encrypted local update queue and encrypted server snapshots.
- Permission/revocation check on every update, including queued updates replayed later.
- Snapshot compaction with tenant-scoped locks, retention-aware purge, and recovery evidence.
- No raw document body in generic logs or analytics.

## Required tests

- Prohibited classifications never enter offline storage, logs, crash reports, backups, or notification previews. The central classifier and purge hook in `packages/offline-sync/src/storage-policy.ts` enforce this for the reference store; the server feed cannot broaden device storage.
- Logout, revoke, tenant change, and account deletion remove all local material and keys.
- Device wall-clock manipulation cannot win a conflict.
- Two-device edits converge; revoked collaborators cannot append updates.
- LMS submission remains pending until authoritative receipt and reconciles safely after ambiguous failure.
- Source changes win authoritative fields while student-owned annotations survive.

## Delivery sequence

1. Web/PWA containment: inventory every IndexedDB, localStorage, Cache API and service-worker write; classify every field; deny sensitive classes by default; centralize logout/revoke/tenant-switch purge.
2. Sync envelope: introduce device installation, mutation, idempotency, HLC, checkpoint, authoritative receipt and reconciliation contracts without enabling new offline classes.
3. Native secure-storage spike: implement isolated SQLCipher key creation/wrapping/wipe and physical-device benchmarks with synthetic data only.
4. Student-owned single-user data: enable tasks/plans/notes under the encrypted database and prove export/deletion/conflict semantics.
5. Collaborative CRDT pilot: restrict CRDTs to student-authored collaborative documents; authorize each update and prove convergence/revocation/compaction.
6. Source-derived metadata: add only field-level allowlisted, expiring academic metadata after institution/provider approval. Official records, family projections and consequential transactions remain online-only.
