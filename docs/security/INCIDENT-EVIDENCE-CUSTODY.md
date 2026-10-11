# Incident evidence custody

| Control | Current state |
| --- | --- |
| Repository implementation | Implemented in `20261011000000_incident_evidence_custody.sql` |
| Live migration | Not verified or asserted by this document |
| Evidence repository/provider | Not selected or approved by this document |
| Operated custody record | None retained yet |
| Control boundary | Metadata and custody only; evidence bytes remain external |

This procedure prevents an incident responder from treating a mutable link or
an unlogged download as preserved evidence. It does not claim that an incident
has occurred, that a provider has been approved, or that the migration is live.

## Capture

1. Put the evidence bytes in the approved immutable evidence repository. Do
   not put them in Semester's application database.
2. Remove credentials, signed query strings and unnecessary student content.
   Keep the unredacted original only when the incident and legal authority
   require it.
3. Calculate SHA-256 over the exact retained bytes and record their byte size.
4. With a fresh second factor and the platform incident-responder capability,
   call `record_incident_evidence` with:
   - the existing incident reference;
   - a bounded evidence kind and source system;
   - an opaque `evidence://` locator, never an HTTP URL or signed object URL;
   - the digest, byte size, capture time and retention date.
5. Keep the returned evidence reference with the incident timeline. The write
   is refused if the console audit chain cannot accept its audit event.

## Transfer and verification

Every handoff or digest check is appended with
`record_incident_evidence_custody`. A transfer names the new custody role and a
bounded reason code, never a person's name or free-form case content. A
verification records the digest observed from the retained bytes. Transfer and
successful verification require the original digest; a mismatch is preserved
as an explicit `verification_failed` event rather than being called verified.
The database links each custody event to the prior event's hash and refuses
updates or deletion of artifacts and custody events.

The custody ledger is read only through `incident_evidence_custody`, which
requires the same platform incident-response authority and fresh MFA and logs
the read before returning metadata. It returns no evidence bytes.

## Retention, legal hold and release

`retention_until` is a minimum review date, not an automatic deletion date.
This slice intentionally has no purge or shortening operation. Before any
future disposal workflow exists, it must:

- refuse deletion under a live account, tenant or platform legal hold;
- require two-person approval and fresh MFA;
- preserve the final digest and disposal receipt;
- keep the append-only custody history;
- prove the approved external repository deleted the correct object.

Until that separate workflow is implemented and operated, evidence remains
preserved and CER-E11 stays only repository-partial, not production-verified.

## Verification boundary

The policy suite `supabase/incident-evidence-custody.check.sql` exercises
authorization, fresh MFA, locator and digest validation, tenant binding,
immutability, hash linkage, audited reads and audit-write failure rollback in a
disposable database. A hosted PostgreSQL 17 branch pass proves the migration
and policy behavior for that exact revision. It still does not prove a live
provider, live migration, real evidence capture or staffed incident operation.
