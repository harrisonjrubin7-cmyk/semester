# Operational maturity

<!-- Rendered from app/src/lib/governance/maturity.ts by maturity.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

The last twenty areas of running a platform for universities that a feature
list never mentions, each broken into the controls a reviewer would ask for
and each control marked with what the tree holds. A control that claims to
exist cites a file, and the file exists; an owed control says what would
close it. Nothing here is a promise of a date.

**43 of 200 controls are in place, 80 are partial and 77 are owed.**
Nothing at all is in place in 7 areas: Records management and legal holds; E-discovery and export defensibility; Accessibility of generated content; Physical security and device management; Cost governance; Data residency; Disaster scenarios beyond technology.
Most owed controls wait on something that does not exist yet — a company,
a second person, billing, an assessment engine, a customer — and the note
says which.

## How to read an area

Each opens with the **stance**: the one sentence the company is held to,
whatever the checklist says. **Exposure** says who may see the area’s
working material — `internal` never reaches general staff or students.
**Owner** is a seat of the [launch readiness council](../LAUNCH-READINESS-COUNCIL.md),
never a person; every seat is vacant.

## The areas

| Area | In place | Partial | Owed | Exposure | Owner |
| --- | ---: | ---: | ---: | --- | --- |
| [Records management and legal holds](#records-management-and-legal-holds) | 0 | 8 | 1 | `internal` | `privacy` |
| [E-discovery and export defensibility](#e-discovery-and-export-defensibility) | 0 | 4 | 7 | `internal` | `privacy` |
| [Accessibility of generated content](#accessibility-of-generated-content) | 0 | 4 | 4 | `public` | `accessibility` |
| [Content rights, copyright and licensing](#content-rights-copyright-and-licensing) | 2 | 5 | 4 | `staff` | `data` |
| [Accreditation and assessment evidence](#accreditation-and-assessment-evidence) | 1 | 3 | 5 | `staff` | `product` |
| [Learning analytics ethics](#learning-analytics-ethics) | 6 | 4 | 1 | `public` | `privacy` |
| [Accommodations across the lifecycle](#accommodations-across-the-lifecycle) | 5 | 4 | 2 | `staff` | `accessibility` |
| [Minors, guardians and dual enrollment](#minors-guardians-and-dual-enrollment) | 3 | 3 | 4 | `staff` | `privacy` |
| [Digital-accessibility procurement law](#digital-accessibility-procurement-law) | 1 | 3 | 3 | `staff` | `accessibility` |
| [Physical security and device management](#physical-security-and-device-management) | 0 | 0 | 11 | `internal` | `security` |
| [Developer experience and engineering productivity](#developer-experience-and-engineering-productivity) | 7 | 4 | 1 | `staff` | `engineering` |
| [Cost governance](#cost-governance) | 0 | 4 | 6 | `internal` | `founder` |
| [Cloud-provider exit](#cloud-provider-exit) | 2 | 4 | 4 | `staff` | `engineering` |
| [Accessibility and security of internal tools](#accessibility-and-security-of-internal-tools) | 2 | 4 | 2 | `staff` | `accessibility` |
| [Data residency](#data-residency) | 0 | 2 | 8 | `staff` | `security` |
| [Ethics of growth and pricing](#ethics-of-growth-and-pricing) | 4 | 3 | 3 | `public` | `founder` |
| [Disaster scenarios beyond technology](#disaster-scenarios-beyond-technology) | 0 | 6 | 5 | `internal` | `founder` |
| [Adoption and change management](#adoption-and-change-management) | 4 | 6 | 1 | `staff` | `success` |
| [Documentation resilience](#documentation-resilience) | 1 | 4 | 4 | `staff` | `engineering` |
| [Market and competitive intelligence](#market-and-competitive-intelligence) | 5 | 5 | 1 | `internal` | `founder` |

## Records management and legal holds

> A legal hold overrides every deletion job, and deletion resumes when the hold is released — both proven, not assumed.

Exposure `internal` · owner `privacy` · 0 of 9 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| RM-01 | Records-retention schedule by data class. | partial | [`RETENTION.md`](../../RETENTION.md) | Retention is stated per table and per device store. It is not organised by data class, and financial, audit and security records are not yet classes of their own. |
| RM-02 | Legal-hold workflow. | partial | [`supabase/legal-holds.check.sql`](../../supabase/legal-holds.check.sql) | A hold table, a placing capability limited to the account’s own school, and a platform hold only an operator places (`20260930100000_legal_holds.sql`); 42 checks. No screen places one and no runbook says when counsel should. |
| RM-03 | Litigation and investigation preservation workflow. | owed | — | Would follow the hold workflow; nothing preserves a snapshot of an account on request today. |
| RM-04 | A hold overrides deletion jobs. | partial | [`supabase/legal-holds.check.sql`](../../supabase/legal-holds.check.sql) | The three retention sweeps skip what a live hold covers, and `erase_account` refuses a held account before it touches a row (`20260930140000_erase_respects_holds.sql`), and a trigger on `auth.users` is the backstop. A platform-wide hold pauses the AI-runtime and Community sweeps (`private.run_sweep`), and a school or account hold keeps its own rows in them (20260930170000): exercised on AI metadata, restrictions and safety entries, held by a test on the rest. On-device deletion (`deleteEverything`) checks nothing. |
| RM-05 | Hold release process. | partial | [`supabase/legal-holds.check.sql`](../../supabase/legal-holds.check.sql) | Released by a different person holding `hold:release`, with a reason, once; the row is never deleted or edited, so the placement and release are the record. A school with one administrator cannot release its own hold and must use break-glass. No runbook yet. |
| RM-06 | Retention owner and review cadence. | partial | [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md) | The operating system names the privacy seat as owner of data inventory and lineage, quarterly. The seat is vacant. |
| RM-07 | Customer notification where contractually required. | partial | [`docs/operating-model/INCIDENT-COMMUNICATIONS.md`](INCIDENT-COMMUNICATIONS.md) | Notice templates exist for incidents. None exists for a hold, a preservation request or a lawful-access request. |
| RM-08 | Proof that deletion resumes correctly after a hold is released. | partial | [`supabase/legal-holds.check.sql`](../../supabase/legal-holds.check.sql) | Proved for the abandoned-sign-up, audit and invite sweeps and for a student’s own erasure through `erase_account`: each stops for a hold and runs again once it is released. Proved for the AI-runtime and Community sweeps under a platform hold only. |
| RM-09 | Financial, audit and security records kept apart from student-content retention. | partial | [`RETENTION.md`](../../RETENTION.md) | Audit and access logs have their own retention lines. Financial records have their own class: kept seven years after the end of the year they were made, then purged monthly for individual subscribers (D-132; `20260929130000_financial_retention.sql`, scheduled in `supabase/scheduler.sql`). An institution’s records follow its contract. Student-account ledgers (D-146) await a school-set schedule; the ledger has no purge. |

## E-discovery and export defensibility

> A controlled export is requested by a verified person, scoped, approved, hashed, delivered securely and logged; it is never a general staff tool.

Exposure `internal` · owner `privacy` · 0 of 11 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| ED-01 | Authorised-requester verification. | owed | — | The only export today is a student’s own (`exportAccount`). No path exists for an institution’s verified requester. |
| ED-02 | Scope definition for a controlled export. | owed | — | Needs a request object naming accounts, date range and data classes, approved before anything is read. |
| ED-03 | Search and filter criteria. | owed | — | Follows ED-02; the criteria are part of the request, recorded with it. |
| ED-04 | Export approval. | partial | [`app/src/lib/ops/commitments.ts`](../../app/src/lib/ops/commitments.ts) | The commitments register shows the approval shape the company uses: a named seat, dated, recorded. No export approval uses it yet. |
| ED-05 | Chain of custody. | owed | — | Who handled the export, when, and what they did with it — a log that does not exist because the export does not. |
| ED-06 | Hash or checksum of what was delivered. | partial | [`app/src/lib/workspace-backup.ts`](../../app/src/lib/workspace-backup.ts) | A student’s own backup is a plain JSON file with no digest. A defensible export needs a recorded hash. |
| ED-07 | Redaction process. | owed | — | Other students’ data inside a shared object (a group, a thread) would need redacting before delivery. No process. |
| ED-08 | Secure delivery. | partial | [`docs/SECURITY-ACCESSIBILITY-READINESS.md`](../SECURITY-ACCESSIBILITY-READINESS.md) | The trust packet is shared by expiring link to named reviewers and recorded. The same mechanism would carry an export; none has. |
| ED-09 | Access log for the export. | partial | [`supabase/support-access.check.sql`](../../supabase/support-access.check.sql) | Support access to a student’s account is granted, time-limited and logged. An export is not a support grant and has no log. |
| ED-10 | Retention and deletion after delivery. | owed | — | How long the company keeps its copy of a delivered export, and the proof it was deleted. |
| ED-11 | Export metadata and evidence report. | owed | — | A report naming the request, scope, approver, hash, delivery and deletion. Follows all of the above. |

## Accessibility of generated content

> Nothing Semester generates is called accessible until it has been checked; the check is part of generating it.

Exposure `public` · owner `accessibility` · 0 of 8 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| GA-01 | Generated images require an alt-text prompt. | owed | — | Figures generated for a course (`lib/figures` and the study guide) carry captions; nothing requires or checks an alt text before the figure is saved. |
| GA-02 | Generated slides require a reading-order and contrast check. | owed | — | The deck maker produces slides with no reading-order or contrast check on output. |
| GA-03 | Generated documents require heading, link and table checks. | owed | — | The essay and write tools export text; no structural check runs on the export. |
| GA-04 | Generated charts require a data table, labels, units and a text summary. | partial | [`app/src/a11y/tellings.test.ts`](../../app/src/a11y/tellings.test.ts) | The app’s own charts are held to “never colour alone”. A chart a student generates from a sheet is not checked for a data table or a summary. |
| GA-05 | Generated video requires a caption and transcript workflow. | partial | [`app/src/lib/webvtt.ts`](../../app/src/lib/webvtt.ts) | Captions are produced as WebVTT and attached with `<track>`. Nothing refuses a video that has none. |
| GA-06 | Generated equations have accessible math rendering. | owed | — | Equations render visually; no MathML or spoken form is produced. |
| GA-07 | Generated quiz items use accessible question structures. | partial | [`app/scripts/labels.mjs`](../../app/scripts/labels.mjs) | Every control in the drill and quiz screens has a name, checked by the label rule. Question structure (grouping, instructions before choices) is not checked. |
| GA-08 | AI does not claim generated output is accessible without validation. | partial | [`app/src/lib/source.ts`](../../app/src/lib/source.ts) | AI-assisted output is labelled as AI-assisted. No output is labelled accessible, which is the right default until a check exists. |

## Content rights, copyright and licensing

> Every piece of course material carries who owns it, what may be done with it, and when that ends.

Exposure `staff` · owner `data` · 2 of 11 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| CR-01 | Content ownership metadata. | partial | [`app/src/lib/where.ts`](../../app/src/lib/where.ts) | Every row carries where it came from (official, connected, made, yours, sample, stale). That is provenance, not ownership: nothing records who holds the copyright. |
| CR-02 | Faculty and institution permission status. | partial | [`supabase/coursestudio.check.sql`](../../supabase/coursestudio.check.sql) | Course Studio records what an instructor published and to whom. A syllabus a student uploads carries no permission status. |
| CR-03 | Copyright and licensing classification. | owed | — | No field classifies a piece of material as the institution’s, the publisher’s, open, or unknown. |
| CR-04 | Library-licence restrictions. | owed | — | Library-licensed readings are indistinguishable from any other upload. |
| CR-05 | Course-material access boundary. | in place | [`supabase/tenancy.check.sql`](../../supabase/tenancy.check.sql) | A student’s uploaded material is their own; row-level policy keeps it from every other account, tested as a second account in every build. |
| CR-06 | AI-use eligibility by content type. | partial | [`app/src/screens/settings/Assistant.tsx`](../../app/src/screens/settings/Assistant.tsx) | The student decides what the assistant may see. No content type is ineligible on its own account (a licensed reading, an exam). |
| CR-07 | Download and export restriction. | owed | — | Everything a student holds exports; nothing marks a piece as not-for-export because of its licence. |
| CR-08 | Citation and source attribution. | in place | [`app/src/lib/cite.ts`](../../app/src/lib/cite.ts) | Every card and answer built from material cites the piece it came from, and the assistant shows its sources. |
| CR-09 | Content takedown and DMCA process. | owed | — | No published address, no form, no runbook for a rights-holder’s notice. |
| CR-10 | Expiry at course end or licence end. | partial | [`app/src/lib/rollover.ts`](../../app/src/lib/rollover.ts) | A term can be closed and archived. Nothing expires a piece of material on a licence date. |
| CR-11 | Revoke and re-index after removal. | partial | [`app/src/lib/changeset.ts`](../../app/src/lib/changeset.ts) | Removing a source removes the cards built from it. AI retrieval has no index to purge because retrieval reads the student’s own material at answer time. |

## Accreditation and assessment evidence

> Semester is not an accreditation authority. It helps an institution organise and export evidence it has approved.

Exposure `staff` · owner `product` · 1 of 9 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| AC-01 | Outcome and competency mapping. | owed | — | No competency model exists; requirements are the student’s own degree requirements, typed in. |
| AC-02 | Assessment evidence collection. | owed | — | There is no assessment engine (edge-case catalog EC-LMS-02), so nothing to collect. |
| AC-03 | Rubric and artefact alignment. | owed | — | No rubrics (EC-LMS-05). |
| AC-04 | Programme-level aggregate reporting. | partial | [`docs/COURSE-DEMAND-FORECASTING.md`](../COURSE-DEMAND-FORECASTING.md) | Course-demand snapshots report only at n ≥ 10. The same suppression rule would govern programme reporting; no programme report exists. |
| AC-05 | Faculty review workflow. | partial | [`docs/FACULTY-COURSE-STUDIO-DESIGN.md`](../FACULTY-COURSE-STUDIO-DESIGN.md) | Course Studio has a publish step by the instructor. Review of evidence by faculty is not a workflow. |
| AC-06 | Accreditation export and report templates. | owed | — | None. Would be written with the first institution that asks, from its accreditor’s template, never from ours. |
| AC-07 | Evidence retention and audit trail. | owed | — | Follows RM-01: accreditation evidence would be a retention class with its own line. |
| AC-08 | Privacy thresholds on aggregate evidence. | in place | [`docs/COURSE-DEMAND-FORECASTING.md`](../COURSE-DEMAND-FORECASTING.md) | Aggregate-only, n ≥ 10, enforced in code and in the database, for the one aggregate that exists. |
| AC-09 | Methodology and interpretation notes on every report. | partial | [`docs/PROOF-CALENDAR.md`](../PROOF-CALENDAR.md) | The proof standard requires methodology, cohort, timeframe and limitations beside any measure. No accreditation report exists to carry them. |

## Learning analytics ethics

> No predictive-risk label is ever attached to a student, and no metric is collected that is not on the approved list.

Exposure `public` · owner `privacy` · 6 of 11 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| LA-01 | Learning-analytics policy. | in place | [`docs/PRODUCT-ANALYTICS-DATA-ETHICS.md`](../PRODUCT-ANALYTICS-DATA-ETHICS.md) | What is measured, what is promised never to be measured, and the test that holds each promise. |
| LA-02 | Approved metric catalog. | in place | [`ANALYTICS.md`](../../ANALYTICS.md) | Exactly three server marks (opened, course, studied), enforced by a check constraint; each new mark needs its own PR and owner review (D-005). |
| LA-03 | Prohibited metric catalog. | in place | [`docs/ANALYTICS-EVENTS.md`](../ANALYTICS-EVENTS.md) | “What is never collected”: titles, anything typed, per-screen or per-session data, time of day, an identifiable clarity answer. |
| LA-04 | Student transparency notice. | in place | [`app/src/lib/privacy.ts`](../../app/src/lib/privacy.ts) | The privacy screen states every field the sync sends, checked by test against what it actually sends. |
| LA-05 | Opt-in where needed. | partial | [`app/src/lib/usage.ts`](../../app/src/lib/usage.ts) | On-device screen counts have a toggle. Server marks have none because they are presence-only; a richer mark would need consent, and D-005 says so. |
| LA-06 | Aggregation and suppression rules. | in place | [`docs/COURSE-DEMAND-FORECASTING.md`](../COURSE-DEMAND-FORECASTING.md) | n ≥ 10 on the one aggregate table, in code and in the database. |
| LA-07 | No individual predictive-risk labelling. | in place | [`docs/PRODUCT-ANALYTICS-DATA-ETHICS.md`](../PRODUCT-ANALYTICS-DATA-ETHICS.md) | Promised in the policy and in the public site’s product page: Semester does not score students or predict grades. No model in the tree does. |
| LA-08 | Human review for any high-impact intervention. | partial | [`docs/operating-model/AI-LIFECYCLE-GATES.md`](AI-LIFECYCLE-GATES.md) | The AI gates require human review before a use case reaches production. No intervention exists to review. |
| LA-09 | Bias and fairness review. | partial | [`docs/EQUITY-REVIEW.md`](../EQUITY-REVIEW.md) | Fifteen ranking and recommending surfaces are reviewed and gated (D-1019), with the owner as named reviewer and not independently, with eight findings open; no outcome is measured because no demographic data reaches this code (the owner says some is collected; the repository cannot confirm it), and the AI recommendation evaluation harness is designed and not run. |
| LA-10 | Research versus operational analytics kept separate. | owed | — | No research use exists and no policy says how one would be approved, consented and separated. |
| LA-11 | Faculty and advisor dashboard scope controls. | partial | [`supabase/expansion.check.sql`](../../supabase/expansion.check.sql) | An advisor sees only what a student shared, for as long as they shared it. There is no dashboard, so no dashboard scope. |

## Accommodations across the lifecycle

> An accommodation is a functional summary the student controls, never a diagnosis, and nobody sees it who was not granted it.

Exposure `staff` · owner `accessibility` · 5 of 11 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| AP-01 | Disability-services issuer workflow. | owed | — | The accommodation share is student-created. No issuer role for a disability-services office exists. |
| AP-02 | Functional accommodation summary only, no diagnosis. | in place | [`docs/CONSENT-SHARING-DESIGN.md`](../CONSENT-SHARING-DESIGN.md) | The design holds the share to functional terms and the schema has no diagnosis field. |
| AP-03 | Student-controlled sharing by recipient, course and term. | in place | [`supabase/expansion.check.sql`](../../supabase/expansion.check.sql) | accommodation_shares name the recipient and carry expiry; the student creates and revokes. |
| AP-04 | Time-limited shares. | in place | [`supabase/expansion.check.sql`](../../supabase/expansion.check.sql) | Every share carries an expiry the policy enforces. |
| AP-05 | Instructor access through an audited function. | partial | [`supabase/expansion.check.sql`](../../supabase/expansion.check.sql) | Reads are policy-gated. Whether each read is logged as an access event is not yet tested. |
| AP-06 | Student read-history view. | partial | [`app/src/lib/cloud.ts`](../../app/src/lib/cloud.ts) | Access logs exist for advisor shares (`readAccessLog`). No screen shows a student who read an accommodation share. |
| AP-07 | Immediate revoke. | in place | [`supabase/expansion.check.sql`](../../supabase/expansion.check.sql) | Revocation stops the next read; tested. |
| AP-08 | Assessment accommodation application. | owed | — | No assessment engine, so no extra time or alternative format to apply (EC-LMS-04). |
| AP-09 | Course-material accessibility support. | partial | [`app/src/lib/speak.ts`](../../app/src/lib/speak.ts) | Read-aloud exists in one screen; text size, spacing and typeface are settings. Alternative formats of a specific upload are not produced. |
| AP-10 | Expiry and renewal workflow. | partial | [`supabase/expansion.check.sql`](../../supabase/expansion.check.sql) | Expiry is enforced. Renewal is a new share; nothing prompts before expiry. |
| AP-11 | No unauthorised staff visibility. | in place | [`supabase/expansion.check.sql`](../../supabase/expansion.check.sql) | Row-level policy: only the named recipient, within the window. |

## Minors, guardians and dual enrollment

> No feature that matches, reviews or messages is open to a minor until guardian consent and the age-of-majority transition are built.

Exposure `staff` · owner `privacy` · 3 of 10 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| MN-01 | Source for minor age or status. | in place | [`supabase/minimum-age.check.sql`](../../supabase/minimum-age.check.sql) | Stated at sign-up or once afterwards, never changed; only the day a minor turns 18 is kept (D-139). Self-reported, so it is a stated age, not a verified one. |
| MN-02 | Guardian consent where required. | owed | — | No guardian model. The supporter and family privacy model says it needs the minors decision before building. |
| MN-03 | Age-of-majority transition. | in place | [`supabase/minimum-age.check.sql`](../../supabase/minimum-age.check.sql) | The restriction lifts on the 18th birthday with nothing to run. Nobody is told; the Account screen stops saying it. |
| MN-04 | Dual-enrollment sharing rules. | owed | — | A high-school student in a university course would be a minor in an institutional tenant; no rule exists. |
| MN-05 | Parent and supporter limited-grant model. | partial | [`docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md`](../SUPPORTER-FAMILY-PRIVACY-MODEL.md) | The model is designed: a student grants a supporter a limited view. Built for adults’ supporters, not for guardians of minors. |
| MN-06 | Restricted career matching, reviews and messaging for minors. | in place | [`supabase/minimum-age.check.sql`](../../supabase/minimum-age.check.sql) | A minor is not a verified student, so every policy that asks refuses; mentor requests, connections, study matching and employer opt-in refuse by trigger. Reporting and guardian sharing stay open. |
| MN-07 | Consent renewal and expiry. | owed | — | Follows MN-02: a consent that never expires is not a consent. |
| MN-08 | Safe communications policy. | partial | [`docs/COMMUNITY-MEDIA-SAFETY.md`](../COMMUNITY-MEDIA-SAFETY.md) | Community safety rules exist for all users. Nothing is specific to minors. |
| MN-09 | Identity and guardian verification where necessary. | owed | — | No verification path for a guardian. |
| MN-10 | State and jurisdiction review. | partial | [`docs/FERPA-COPPA-1EDTECH-READINESS.md`](../FERPA-COPPA-1EDTECH-READINESS.md) | COPPA is in the readiness register. State-by-state student-privacy law is not reviewed. |

## Digital-accessibility procurement law

> Accessibility law and procurement rules are read quarterly, and a product change that would change the conformance report is tracked as one.

Exposure `staff` · owner `accessibility` · 1 of 7 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| LW-01 | Monitor ADA Title II and public-sector digital-access obligations. | partial | [`docs/operating-model/ACCESSIBILITY-GOVERNANCE.md`](ACCESSIBILITY-GOVERNANCE.md) | The council’s charter names WCAG 2.2 AA as the bar, which is what the Title II rule adopts. No watch process is scheduled. |
| LW-02 | Monitor Section 508 and state accessibility requirements. | owed | — | Not tracked; would join LW-01 as one quarterly reading. |
| LW-03 | Track university VPAT and ACR requirements. | in place | [`docs/trust/HECVAT-VPAT-PLAN.md`](../trust/HECVAT-VPAT-PLAN.md) | The VPAT/ACR checklist and the 90-day plan to a first report. |
| LW-04 | Update contract clauses and VPAT scope with the product. | owed | — | No contract exists to carry a clause; the pilot agreement outline has no accessibility clause yet. |
| LW-05 | Review the accessibility policy at least quarterly. | partial | [`docs/operating-model/OPERATING-RHYTHM.md`](OPERATING-RHYTHM.md) | A quarterly policy review is in the rhythm. The seat is vacant and none has happened. |
| LW-06 | Track product changes that require an ACR update. | owed | — | Would follow the first ACR: a release note field saying whether the change touches a reported criterion. |
| LW-07 | Keep the accessibility vendor and subprocessor review current. | partial | [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) | Subprocessors are registered and held to the content-security policy. Their accessibility (of anything user-facing) is not reviewed. |

## Physical security and device management

> The people who operate the platform work from managed, encrypted, lockable devices, or not on production.

Exposure `internal` · owner `security` · 0 of 11 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| DV-01 | Company device-management policy. | owed | — | The company is a single-member LLC by the owner’s attestation (HECVAT COMP-01, 28 September) and has no device policy. One founder’s device operates everything. |
| DV-02 | Disk encryption. | owed | — | Not attested. Would be the first line of DV-01. |
| DV-03 | Endpoint protection. | owed | — | Not attested. |
| DV-04 | Screen lock and password policy. | owed | — | Not attested. |
| DV-05 | Remote wipe. | owed | — | Not attested. |
| DV-06 | Asset inventory. | owed | — | None; a one-line list of devices is the whole control at this size. |
| DV-07 | Secure disposal. | owed | — | None; nothing has been disposed of yet. |
| DV-08 | BYOD rules. | owed | — | None; every device is personal today, which is the problem. |
| DV-09 | Secure Wi-Fi and network policy. | owed | — | None written; would be a line in DV-01. |
| DV-10 | Physical document handling. | owed | — | None; nothing is printed, which is not a policy. |
| DV-11 | Visitor and access policy, if offices exist. | owed | — | No office exists, so none is needed yet. |

## Developer experience and engineering productivity

> Shipping safely and quickly are the same discipline: a standard environment, synthetic data, flags, previews and measured lead time.

Exposure `staff` · owner `engineering` · 7 of 12 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| DX-01 | Local development environment standard. | in place | [`SETUP.md`](../../SETUP.md) | One documented setup; the gates are listed in CLAUDE.md and REGRESSION-CHECKLIST.md. |
| DX-02 | Seed and synthetic data tooling. | in place | [`app/src/data/institutional-preview.ts`](../../app/src/data/institutional-preview.ts) | Synthetic institutions and personas for the demo and the institutional preview; the sample semester ships with the app. |
| DX-03 | Developer sandbox. | in place | [`STAGING.md`](../../STAGING.md) | A staging project and a preview build, with the demo built to /demo/ on every deploy. |
| DX-04 | Test data policy. | partial | [`docs/PSEUDONYMITY-POLICY.md`](../PSEUDONYMITY-POLICY.md) | Fixtures are synthetic and the preview has no account service. No written rule forbids production data in tests. |
| DX-05 | API mocks. | in place | [`app/vite.config.ts`](../../app/vite.config.ts) | The mocked test project and its allow-listed modules; the gateway smoke script runs against a local server. |
| DX-06 | Feature-flag workflow. | in place | [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md) | Every flag in `lib/flags.ts` is in the registry, held by test. |
| DX-07 | Preview environment per pull request. | partial | [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml) | Main deploys the product and the demo. No per-PR preview URL. |
| DX-08 | Migration test harness. | in place | [`docs/LAUNCH-HARDENING-REPORT.md`](../LAUNCH-HARDENING-REPORT.md) | Migrations run twice in CI and every policy has a check file. |
| DX-09 | Code ownership. | owed | — | No CODEOWNERS file; one person owns everything. |
| DX-10 | Architecture decision records. | in place | [`docs/architecture/README.md`](../architecture/README.md) | Ten ADRs, indexed. |
| DX-11 | Internal developer portal. | partial | [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md) | The operating system links the authoritative version of everything. It is a page, not a portal, and that is enough at this size. |
| DX-12 | Engineering metrics: lead time, deployment frequency, change failure rate, MTTR. | partial | [`ROLLBACK.md`](../../ROLLBACK.md) | Deploys are per merge and rollbacks are recorded, which gives frequency and failure rate on inspection. Nothing computes them. |

## Cost governance

> Every dollar of cloud and AI spend is attributable to a tenant, a module or an environment, and an anomaly is noticed before the invoice.

Exposure `internal` · owner `founder` · 0 of 10 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| FO-01 | Cloud cost allocation by tenant, module and environment. | owed | — | One Supabase project, one AI gateway; no tags, no allocation. |
| FO-02 | AI cost allocation by use case, model and tenant. | partial | [`docs/architecture/0004-ai-through-a-metered-gateway.md`](../architecture/0004-ai-through-a-metered-gateway.md) | AI runs through a metered gateway with per-account limits. Cost is not rolled up by use case or tenant. |
| FO-03 | Budget and alert thresholds. | owed | — | No budget is set on any provider. |
| FO-04 | Cost anomaly detection. | owed | — | None; follows FO-03, since an anomaly is measured against a budget. |
| FO-05 | Storage lifecycle controls. | partial | [`RETENTION.md`](../../RETENTION.md) | Retention says how long things are kept. No lifecycle rule moves or expires storage automatically. |
| FO-06 | Egress monitoring. | owed | — | None; the provider’s dashboard is read by hand, if at all. |
| FO-07 | Idle environment cleanup. | owed | — | None; there is one environment. |
| FO-08 | Vendor spend review. | partial | [`docs/trust/VENDOR-RISK-REGISTER.md`](../trust/VENDOR-RISK-REGISTER.md) | Vendors are registered for risk, not for spend. |
| FO-09 | Unit-cost model: per active student, course, AI action, integration, assessment. | partial | [`docs/operating-model/COMMERCIAL-GOVERNANCE.md`](COMMERCIAL-GOVERNANCE.md) | Commercial governance names the drivers. No unit cost is measured. |
| FO-10 | Margin guardrails. | owed | — | Nothing is sold, so there is no margin to guard; the rule should exist before the first invoice. |

## Cloud-provider exit

> No provider is assumed permanent: data is exportable in open formats and every environment can be recreated from code.

Exposure `staff` · owner `engineering` · 2 of 10 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| EX-01 | Cloud and provider dependency inventory. | in place | [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) | Every third party data can reach, held to the content-security policy by test. |
| EX-02 | Data export format. | in place | [`docs/DATA-PORTABILITY-AND-OFFBOARDING.md`](../DATA-PORTABILITY-AND-OFFBOARDING.md) | Open formats for a student and for an institution, and what offboarding removes. |
| EX-03 | Infrastructure as code. | partial | [`MIGRATION-HISTORY.md`](../../MIGRATION-HISTORY.md) | The database is fully described by migrations. Project settings, auth configuration and DNS are not in code. |
| EX-04 | Environment recreation procedure. | partial | [`RESTORE.md`](../../RESTORE.md) | A restore into a disposable project is written down; a timed rehearsal is owed (proof calendar month 1). |
| EX-05 | Provider outage plan. | partial | [`docs/market-readiness/DISASTER_RECOVERY.md`](../market-readiness/DISASTER_RECOVERY.md) | Marked NOT_STARTED in its own words; the app keeps working on the device without the provider, which is the real plan today. |
| EX-06 | Alternate provider assessment. | owed | — | None has been assessed; the exit plan is the export format and the migrations (EX-02, EX-03). |
| EX-07 | Database migration playbook. | partial | [`docs/market-readiness/MIGRATION_PLAYBOOK.md`](../market-readiness/MIGRATION_PLAYBOOK.md) | Written for moving an institution’s data in, not for moving Semester’s database out. |
| EX-08 | Object-storage migration plan. | owed | — | None; uploaded files live in the provider’s storage with no copy elsewhere. |
| EX-09 | DNS and CDN transition plan. | owed | — | The app is on GitHub Pages under the repository’s address; no custom domain, so no transition to plan yet. |
| EX-10 | Contract and termination review. | owed | — | No provider contract has been reviewed for termination terms. |

## Accessibility and security of internal tools

> The Operations Console and the customer portal meet the same accessibility and security bar as the student app.

Exposure `staff` · owner `accessibility` · 2 of 8 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| IT-01 | WCAG 2.2 testing for console workflows. | partial | [`app/scripts/accessibility-smoke.mjs`](../../app/scripts/accessibility-smoke.mjs) | The axe run covers the app’s screens, staff screens included, since they are the same app. No separate console exists. |
| IT-02 | Keyboard support for incident, support and approval flows. | partial | [`app/src/screens/Moderation.test.tsx`](../../app/src/screens/Moderation.test.tsx) | The moderation console is tested for keyboard use. Support tickets and approvals are screens of the same app under the same rules. |
| IT-03 | Screen-reader-accessible tables and charts. | in place | [`app/src/a11y/tellings.test.ts`](../../app/src/a11y/tellings.test.ts) | Nothing is said with colour alone, across every screen. |
| IT-04 | Accessible document room. | partial | [`app/src/screens/TrustRoom.tsx`](../../app/src/screens/TrustRoom.tsx) | The NDA room is an app screen and inherits the app’s checks. Its documents are Markdown, which reads well; no PDF is served. |
| IT-05 | Accessible customer implementation materials. | partial | [`docs/LAUNCH-CONTENT-AND-TRAINING.md`](../LAUNCH-CONTENT-AND-TRAINING.md) | Materials are plain text and Markdown. No check of the slides or recordings a launch would produce. |
| IT-06 | Accessible internal training. | owed | — | No internal training exists. |
| IT-07 | Role-specific accessibility testing. | owed | — | The smoke run drives a student. Faculty, advisor and staff journeys are not driven. |
| IT-08 | High-contrast and zoom support. | in place | [`app/src/lib/contrast.test.ts`](../../app/src/lib/contrast.test.ts) | Every ground is measured against every surface, and the OS high-contrast preference raises the tokens; 200% zoom is in the accessibility baseline. |

## Data residency

> Where data lives, where it is backed up and where keys are held are decided and written down before an enterprise contract is signed.

Exposure `staff` · owner `security` · 0 of 10 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| DR-01 | Supported regions. | partial | [`app/src/lib/privacy.ts`](../../app/src/lib/privacy.ts) | The privacy screen states the one region the project runs in. No second region is offered. |
| DR-02 | Customer region selection. | owed | — | Not offered; there is one region to choose. |
| DR-03 | Backup region. | owed | — | Backups are the provider’s, in the same region. |
| DR-04 | Encryption-key location. | owed | — | Provider-managed; not stated to customers. |
| DR-05 | Subprocessor locations. | partial | [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) | Each subprocessor is named; its processing region is not recorded for every row. |
| DR-06 | Cross-border transfer mechanism. | owed | — | No non-US customer, no mechanism. |
| DR-07 | Tenant migration between regions. | owed | — | Not offered; follows DR-02. |
| DR-08 | Regional incident and support model. | owed | — | One model, one time zone. |
| DR-09 | Contract language. | owed | — | Follows counsel’s DPA (trust package). |
| DR-10 | Residency evidence. | owed | — | Would be the provider’s attestation of region, filed under docs/evidence/. |

## Ethics of growth and pricing

> No dark pattern, no paywall around a student’s own data, no manipulative nudge, and every price explained before it is charged.

Exposure `public` · owner `founder` · 4 of 10 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| GR-01 | No dark patterns. | in place | [`docs/ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`](../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md) | The engagement policy names them and the test suite forbids streaks, guilt and time-in-app as an achievement. |
| GR-02 | No hidden paywall around a student’s own data. | in place | [`app/src/lib/plans.ts`](../../app/src/lib/plans.ts) | Export, deletion and saved plans are on every plan, written into the data and tested. |
| GR-03 | No manipulative student nudges. | in place | [`app/src/donotbuild.test.ts`](../../app/src/donotbuild.test.ts) | Notifications only from allow-listed files, no ad or tracking hosts, no streaks. |
| GR-04 | Fair student pricing. | partial | [`app/src/lib/plans.ts`](../../app/src/lib/plans.ts) | Free covers everything a student needs to plan; paid plans add capacity and comparison. Only Plus is on sale, in the app and on test keys, so fairness is still a design more than a record. |
| GR-05 | Transparent institutional implementation pricing. | partial | [`app/src/site/more.tsx`](../../app/src/site/more.tsx) | The public “how pricing works” page names the four drivers and what implementation includes. No price list exists. |
| GR-06 | Clear AI and usage costs. | partial | [`app/src/screens/settings/Assistant.tsx`](../../app/src/screens/settings/Assistant.tsx) | The assistant settings say what a question costs the student (nothing) and what the gateway meters. Institutional allowance terms are unwritten. |
| GR-07 | Accessible refund and cancellation. | owed | — | Cancellation reaches Stripe (D-132); the refund policy is still a proposal and is owed before a live payment. |
| GR-08 | Ambassador disclosure. | owed | — | No ambassador programme; if one starts, every ambassador discloses. |
| GR-09 | Responsible advertising and sponsorship policy. | in place | [`docs/operating-model/TRUST-BRAND-AND-LEGAL.md`](TRUST-BRAND-AND-LEGAL.md) | No advertising and no selling of student data, stated publicly and held by the no-tracking-hosts test. |
| GR-10 | Equity, access and accessibility discount policy. | owed | — | Not decided. Belongs with the first price list. |

## Disaster scenarios beyond technology

> Every scenario beyond technology has an owner, a communication plan, a fallback and a post-event review, before it happens.

Exposure `internal` · owner `founder` · 0 of 11 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| DS-01 | Founder unavailable. | partial | [`docs/operating-model/RISK-GOVERNANCE.md`](RISK-GOVERNANCE.md) | Named as a key-person risk with a mitigation. No delegate holds credentials; SECRETS.md says where they are, not who else may use them. |
| DS-02 | Entire support team unavailable. | owed | — | The support team is one person (DS-01). |
| DS-03 | Key vendor insolvency. | partial | [`docs/trust/VENDOR-RISK-REGISTER.md`](../trust/VENDOR-RISK-REGISTER.md) | Vendors are tiered. No exit plan per vendor (EX-06). |
| DS-04 | Payment provider outage. | owed | — | No payment provider. |
| DS-05 | Major public-relations event. | partial | [`docs/operating-model/INCIDENT-COMMUNICATIONS.md`](INCIDENT-COMMUNICATIONS.md) | Templates by audience exist for incidents. A press statement and a spokesperson are not among them. |
| DS-06 | Legal injunction. | owed | — | No plan; would need counsel and a hold workflow (RM-02). |
| DS-07 | Large-scale institution outage. | partial | [`docs/OFFLINE-MODE.md`](../OFFLINE-MODE.md) | The app keeps working on the device without any server. The institutional side (SSO down, SIS down) has no runbook because no institution is connected. |
| DS-08 | Ransomware or data-extortion attempt. | partial | [`docs/market-readiness/INCIDENT_RESPONSE.md`](../market-readiness/INCIDENT_RESPONSE.md) | The incident process covers a breach. A restore has not been rehearsed (proof calendar), which is the control that matters here. |
| DS-09 | Major natural disaster affecting a region. | owed | — | One region, one operator. See DR-03. |
| DS-10 | Sudden regulatory change. | partial | [`docs/operating-model/TRUST-BRAND-AND-LEGAL.md`](TRUST-BRAND-AND-LEGAL.md) | A quarterly legal review is in the rhythm. No watch process between reviews (LW-01). |
| DS-11 | Critical employee departure. | owed | — | No employee; the founder case is DS-01. |

## Adoption and change management

> Institutional change is a people problem: stakeholders mapped, champions named, resistance heard, adoption measured by role.

Exposure `staff` · owner `success` · 4 of 11 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| AD-01 | Stakeholder mapping. | in place | [`docs/INSTITUTIONAL-CHANGE-MANAGEMENT.md`](../INSTITUTIONAL-CHANGE-MANAGEMENT.md) | Roles, what each fears and what each gains, by campus office. |
| AD-02 | Change-readiness assessment. | in place | [`docs/operating-model/CHANGE-MANAGEMENT.md`](CHANGE-MANAGEMENT.md) | Assess readiness, set goals, secure buy-in, implement, evaluate. |
| AD-03 | Faculty, advisor and student champion network. | partial | [`docs/LAUNCH-READINESS-COUNCIL.md`](../LAUNCH-READINESS-COUNCIL.md) | The champion seat exists and is vacant. A network of champions follows the first one. |
| AD-04 | Training reinforcement. | partial | [`docs/LAUNCH-CONTENT-AND-TRAINING.md`](../LAUNCH-CONTENT-AND-TRAINING.md) | Training content is planned by role. Reinforcement after launch is in the 90-day programme, untested. |
| AD-05 | Resistance and feedback management. | partial | [`app/src/lib/feedback.ts`](../../app/src/lib/feedback.ts) | In-app feedback reaches the team with a route shape and no personal data. Institutional resistance is a conversation, and the playbook says who has it. |
| AD-06 | Communication calendar. | partial | [`docs/90-DAY-LAUNCH-PROGRAM.md`](../90-DAY-LAUNCH-PROGRAM.md) | Communications are placed in the 90 days. Not a calendar an institution can take and fill. |
| AD-07 | Office hours. | partial | [`docs/market-readiness/HUMAN_HELP.md`](../market-readiness/HUMAN_HELP.md) | Human help is designed and off by flag. Scheduled office hours are not in it. |
| AD-08 | Role-specific success metrics. | in place | [`app/src/lib/ops/firstyear.ts`](../../app/src/lib/ops/firstyear.ts) | First-year measures by role, with the baseline each needs. |
| AD-09 | Adoption barriers log. | owed | — | Nothing collects barriers by institution. Would live with the pilot scorecard. |
| AD-10 | Change impact assessment. | partial | [`app/src/lib/governance/release-readiness.ts`](../../app/src/lib/governance/release-readiness.ts) | Release readiness scores a change on fixed dimensions. Who at the institution is affected is not one of them. |
| AD-11 | Post-launch learning review. | in place | [`docs/PROOF-CALENDAR.md`](../PROOF-CALENDAR.md) | The pilot outcome baseline and the midpoint report are scheduled, with what each must contain. |

## Documentation resilience

> A document nobody has tested recently is a guess; a runbook a new employee cannot follow is not a runbook.

Exposure `staff` · owner `engineering` · 1 of 9 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| DO-01 | Documentation quality review. | partial | [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md) | Every controlled document has a review date and a status; a passed date is a finding. Quality beyond “read and stands” is not assessed. |
| DO-02 | Documentation ownership rotation. | owed | — | Owners are seats, all vacant; rotation needs two people. |
| DO-03 | Expired-document alert. | in place | [`app/src/lib/ops/operatingsystem.ts`](../../app/src/lib/ops/operatingsystem.ts) | A next-review date that has passed fails the register test. |
| DO-04 | Runbook test dates. | partial | [`docs/RUNBOOKS.md`](../RUNBOOKS.md) | Runbooks are indexed. None records when it was last walked, and the restore drill has not been. |
| DO-05 | New-hire onboarding validation. | owed | — | No hire has followed SETUP.md cold; the first one is the test. |
| DO-06 | “Can a new employee operate this?” exercise. | owed | — | Follows DO-05, for operations rather than development. |
| DO-07 | Critical-process video walkthroughs. | owed | — | None recorded; the restore drill would be the first worth filming. |
| DO-08 | Offline and emergency runbook copies. | partial | [`RESTORE.md`](../../RESTORE.md) | Runbooks live in the repository, which every clone carries offline. No printed or out-of-band copy of the recovery steps. |
| DO-09 | Documentation search quality. | partial | [`app/src/lib/settings.ts`](../../app/src/lib/settings.ts) | The app’s own help and settings are searchable by keyword. The repository’s documents are searched with grep. |

## Market and competitive intelligence

> Competitive intelligence is lawful and public: no scraping restricted systems, no use of confidential competitor material.

Exposure `internal` · owner `founder` · 5 of 11 in place.

| ID | Control | Status | Evidence | What it shows, or what would close it |
| --- | --- | --- | --- | --- |
| CI-01 | Competitor category map. | in place | [`COMPETITION.md`](../../COMPETITION.md) | Ten direct competitors, compared against the code. |
| CI-02 | Public feature tracking. | in place | [`COMPETITION.md`](../../COMPETITION.md) | Feature-by-feature, from public material only. |
| CI-03 | Pricing and packaging monitoring. | partial | [`MARKET-POSITION.md`](../../MARKET-POSITION.md) | Positioning names the price bands. No schedule re-reads competitors’ public pricing. |
| CI-04 | Standards and certification monitoring. | partial | [`docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md`](../PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md) | The certifications that matter are listed with what each takes. No watch on changes to them. |
| CI-05 | Customer feedback themes. | partial | [`app/src/lib/feedback.ts`](../../app/src/lib/feedback.ts) | Feedback arrives categorised. No theming across it has been done because there is little of it. |
| CI-06 | Procurement and RFP analysis. | in place | [`docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](../HIGHER-ED-RFP-RESPONSE-LIBRARY.md) | The questions procurement asks, with what exists to answer each. |
| CI-07 | Win/loss analysis. | owed | — | No deal has been won or lost. |
| CI-08 | Feature-gap review. | in place | [`COMPETITIVE-REVIEW.md`](../../COMPETITIVE-REVIEW.md) | The gaps against competitors, and which to adopt. |
| CI-09 | Market trend review. | partial | [`MARKET-POSITION.md`](../../MARKET-POSITION.md) | A position taken once, in September 2026. Not reviewed on a schedule. |
| CI-10 | Positioning updates. | partial | [`docs/operating-model/DEFENSIBILITY.md`](DEFENSIBILITY.md) | The moat is stated. Nothing schedules its re-reading against the market. |
| CI-11 | No scraping restricted systems or using confidential competitor information. | in place | [`COMPETITION.md`](../../COMPETITION.md) | Every comparison cites public material; the file says so in its header, and the stance above is the rule. |
