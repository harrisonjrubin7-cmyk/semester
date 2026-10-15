<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Workbook: Documents

**Done means:** Every document in scope is present byte-for-byte, attached to the right person or record, readable only by who could read it, with its retention clock intact.

**Institution approver:** `data_owner` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## What to bring

| Entity | Natural key in the source | History | Sensitivity |
| --- | --- | --- | --- |
| document (file with metadata) | content digest + record it belongs to | summary | restricted |
| document attachment link | document + record + role | summary | restricted |
| retention and hold status | document + schedule + hold | full | restricted |
| signature or approval on a document | document + signer + signed-at | full | restricted |

Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.

## Checks

A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.

| Check | Proves | Severity | Primitive | Compares |
| --- | --- | --- | --- | --- |
| `documents.count.documents` | count | low | `countParity` | Documents by type |
| `documents.key.digests` | key | critical | `keyParity` | Each source file's SHA-256 appears exactly once on the target; none missing, none substituted |
| `documents.semantic.metadata` | semantic | high | `valueParity` | Document type, effective date, language, and media type after code table; no filename-as-identity |
| `documents.relationship.attachment_targets` | relationship | critical | `referentialIntegrity` | Each document is attached to the right person or record; no document on a different student |
| `documents.history.signatures` | history | critical | `historyPreserved` | Signatures and approvals keep signer, time and the digest they covered |
| `documents.history.retention_clock` | history | high | `temporalContinuity` | Retention start, schedule and legal-hold intervals keep their shape; a hold is never lost |
| `documents.permission.read_access` | permission | critical | `permissionParity` | Who can open each document class equals the source's |
| `documents.outcome.retrieval` | outcome | high | `outcomeParity` | A sample of documents opens and its digest equals the source's; a destruction run computes the same due set as the legacy schedule |

## What the engine runs

`institution-migration validate` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **high** (no major defect tolerated; minor at 0.5%).

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `documents.document.crosswalk` | crosswalk | critical | Every document maps to exactly one target document; no two collapse into one; nothing appears from nowhere. |
| `documents.document.content` | preserved | critical | document: checksum, byte_size, mime_type mean the same thing after the move. |
| `documents.document.owner` | preserved | critical | document:  mean the same thing after the move. |
| `documents.document.hold` | preserved | critical | document: legal_hold, retention_class mean the same thing after the move. |
| `documents.document.metadata` | preserved | high | document: kind, title, access_level mean the same thing after the move. |
| `documents.document.created` | preserved | high | document: created_on mean the same thing after the move (compared as date). |
| `documents.document.person` | reference | critical | Every document.owner_person_id points at a real person, and none that were fine in the source are orphaned. |
| `documents.version.crosswalk` | crosswalk | high | Every document_version maps to exactly one target document_version; no two collapse into one; nothing appears from nowhere. |
| `documents.version.preserved` | preserved | high | document_version: checksum, version_no mean the same thing after the move. |
| `documents.version.order` | order | high | document_version keeps its sibling order within each document_id. |
| `documents.version.history` | history | high | document_version: every event of each document, in order, with the same values. |
| `documents.access.crosswalk` | crosswalk | critical | Every document_access maps to exactly one target document_access; no two collapse into one; nothing appears from nowhere. |
| `documents.access.grant` | permission | critical | document_access: nobody gains access they did not have; lost access is reported. |

**Evidence classes the engine covers on its own:** `count`, `key`, `semantic`, `relationship`, `history`, `permission`.
**Still needs results from outside the two extracts:** `outcome`, supplied as `external-checks.json` (see the workbook checks above for what to run). The gate refuses the domain until they arrive.

## What stays behind

| What | Class | What happens instead |
| --- | --- | --- |
| documents of sensitive kinds | T4 | Documents of kind medical form, accommodation letter, conduct notice or counseling note are not migrated, whatever system they sit in. They are listed by kind and count in the source inventory so their absence is a decision. |
| unreadable or corrupt source files | T3 | Never repaired in flight. Listed as exceptions; the institution decides to re-scan, accept the loss in writing, or exclude. |

## Scope approvals

No field here is refused or needs a named approval.

## What a count will not show

- Re-encoding or OCR "improves" a file and breaks its digest and its signature validity.
- Retention starts at the migration date and resets every clock.
- A legal hold is a flag on the old system's record and has nowhere to go; the documents become deletable.
- Retention periods and legal-hold duties are the institution's records schedule and counsel's, never defaulted here.

## Business outcomes to recompute, not copy

- Digest equality per document
- Attachment target per document
- Destruction-due set
- Hold set

## Calendar events the parallel run must include

- `retention_run`
- `records_request`
