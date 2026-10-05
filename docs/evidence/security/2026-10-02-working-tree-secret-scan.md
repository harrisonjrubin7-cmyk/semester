# Working-tree secret scan

**Produced:** 2026-10-02
**Scope:** the complete working tree, including tracked and untracked market-readiness material
**Scanner:** Gitleaks 8.28.0, the version pinned by `.github/workflows/ci.yml`
**Configuration:** `.gitleaks.toml`
**Result:** PASS — no leaks found

## Integrity and execution

- Official release asset: `gitleaks_8.28.0_darwin_arm64.tar.gz`.
- Downloaded SHA-256: `d942f3ad147250c9edbaab3fed9e482f98d3b59ba10ae97b8d75647e3ade492c`.
- The value matched the official `gitleaks_8.28.0_checksums.txt` release file before execution.
- Command shape matched CI: `gitleaks dir . --no-banner --redact --config .gitleaks.toml --exit-code 1`.
- Scanner report: approximately 518.06 MB scanned in 7.88 seconds; no leaks found; exit code 0.

## Limits

This is point-in-time repository evidence. It does not inspect secrets stored in deployment providers, validate credential rotation, replace GitHub secret protection, or prove that no secret will be introduced later. Renew it on every release candidate and after material configuration or credential-handling changes.
