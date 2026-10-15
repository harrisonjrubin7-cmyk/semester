# Registration recovery tests (14 Oct)

`registration_recovery_test_cases.csv` (17 cases) and `registration_reference_test_results.csv` (22 passed) are yours, filed unchanged. Your results say these are in-memory reference-model tests, not database, provider or worker integration — agreed; none ran here.

`registration_recovery_crosswalk.csv` maps each REG case to the contract's recovery code, end state and acceptance test in `../contracts/registration.enroll.json`. All 17 now agree. One fix: **REG-01** (account with a grant at school A acts at school B) ends in `denied`, not `reauthenticate` — signing in again doesn't grant a missing permission.

## The two .pyc uploads
`registration_recovery_reference_model.cpython-312.pyc` and its test file are compiled Python bytecode, not source. I can't review logic from them, but their string tables show what the model covers: identity/permission/authority checks, freshness, window and ticket, scoped overrides and expiry, waitlist offers, precommit failure vs confirmed no-commit, timeout before/after dispatch with reconcile, projection failure, swap with replacement confirmation, withdrawal with separate academic and financial outcomes, corrections with original kept, and a worker claim with fencing, an inbox and stale-lease handling. That matches the 17 cases and the contract's states (`awaiting_information`, `awaiting_approval`, `paused`, `correction_pending`, …).

Not filed — bytecode is tied to Python 3.12, can't be diffed or reviewed, and shouldn't go into a repo. Send the `.py` sources to have them reviewed and kept next to the contract.

## Onboarding recovery crosswalk (14 Oct)
`onboarding_recovery_crosswalk.csv` maps the 13 onboarding failures to where they'd be enforced. The 111 patch covers ONB-09 and ONB-13; 101 covers ONB-10; the rest belong to identity, consent, membership sync, routing, import and notification components. Patch change: when an assignment's journey version isn't published, `complete_step` now moves the person to `support_required` (ONB-13). A step missing from the client's stale list returns `step_not_in_version`, so the client refetches instead of escalating. One test to adjust: ONB-09 expects `support_required` for a forged verified event, but the API can't accept one (verified events are server-only), so the test should assert the forgery attempt is rejected.
