# Implementation status

## Working in this MVP

- Modular Next.js/FastAPI/Celery/PostgreSQL/Redis/MinIO structure and Docker Compose.
- UUID ownership-scoped schema covering every requested record family, initial migration, authentication, CRUD routes, review/conflict safety state, ICS, progress, and versioned asset/export records.
- PDF, DOCX, PPTX, XLSX, CSV, text, and safe ZIP extraction; source locations and low-confidence review items.
- Citation validation, deterministic fake LLM, all fourteen prompt-chain definitions, WeasyPrint guide PDF, duplex-safe ReportLab cards, editable DOCX, and isolated renderer benchmarks.
- Premium responsive Semester shell with Ink navigation, Parchment work surfaces, a persistent context bar, labeled mobile tabs, keyboard command palette, source/status vocabulary, and loading, error, empty, offline, and stale/review language; no invented totals.
- Owner-scoped source inspection with paginated extracted chunks, document-native location labels, focus-managed source sheet, and authenticated original download.
- Review resolution UI for confirming, rejecting, or correcting structured extraction payloads without rewriting preserved source files.
- Calendar editing with a mandatory consequence preview, explicit unspecified-time preservation, authenticated persistence, and one-step session undo.
- Atomic worker leases with monotonic fencing, scoped progress/terminal writes, expired-lease redelivery, owner-scoped cancellation, and study-asset deletion barriers. These controls prevent stale database commits; they do not promise exactly-once external provider effects.
- Tests for shell navigation, command focus, source labels and locations, review correction validation, calendar preview/undo, operational states, semantic tokens, automated axe accessibility, ownership isolation, conflicts, missing date/time behavior, invalid citations, deduplication, safe archives, migrations, concurrent upload completion, ICS, and exports.

## Mocked or credential-dependent

- The default LLM deliberately produces no unsupported facts. Connect a structured-output provider with `LLM_PROVIDER`, `LLM_API_KEY`, and `LLM_MODEL`.
- OCR, speech-to-text, EPUB/legacy Office conversion, malware scanning, Google/Outlook OAuth, object-store encryption/KMS, and generated audio/video are adapter hooks or deployment services, not live providers.

## Before production

- Add managed secrets/KMS, signed download endpoints, CSRF/session hardening as appropriate, API rate limits, audit logs, retention/deletion verification, ClamAV or managed scanning, real provider adapters, browser accessibility/visual QA, load tests, backup/restore exercises, independent security review, and institutional privacy/legal approval.
- Replace the metadata-driven initial Alembic revision with explicit generated operations if the organization requires fully inspectable DDL diffs.
- Add worker job polling/cancellation UI, cloud upload providers, exact PDF bounding boxes/OCR overlays, and external-calendar reconciliation.

See `docs/audit/course-engine/` at the repository root for the factual current-state inventory, gaps, test coverage, and phased roadmap.
