# Launch gates (go/no-go)

Status per gate: **pass** · **fail** · **blocked** · **not_applicable**. A pass names its evidence. Assessed 22 Oct 2026, workspace Education OS, latest commit on main.

| Gate | Status | Evidence / reason |
|---|---|---|
| Authentication works for external users | pass (synthetic) | Sign-in by email link or Google configured; preview runs authenticated in logs. |
| Institutional SSO (SAML) | blocked | Zite SAML support not verified (capability #2). |
| Authorization: server-side, deny by default | pass (code review) | Every endpoint calls `requireAccess`; role-gated actions check roles server-side. |
| Tenant isolation | pass (test) with limitation | Live probe, 22 Oct: institution A excludes B's courses, sections and requirements; control passes. Seven leaks fixed in e9c1fd4. **Limitation:** no DB-level RLS; endpoint-by-endpoint only. |
| Cross-student negative tests with real accounts | blocked | Only one user account exists in the workspace; two-account runs need test users. |
| Data accuracy / SIS reconciliation | blocked | No SIS connector authorized; fixture adapter not built. |
| AI boundary (no student-record egress, course rules) | pass (test) | tests/aiGate.test.ts 11/11, mutation check red→green. |
| AI answer quality evaluation | blocked | No evaluation fixtures yet. |
| Consent expiry and revocation | pass (test) | tests/shares.test.ts 10/10. |
| Regrade and readiness rules | pass (test) | tests/regrade.test.ts 12/12, tests/readiness.test.ts 9/9. |
| File access isolation | fail | Uploaded files are public by URL (capability #12). Do not store student documents until moved to a permissioned store. |
| Environment separation (staging) | fail | Preview and live share one database (capability #16). |
| Transactions for multi-step writes | fail | Not available (capability #6); mitigated by ordering and idempotency only. |
| Audit log integrity | fail | Audit table editable by workspace editors (capability #11). |
| Billing and webhook integrity | not_applicable (now) | No billing built; no payments. |
| Accessibility | blocked | Built-in practices only; no audit, no ACR. |
| Monitoring and incident routing | blocked | Endpoint logs exist (get_logs); no alerting configured. |
| Backup and restore evidence | blocked | Not exercised (capability #18). |
| Legal: DPA/FERPA addendum, MSA, privacy policy | blocked | Drafts under counsel review (Book 1); not signed. |
| Security questionnaire (HECVAT Full), pen test, insurance | blocked | Not complete (Book 1 checklist). |
| Founder approval to publish | blocked | Requested; see conflicts C6. |

## Verdict
**No-go for real student records.** Blockers: file privacy, environment separation, transactions, audit integrity, SSO, SIS reconciliation and the legal and contract items.
**Possible go for a synthetic-data demo** (public site plus the product with Sample data), only with the founder's explicit approval to publish.
