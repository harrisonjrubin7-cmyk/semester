# Semester ecosystem build: reconciliation, first slice, and continuation record

Date: 2026-10-18. Base commit: `955d9e06` (origin/main at session start). Branch: `claude/adoring-curie-707njl`.

This record follows the consolidation specification supplied for this session. It separates what was
verified in this repository from what is only designed, and it names what is blocked. It does not claim
the ecosystem is complete, deployed, institution-authorized, or production-enabled.

## 1. Scope actually established

- **Not available to this session:** the supplied platform inventory and operating library the specification
  refers to as `paste.txt`, and the design-system PDFs. They are not in the repository. A master inventory of
  every operating system, role, screen and function cannot be produced from the repository alone. **This is the
  blocker for full-ecosystem coverage.** Until the inventory is supplied, the register below covers only the
  capabilities the specification names.
- **Existing platform:** the repository already contains a large implementation: `app/` (Vite product, API
  gateway under `app/server` and `app/api`), `packages/institution`, `packages/platform`, `packages/platform-control`,
  `operator/`, `registry/`, `supabase/` (migrations) and `database/` (matrices). This session did not re-audit
  each domain against the inventory.
- **Migration ownership:** unchanged. No migration was added in this slice.

## 2. Verified command map

Run from the repository root unless noted. Results are from this session, on the base commit plus the slice below.

| Command | Result | Notes |
| --- | --- | --- |
| `npm ci` | Pass: 236 packages | Node is v22.22.0; the lockfile engines ask for `^22.22.2`. Warnings only. |
| `npm run registry:validate` | Pass: `valid: true`, 0 issues | |
| `npm run platform-control:test` | Pass: 63 of 63 | |
| `npm run operator:typecheck` | Pass | |
| `npm run operator:test` | Pass: 62 of 62 | |
| `npm run operator:build` | Pass | Regenerated outputs are already ignored or unchanged. |
| `npm run release:check` | **Exit 1, `allowed: false`, by design** | Blocks `registration.readiness`: no production-ready evidence and no support, synthetic-check, restore-drill or incident-exercise evidence. The gate blocks promotion when evidence is missing, as the specification requires. |
| `cd app && npx tsc -b` | Pass | |
| `cd app && npm run check:university` | Pass | |
| `cd app && npm run lint` | Pass | Pre-existing warnings only, under the limit of 25. |
| `cd app && npm test` | Pass: 1564 files, 24,527 tests; 81 skipped | Run after the slice. The census fixes are in section 4. |
| `cd app && npm run test:shuffle` | Pass | Seed `1792341916578`. |
| `cd app && npm run build` | Pass | A chunk-size warning existed before this change. |

Not run in this session: design-system gates (no UI changed), `registry:build` and `release:report`
(side effects not inspected), smoke scripts that need a running server, and any hosted-database or
deployment step.

## 3. Reconciliation register (specification priorities)

"Verified" means checked in this session. "Existing" means present in the repository and not re-audited.

| Capability | Code | Records and migrations | Tests | Status |
| --- | --- | --- | --- | --- |
| Assignment, draft, submission, receipt (student) | **`packages/institution/src/assignment-submission.ts`** (new) | None yet: in-memory store only | `assignment-submission.test.ts`: 24 tests | **Verified as a library.** Not wired to a route, a database, or a screen. |
| Faculty assessment and released feedback | Same module | None yet | Same tests | **Verified as a library.** Same gaps. |
| Submission lifecycle | `ASSESSMENT_SUBMISSION` in `workflow.ts` (existing) | — | `walk()` path tested in the slice | Existing workflow, reused. |
| Event envelope, outbox, consumer receipts | `packages/institution/src/events.ts` (existing) | `private.domain_outbox_events`, `private.domain_event_receipts` (`20260928320000`) | `events.test.ts`, census tests | Existing. **No publisher runs:** `drainOutbox` has no caller, which a census test asserts. |
| Gateway idempotency | Existing | `20261011120000_gateway_idempotency_store.sql` | Existing | Existing; not re-audited. |
| Client idempotency key | `app/src/lib/idempotency.ts` (existing) | — | Existing | A press guard for screens. It is not the server contract. |
| Registration readiness | `packages/institution/src/readiness-workflow.ts` (existing) | `20261009160000`, `20261010140000` | Existing | Blocked at release: no production evidence. |
| Capability passports | `registry/passports/` (2 files) | — | `registry:validate` passes | A passport for the submission capability is **proposed**, not added. It needs evidence fields this slice does not have. |
| Identity, membership, tenant isolation | Existing (`identity.ts`, `app/server/institution/membership.ts`) | `database/TENANT_ISOLATION_MATRIX.md` | Existing | **Not re-verified** in this session. Specification item A2/A3 remains open. |
| AI gateway and protected-record egress | `course-agent-policy.ts`, `retrieval.ts`, `ai-data-class.ts` (existing) | — | Existing | **Not verified.** The specification requires an enforceable egress rule; this session did not check it. |
| Hosted deployment | `vercel.json` (existing) | — | — | **Not deployed and not verified.** No deployment was made. |

### Capability passport (proposed, not in the registry)

This is the specification's proposed shape for the submission capability, filled with the evidence that exists.
It is a document, not a registry entry.

```text
id: learning.assignment.submit
owner: learning                     (owner name not assigned: needs an accountable person)
record_owner: institution
contracts:
  command: learning.assignment.submit.v1      (not yet a reviewed contract file)
  event:   submission.finalized               (registry name; the spec's learning.submission.received is not in events.ts)
authorization: active membership, enrolled student, assignment in the same institution, window open, draft version current
data: private draft never readable by faculty or other students; submitted body versioned; feedback hidden until released
execution: idempotency required (verified), receipt required (verified), transactional outbox (library only)
evidence:
  implementation: packages/institution/src/assignment-submission.ts
  tests: packages/institution/src/assignment-submission.test.ts (24 tests, incl. guard mutation checks)
  deployment: null
  institution_authorization: null
  production_activation: null
```

## 4. The first slice

**What it does (library, no transport):** a student saves a versioned private draft, submits it with an
idempotency key bound to the exact request, and receives a receipt. A second submission to the same
assignment is refused. Faculty of the course record a grade, which stays hidden. Releasing the feedback makes
it visible to the author and posts one `grade.posted` event. Every refusal is typed (`SubmissionRefusal`,
a `Refusal`) and is thrown before any write.

**Rules chosen, and why:**

- Authority is checked before a replay is answered, so a revoked student's retry is refused. (Tested.)
- A replay is answered before the version and window checks, so a retry after the deadline returns the same
  receipt rather than a new late submission. (Tested.)
- The idempotency fingerprint is the exact canonical request string, not a hash, so a collision cannot make a
  different request look like a replay. A Postgres adapter should store a digest of it.
- Event names are the existing registry names (`submission.finalized`, `grade.posted`). The specification's
  `learning.submission.received.v1` is not in the registry; adding it is a decision for the owner.
- Event payloads carry ids and versions, never the submitted text or the grade.
- Institution and course authority are both checked. A user from another institution gets `not_found`, not a
  description of what exists there.

**Mutation evidence (a guard that never fails is not known to be a guard):**

- Removing the membership-revocation check made `a revoked membership stops a new submission and also a replay` fail.
- Removing the submission-window check made `a submission after the window closes is refused` fail.
- Both restored: 24 of 24 pass.

**Census changes (deliberate, same change as the producer):** `app/src/lib/docs/platform-reference.test.ts`
and `app/src/lib/docs/examples.test.ts` name every event producer in the repository. The new module is a
producer, so both lists now include it. `docs/reference/EVENTS.md` was regenerated from the census with
`REGISTERS=write`. The mount rule in the census matched any import containing `/institution/`, which counted
the app's own server folder as mounts of the new module. The rule now matches the producer file for that
package. A control test shows the barrel is not a mount, and a tripwire fails if the barrel ever re-exports
the module. Nothing mounts the module today: no route or worker imports it.

## 5. Blockers and decisions required

| # | Item | Accountable | Needed for |
| --- | --- | --- | --- |
| B1 | The supplied inventory and operating library (`paste.txt`) and design PDFs are not in the repository. | Product owner | Master inventory and full-coverage matrix |
| B2 | Owner for the `learning.assignment.submit` capability. | Product owner | Passport and institutional sign-off |
| B3 | Event name: keep `submission.finalized`, or add `learning.submission.received.v1`. | Platform owner | Contract file |
| B4 | Migration ownership between `supabase/migrations` and `database/`. | Platform owner | Any submission schema |
| B5 | Who runs the outbox publisher, and where (Vercel function limits make a long-running worker a deployment decision). | Backend and platform owners | Any external effect of an event |
| B6 | Staging deployment target and approval. | Release owner | Any deployment. **Not requested or performed.** |

## 6. Release manifest (draft, promotion blocked)

- Commit: `955d9e06` plus the slice commit (see the pull request).
- Build: `npm run build` passes. Types, gateway typecheck, lint, the full suite and the shuffled suite pass.
- Migrations: none added. No hosted database was touched.
- Configuration and policy: none changed. Census expectations and `EVENTS.md` were updated (section 4).
- Scope: library only. No route, screen, worker or deployment.
- Evidence: the command map (section 2) and the slice tests (section 4).
- Status per capability: designed (yes, in the specification); implemented (library only); tested (unit tests);
  deployed (no); institution-authorized (no); production-enabled (no).
- Approvals: none. Promotion is blocked: `release:check` refuses `registration.readiness`, and this capability
  has no passport evidence beyond the tests.
- Security: no HTTP surface was added, so there was nothing for a DAST scan to exercise. HawkScan was not run
  and no `HAWK_API_KEY` is configured in this session.

## 7. Continuation record: next executable tasks

1. Obtain B1 and build the master inventory and coverage matrix against it.
2. Resolve B3 and B4, then write the submission migration with composite tenant foreign keys, row-level
   security, and the idempotency fingerprint stored as a digest. Run the migration-order test.
3. Write a Postgres adapter for `MemorySubmissionStore` and a gateway route that calls the service.
4. Decide B5, then build the outbox publisher with subscriber-specific receipts. Its tests must cover crash,
   duplicate delivery, and lease expiry.
5. Run the AI-egress and tenant-isolation checks the specification requires (section 3 rows marked "not verified").
6. Write the passport file once steps 2 to 4 provide evidence. Until then it stays a proposal.
