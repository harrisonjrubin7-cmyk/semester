# Documents and Sources system passport

<!-- Rendered from app/src/lib/systempassports.ts by systempassports.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** planning contract only. This passport is not evidence that the system is implemented, deployed, connected, institution-approved or live.

## Purpose

Preserve originals, editable work, citations, extraction history, exports and recovery with explicit source lineage.

## System relationship

- `native`
- `connected`

## System of record

Semester owns:

- Student-created files and notes
- extraction outputs
- source references
- exports and recoverable trash

External authority remains:

- Original institution retention systems where required
- connected file providers

## Authority

- Students control their files and exports.
- Collaborators act only through explicit shares.
- Retention or legal holds override deletion only with visible authority.

## Records

- `file_object`
- `document`
- `source_reference`
- `version`
- `share`
- `export_job`

## Commands

- `upload_file`
- `extract_document`
- `create_version`
- `share_file`
- `export_file`
- `delete_file`

## Events

- `file.uploaded`
- `extraction.completed`
- `version.created`
- `file.shared`
- `file.deleted`

## Integrations

- Object storage
- Google Drive
- Microsoft files
- AI gateway

## Workflows

- Upload and scan
- Extraction review
- Sharing
- Export
- Trash and permanent deletion

## Screens

- Files and notes
- Document editor
- Source detail
- Version history
- Export

## Source and freshness rules

- Render authority and freshness independently; never collapse them into one color or status.
- Block or warn on consequential actions when the required source is stale, unknown, degraded or reconciling.
- Preserve source references, observed time, version and correction history on every governed record.

## Audit evidence

- Original hash and classification
- Extraction/model version
- Share scope
- Export and deletion receipts

## Tests

- Unit and contract tests for commands, events and validation.
- Tenant, relationship, policy and least-privilege negative tests.
- Ready, loading, empty, error, forbidden, offline and stale UI states where the surface applies.
- Keyboard, screen-reader, mobile and reduced-motion acceptance.

## Operational contract

- Owner: Workspace platform and privacy
- Service level: Define an SLO before tenant activation.
- Alerts:
  - Policy refusal trend
  - Stale-source threshold
  - Workflow failure or reconciliation backlog
- Runbook: `docs/runbooks/documents.md (required before activation)`
- Rollback: Disable the exposure gate, stop writes, preserve receipts and reconcile to the last authoritative state.
- Feature flags: `system.documents.enabled`

## Dependencies and capability coverage

- System dependencies: `identity`, `authorization`, `consent`
- Capability rows: `CAP-031`, `CAP-032`, `CAP-033`, `CAP-034`, `CAP-035`, `CAP-036`, `CAP-037`, `CAP-038`, `CAP-039`, `CAP-040`

## External activation gates

- Malware and content scanning
- Retention and legal-hold policy
- Provider and export acceptance
