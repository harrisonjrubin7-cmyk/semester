# Institutional pilot conversion flow — Registration Readiness Pilot

Status: proposed public flow and internal handoff. Source material already in the
repository and not duplicated here: [`docs/commercial/PILOT-OFFER.md`](../commercial/PILOT-OFFER.md),
`PILOT-PROPOSAL-TEMPLATE.md`, `PILOT-SCORECARD.md`, [`docs/PILOT-TO-ANNUAL-CONVERSION.md`](../PILOT-TO-ANNUAL-CONVERSION.md),
[`docs/PAID-PILOT-FRAMEWORK.md`](../PAID-PILOT-FRAMEWORK.md), `docs/institutional-readiness/`.

**Scope boundary (GO-NO-GO, 2026-10-03):** public marketing may invite a design-partner
**conversation**: discovery, a synthetic-data demo, pilot design. It may not offer a
paid pilot, live data, tenant activation, logos, or outcomes. The "paid pilot
agreement" stage below is an internal stage and is not a public promise.

## 1. The wedge

Lead with **Semester Registration Readiness Pilot**, not "replaces every university
system" (CLM-006 prohibits that claim). The pilot helps a defined student group understand
next steps, take required actions and complete readiness workflows, beside existing
systems (CLM-004).

Audience: Student Success, Advising, Registrar, Student Affairs, an academic department,
a defined cohort. Scope: one cohort/department/unit/program; one academic term or 8–12
weeks; a defined integration and data boundary; named sponsor; named champion; defined
student population; written success metrics; written annual-conversion decision date.

## 2. Public page structure (`/pilot`)

1. Hero: "Prove registration readiness improvements in one term." Label the scope
   **illustrative until contractually confirmed**; do not promise a result.
2. Who the pilot is for.
3. The current-state workflow problem (no unsupported "students are X% more likely").
4. What Semester changes.
5. Pilot scope **and non-goals** (not a replacement of SIS, LMS, registrar or degree audit).
6. Timeline (8–12 weeks / one term).
7. Data, security and accessibility boundaries, linked to the Trust Center; states what
   is *not* yet independently assessed.
8. Success measures: activation, first meaningful action, workflow completion, weekly
   active use, student confidence/satisfaction, staff efficiency or support-friction
   reduction, relevant support burden, pilot-to-annual readiness. Each is defined and
   labelled **"what we will measure"**; no baseline or result is shown.
9. Roles and responsibilities: sponsor, champion, Semester owner, IT/data contact.
10. Pilot-to-annual path and decision date.
11. FAQ.
12. Request form.

## 3. End-to-end flow and what the frontend does at each step

| # | Step | Public/visible | Internal handoff |
| --- | --- | --- | --- |
| 1 | Reads pilot page | scope, timeline, metrics, boundaries | page view (consented) |
| 2 | Downloads a resource or requests a conversation | form | server-validated intake |
| 3 | Consent and attribution captured | separate marketing opt-in; privacy acknowledgment | consent record, UTM/landing/referrer |
| 4 | Lead queue / CRM handoff | generic safe success, expected response window | `site_leads` → `gtm_accounts` / `gtm_stakeholders` (existing), owner assignment |
| 5 | SLA | "we will reply within N" only with the route's real SLA | `respond_by` |
| 6 | Discovery call | optional calendar handoff | qualification notes |
| 7 | Qualification | — | problem, champion, economic buyer, timing, security/procurement path, pilot scope |
| 8 | Role-specific demo | synthetic data only | demo record |
| 9 | Pilot design session | — | cohort, workflow, metrics, scope |
| 10 | Pilot proposal + Mutual Action Plan | — | `docs/commercial/PILOT-PROPOSAL-TEMPLATE.md` |
| 11 | Security / privacy / accessibility / procurement review | Trust Center, security-document request | `trust_room_requests`, grant, NDA |
| 12 | Paid pilot agreement | **not a public promise today** | counsel and Finance gate (NO-GO) |
| 13 | Implementation | — | admin runbook |
| 14 | Activation and measurement | — | `gtm_pilots`, `gtm_pilot_metrics` |
| 15 | Midpoint executive review | — | `docs/institutional-readiness/PILOT-EXECUTIVE-OUTCOME-REVIEW.md` |
| 16 | Final value report | — | methodology-linked; becomes proof only with approval |
| 17 | Annual conversion decision | — | `docs/PILOT-TO-ANNUAL-CONVERSION.md` |
| 18 | Expansion / case study / reference | — | FTC policy §3–4: needs customer permission |

Steps 4, 11, 14 reuse tables that already exist. The public frontend builds steps 1–5
and the safe handoff. Internal records are never exposed to the browser.

## 4. Gaps that block a working flow today

- No consent version, suppression check or audit event on intake (F-03).
- Intake does not record structured attribution.
- `request_procurement` creates a trust-room request, but no public page explains
  what happens next.
- There is no calendar integration; the handoff must be a link with a fallback.
- Qualification fields (champion, buyer, timing) are not captured on the form and are
  not required to be: ask them on the call, not in the form (minimum-data principle).

## 5. What the form must not ask for

No student identifiers, records, accommodations, financial aid, health or disciplinary
information; no more than needed to route the request. See
[`LEAD_INTAKE_AND_CONSENT_SPEC.md`](LEAD_INTAKE_AND_CONSENT_SPEC.md).
