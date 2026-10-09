# API gaps

## Present and tested

- Account registration/login and ownership-scoped course CRUD.
- Initiate/complete upload flow, duplicate checksum behavior, file listing, download, classification, deletion, and extraction retry.
- Review items, conflicts, calendar events, filtered ICS export, study assets, PDF/DOCX/flashcard export, progress, and benchmark reads.
- Citation validation rejects unsupported generated claims.

## Still required

| API capability | State | Notes |
|---|---|---|
| Signed object-store upload/download | designed | Local storage works; production adapter returns a not-implemented response. |
| Job polling, cancellation, retry policy, and user-visible failure codes | partially API-wired | Job read exists; full control and UI are missing. |
| Structured OCR/STT/provider adapters | designed | Hooks exist; credentials and providers are not active. |
| Calendar OAuth and bidirectional reconciliation | documented | ICS export exists; live sync does not. |
| Source-location viewer endpoint | documented | Needs protected streaming plus page/slide/cell/timestamp fragments. |
| Rate limiting, abuse controls, session revocation, and CSRF posture | documented | Required before internet exposure. |
| Audit/event stream | documented | Needed for correction, approval, generation, and export evidence. |
| Institution roles and permissions | documented | Current course engine is single-owner, not an institutional authorization layer. |
