# Database tests to execute on isolated target (NOT RUN)
1. Same bed overlapping reserved/confirmed insert rejected (23P01); adjacent dates accepted.
2. Same student overlapping bed claims rejected; different students/beds accepted.
3. Blocked-bed interval conflicts with reservation; adjacent closure permitted.
4. Cross-institution foreign key injection rejected; API errors do not disclose hidden IDs.
5. Empty/reversed period, invalid reserved expiry and blocked student rejected.
6. Concurrent final-bed transactions result one winner; deadlock retry cannot duplicate command.
7. Expiry worker/selection/confirmation races resolved under lock; confirmed never auto-expired.
8. Contract/application/student/period/group consistency checks implemented and fail closed.
9. Group all-or-none commit; acceptance tied to current version and every member eligible.
10. Missing/forged/revoked capability denied; no anonymous/browser DML; test runtime role not owner/superuser/BYPASSRLS.
11. Audit failure rolls back allocation; outbox/receipt atomic.
12. Idempotency same key+digest returns prior receipt; changed payload rejected.
13. Restore preserves claims/exclusion/policies/files/revocations and source mappings.
Schema does not implement all service checks. A PostgreSQL engine and target configuration are required for execution; Python tests do not prove SQL correctness.
