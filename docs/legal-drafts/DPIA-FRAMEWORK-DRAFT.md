> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester data protection impact assessment (DPIA) framework — draft

**Status:** requires qualified human counsel review. This is a process and form. Whether a given assessment is legally required, and whether a conclusion is adequate, is counsel's decision.
**Relationship to existing work:** [`docs/operating-model/PRIVACY-IMPACT-ASSESSMENT.md`](../operating-model/PRIVACY-IMPACT-ASSESSMENT.md) (rendered from `app/src/lib/governance/pia.ts`) holds the per-surface engineering answers (7 answered, 6 owed; no assessment reviewed by the privacy seat, which is vacant). This framework adds what that register lacks: a **trigger screen**, a **necessity and proportionality** step, **jurisdiction and age** inputs, **counsel sign-off**, and a **re-review rule**. The PIA rows become Section 5 evidence; they are not duplicated here.

## Step 1 — Trigger screen (any "yes" opens a full DPIA; unsure counts as yes)

| # | Trigger |
| --- | --- |
| T1 | New surface or change that touches education records, grades, accommodations, health or wellbeing, financial, immigration, discipline, or precise location |
| T2 | Any person under 18, or possibly under 13, can reach it |
| T3 | Guardian, advisor, faculty or staff visibility into data the student did not enter for them |
| T4 | AI processing of personal data, profiling, scoring, ranking, or automated recommendation affecting opportunities, grades, aid or access |
| T5 | New sub-processor, new region, or transfer outside the current footprint |
| T6 | Linking or combining data across tenants, sources or products; matching to external identities |
| T7 | Employer, marketplace provider or other outside party receives student data |
| T8 | Large-scale or systematic monitoring (engagement scoring, early-alert, cohort analytics below cohort floors) |
| T9 | Data used for a purpose other than the one it was collected for, including model training or product analytics |
| T10 | Customer or regulator requires one |

## Step 2 — Describe the processing

Purpose in one sentence · data subjects and ages · data fields (from the data inventory) and classification (T0–T5) · source and authority (student, institution, third party) · recipients and sub-processors · locations and regions · retention and deletion · roles (J5) · jurisdictions (J2) · legal basis or authority and consent mechanism (`[COUNSEL TO STATE]`) · automated decisions · human review points.

## Step 3 — Necessity and proportionality

Is each field needed for the stated purpose? Could less data, local-only processing, de-identification or aggregation achieve it? Is the retention the shortest workable? Could the user decline without losing core function? Is the purpose compatible with what the student was told? Answers are written as sentences with a link to the code or document that makes them true (same rule as the PIA register). Any "no" narrows scope, adds a control, or defers the surface.

## Step 4 — Risk to people (not to the company)

For each risk: who is harmed, how (exposure, discrimination, loss of opportunity, embarrassment, safety, loss of control), likelihood (remote / possible / likely), severity (minimal / significant / severe), existing controls, residual risk, treatment. Seed risks: cross-tenant exposure; guardian over-disclosure; staff over-access; AI hallucination in advising; re-identification from cohorts; retention beyond need; vendor secondary use; minors' contact by strangers; coerced sharing with employers or guardians; profile misuse after a student leaves.

## Step 5 — Evidence links

PIA register row; threat model entry; RLS/authorization tests; retention/deletion test; consent workflow; AI evaluation report; accessibility check of the notice and consent UI; vendor review; DPA clause.

## Step 6 — Consultation

Students or student representatives (where practical), institution privacy officer, security, accessibility, and counsel. Record who was asked, when, and what changed.

## Step 7 — Decision

| Outcome | Meaning |
| --- | --- |
| Proceed | Residual risk accepted by an authorised approver; counsel concurs |
| Proceed with conditions | Named controls and dates; surface flagged off until evidenced |
| Narrow | Scope reduced; re-assess |
| Do not proceed | Recorded with reason |
| Escalate to regulator or institution consultation | Where counsel advises |

## Step 8 — Sign-off and re-review

Fields: assessor · privacy owner · security · counsel (`requires qualified human counsel review`) · customer privacy authority where applicable · date · version · surfaces covered · next review. Re-open on: change in data fields, purpose, provider, region, age band, jurisdiction, incident, complaint, or twelve months, whichever first (`[COUNSEL TO CONFIRM CADENCE]`).

## Register fields (one row per assessment)

id · surface · triggers hit · version · date · assessor · counsel reviewer · outcome · conditions · evidence links · next review · status.
