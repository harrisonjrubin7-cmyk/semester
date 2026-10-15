# 06 · CI/CD, release, rollback, migration, secrets, backup/DR, offline sync, observability

> Part of the [CTO architecture pack](README.md). Status: **proposed**.
> Existing, controlling documents: `ROLLBACK.md`, `RESTORE.md`, `SECRETS.md`,
> `MONITORING.md`, `SECURITY.md`, `docs/engineering-operations/*`. This page
> states the *target* and names what changes; it does not replace them.

## 1. CI pipeline (target)

Today's `ci.yml` is one serial workflow (audit → `tsc -b` → lint →
`check:university` → vitest ×4 → build → budgets → Playwright smokes → PG 17
`supabase/check.sh`, `load.sh`, `rehearse.sh`, `restore.sh`), followed by
`pages.yml` and `functions.yml` gated on its success. Target keeps every one of
those checks and reorganises them into parallel, affected-only stages:

```mermaid
flowchart LR
  A[changes: turbo affected graph] --> B[static: typecheck · lint · boundaries · migration-lint · secrets · license]
  A --> C[unit + property: per package]
  A --> D[contract: oasdiff · event-schema compat · generated-client freshness]
  A --> E[db: PG17 up → check suites → forward+rollback rehearsal → restore]
  B & C & D & E --> F[build: artifacts + SBOM + provenance]
  F --> G[e2e: preview env · golden path · sync · cold · a11y axe]
  G --> H[security: DAST (HawkScan) · dependency audit · IaC policy]
  H --> I{required checks green?}
  I -- yes --> J[merge queue]
```

Required, non-negotiable checks (each already exists unless marked **new**):

| Check | Source today |
| --- | --- |
| types (`tsc -b`) and **server types (NodeNext)** | `check:university` → generalised to `check:server` |
| lint + style/label/terms audits | `npm run lint` |
| unit/integration, TZ matrix, shuffled order | `test`, `test:zones`, `test:shuffle` |
| root-unmount guard | `src/rootunmount.test.ts` |
| budgets (perf, complexity) | `budgets`, `complexity-budgets.json` |
| second-account RLS suites (106) | `supabase/check.sh` |
| restore + rehearsal | `restore.sh`, `rehearse.sh` |
| secrets scan | `secrets` job, `.gitleaks.toml` |
| a11y / cold / golden / sync smokes | Playwright scripts |
| **module boundaries** | **new** |
| **migration lint (RLS+FORCE, tenant_id, expand/contract)** | **new** |
| **OpenAPI breaking-change detector** | **new** |
| **PDP↔RLS conformance** | **new** |
| **provider-degraded run** (all adapters stubbed to fail; native journeys must pass) | **new** |

A **merge queue** serialises merges and re-runs the required set on the
rebased result. This addresses the repository's lived failure mode (CLAUDE.md:
sixteen merges in an hour, duplicated work, rebases found by CI).

## 2. Release process

1. **Cut:** a release candidate is a main commit whose artifact set (web bundle,
   `core` image, worker images, migration set, IaC plan) is immutable and
   attested (SLSA-style provenance, SBOM).
2. **Deploy to staging;** run the promotion gates ([05](05-ENVIRONMENTS-AND-ROLLOUT.md) §8).
3. **Release notes are generated** from conventional commits and capability
   register rows; user-visible changes need a *claims check* against
   `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` (nothing marketed as live until its
   evidence exists).
4. **Ring roll-out** ([05](05-ENVIRONMENTS-AND-ROLLOUT.md) §3–4) with automatic canary analysis.
5. **Release record:** who approved, evidence links, flags changed, migrations
   applied, rollback plan — one file per release in `docs/operations/releases/`.
6. **Cadence:** web/core weekly trains plus on-demand hotfix lane; native apps
   biweekly; schema changes follow expand/contract so they never block a train.
7. **Freeze windows** around registration, grade release and billing cycles per
   tenant calendar (stored in tenant config; the pipeline refuses ring-1+
   deploys inside a tenant's freeze).

## 3. Rollback (ordered by speed)

| Layer | Mechanism | Target time | Notes |
| --- | --- | --- | --- |
| Capability | `feature_kill_switch` write | < 1 min | exercised monthly (`drill:killswitch`) |
| Code (`core`, workers) | traffic shift to previous revision | < 5 min | automatic on canary abort |
| Web | redeploy previous immutable bundle | < 5 min (today: Pages redeploy measured 76–180 s per `ROLLBACK.md`) | service worker prompts reload; incompatible clients are told to update |
| Native | server-side feature gate + min-supported-version; store rollback is slow, so **never depend on it** | < 15 min via gate | |
| Config | previous config version (config is versioned, second-person published — D-1011) | < 5 min | |
| **Schema** | **forward-only.** Fix by new migration; destructive steps (the "contract" phase) happen only after ≥ 1 full release train with no reader of the old shape | n/a | `ROLLBACK.md` already states "schema rolls forward only" — keep it |
| Data corruption | point-in-time recovery to a *new* instance, diff, selective restore | hours; see §6 | never overwrite production in place |

Every release record carries a **rollback plan that was rehearsed on staging**
for that release's migration set.

## 4. Migrations: expand → migrate → contract

1. **Expand:** add nullable column/table/index `CONCURRENTLY`; ship code that
   writes both shapes. Lint rejects `NOT NULL` without default, `DROP`, `RENAME`,
   type narrowing and table rewrites on > 1 M-row tables here.
2. **Migrate:** backfill in idempotent, resumable batches from a worker with
   per-tenant throttling and an audit event per batch; verify with a
   checksum/row-count reconciliation job.
3. **Switch reads** behind a flag (shadow-read comparison first: read both,
   serve old, log differences; promote when diff = 0 for N days).
4. **Contract:** drop the old shape in a later release, after the rollback
   window; requires data-steward sign-off and a fresh backup tag.

Extra rules: every migration ships with its `*.check.sql` additions; every new
table passes the migration linter ([02](02-MONOREPO-STRUCTURE.md) §4); a
migration that locks > 1 s in staging rehearsal is rejected; production
migrations run from the pipeline with `lock_timeout`/`statement_timeout` set
and an automatic abort. The **baseline** 171 migrations are never rewritten.

## 5. Secrets and keys

| Layer | Rule |
| --- | --- |
| Inventory | `SECRETS.md` stays the register (today: four stores). Target: **one** secret manager per cloud, one owner per secret, rotation interval, revocation runbook; CI test keeps `Deno.env.get`/`process.env` reads and the register in sync (exists: `security.test.ts`, `secrets.test.ts`) |
| Build | `VITE_*` public only; CI fails if a secret-shaped value appears in a `VITE_` var |
| Runtime | workload identity (OIDC) from CI/runtime to cloud; **no long-lived deploy keys** (replace `SUPABASE_ACCESS_TOKEN` with scoped tokens, rotate quarterly until then) |
| Tenant data keys | envelope encryption: per-tenant data key wrapped by KMS key; per-tenant key for object storage and journal (`SEMESTER_JOURNAL_KEY` is a single 32-byte key today → becomes per-tenant wrapped keys) |
| Customer-supplied credentials (SIS/LMS) | stored encrypted by tenant key; `integration_*` stores only a `credential_ref`; never logged; rotation + expiry alerts |
| Humans | SSO + hardware-key MFA for every production-adjacent system; break-glass role with dual control, 4 h expiry, audit event |
| Leak response | per-secret revocation steps live in `SECURITY.md`; automate revocation for the top 5 (DB, auth admin, AI provider, payments, deploy) and drill them |

## 6. Backup, restore, disaster recovery

| Asset | Backup | RPO | RTO | Proof |
| --- | --- | --- | --- | --- |
| Postgres (pooled) | continuous WAL + daily base backup, cross-region copy | ≤ 5 min | ≤ 1 h to a new instance | monthly restore into scratch + `check.sh` against it + row-count/ledger-chain verification (`verify_ledger_chain` exists) |
| Postgres (silo) | same, per tenant | per contract | per contract | per-tenant drill at onboarding and yearly |
| Object storage | versioned + cross-region replication + object lock on exports/evidence | ≤ 15 min | ≤ 2 h | quarterly sample restore |
| Ledger/audit | WAL + periodic anchor hash in WORM storage | 0 (anchor ≤ 1 h) | with Postgres | anchor verified weekly |
| IaC/config | git + remote state with versioning | 0 | ≤ 1 h to re-stamp an env | quarterly "rebuild staging from scratch" |
| Secrets | secret manager replication + sealed break-glass copy held by two people | — | ≤ 2 h | semi-annual |
| Device data | the device is a *replica*; server is authoritative for institutional data; student drafts sync on reconnect | — | — | sync drills ([§7](#7-offline-and-sync-protocol)) |

DR scenarios rehearsed twice a year and written up as evidence: region loss,
database corruption, credential compromise, bad migration, vendor (auth/AI)
outage, ransomware-style deletion. `RESTORE.md` today is "a document, not a
capability"; the exit criterion for ring 1 is that this sentence stops being
true. **Legal hold overrides deletion:** restore procedures re-apply holds and
deletion tombstones so a restore never resurrects data a person had lawfully
erased.

## 7. Offline and sync protocol

Data classes and rules (from the audit, aligned with `offline-sync-contract.md`
and `crdt-replication.md`):

| Class | Examples | Mechanism |
| --- | --- | --- |
| Local-first personal | tasks, notes, drafts, study artifacts | device-encrypted store; per-field merge today; CRDT/LWW registers target; conflict history visible |
| Coordinated collaboration | shared docs, group work | Yjs updates with membership + permission-epoch check on every sync |
| Transactional institutional | registration, grades, bills, holds, approvals | **server-authoritative commands**, idempotency keys, states `pending → confirmed | failed`, never an optimistic "done" |
| Sensitive/cache-restricted | official records, billing, accommodations, case notes | minimal cache, encrypted, expiry, revoke on logout/remove-device |
| AI drafts | plans, suggestions | stored with model/version, sources, policy decision, user acceptance |

Protocol (`services/sync-gateway`, `packages/offline-sync`):

```ts
// device → server (idempotent, resumable)
interface SyncPush {
  deviceId: string; tenantId: string; sessionId: string;
  cursor: string;                      // last server position acknowledged
  commands: Array<{ commandId: string; idempotencyKey: string; name: string;
                    payload: unknown; createdAt: string; hlc: string }>;
  crdtUpdates?: Array<{ docId: string; update: Uint8Array; stateVector: Uint8Array;
                        permissionEpoch: number; payloadHash: string }>;
}
// server → device
interface SyncPull {
  cursor: string;
  changes: Array<{ table: string; id: string; op: 'upsert'|'tombstone'; fields: Record<string, unknown>;
                   source: SourceMetadata; classification: Classification }>;
  commandResults: Array<{ commandId: string; status: 'completed'|'rejected'|'pending_approval'|'failed';
                          reasonCode?: string; userMessage: string; correlationId: string }>;
  revocations?: { wipe?: true; docIds?: string[]; permissionEpoch?: number };
}
```

Rules: server enforces PDP per command and per CRDT update; unknown
classification is refused; clock skew handled with hybrid logical clocks;
**remote wipe deletes DB, WAL and SHM** and is verified on next contact; a
device unseen for N days (tenant policy) expires its sensitive cache.
Compatibility: the existing `lib/cloud.ts` per-field sync and `lib/sync/outbox`
continue to work through the gateway as the v0 client until each OWNED_TABLE is
migrated ([09](09-CONVERSION-PLAN.md)).

UX states required on every screen that can be offline (from the audit's state
matrix and `DO-NOT-BUILD` rule 8): offline indicator, queued-change count, last
sync, per-item *pending/failed*, and a conflict screen with both versions.

## 8. Observability and operations

**SLIs per critical journey** (one dashboard each, owned by a module owner):
open-Today, sign-in, create/edit task/event, submit assignment, register for
course, view grade/bill, AI answer, connector freshness, notification delivery,
data export/deletion request fulfilment.

**Alerting policy:** page only on symptoms that burn error budget fast
(multi-window, multi-burn-rate); everything else is a ticket. Today's
`MONITORING.md` has *one waking alert and a weekly review, no rota*; the target
adds a rota only once two people can staff it — before then, paging a single
person 24×7 is not an operating model, it is a risk (recorded as such).

**On-call:** primary + secondary, 1-week rotation, follow-the-sun only when
headcount allows; runbooks per module (`MODULE.md` links); incident command
roles (commander, comms, scribe); customer comms templates exist
(`INCIDENT-COMMUNICATIONS`); post-incident review within 5 business days,
blameless, with action items entered in the technical-debt register.

**Security operations:** PDP-denial spikes, RLS errors, admin/break-glass use,
impossible travel, support-access grants, bulk exports → SIEM rules with named
owners; quarterly access review; annual third-party penetration test and a
pre-ring-2 test; vulnerability SLAs: critical 7 d, high 30 d, medium 90 d.

**Cost observability:** AI cost per successful outcome, cost per active
student by tenant, per-module infra attribution (tags) — the audit's unit
economics inputs, produced by the platform instead of by spreadsheet.

**Status and support:** public status page (component per journey), per-tenant
health page in `ops-console` (connector health, lag, last good sync), support
tooling with consented, time-bound, recorded access and field-level redaction.
