# Production activation checklist

This is an operator gate, not an instruction to activate Course Engine from a development change. Record evidence for every item against the exact approved release SHA. Do not reuse local defaults or student data during acceptance.

## Platform decision and ownership

- [ ] Name the production hosting target for API, worker, PostgreSQL, Redis, and private object storage.
- [ ] Assign an operator and incident owner; document region, residency, retention, and recovery objectives.
- [ ] Confirm network boundaries: only the API is public; database, broker, worker, and object store use private connectivity.

## Data services and recovery

- [ ] Provision managed PostgreSQL with encryption, point-in-time recovery, tested backups, connection limits, and alerts.
- [ ] Provision durable Redis/Celery infrastructure with authentication, TLS, queue-depth alerts, and a documented recovery policy.
- [ ] Provision a private, versioned object bucket with public access blocked, lifecycle policy, encryption, access logs, and least-privilege API/worker identities.
- [ ] Set `S3_EXPECTED_BUCKET_OWNER` to the verified 12-digit account owner. Prove the object adapter rejects a different owner, bucket, key, checksum, content type, size, and encryption mode in provider acceptance tests.
- [ ] Restore a database backup and a preserved-original object into an isolated environment, then verify citations still resolve.

## Release and migrations

- [ ] Build immutable API, worker, and web artifacts from the same approved SHA and publish an SBOM/vulnerability result.
- [ ] Remove `alembic upgrade head` from the long-running API startup command. Run migrations as a separately approved, single-run release job.
- [ ] Rehearse upgrade and downgrade on a production-shaped PostgreSQL snapshot; record duration, locks, row counts, and rollback decision points.
- [ ] Verify `0003_upload_completion` exists before enabling the new completion route. Do not start mixed old/new API workers across that schema boundary.
- [ ] Define application rollback separately from schema rollback; preserve completion receipts and originals during either rollback.

## Security and processing

- [ ] Store JWT, database, Redis, and object-store credentials in the platform secret manager; rotate all bootstrap values.
- [ ] Replace the development malware scanner with the approved scanner. Test clean, infected, unavailable, timeout, and oversized-file outcomes; scanner failure must fail closed.
- [ ] Confirm originals remain private and immutable to clients after upload. Validate signed download authorization and short expiry.
- [ ] Confirm OCR, transcription, and AI adapters do not send student records to an external provider until privacy, contractual, residency, and retention reviews explicitly approve that provider.
- [ ] Enable rate limits, audit events, dependency/container scanning, and alerts for repeated completion failures and malware detections.

## Reliability and observability

- [ ] Add and verify the separate worker-leasing/fencing/recovery design before claiming exactly-once extraction. Completion deduplication alone does not fence duplicate workers.
- [ ] Define recovery for committed jobs whose broker dispatch is interrupted; exercise the recovery path without duplicating a completion receipt.
- [ ] Run exactly one monitored Celery beat dispatcher for `recover_upload_dispatches`; alert on pending or `dispatching` receipts older than five minutes.
- [ ] Load-test concurrent initiations/completions, uploads at the configured boundary, queue saturation, and large safe archives using synthetic data.
- [ ] Dashboard API latency/error rate, completion rejection reasons, quarantine age, scan/extraction duration, queue age/depth, worker failures, database health, and object-store errors.

## Product acceptance and cutover

- [ ] Run every supported-format extractor gate with synthetic fixtures; prove precise page/slide/cell/timestamp citations and review-first defaults.
- [ ] Run deletion/retention, conflict resolution, approved calendar/study asset, export, progress, accessibility, and browser acceptance suites.
- [ ] Complete UAT with non-sensitive fixtures and obtain named security, privacy, product, and operations approvals.
- [ ] Configure domains and TLS only after the services pass health checks. Stage DNS cutover and rollback values; do not alter production domains from a source-code PR.
- [ ] Record the exact release SHA, migration revision, artifact digests, evidence links, approvers, cutover time, and rollback owner.
