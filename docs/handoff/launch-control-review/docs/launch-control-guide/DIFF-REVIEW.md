# Review of previous proposed patch and orchestrator
Status: revise before claiming launch evidence. Review based on exact source shown in the prior conversation; prior generated archive was not available in this execution environment.
1. Original diff adds eight documentation/orchestration files only. No product, API or database capability is implemented by that diff.
2. Previous git-apply check was against a clean temporary repository, not the actual Semester worktree. Baseline 4b4f8ca742242132f5b2dd254d23422ae70eaa7a must be rechecked/rebased before application.
3. Original orchestrator handled timeout but not missing npm/OS launch errors. Revised runner records unavailable/launch_error.
4. Original setup failures printed text without a report. Revised CLI persists a failed report where possible; persistence failure exits 2.
5. Original runner passed the local service key to all child suites. Revised runner removes that key except for account-sync. Other inherited credentials are not sandboxed; use a clean ephemeral test environment.
6. Child stdout/stderr are now discarded by default, preventing unbounded in-memory captured logs and accidental report credential persistence. Individual child scripts must be run directly in an approved environment for diagnostics.
7. Loopback URL does not prove all backend/provider requests are local. Keep the existing account-sync guard and inspect actual build configuration.
8. Exit-zero trusts child exit semantics. This runner cannot independently verify every browser step; preserve underlying suite evidence. It never labels a selected student scope as full-platform readiness.
9. Full Course Studio, institutional authority, company reporting and production rollback are excluded. They need mapped tests and fixtures.
10. Missing test prerequisites must block, never skip or fabricate success. New unit tests validate orchestration only.
This revised patch is a new additive review package under docs/launch-control-guide. It does not automatically replace the prior proposed files, change package scripts or integrate CI. Choose one canonical runner during repository review; do not deploy parallel competing launch mechanisms.
