# 07 · Documentation, training, enablement and knowledge management

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — NOT YET OPERATED** |
| Owner seat | `operations` (knowledge owner, held by the Founder, acting); `success` owns customer training |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`DOCUMENT-CONTROL-POLICY`](../../company/DOCUMENT-CONTROL-POLICY.md), [`KNOWLEDGE-BASE-STRATEGY`](../../commercial/KNOWLEDGE-BASE-STRATEGY.md), [`RUNBOOKS`](../../RUNBOOKS.md), [`FACULTY-ENABLEMENT`](../../FACULTY-ENABLEMENT.md), [`DEFINITION-OF-DONE`](../../DEFINITION-OF-DONE.md), [`SEMESTER-OPERATING-SYSTEM`](../../../SEMESTER-OPERATING-SYSTEM.md) |
| Claim ceiling | Semester may say it keeps source-controlled documentation and has a training design. It may not claim a completed training academy, certified staff, or validated help coverage until records exist. |

## Principles

1. **Documentation describes actual behaviour, lives in the repository or a controlled system, and changes with the thing it describes.** A change that alters behaviour and not its page is not done.
2. **One authoritative page per topic.** The repository holds several hundred pages. [`SEMESTER-OPERATING-SYSTEM`](../../../SEMESTER-OPERATING-SYSTEM.md) says which one wins; this set deletes and renumbers nothing.
3. **A person who has never done the work can do it from the page.** That is the test of a runbook ([the fresh-hands test](#the-fresh-hands-test)).
4. **Training is evidence.** A sensitive role is held only by a person with a current, recorded certification.
5. **Enablement never exceeds evidence.** Sales and marketing material draws only on the approved claims register.
6. **Plain language, accessible by construction.** Real text, descriptive headings and links, no image-only steps, captions and transcripts for media.

## Document taxonomy

| Class | Examples | Audience | Home | Approval | Review |
| --- | --- | --- | --- | --- | --- |
| **Policy** | Privacy, acceptable use, support policy, retention | Public and internal | Controlled system; drafts in `docs/legal/` | Counsel; founder | Annual |
| **Standard** | Design system, API conventions, severity definitions | Internal | Repository | Owning seat | Quarterly |
| **Procedure and runbook** | Incident, restore, rollback, data-rights, this set | Internal | Repository | Owning seat; exercised | After each exercise; at most 12 months |
| **Template** | The twenty-six in [templates](templates.md) | Internal | Repository | Owning seat | Annual |
| **Register** | Risk, claims, vendors, activation | Internal | Repository or private system | Owning seat | Monthly or quarterly |
| **Customer guide** | Admin guide, quick starts, FAQ, known limitations | Customers | Repository (`docs/launch/`) and help centre | Product and domain seat | At each release that changes it; 90 days |
| **Knowledge article** | How-to, troubleshooting, known issue | Customers or support | Knowledge base | Domain seat; high-risk topics need domain approval | 90 days |
| **Evidence** | Test results, drill records, scans, sign-offs | Auditors, procurement | `docs/evidence/` or the private store | Producer; independent reader | Retained per schedule |
| **Customer record** | Charter, contacts, UAT, decisions | Semester and that customer | Private operations system | Owning seat | Per engagement |

Privileged, customer-confidential, personnel and sensitive security records stay in approved restricted systems, never in the public repository ([document control](../../company/DOCUMENT-CONTROL-POLICY.md)).

## Required metadata

Every controlled page carries: title, path or ID, owning **seat**, approver, version, status, effective date, review date, classification, what it supersedes, dependencies, record location. The repository's control table (Status, Owner, Evidence date) is the minimum form. A page whose review date has passed is a finding on the monthly review.

## Documentation as part of "done"

The release gates already require docs and runbooks. The operating rule:

| Change | Documents that change with it |
| --- | --- |
| New or changed behaviour | Customer guide or article; release note; support macro if a question is likely |
| New failure mode | Runbook; known-issue entry; alert and dashboard row |
| New integration | Integration catalog; admin guide; data-flow map; subprocessor list if a destination |
| New or changed policy | Policy page; decision file; training module if people must act differently |
| New or changed vendor | Register entry; subprocessor list; exit plan |
| Incident | Review; runbook edit; problem record; article |

A release is not promoted past the release review while any row above is open for it.

## The knowledge base

[`KNOWLEDGE-BASE-STRATEGY`](../../commercial/KNOWLEDGE-BASE-STRATEGY.md) fixes the content model and lifecycle. Operations adds three disciplines.

**Intake.** Articles are created from: top recurring cases ([04](04-support-operating-model.md)), failed searches, release notes, incident reviews, implementation lessons and customer feedback. Triage by harm and frequency.

**Freshness.** Customer-facing articles carry an expiry date 90 days out. Articles tied to a feature flag, a connector or a policy carry a *dependency*; when that thing changes, the article is flagged stale automatically or at the weekly release review. Unsafe guidance is withdrawn at once, communicated, and reviewed as an incident.

**Measurement.** Coverage means validated tasks and failure states, not article count.

| Measure | Definition | Target (SL0) |
| --- | --- | --- |
| Deflection | Help views that did not become a case ÷ help views, same topic | Measured; no target until a baseline exists |
| Stale rate | Articles past their review date ÷ all | at most 5% |
| Known-issue latency | Confirmed issue to published | 1 business day ([SL-DOC-01](04-support-operating-model.md#delivery-success-trust-and-partners)) |
| Top-ten coverage | Top ten recurring causes with a current article | 100% |
| Helpfulness | Rated helpful, cohorts of ten or more | Measured |

Minimum launch set: first win and onboarding; account, local versus synced; sources, freshness and official limits; offline and recovery; accessibility and help; privacy controls, export and delete; supported integrations; known limitations; support and escalation; offboarding.

## Runbook and procedure standard

A runbook ([TPL-23](templates.md#tpl-23-sop-and-runbook-skeleton)) contains: trigger, owner seat and backup, prerequisites and access, numbered steps with expected results, verification, failure and recovery, escalation, rollback, evidence to keep, related pages, and the date it was last *exercised*.

### The fresh-hands test

A runbook is **exercised** when someone who has not performed it follows it unaided on a sandbox, a drill or a real instance, and the facilitator records: time taken, steps where they stopped or guessed, errors, and what the page lacked. A runbook that fails is edited and run again. A runbook that has never passed is labelled *draft* in its header. Transfer from the founder ([11](11-founder-to-team-transition.md#the-transfer-ladder)) uses the same test.

## Training

### Principles

Role-based, practice-based, recorded, recertified. Training that records only attendance is not evidence; the evidence is a practical sign-off by an assessor who is not the trainee.

### Curricula for people who work at Semester

| Role | Modules | Practical sign-off | Recertify |
| --- | --- | --- | --- |
| **Everyone** | Mission and boundaries; privacy and student data; security hygiene and phishing; accessibility basics; claims discipline; incident reporting | Short assessment and a reporting exercise | Annual |
| **Support agent** | Taxonomy and priority; identity and authorization checks; sensitive-case routing; crisis boundaries; plain language; tools | Ten calibrated cases pass QA | Annual; refresher after any gate failure |
| **Incident responder** | Severity and flags; roles and authority; containment safely; communications templates; evidence handling | Run a tabletop as commander | Twice a year |
| **Implementation consultant** | The method; rollout state machine; configuration tiers; integration patterns; UAT; go-live gate | Fresh-hands run of a sandbox tenant through phase 5 | Annual |
| **Customer success manager** | Health score; EBR; renewal; adoption; escalation | Mock EBR and renewal review | Annual |
| **Privacy operations** | Data rights; retention and holds; legal-hold interaction; request handling | Rehearsal of a full request | Annual |
| **Trust and safety, and moderators** | Policy; case handling; minors; harassment; crisis boundaries; wellbeing; appeals | Blind calibration items per [volunteer program](../../VOLUNTEER-MODERATOR-PROGRAM.md) | Twice a year |
| **Sales and partnerships** | Claims register; qualification and no-fit list; deal-desk; procurement packet | Pass a claims quiz; shadow two calls | Annual; at each claims change |
| **Privileged access holders** | Access policy; break-glass; two-person rules; logging | Access drill | Annual |

A **certification** is recorded in the training record ([TPL-24](templates.md#tpl-24-training-module-and-sign-off)): who, role, modules, assessor, date, expiry. Sensitive access is granted only with a current certification; it lapses with the certification. The `operations` seat certifies; `security` and `privacy` consult ([O-02](03-raci-and-decision-rights.md#people-and-operations)).

### New-hire onboarding

| Window | Outcome |
| --- | --- |
| Day 1 | Accounts with least privilege; read this README and the role's pages; meet the buddy |
| Week 1 | Everyone-curriculum complete; shadow the owner of the first process |
| Day 30 | Role curriculum done; first reverse-shadow run of an owned process |
| Day 60 | Runs the process alone with sampled review; first improvement to a page |
| Day 90 | Certified for the role; included in the rota where the stage requires |

### Customer-side training

Training for customers is part of implementation phase 6 ([02](02-implementation-methodology.md#phase-6--train)) and is owned by `success`.

| Audience | Content | Format | Evidence |
| --- | --- | --- | --- |
| Institution administrators | Configuration, roles and policy, integrations and health, audit and exports, support routing, offboarding | Live session, recorded; guide; sandbox practice | Attendance and task sign-off |
| Support-desk staff | Triage, the taxonomy, what Semester support will and will not do, escalation to Semester | Live session; macros; practice cases | Practical sign-off |
| Faculty and TAs | Course setup, AI policy settings, grading flow, accessibility, integrity | Short sessions; quick start; office hours | Completion |
| Advisors | Agenda and caseload tools, source freshness, appropriate use | Quick start; scenario practice | Completion |
| Students | First win, privacy controls, help | In-product guidance; short guide | Activation |
| IT and identity | Connector health, reconciliation, incident contacts | Technical walkthrough | Test of failover contact |

All training is accessible: captions and transcripts, keyboard-operable materials, plain language, alternative formats on request.

## Enablement

### Sales, partnership and marketing enablement

| Asset | Source of truth | Gate |
| --- | --- | --- |
| Positioning and messaging | [`POSITIONING-AND-MESSAGING`](../../commercial/POSITIONING-AND-MESSAGING.md) | Claims register |
| Demo scripts | [`DEMO-SCRIPT-EXECUTIVE`](../../commercial/DEMO-SCRIPT-EXECUTIVE.md) and siblings | Demo uses synthetic data only; shows only what runs |
| Procurement packet | [`TRUST-CENTER`](../../TRUST-CENTER.md); [`HIGHER-ED-RFP-RESPONSE-LIBRARY`](../../HIGHER-ED-RFP-RESPONSE-LIBRARY.md) | Counsel and domain seats approve answers |
| Objection handling | [`OBJECTION-HANDLING`](../../market-readiness/OBJECTION-HANDLING.md) | Evidence-backed only |
| Customer references and case studies | [Reference program](../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md) | Written rights-holder permission per claim, channel and term |

Anyone speaking for Semester uses claims from the register. A claim not in it is not made. A prospect's question the register cannot answer is logged and answered after review, not improvised.

### Internal enablement

A monthly *what changed* note: releases, policy changes, new known issues, new runbooks and exercises. A quarterly *show and tell* where an owner walks through a process with a live example. A running list of the five most common internal questions and their answers.

## Knowledge management

| Practice | Rule |
| --- | --- |
| **Capture** | Decisions in `docs/decisions/` and the private log; lessons in reviews and closeouts; customer-specific facts in the private system. Nothing important lives only in a head, a chat or a personal inbox. |
| **Ownership** | Every page has a seat and a backup; an orphan page is reassigned or archived at the monthly review. |
| **Findability** | One index ([`SEMESTER-OPERATING-SYSTEM`](../../../SEMESTER-OPERATING-SYSTEM.md)); descriptive titles; links over copies. Facts that change are linked, not copied. |
| **Supersession** | New page links to what it replaces; the old page gets a pointer; nothing is silently deleted. |
| **Recorded walkthroughs** | The founder records walkthroughs of anything held only in their head ([11](11-founder-to-team-transition.md)); transcripts are filed with the page. |
| **Retention** | Per [`RECORDS-RETENTION-SCHEDULE-DRAFT`](../../company/RECORDS-RETENTION-SCHEDULE-DRAFT.md); legal holds override. |
| **Handover** | A leaving person completes a transfer record and a runbook exercise for each process they own. |

## Metrics

| Measure | Target (SL0) | Source |
| --- | --- | --- |
| Pages past review date | at most 5% | Document index |
| Runbooks exercised in the last 12 months | 100% of tier-1 runbooks | Runbook headers |
| Roles with current certification where required | 100% | Training record |
| Release rows with an open documentation item at promotion | 0 | Release review |
| Orphan pages | 0 | Monthly review |
| Time for a new hire to first certified process | at most 90 days | Training record |

## Related

[Templates TPL-23 to TPL-25](templates.md) · [04 Quality assurance](04-support-operating-model.md#quality-assurance) · [11 Founder transition](11-founder-to-team-transition.md)
