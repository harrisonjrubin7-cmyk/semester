# FERPA risk and permission matrix

Status: engineering/privacy baseline, not legal advice and not a FERPA compliance or school-official claim.

## Core rule

Repository controls can support a lawful deployment; they cannot create the institution's legal authority, school-official designation, consent policy, directory-information policy, or data-processing agreement. Those are external approvals.

| Actor | Allowed record access | Offline | Required authority | Explicit deny |
| --- | --- | --- | --- | --- |
| Student | Own authorized records and student-owned work | Only allowlisted student-owned/short-lived fields | Active membership or personal account, purpose, policy | Other students, hidden source fields, unsupported official claims |
| Guardian/family | Minimized approved projection only | No by default | Authenticated person, verified relationship, active scoped consent, institution policy, purpose, expiry | Raw grades, transcript, enrollment, submissions, degree audit, aid, wellness, accessibility, conduct, support cases |
| Faculty | Course/section-scoped records needed for instruction | No by default | Active course role + approved instructional purpose | Unrelated courses or non-instructional records |
| Advisor | Assigned caseload/scoped student view | No by default | Advisor role, assignment, purpose, policy | Institution-wide browsing without assignment |
| Registrar | Defined record function | No | Explicit privilege, purpose, separation of duties | General support or analytics access |
| Institution admin | Configuration, audit, rollout and aggregate views by default | No | Explicit scoped privilege | Raw education records merely because user is an admin |
| Marketplace partner | Student-approved disclosure snapshot | No | Verified partner, listing/application purpose, consent snapshot | Raw SIS/LMS data, hidden profiling, unrelated fields |
| Semester support | No default student-record access | No | JIT grant, justification, scope, expiry, student/institution policy, audit | Standing broad access or content in ticket context |
| AI | Same or narrower context than the user's authorized search | No separate cache | Tenant, actor, purpose, policy, classification and permitted tool | Cross-tenant retrieval, secondary training, unconfirmed high-impact action |
| SIS/LMS connector | Tenant-bound approved sync fields | No | Connection credential, approved scopes and mapping | Unapproved fields, silent writeback, cross-tenant replay |

## Guardian findings

### Implemented or partially implemented

- Local family planning is explicit that it grants no authority.
- The institution package models family grants and denies access based on category, resource, acceptance, expiry, and revocation.
- Synthetic institution adapters demonstrate invite, accept, revoke, and payment-without-read semantics.
- Supabase includes family invite/share, consent narrowing, and K-12 guardian migrations/checks.

The repository currently expresses family authority through at least two paths: category/resource-based `family_grants` and K-12 `guardian_links` plus `private.guardian_may_read`. That is a convergence risk, not a reason to discard either feature. The target is one relationship record plus one consent/policy/projection decision contract, with compatibility adapters until both call paths migrate.

### Not proved live

- Production identity/relationship verification.
- Institution-approved policy evaluation for a named tenant.
- A single minimized `guardian_data_projection` service with expiry and invalidation evidence.
- Immediate revocation across every cache/session/search/AI path in a live environment.
- Guardian support staffing and a production access-history view.

The family capability must remain `institution_controlled` or `planned_but_not_exposed` until these are satisfied.

## Risk priority

Priority describes potential release impact, not a verified breach or legal conclusion.

| Priority | Finding | Current evidence | Exit condition |
| --- | --- | --- | --- |
| P0 | None verified in this static assessment | No demonstrated active cross-tenant disclosure, destructive official write, or confirmed data loss was reproduced | Any future failed isolation/projection test becomes immediate P0 and disables the capability. |
| P1 | Sensitive browser persistence is not one centrally classified encrypted cache | Raw IndexedDB/localStorage persistence and PWA caching exist; SQLCipher/native key lifecycle does not | Central offline classifier, prohibited-data tests, purge/revoke proof; native secure store before sensitive native offline activation. |
| P1 | Family/guardian authorization can drift across two models | `family_grants` and `guardian_links`/`guardian_may_read` coexist | One policy decision and minimized projection service; compatibility adapters; revocation parity and negative tests. |
| P1 | Tenant/RLS evidence is incomplete for this exact commit | RLS is broad, but PostgreSQL 17 checks could not run locally and no `FORCE ROW LEVEL SECURITY` declarations were found | Green PG17 clean/reapply/negative suites, privileged-path review, and named-tenant data map. |
| P1 | Capability `verified` can be mistaken for operationally live | 60/60 registry rows are repository-verified/L3; audience release profiles are separate | One resolved capability status drives route, entitlement, claims, AI, support and rollback with expiring evidence. |
| P2 | Marketplace lacks the complete purpose-limited application boundary | Moderated opportunities exist; partner verification, disclosure snapshot, delivery receipt and partner retention are incomplete | Verified partner/application schema and no-raw-record negative tests. |
| P2 | AI policy is strong but not yet the sole authorization boundary for every tool | Governed intelligence and selected centralized policy actions exist | All retrieval and actions call the same policy service as direct user access; parity tests. |
| P3 | Audit/docs/status vocabularies are duplicated | Extensive overlapping registers and readiness documents | Canonical index, generated registers, owner/review/expiry metadata and archived superseded evidence. |

## Sensitive operations

| Operation | Required control |
| --- | --- |
| Read education record | Tenant + subject/resource scope + role/relationship + purpose + policy + field projection + audit |
| Share with guardian | Verified relationship + explicit field/category consent + expiry + preview + policy + projection + audit |
| Support access | Time-limited JIT grant + justification + minimum scope + notification/approval policy + read audit |
| Export | Subject verification + scope preview + secure delivery + expiry + audit; do not silently omit provider/device data |
| Delete | Reauthentication + dependency/hold review + backup exception disclosure + durable receipt |
| AI retrieval/action | Same authorization as direct read plus tool policy; high-impact actions require confirmation |
| Marketplace application | Explicit selected fields + immutable consent/disclosure snapshot + delivery receipt + partner retention rules |

## Required negative tests

- Guardian cannot select raw institutional record relations even with a relationship row.
- Expired, revoked, wrong-purpose, wrong-field, wrong-tenant, and policy-version-mismatched projections deny.
- Support agent without a current grant cannot read or infer student content.
- An institution admin cannot use configuration privileges as record privileges.
- AI and search return identical authorization decisions for the same resource.
- Exports, analytics, logs, notifications, and error messages cannot become side channels.

## Approval gates

- Institution: role matrix, directory information, consent, legitimate educational interest, record-owner escalation, retention, and incident contacts.
- Legal/privacy: DPA, school-official theory where used, FERPA workflow, COPPA/age handling where applicable, privacy notice, terms, subpoenas/legal holds, and subprocessor review.
- Security: independent isolation review, incident response, key/secrets management, access review, vulnerability process, and production evidence.
- Founder/operations: named owners, staffing, support hours, insurance/procurement decisions, and claims approval.
