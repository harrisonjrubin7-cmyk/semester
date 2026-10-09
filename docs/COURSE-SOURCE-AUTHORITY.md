# Course-source authority contract

**Status:** locally implemented contract plus private student-source metadata, storage-receipt, scan-settlement, correction and recovery persistence; no server bucket, byte storage, upload/download route, scanner, extraction worker, scheduler or deployment exists.

Semester keeps one current product path: Import and Study Studio. The separate Course Engine shell and data model are not integration targets. Before either current screen can persist a source on the server, `app/server/course-sources/contract.ts` requires the caller to supply current server-resolved evidence for one of two existing course authorities.

| Source class | Canonical identity | Relationship required | Bucket label | Classification |
| --- | --- | --- | --- | --- |
| Student source | Tenant + exact owner + opaque `public.courses.id`; course code and term remain provenance labels | The authenticated actor owns that exact course row and holds the current exact tenant membership | `student-files` | `student_private` |
| Published course material | Tenant + normalized course code + term | `course:publish` at exact `course` scope `<tenant>/<CODE>` | `course-materials` | `internal` |

The labels name future private storage boundaries; they do not assert that buckets exist. The underlying object-key authority remains `packages/platform/src/engines/files.ts`: `t/<tenant>/<classification>/<yyyy-mm>/<fileId>`, parsed and tenant-checked before every store operation. A client never selects a bucket, key, tenant, owner, role, capability, scan result or retention policy.

## Write and read boundary

1. The server validates the session and builds `RequestContext`; a request tenant hint must agree with that verified context.
2. A repository reloads the current course row, tenant membership or exact course-scoped publish grant. The request body is not relationship evidence.
3. The shared rate limiter must allow the actor and the request must carry a valid idempotency key.
4. The course contract accepts PDF, Word, PowerPoint, plain text and Markdown. Server ZIP intake remains refused until a bounded sandboxed expander can validate every child; the current device-local ZIP reader is not a server security control.
5. The generic file engine applies its classification size cap and creates a tenant-prefixed `pending_upload` record. Only a tenant-bound service context may accept a storage receipt and move it to `quarantined`; an ordinary user context is refused.
6. Only that tenant-bound service may settle a scan. A clean scanner verdict, an allowed detected type exactly matching the declared type, a valid SHA-256 and a named scanner version may move the record to `available`. Every mismatch, blocked verdict or scanner error settles fail-closed as `rejected`. Only `available` records may later receive signed download URLs.

## Retention, deletion and recovery

Student sources reuse the current Drive recovery promise: explicit deletion enters a 30-day recovery window. The persistence slice keeps the metadata tombstone and prior lifecycle state, and it does not treat expiry of that window—or eventual removal of an object—as proof that the whole operation completed. No purge is implemented yet, so expired tombstones remain until a separately tested hold-aware purge exists. Shared course material cannot be planned without a current institution retention-policy id, version and bounded withdrawal period. A legal hold wins over every deletion schedule.

This contract is a technical default, not counsel or institution approval. `RETENTION.md`, the applicable signed institutional policy and legal-hold controls remain authoritative before activation.

## Provenance and confirmed corrections

Every accepted source is `imported`, never institution-verified merely because it was uploaded. The immutable source and its SHA-256 remain the evidence of what was read. A student-confirmed correction creates a new hash-linked correction revision identifying the derived record and field; it does not alter the source or silently overwrite its provenance. Downstream Import/Study Studio persistence must propagate that revision to every derived date, assignment or study artifact it changes.

Audit facts contain tenant, actor, source id, course code, term, correlation id and bounded outcome only. They never contain a filename, source excerpt, extracted text, prompt, answer, prior value or corrected value. Actual persistence must append the audit fact and domain change atomically, and reconcile uncertain outcomes by idempotency key before retrying.

## Persistence now verified locally

`20261008234500_course_source_persistence.sql` implements only the student-owned half of this authority. Its controlled service functions independently reload the exact current `public.courses` row and active `institution_membership` on create, correction, deletion and restore. Client roles have no metadata policy or table privilege. Exact retries are idempotent; conflicting retries fail. Corrections are append-only and hash-linked. Deletion preserves a 30-day recovery window and legal holds refuse it. Pseudonymous audit and the domain change commit or roll back together.

`20261009000000_course_source_scan_settlement.sql` adds only the service-side persistence transitions. A matching object key, byte count, SHA-256 and bounded object version move `pending_upload` metadata to `quarantined`; no receipt makes it readable. Scan settlement rechecks the current course relationship and moves to `available` only for a named scanner's clean verdict when stored and scanned hashes match and the allowlisted detected type exactly matches the declaration. Type mismatch, integrity mismatch, blocked verdict and scanner error settle as `rejected`. Both transitions are tenant-bound, request-hash idempotent and atomic with pseudonymous content-free audit. They record reports from a future private runtime; they do not prove that an object or scanner exists.

Institution-published `course-materials` remains closed. The repository has no current versioned institution retention-policy authority for that material, so a request or service argument cannot supply the missing proof.

## Still open before ingestion

- private bucket provisioning and bucket-policy proof;
- a deployed document scanner and sandboxed extraction worker;
- a repository adapter for the service-only persistence functions and a private runtime that can produce trustworthy receipts;
- published-material retention-policy authority;
- route authentication, shared rate-limit storage, upload receipts and signed-download authorization;
- Import and Study Studio wiring, source-version propagation and recovery UI;
- PostgreSQL/RLS, gateway, browser, accessibility, responsive, failure-state and DAST evidence;
- deployment, policy approval and institutional activation.
