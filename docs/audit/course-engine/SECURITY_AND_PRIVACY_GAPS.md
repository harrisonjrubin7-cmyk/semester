# Security and privacy gaps

## Implemented safeguards

- Password hashing and bearer authentication.
- Ownership checks on course, file, job, review, conflict, calendar, asset, export, and progress reads/writes.
- Safe archive extraction limits and duplicate checksum handling.
- Citation enforcement for generated factual sections.
- Original-file deletion and versioned generated assets.
- No credentials or uploaded content are written to the frontend bundle.

## Release blockers

| Blocker | Evidence state |
|---|---|
| Managed secrets/KMS and encrypted object storage | not implemented |
| Malware scanning service | adapter only |
| Signed short-lived source URLs/protected streaming | not implemented |
| API rate limits and abuse monitoring | not implemented |
| Session revocation/rotation and documented CSRF posture | not implemented |
| Durable audit events and tamper-evident export/correction history | not implemented |
| Retention, deletion verification, data export, and legal-hold integration | not implemented |
| Production RLS/tenant isolation test matrix | not implemented for course-engine schema |
| Independent penetration, privacy, accessibility, and legal review | external gate |
| Backup/restore drill and recovery evidence | external operational gate |

HawkScan is required after meaningful code change, but this environment has neither the Hawk runtime nor `HAWK_API_KEY`. No DAST pass is claimed. A scan must run against a started deployment after those prerequisites are provisioned.
