# Threat model

Write a one-page **feature security design record**, linked to the pull request, for every high-risk feature: authentication, profile data, records, messages, document upload, payment, institutional integrations, admin workflows and AI-assisted actions.

## Template
- **Assets and actors:** what's protected, and who acts on it
- **Entry points and trust boundaries**
- **Abuse cases** (at least 5) and the control for each
- **Authorization rules**, written before the schema and UI
- **Strong consistency needed for:** permissions, privacy settings, records, payments, credentials, grants, revocations
- **Failure modes:**
  - events that are duplicated, out of order or stale
  - a dependency outage
  - a policy changing mid-workflow
  - a saga left partly complete
- **Residual risk**, with its owner

## Standing threats for Semester
| Threat | Primary control | Detective control |
|---|---|---|
| Student A reads student B's record (IDOR) | RLS plus the `authorize()` relationship check | Denied-access audit events; negative RLS tests in CI |
| Cross-tenant read | Composite tenant foreign keys; tenant derived from identity, never from the request | Cross-tenant pgTAP tests |
| Staff browsing beyond legitimate interest | Purpose drawn from the workflow, plus a typed relationship | Access reviews; reports of unusual read volume |
| Forged or replayed LTI launch | JWKS signature check, nonce, one-time state consumption | Launch trace rejection codes |
| LTI role escalated into an institutional role | Roles map to course scope only | Policy tests |
| Service-role key leaks to the client | Server-only use; secret scanning | Scanner alerts; key rotation |
| SECURITY DEFINER function used as a back door | Register, `search_path = ''`, revoke from PUBLIC, caller check inside the function | Direct-call tests for each role |
| AI acts without approval, or leaks records | Approval bound to a payload hash; retrieval limited by permissions | ai_policy_decisions; prompt-injection tests |
| Prompt injection from documents, email or web pages | Tool allow-list; untrusted content never grants tools | Red-team suite |
| Payment amount tampering | Server picks the price; only verified webhooks change state | Reconciliation mismatches |
| Malicious upload | Scan and quarantine; private storage; expiring signed URLs | Scan results; quarantine alerts |
