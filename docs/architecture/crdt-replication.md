# CRDT replication contract

Status: target architecture. No general CRDT runtime, append-only update service, state-vector synchronization or compaction service was found.

## Allowed scope

CRDTs may serve student-authored documents, notes, diagrams or explicitly approved collaboration. They must not govern enrollment, grades, transcripts, consent, entitlement, payment state, official submissions, institution configuration or provider-owned records.

## Update envelope and service rules

Every update requires tenant, document, actor/person, membership, device, client update ID, state vector, policy version, permission epoch, received time, payload hash and classification. The service validates tenant, active membership, current collaboration permission, revocation epoch, size/rate limits and idempotency before accepting it.

1. Append accepted updates; never replace audit history with a client snapshot.
2. Return accepted update IDs and the server state vector.
3. Produce encrypted snapshots after measured thresholds.
4. Compact under a tenant/document lock after durable snapshot verification.
5. Apply document-class retention, deletion and legal-hold rules.
6. Reject revoked collaborators immediately; they may keep a personal unsent copy but cannot merge it.
7. Keep audit metadata content-free where possible; protect document content separately.

## Offline states and verification

The encrypted, device-bound queue distinguishes `saved_locally`, `queued`, `accepted`, `rejected`, and `conflict_requires_copy`. “Saved locally” is never “shared.” Remote device revocation blocks new sync and schedules local key/data destruction where the platform permits.

Before activation prove deterministic convergence, duplicate/reordered update safety, permission and tenant denial, revocation races, snapshot restore, compaction correctness, deletion/hold behavior, large-document limits, replay resistance and partial-failure recovery. Select Yjs, Automerge or another engine only after a threat model and benchmark; this document does not preselect a library.
