# Trust Center architecture

Status: proposed. Builds on the existing [`docs/TRUST-CENTER.md`](../TRUST-CENTER.md),
`docs/SUBPROCESSORS.md`, `docs/INSTITUTIONAL-TRUST-SCORECARD.md`, the `trust_*` tables and the
`trust-room` Edge Function. A Trust Center is a claims surface: **every statement on it is
a claim under the register**, so its content model is the claims model.

## 1. Principle

Trust is shown, not asserted. Each item states what exists, its scope, its date, who
reviewed it and what is *not* yet done. Words the register prohibits (CLM-008/010/012/016:
"compliant", "certified", "secure", "WCAG conformant", uptime guarantees, "zero retention")
are not used. A pending framework is never given an "achieved" visual state (audit F-02).

## 2. Routes

```
/trust                       overview: summary of the six areas, review dates, status link
/trust/security              security overview (public tier only)
/trust/privacy               what is collected, why, retention/deletion, data requests
/trust/accessibility         commitment, scope, known issues, contact, remediation
/trust/responsible-ai        governed AI: boundaries, institution control, human review
/trust/subprocessors         names and purposes (from docs/SUBPROCESSORS.md)
/trust/security-documents    request flow; NDA-gated materials listed by title only
/trust/compliance            roadmap and status of frameworks, dated, with "not certified" where true
/trust/status                link-out to status.html and the incident-communication approach
/security  /privacy  /accessibility    short canonical pages that link into /trust
/.well-known/security.txt    vulnerability contact and policy (see below)
```

## 3. Public vs controlled

| Public | Controlled / NDA-gated (never rendered publicly) |
| --- | --- |
| Security overview, privacy summary, accessibility statement (once approved), subprocessor names, responsible-AI principles, retention summary, status page, vulnerability contact | Detailed architecture diagrams, full HECVAT response, penetration-test report, vulnerability detail, incident evidence, security-questionnaire answers, audit/control evidence, customer-specific contract security terms |

The controlled tier maps to `trust_artifacts.tier = 'nda'`. The `public` tier exists
in the table but has **no public read path today**; the public Trust Center is
therefore served through the read model in §5, not by exposing the table.

## 4. Review workflow

Draft → product accuracy → security → privacy → accessibility → legal (if externally
material) → claims/evidence review → approved → published → review due → updated/retired.
Maps onto `content_register.review_state` (`draft|review|published|superseded|archived`)
plus per-item approvals. `content_published_is_governed` already requires owner,
`next_review_at`, `source_basis` and `published_at` for `published`.

## 5. Data path

```
Browser ─GET→ Edge Function `marketing-public` (verify_jwt=false, origin allow-list)
              └ service-role RPCs  marketing_public_trust_summary()  etc.
                  └ reads content_register ⨝ claims_register  WHERE
                      review_state='published' AND visibility='public'
                      AND claim.status='active' AND now() < review_by/next_review_at
```
No `anon` grant on any governance table; no anon-callable function (that would break
the `grants.check.sql` invariant). Responses carry only title, body, approved copy, scope,
last-reviewed and evidence label. They never carry owner ids, internal notes, NDA references
or draft state. The function returns an empty list, not an error, when nothing is approved.

Because `claims_register` and `content_register` have no rows today, **the Trust
Center renders its honest "in preparation" state until items are approved**. That is
correct, not a bug.

## 6. Security-document request

Reuse `request_procurement` → `site_leads` → `trust_room_requests` → `trust_room_grant`
(NDA required for the `nda` tier) → token link → `trust-room` Edge Function → 60-second
signed URL from the private `trust-packet` bucket. Public page lists titles and tiers, not content.

## 7. Vulnerability reporting

Publish `/.well-known/security.txt` (contact, policy, expiry). The in-page report form
needs the `security_report` route (audit F-01). The contact mailbox is
`harrisonjrubin7@gmail.com`, which the owner has confirmed is a non-personal company mailbox, so it may be
used for `security.txt`. Before advertising it, confirm it is monitored and who else has access.

## 8. Accessibility statement

`docs/accessibility/ACCESSIBILITY-STATEMENT-DRAFT.md` is **"DRAFT, NOT PUBLISHED"** with four
publish conditions. The page may use the register-compliant form only: *"Semester uses
automated accessibility safeguards and a controlled manual test plan; there is no WCAG
conformance report, VPAT or ACR."* plus the barrier-report contact.

## 9. Open items for human review

Security (what can be said about encryption/controls), Privacy (retention summary and
data-request process), Accessibility (scope of the statement), Legal (all of it), and a
named owner and `review_by` for every item before publication.
