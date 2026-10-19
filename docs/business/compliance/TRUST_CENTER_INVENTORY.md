# Trust Center Inventory

| Control | Value |
| --- | --- |
| Status | **DRAFT - INTERNAL INVENTORY - NO NEW PUBLIC CLAIMS - NOT APPROVED** |
| Owner | Harrison Rubin (interim; trust seat vacant; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [DRAFT] [INTERNAL] [ASSUMPTION] [REVIEW: counsel] [REVIEW: security] [REVIEW: privacy] [REVIEW: accessibility] [REVIEW: procurement] |
| Audience | Internal |

> Operating document, not legal advice. It inventories existing content and states which items are public or request-gated; it publishes nothing and adds no claim.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [docs/TRUST-CENTER.md](../../TRUST-CENTER.md) and `app/src/components/TrustCenter.tsx` | The in-app **Trust & data** center under Me > You: a signed-in student's own sources, shares, export, deletion and AI controls (flag `trust_center`, `VITE_TRUST_CENTER`, off by default, D-012/D-057) | Clarifies that this is a **student data-controls screen**, not the institutional procurement Trust Center, so the two are not confused in procurement answers | The name collides; nothing existing says so in one place |
| [docs/SECURITY-ACCESSIBILITY-READINESS.md](../../SECURITY-ACCESSIBILITY-READINESS.md) | The trust packet by confidentiality tier and the five-step NDA access process | A per-item inventory with owner, approval state and gap, plus the controlled request flow as an operating checklist | That page is an index of registers; this adds ownership and gaps |
| [docs/market-readiness/TRUST-CENTER-CONTENT.md](../../market-readiness/TRUST-CENTER-CONTENT.md) | Draft procurement-conversation text for a future Trust Center (security, privacy, accessibility, AI, operations, evidence index) | Status and approval state of each block | The text is a draft and must stay a draft |
| `app/src/screens/TrustRoom.tsx`, `app/src/lib/trustroom.ts`, `app/src/lib/trustlink.ts`, `supabase/functions/trust-room/index.ts`, `supabase/migrations/20260928100000_trust_room.sql` | The reviewer-side procurement room mechanism (link token in URL fragment, one-minute signed URLs, logged opens) | Treated as the request-gated channel in the inventory | Code, not documentation |
| [docs/trust/DOCUMENT-MAP.md](../../trust/DOCUMENT-MAP.md) and [docs/trust/REVIEWER-QUESTION-MAP.md](../../trust/REVIEWER-QUESTION-MAP.md) | Every trust document with its own status; questions mapped to pages | Referenced for which documents are candidates for the packet | Canonical indexes |
| `app/src/lib/trustdashboard.ts` | The institution-facing "customer trust dashboard" rows, derived from code (version, modules, integrations, retention, accessibility status from the claims register) | Listed as an existing, derived surface | Not duplicated |

## Gate (what may be done now versus held)

| Activity | Status |
| --- | --- |
| Point a prospect to the public pages already on the site (section 1) | NOW, unchanged wording only |
| Share a controlled document with a named reviewer in a design-partner discovery | HELD until NDA, packet commit and approver exist (section 3); synthetic or repository-derived documents only |
| Publish any new trust, security, privacy or accessibility statement | HELD: requires exact wording plus a named approver in `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` (none recorded; approved count zero) |
| Publish certifications, badges, "compliant" or "certified" language | PROHIBITED (CLM-010) |

## 1. Inventory of content items

Visibility: **Public** = reachable without an account today; **Request-gated** = only through the NDA/trust-room flow; **Internal** = repository only; **Student-only** = signed-in student screen. Approval state quotes `PUBLIC-CLAIMS-APPROVAL-REGISTER.md`: no named approver is recorded for any customer-facing wording.

| # | Item | Where | Visibility | Owner | Approval state | Gaps / notes | Label |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Privacy disclosure shown in the app | `app/src/lib/privacy.ts`, `app/src/screens/Privacy.tsx`; held true by `app/src/lib/privacy.test.ts` | Public (in the app) | Harrison Rubin (interim) | Test-held; not counsel-reviewed | Public policies await counsel (GO-NO-GO blocker 4) | [VERIFIED] `app/src/lib/privacy.test.ts` [REVIEW: counsel] |
| 2 | Company-site trust pages: Security, Privacy, Accessibility, Legal, Data and AI transparency, Launch readiness | `app/src/site/pages.tsx`, `app/src/site/more.tsx`, `app/src/site/benchmark.tsx` (routes `/security/`, `/privacy/`, `/accessibility/`, `/legal/`, `/trust/data-and-ai-transparency/`, `/launch-readiness/`) | Public | Harrison Rubin (interim) | Not registered as approved wording | **Finding T-1:** the site states "a confirmed exposure of your data brings notice within 72 hours" (`app/src/site/pages.tsx` contact routes and security section) while `SECURITY.md` calls 72 hours a target pending counsel and not a commitment, and `LEGAL-REVIEW-QUEUE.md` item L1 queues the 72-hour commitment for counsel. Review wording before any outreach points to it | [VERIFIED] [REVIEW: counsel] |
| 3 | Security contact and policy | `app/public/.well-known/security.txt`; `SECURITY.md` | Public | Harrison Rubin (interim) | Published; safe-harbour wording not written (needs counsel) | Contact is a personal mailbox; `Expires` 2027-03-31 per CONTROL-FACTS.md (as generated at revision 5eba494) | [VERIFIED] [REVIEW: counsel] |
| 4 | Status page and incident feed | `app/public/status.html`, `app/public/status-incidents.json`, `app/public/status-feed.xml`; `app/src/lib/statuspage.test.ts` | Public | Harrison Rubin (interim) | n/a (facts feed) | Feed lists no incidents (updated 2026-09-30); no subscribers; posting needs a merge and deploy (TR-39); not an uptime statement | [VERIFIED] |
| 5 | Subprocessor register | `docs/SUBPROCESSORS.md` from `app/src/lib/trust/subprocessors.ts` | NDA before counsel review; public once reviewed (per SECURITY-ACCESSIBILITY-READINESS) | Harrison Rubin (interim) | Draft; counsel has not reviewed; regions/terms not on file | See [VENDOR_RISK_REGISTER.md](VENDOR_RISK_REGISTER.md) | [VERIFIED] `app/src/lib/trust/subprocessors.test.ts` [REVIEW: counsel] |
| 6 | HECVAT readiness register and draft response | `docs/market-readiness/HECVAT_READINESS.md`, `HECVAT_DRAFT_RESPONSE.md`, `docs/trust/HECVAT-READINESS-MATRIX.md` | Request-gated (NDA) | Harrison Rubin (interim) | Draft; not a completed HECVAT | See [HECVAT_ROADMAP.md](HECVAT_ROADMAP.md) | [DRAFT] |
| 7 | Questionnaire / RFP library | `docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md` | Internal (answers are copied into responses) | Harrison Rubin (interim) | Test-held wording | See [SECURITY_QUESTIONNAIRE_LIBRARY.md](SECURITY_QUESTIONNAIRE_LIBRARY.md) | [VERIFIED] `app/src/lib/gtm/rfp.ts` |
| 8 | FERPA/COPPA/1EdTech readiness register | `docs/FERPA-COPPA-1EDTECH-READINESS.md` | Request-gated | Harrison Rubin (interim) | Register; no compliance claim | Counsel | [DRAFT] [REVIEW: counsel] |
| 9 | Architecture, data flow, retention | `docs/ARCHITECTURE.md`, `docs/trust/DATA-FLOW-MAP.md`, `RETENTION.md` | Request-gated | Harrison Rubin (interim) | Draft | Customer-specific map required | [DRAFT] |
| 10 | Incident response plan and runbooks | `docs/trust/INCIDENT-RESPONSE-PLAN.md`, `docs/trust/SECURITY-INCIDENT-RUNBOOK.md` | Request-gated | Harrison Rubin (interim) | Draft; never target-exercised | No notice clock approved | [DRAFT] [REVIEW: counsel] |
| 11 | Security overview / whitepaper | `docs/trust/SECURITY-OVERVIEW.md`, `docs/trust/SECURITY-WHITEPAPER.md`, `docs/legal-drafts/SECURITY-OVERVIEW-DRAFT.md` | Request-gated until approved | Harrison Rubin (interim) | Draft | CLM-009 exact wording not approved | [DRAFT] [REVIEW: security] |
| 12 | CI evidence for a named commit | `.github/workflows/ci.yml`; run links | Request-gated | Harrison Rubin (interim) | On request, from a frozen candidate | Blocker 1: no authorized candidate | [DRAFT] |
| 13 | Dated evidence files (assurance run, dependency audit, secret scan, restore rehearsal, smoke, tabletop) | `docs/evidence/` | Request-gated; each states its own limits | Harrison Rubin (interim) | Point-in-time | Never present as continuing assurance | [VERIFIED] |
| 14 | Accessibility statement | `docs/accessibility/ACCESSIBILITY-STATEMENT-DRAFT.md`, `docs/legal-drafts/ACCESSIBILITY-STATEMENT-DRAFT.md` | Not published as a statement; the site has an Accessibility page | Harrison Rubin (interim) | Draft | No WCAG conformance statement; qualified review absent | [DRAFT] [REVIEW: accessibility] |
| 15 | VPAT / ACR | none | n/a | n/a | Does not exist | `docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md` is an internal self-assessment, not an ACR | [VERIFIED] absence |
| 16 | Penetration test report | none | n/a | n/a | Does not exist | Plan only: `docs/trust/PENETRATION-TEST-PLAN.md` | [VERIFIED] absence |
| 17 | SOC 2 report | none | n/a | n/a | Does not exist | Not planned before a first pilot (RFP SEC-5) | [VERIFIED] absence |
| 18 | DPA, terms, privacy policy (legal) | `docs/legal-drafts/` | Not public | Harrison Rubin (interim) | Drafts; counsel has not approved any | Blocker 4 | [DRAFT] [REVIEW: counsel] |
| 19 | Insurance certificate | none | n/a | n/a | Does not exist | Blocker 5 | [VERIFIED] absence [REVIEW: insurance] |
| 20 | In-app **Trust & data** center (student data controls) | `app/src/components/TrustCenter.tsx`, `docs/TRUST-CENTER.md` | Student-only; flag off by default | Harrison Rubin (interim) | Feature, not a claim | Not a procurement Trust Center; do not describe it as one | [VERIFIED] `app/src/components/TrustCenter.test.tsx` |
| 21 | Institution trust dashboard (derived rows) | `app/src/lib/trustdashboard.ts` | Institution view; nothing live | Harrison Rubin (interim) | Derived from code | No institution connected; rows say so | [VERIFIED] `app/src/lib/trustdashboard.test.ts` |
| 22 | Procurement room (reviewer page and server) | `app/src/screens/TrustRoom.tsx`, `supabase/functions/trust-room/index.ts` | Request-gated by link token | Harrison Rubin (interim) | Mechanism built; no packet content approved | Trust seat vacant; no document published to it | [VERIFIED] `supabase/trust-room.check.sql` |

**Never shared at any tier** (from SECURITY-ACCESSIBILITY-READINESS.md): secrets, keys, production data, any student's records, other institutions' configurations or contacts, or anything under `supabase/` that names a real account.

## 2. What is not in the Trust Center and must not be implied

No customer or logo list, no uptime or response-time figures, no SOC 2/ISO/HECVAT badge, no accessibility conformance level, no "FERPA compliant", no penetration-test statement, no encryption statement beyond what the evidence supports, no live SSO/SCIM/LTI availability. Where a reviewer asks, the answer is the corresponding row of the RFP library ("Planned / not available" or "Not supported").

## 3. Controlled security-document request flow [DRAFT]

Canonical source: [docs/SECURITY-ACCESSIBILITY-READINESS.md](../../SECURITY-ACCESSIBILITY-READINESS.md) and the database rules in `supabase/migrations/20260928100000_trust_room.sql`. This section restates it as an operating checklist and adds the owner and the evidence to keep.

| Step | Rule | Held by | Evidence kept | Owner today |
| --- | --- | --- | --- | --- |
| 1 Request | A named person at the institution asks, in a role (IT security, privacy, procurement, accessibility); logged against the opportunity | CRM per `docs/INSTITUTIONAL-GTM-PLAYBOOK.md`; the database holds `trust_room_requests` | Request record | Harrison Rubin (interim) |
| 2 NDA first | An NDA-tier item cannot be granted to a request with no NDA on file | `trust_room_open`/grant rules in the migration; test `supabase/trust-room.check.sql` | NDA reference [REVIEW: counsel] | Harrison Rubin (interim) |
| 3 Packet from a named commit | Every grant carries a 40-hex commit and pins artifact versions; versions are append-only; a version past its review date cannot enter a new grant | Migration | Commit id in the grant | Harrison Rubin (interim) |
| 4 Expiring link | Grant expires within thirty days; token stored only as SHA-256, shown once; the reviewer's link carries the token in the URL fragment | `app/src/lib/trustlink.ts`; migration | Grant record | Harrison Rubin (interim) |
| 5 Open is logged | Each open is recorded and visible to the institution; documents open through one-minute signed URLs from the private `trust-packet` bucket | `app/src/screens/TrustRoom.tsx`; `supabase/functions/trust-room/index.ts` | Access log rows | Harrison Rubin (interim) |
| 6 Nothing edited for the audience | A row that reads "No" is sent as "No" with its "what moves it" | Process rule | Packet diff against commit | Harrison Rubin (interim) |
| 7 Revoke and review | Grants can be revoked, not edited; `kill.sharing` closes the room | Migration; `app/src/lib/flags.ts` | Revocation record | Harrison Rubin (interim) |

Pre-conditions before the first live grant [DRAFT]: (a) a trust owner or interim holder accepts the seat in writing; (b) packet contents are chosen from section 1 rows marked Request-gated and approved by the owner; (c) counsel approves the NDA form; (d) no document is published that contradicts `PUBLIC-CLAIMS-APPROVAL-REGISTER.md`; (e) a dry run with a synthetic reviewer and synthetic documents is filed under `docs/evidence/`. Not evidenced today: items (a), (c) and (e).

## 4. Gaps and next actions

| Gap | Action | Owner | Label |
| --- | --- | --- | --- |
| T-1 public 72-hour wording vs SECURITY.md target | Counsel decides the commitment; align site and SECURITY.md in one change | Harrison Rubin + counsel | [REVIEW: counsel] |
| Trust seat vacant; no approved packet | Name owner; approve packet list | Harrison Rubin | [DRAFT] |
| No dry run of the room | Synthetic reviewer, synthetic packet | Harrison Rubin | [DRAFT] |
| Accessibility statement and ACR absent | Qualified review first (TR-25) | Harrison Rubin | [REVIEW: accessibility] |
| Subprocessor list unpublished | Counsel review then publish (TR-22) | Harrison Rubin | [REVIEW: counsel] |

## Evidence state

Statements about visibility and gating come from the cited code and documents at revision `5eba494`. No grant has been minted and no document published to the room is evidenced in the repository.

## Claim ceiling

Permitted: "Semester has a controlled, logged mechanism for sharing security documents with named reviewers under NDA." Not permitted: that the documents contain assurance, certification or compliance.

## Prohibited claims

SOC 2, ISO, HECVAT approval, FERPA/COPPA compliance, penetration test, WCAG/VPAT conformance, uptime, customer names or logos.

## Professional review required

Counsel [REVIEW: counsel] for NDA form, public policies, the 72-hour wording; accessibility evaluator [REVIEW: accessibility] for any accessibility statement; procurement [REVIEW: procurement] for packet content. None named in the repository.
