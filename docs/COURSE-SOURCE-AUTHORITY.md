# Course-source authority contract

**Status:** locally implemented contract, student/shared metadata and controlled lifecycle, plus deny-by-default private bucket definitions; no stored byte, upload/download route, storage adapter, scanner, extraction worker, scheduler, deployment or production-bucket evidence exists.

Semester keeps one current product path: Import and Study Studio. The separate Course Engine shell and data model are not integration targets. Before either current screen can persist a source on the server, `app/server/course-sources/contract.ts` requires the caller to supply current server-resolved evidence for one of two existing course authorities.

| Source class | Canonical identity | Relationship required | Bucket label | Classification |
| --- | --- | --- | --- | --- |
| Student source | Tenant + exact owner + opaque `public.courses.id`; course code and term remain provenance labels | The authenticated actor owns that exact course row and holds the current exact tenant membership | `student-files` | `student_private` |
| Published course material | Tenant + normalized course code + term | `course:publish` at exact `course` scope `<tenant>/<CODE>` | `course-materials` | `internal` |

`20261009004500_course_source_storage_buckets.sql` now defines those two private boundaries where Supabase Storage exists. It repairs either bucket to private, applies the existing classification size cap and restricts both to the five course-document MIME types. It deliberately creates no anon or authenticated object policy. This is local schema evidence only: it does not show that a migration is deployed, a production bucket exists or any byte has been accepted. The underlying object-key authority remains `packages/platform/src/engines/files.ts`: `t/<tenant>/<classification>/<yyyy-mm>/<fileId>`, parsed and tenant-checked before every store operation. A client never selects a bucket, key, tenant, owner, role, capability, scan result or retention policy. `20261009001500_course_material_retention_policy.sql` supplies the shared-material policy authority: an operator with `console:operate` and fresh MFA consumes one independently approved `tenant-policy` request to append an active or withdrawn tenant version. The private resolver returns no row when no version exists or the latest version is withdrawn, so shared intake remains closed by default.

## Write and read boundary

1. The server validates the session and builds `RequestContext`; a request tenant hint must agree with that verified context.
2. A repository reloads the current course row, tenant membership or exact course-scoped publish grant. For shared material it also resolves the current active policy id, version and retention days from the private authority table. The request body is not relationship or retention evidence.
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

`20261009003000_course_material_metadata.sql` implements the shared-material metadata boundary without reusing a student's ownership model. The service-only planner rechecks the named publisher's current profile and exact live `course:publish` grant at `<tenant>/<COURSE>`, resolves the current active retention policy, and requires the server's expected policy id/version to match before it records an `internal` plan for one tenant/course/term. Plan, withdrawal and restore are idempotent and atomic with pseudonymous content-free audit; operation history is append-only. Policy withdrawal closes new intake and restore, while an already-bound row keeps its original policy id, version and duration. Metadata has no client policy or write grant and cannot be physically deleted, leaving object creation, storage/scanner settlement, extraction, signed reads and a future legal-hold-aware purge explicitly closed.

`20261009004500_course_source_storage_buckets.sql` closes only the local bucket-definition dependency. `student-files` is private with a 50 MiB object cap; `course-materials` is private with a 100 MiB cap; both allow only PDF, plain text, Markdown, DOCX and PPTX. The migration-owner repair function is unavailable to anon, authenticated and service roles. With no browser object policy, direct client inserts fail and reads, updates and deletes see or affect zero rows. The buckets contain no production byte and expose no signed read or upload path.

`20261009014500_course_source_derived_snapshots.sql` closes only the hash-authority prerequisite for re-import. A service-only append binds a named extractor version and derived snapshot SHA-256 to the exact SHA-256 of one still-available scanned source after rechecking the current student relationship. The receipt is append-only, request-hash idempotent and atomic with bounded audit; it stores no extracted text or course document. `record_course_source_conflict_resolution` now refuses an imported snapshot hash without a matching receipt for that exact source, tenant, owner and current source hash. This does not attest that an extractor is deployed or trustworthy: a real private runtime must create the receipt before any browser adapter is opened.

## Still open before ingestion

- a deployed document scanner and sandboxed extraction worker that produces genuine derived-snapshot receipts;
- a repository adapter for the service-only persistence functions and a private runtime that can produce trustworthy receipts;
- route authentication, shared rate-limit storage, upload receipts and signed-download authorization;
- Import and Study Studio wiring, source-version propagation and recovery UI;
- PostgreSQL/RLS, gateway, browser, accessibility, responsive, failure-state and DAST evidence;
- deployment, policy approval and institutional activation.
