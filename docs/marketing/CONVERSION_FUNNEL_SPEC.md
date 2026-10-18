# Conversion funnel specification

Status: proposed. Boundaries come from [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)
(2026-10-03): individual acquisition is **conditional / invitation-only, unpaid
validation**; a design-partner institutional pilot is **GO for non-activation
engagement only** (discovery, synthetic demos, no live data, no tenant activation, no
logo claims); a paid pilot and a broad institutional sale are **NO-GO**. Every CTA
below is worded to stay inside that. When the decision changes, the CTA table changes
with it; copy is not changed ahead of the decision.

## 1. Funnels

### 1a. Student (conditional)

```
Visitor → /students (or home) → "Explore Semester" → demo (fictional data, no sign-in)
  → "Start your workspace" → app #/signup → first run → first meaningful action
```
Today the invite gate may be on (`set_invite_only`), in which case the primary CTA is
`request_invite`. The page must show whichever is true; it never offers sign-up when
the gate is closed. Activation, first meaningful action and referral are the only
student outcomes measured (matches `ANALYTICS.md`'s three figures). No scarcity or
countdown copy.

### 1b. Institutional (non-activation scope)

See [`INSTITUTIONAL_PILOT_CONVERSION_FLOW.md`](INSTITUTIONAL_PILOT_CONVERSION_FLOW.md).

### 1c. Trust / procurement

```
Visitor → /trust → read public summaries → request security documents
  → trust-room request (NDA tier gated) → reviewer opens token link → packet
```
Uses the existing `request_procurement` route, `trust_room_requests` and the
`trust-room` Edge Function. Nothing NDA-tier is rendered publicly.

### 1d. Support / accessibility / security reports

`customer_help` (24 h), `accessibility_barrier` (48 h), `site_feedback` (120 h),
**`security_report` and `privacy_request` (do not exist in `cta_routes`; must be
created before any form that posts them is considered working)**.

## 2. CTA table (target)

| CTA id | Visible label | Audience | Route key / destination | Allowed now? |
| --- | --- | --- | --- | --- |
| `explore_semester` | Explore Semester | student | `/product/student-workspace` | yes |
| `student_start` | Start your workspace | student | app `#/signup` or `request_invite` (gate-aware) | gate-aware |
| `student_demo` | Open the demo (fictional data) | student | demo | yes |
| `pilot_design` | Design your pilot | institution | `/pilot` → form route `plan_institution_launch` | yes (non-activation) |
| `pilot_conversation` | Request a pilot conversation | institution | same | yes |
| `explore_trust` | Visit the Trust Center | all | `/trust` | yes |
| `request_pricing` | Request pricing | institution | `request_enterprise` / `plan_department_launch` | yes |
| `procurement_pack` | Request security documents | procurement | `request_procurement` | yes |
| `signin` | Sign in | all | app `#/login` | yes |
| `status` | System status | all | `/trust/status` → `status.html` | yes |
| `report_vuln` | Report a vulnerability | all | `security_report` | **blocked by F-01** |
| `privacy_request` | Make a privacy request | all | `privacy_request` | **blocked by F-01** |

Rules: each page has one primary and at most one secondary CTA; labels are distinct
(no bare "Learn more"); a CTA never promises an "instant demo", never implies a
price, availability or outcome the register prohibits; an unavailable destination is
hidden, not shown disabled-without-explanation.

## 3. Stage definitions (institutional)

| Stage | Evidence required | Exit criterion |
| --- | --- | --- |
| Lead | Valid contact; service consent recorded | Routed to an owner |
| Qualified | Problem, champion, buyer, timing | Discovery complete |
| Demo | Use case and objection record | Next meeting scheduled |
| Pilot design | Cohort, workflow, metrics, scope | Proposal-ready |
| Procurement | Security/DPA/accessibility path | Review plan approved |
| Proposal | Price (only when approved), decision date, mutual action plan | Customer evaluating |
| Signed pilot | Contract / order form | Implementation scheduled |
| Activated | Admin configured, users invited | Baseline available |
| Success | Metrics and executive review | Annual conversion decision |
| Annual | Contract / plan active | Customer-health program starts |

Under today's decision the funnel ends at *Pilot design* and *Procurement
review* for public marketing purposes; later stages are internal.

## 4. Measurement

Funnel measurement is first-party and consent-gated; taxonomy and constraints in
[`MARKETING_ANALYTICS_EVENT_TAXONOMY.md`](MARKETING_ANALYTICS_EVENT_TAXONOMY.md). The
conversion score for a page release (from the compliance checklist): one clear
primary CTA; one appropriate secondary CTA; visible trust path; lead-form confirmation
works; internal handoff verified; no dead-end path.

## 5. Dead-end and failure paths

A form error never leaves the visitor without an alternative: retry, then
a support path (route or monitored address that is not a personal inbox). A rate-limit
response says when to retry. A 404 offers navigation and search. JS-off visitors get
readable content and a plain contact path.
