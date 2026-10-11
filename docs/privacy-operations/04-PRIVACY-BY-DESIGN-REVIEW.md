# 04 · Privacy-by-design review

**Status `DESIGNED`. 4 October 2026. Owner: privacy seat (vacant; no review can be signed until it is filled).**

> Not legal advice. **Legal sufficiency of any outcome here is [COUNSEL REQUIRED].** This file adds a *triage* and *trigger lists* in front of the existing assessment. The assessment itself, its 11 questions and its register are in [`operating-model/PRIVACY-IMPACT-ASSESSMENT.md`](../operating-model/PRIVACY-IMPACT-ASSESSMENT.md), rendered from `app/src/lib/governance/pia.ts` (never hand-edit that `.md`). The PR gate is item 10 of `.github/pull_request_template.md`.

## 0. Why a triage

The existing PIA covers student-data modules and is reached only through one PR checkbox. It does not decide **whether** a change needs an assessment, it has no entry for analytics events, AI features, integrations, marketing campaigns, the company site, referral or ambassador programmes, or a marketplace, and six surfaces are already *owed* an assessment (Community, school records, Course Studio, LTI, Transfer/Career/Basic-Needs, support access). Marketing, GTM, lead capture, the trust room and the sponsorship module are in neither `ASSESSMENTS` nor the owed list.

## 1. Step 1: triage (the author answers; two minutes)

Any **yes** means a review is required before merge or launch.

| # | Question |
| --- | --- |
| T1 | Does it collect, store, infer or send a **new category** of personal data, or an existing category for a **new purpose**? |
| T2 | Does it add or change a **recipient** (vendor, institution, employer, guardian, other users, a model)? |
| T3 | Does it add a new **identifier, cookie, local-storage key, pixel, SDK, or tracking parameter**? |
| T4 | Does it send data to an **AI model**, add context to a model, or let a model act? |
| T5 | Does it affect **minors, guardians, or accounts without a stated age**? |
| T6 | Does it **change what a role can see** (staff, advisor, guardian, support, employer, moderator)? |
| T7 | Does it contact people (email, SMS, push, in-app) or **record consent**? |
| T8 | Does it **profile, rank, score, flag or recommend** about a person? |
| T9 | Does it **change retention, deletion, export, or backup** behaviour, or add a table? |
| T10 | Does it make a **public or sales claim** about privacy, data, or AI? |

**No to all ten:** record "no review required: T1–T10 all no" in the PR with a one-line reason. A wrong "no" is a defect; the reviewer may reopen it.

## 2. Step 2: trigger lists by feature type (what a reviewer must look at)

| Type | Always examine |
| --- | --- |
| **New product feature** | Which table holds it, its `RETENTION.md` row, erasure and export coverage (`account_data_map()` finds FKs to `auth.users` automatically; check non-FK columns and JSON), default visibility (private unless chosen), copy shown to the student, minors behaviour |
| **Analytics / telemetry** | Only the three activity marks exist (`opened`, `course`, `studied`, one per account per day, 400 days; a check constraint enforces it). A new event is a **change to a standing rule**: justify against the FORBIDDEN list and the n ≥ 10 floor in [`PRODUCT-ANALYTICS-DATA-ETHICS.md`](../PRODUCT-ANALYTICS-DATA-ETHICS.md), update `phase5docs.test.ts`'s source (`institution-ops.ts`), and reconcile `market-readiness/ANALYTICS-PLAN.md` and `EVENT-TAXONOMY.md`, which describe a funnel the code does not send. No third-party analytics SDK may be added (`donotbuild.test.ts`, `csp.test.ts`) |
| **AI feature** | Run [`trust/AI-RISK-ASSESSMENT.md`](../trust/AI-RISK-ASSESSMENT.md) (which requires a feature-specific assessment but gives no template: use §4 below). Data classes allowed; whether the **runtime** checks class (it does not today, 8-C7); provider, key owner, terms signed?; retention of prompts and outputs; no training, stated as policy and as a technical control; human confirmation for anything consequential; disclosure; kill switch; minors excluded or not; red-team cases for another student's data, guardians, and accommodations |
| **Marketplace** (not built) | Provider and buyer data, payments and payout data, who sees what before an order, reviews and disputes (personal data about third parties), tax and merchant-of-record questions **[CR]**, minors excluded, a PIA and a register row *before* any build begins |
| **Integration / connector** | Direction of data; scopes minimised; class ceiling per connection; never-ingest list; source-of-truth and what deleting a source does; revocation behaviour (stops the next sync, deletes nothing: say so); purge path per source (designed, unverified); consent records; degraded-mode UX |
| **Marketing / growth / site** | Lawful collection and notice on every form **[CR]**; consent record in `gtm_consent` before any send; suppression; no dark patterns, no exploiting educational stress; attribution kept to what the notice says; referral and ambassador mechanics (data about the *referred* person); testimonial and case-study consent; third-party scripts on the site (03 §6); retention for `site_leads` and `gtm_*` events (none today); **no marketing use of student-workspace data, ever, without a recorded decision** |
| **Staff / support tooling** | Least privilege, time-box, reason, student-visible log; no impersonation exists and none may be added without a PIA |

## 3. Outcomes

`approved`, `approved-with-conditions` (each with an owner and date), `needs-counsel` (blocks), `rejected`. **A condition that is not closed by the date reopens the review.** A reviewer who is also the author does not approve. Today the privacy seat is vacant, so the only honest outcome a reviewer can record is **"assessed, unreviewed"**; the existing PIA already says so.

## 4. Review record (copy into the PR or the PIA data, then keep)

```
change / PR:
author:                       reviewer (not the author):
triage answers:               T1..T10 y/n
data: fields, class (T0–T6), source, who sees it, where stored, retention row
purpose and why it cannot be met with less:
recipients and vendors (03 intake id):
people affected: adults / 13–17 / not-cleared / non-users (e.g. referred persons, leads)
user control: where shown, how to refuse, how to withdraw, what withdrawal does
erasure, export, hold behaviour:   tested by:
AI only: feature, provider, key owner, prompts/outputs retained?, runtime class check?, human confirmation, kill switch
transparency: copy and where; does any public claim change? (claims register id)
risks and mitigations (likelihood, severity, owner):
counsel questions raised (queue ids):
outcome:                      conditions + dates:
```

## 5. Rules that make it real

1. The PR template's item 10 links to this triage, not just the PIA.
2. The privacy seat is filled, and a named backup exists, before any new surface launches.
3. The seven owed surfaces are assessed in this order: Course Engine before activation, school records, Community, support access, LTI, Course Studio, Transfer/Career/Basic-Needs. The order follows exposure of uploaded education records and minors.
4. Marketing, GTM, lead capture, trust room and sponsorship are added to the PIA's surface list.
5. A release gate, not advice: a surface that is *owed* an assessment may not be switched on for a school.
6. Re-review when the answer to any triage question changes, and annually for AI features.
