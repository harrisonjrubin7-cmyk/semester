import type { Seat } from '../launchreadiness';

/**
 * The operational-maturity register: the last twenty areas of running a
 * platform for universities that a feature list never mentions — records
 * management, content rights, learning-analytics ethics, minors, cost
 * governance, a provider exit, disaster scenarios beyond technology — each
 * broken into the controls a reviewer would ask for, and each control marked
 * with what the tree actually holds.
 *
 * `docs/operating-model/OPERATIONAL-MATURITY.md` is rendered from this file by
 * `maturity.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * Three rules, the same ones the risk register and the edge-case catalog keep.
 *
 * **A control that claims to exist cites a file, and the file exists.** `in
 * place` and `partial` carry an `evidence` path; `owed` carries null and a
 * note saying what would close it. The test refuses a citation that is not in
 * the tree, so a control cannot be marked done by a document nobody wrote.
 *
 * **A stance is a sentence the company will be held to.** Each area opens with
 * one — "Semester is not an accreditation authority", "no predictive-risk
 * labelling of a student" — because the brief's checklists are easy to tick
 * and the stance is what a checklist is for.
 *
 * **The count is the finding.** The rendered page says how many controls are
 * in place, partial and owed, and the test states the numbers, so a change in
 * either direction is a line in a diff with a reviewer looking at it.
 *
 * Nothing here reads the network, the database or the clock.
 */

export const MATURITY_AREAS = {
  records: 'Records management and legal holds',
  ediscovery: 'E-discovery and export defensibility',
  generated: 'Accessibility of generated content',
  rights: 'Content rights, copyright and licensing',
  accreditation: 'Accreditation and assessment evidence',
  analytics: 'Learning analytics ethics',
  accommodations: 'Accommodations across the lifecycle',
  minors: 'Minors, guardians and dual enrollment',
  lawwatch: 'Digital-accessibility procurement law',
  devices: 'Physical security and device management',
  devex: 'Developer experience and engineering productivity',
  finops: 'Cost governance',
  exit: 'Cloud-provider exit',
  internal: 'Accessibility and security of internal tools',
  residency: 'Data residency',
  growth: 'Ethics of growth and pricing',
  disaster: 'Disaster scenarios beyond technology',
  adoption: 'Adoption and change management',
  docs: 'Documentation resilience',
  intel: 'Market and competitive intelligence',
} as const;

export type MaturityArea = keyof typeof MATURITY_AREAS;

/**
 * Who may see an area's working material. `internal` areas — records holds,
 * e-discovery — never reach general staff or students; they belong to the
 * privacy, legal and data-steward seats.
 */
export type Exposure = 'internal' | 'staff' | 'public';

export interface AreaStance {
  /** The one sentence the area is held to. */
  stance: string;
  exposure: Exposure;
  /** The seat that owns the area's review. */
  owner: Seat;
}

export const STANCES: Record<MaturityArea, AreaStance> = {
  records: { stance: 'A legal hold overrides every deletion job, and deletion resumes when the hold is released — both proven, not assumed.', exposure: 'internal', owner: 'privacy' },
  ediscovery: { stance: 'A controlled export is requested by a verified person, scoped, approved, hashed, delivered securely and logged; it is never a general staff tool.', exposure: 'internal', owner: 'privacy' },
  generated: { stance: 'Nothing Semester generates is called accessible until it has been checked; the check is part of generating it.', exposure: 'public', owner: 'accessibility' },
  rights: { stance: 'Every piece of course material carries who owns it, what may be done with it, and when that ends.', exposure: 'staff', owner: 'data' },
  accreditation: { stance: 'Semester is not an accreditation authority. It helps an institution organise and export evidence it has approved.', exposure: 'staff', owner: 'product' },
  analytics: { stance: 'No predictive-risk label is ever attached to a student, and no metric is collected that is not on the approved list.', exposure: 'public', owner: 'privacy' },
  accommodations: { stance: 'An accommodation is a functional summary the student controls, never a diagnosis, and nobody sees it who was not granted it.', exposure: 'staff', owner: 'accessibility' },
  minors: { stance: 'No feature that matches, reviews or messages is open to a minor until guardian consent and the age-of-majority transition are built.', exposure: 'staff', owner: 'privacy' },
  lawwatch: { stance: 'Accessibility law and procurement rules are read quarterly, and a product change that would change the conformance report is tracked as one.', exposure: 'staff', owner: 'accessibility' },
  devices: { stance: 'The people who operate the platform work from managed, encrypted, lockable devices, or not on production.', exposure: 'internal', owner: 'security' },
  devex: { stance: 'Shipping safely and quickly are the same discipline: a standard environment, synthetic data, flags, previews and measured lead time.', exposure: 'staff', owner: 'engineering' },
  finops: { stance: 'Every dollar of cloud and AI spend is attributable to a tenant, a module or an environment, and an anomaly is noticed before the invoice.', exposure: 'internal', owner: 'founder' },
  exit: { stance: 'No provider is assumed permanent: data is exportable in open formats and every environment can be recreated from code.', exposure: 'staff', owner: 'engineering' },
  internal: { stance: 'The Operations Console and the customer portal meet the same accessibility and security bar as the student app.', exposure: 'staff', owner: 'accessibility' },
  residency: { stance: 'Where data lives, where it is backed up and where keys are held are decided and written down before an enterprise contract is signed.', exposure: 'staff', owner: 'security' },
  growth: { stance: 'No dark pattern, no paywall around a student’s own data, no manipulative nudge, and every price explained before it is charged.', exposure: 'public', owner: 'founder' },
  disaster: { stance: 'Every scenario beyond technology has an owner, a communication plan, a fallback and a post-event review, before it happens.', exposure: 'internal', owner: 'founder' },
  adoption: { stance: 'Institutional change is a people problem: stakeholders mapped, champions named, resistance heard, adoption measured by role.', exposure: 'staff', owner: 'success' },
  docs: { stance: 'A document nobody has tested recently is a guess; a runbook a new employee cannot follow is not a runbook.', exposure: 'staff', owner: 'engineering' },
  intel: { stance: 'Competitive intelligence is lawful and public: no scraping restricted systems, no use of confidential competitor material.', exposure: 'internal', owner: 'founder' },
};

export type ControlStatus = 'in-place' | 'partial' | 'owed';

export interface Control {
  id: string;
  area: MaturityArea;
  /** The control, in the brief's words. */
  control: string;
  status: ControlStatus;
  /** A repository path that shows it, for `in-place` and `partial`; null for `owed`. */
  evidence: string | null;
  /** What the evidence shows and does not, or what would close an owed control. */
  note: string;
}

const c = (id: string, area: MaturityArea, control: string, status: ControlStatus, evidence: string | null, note: string): Control => ({ id, area, control, status, evidence, note });

export const CONTROLS: readonly Control[] = [
  // ── Records management and legal holds ─────────────────────────────────
  c('RM-01', 'records', 'Records-retention schedule by data class.', 'partial', 'RETENTION.md', 'Retention is stated per table and per device store. It is not organised by data class, and financial, audit and security records are not yet classes of their own.'),
  c('RM-02', 'records', 'Legal-hold workflow.', 'partial', 'supabase/legal-holds.check.sql', 'A hold table, a placing capability limited to the account’s own school, and a platform hold only an operator places (`20260930100000_legal_holds.sql`); 42 checks. No screen places one and no runbook says when counsel should.'),
  c('RM-03', 'records', 'Litigation and investigation preservation workflow.', 'owed', null, 'Would follow the hold workflow; nothing preserves a snapshot of an account on request today.'),
  c('RM-04', 'records', 'A hold overrides deletion jobs.', 'partial', 'supabase/legal-holds.check.sql', 'The three retention sweeps skip what a live hold covers, and `erase_account` refuses a held account before it touches a row (`20260930140000_erase_respects_holds.sql`), and a trigger on `auth.users` is the backstop. A platform-wide hold pauses the AI-runtime and Community sweeps (`private.run_sweep`), and a school or account hold keeps its own rows in them (20260930170000): exercised on AI metadata, restrictions and safety entries, held by a test on the rest. On-device deletion (`deleteEverything`) checks nothing.'),
  c('RM-05', 'records', 'Hold release process.', 'partial', 'supabase/legal-holds.check.sql', 'Released by a different person holding `hold:release`, with a reason, once; the row is never deleted or edited, so the placement and release are the record. A school with one administrator cannot release its own hold and must use break-glass. No runbook yet.'),
  c('RM-06', 'records', 'Retention owner and review cadence.', 'partial', 'SEMESTER-OPERATING-SYSTEM.md', 'The operating system names the privacy seat as owner of data inventory and lineage, quarterly. The seat is vacant.'),
  c('RM-07', 'records', 'Customer notification where contractually required.', 'partial', 'docs/operating-model/INCIDENT-COMMUNICATIONS.md', 'Notice templates exist for incidents. None exists for a hold, a preservation request or a lawful-access request.'),
  c('RM-08', 'records', 'Proof that deletion resumes correctly after a hold is released.', 'partial', 'supabase/legal-holds.check.sql', 'Proved for the abandoned-sign-up, audit and invite sweeps and for a student’s own erasure through `erase_account`: each stops for a hold and runs again once it is released. Proved for the AI-runtime and Community sweeps under a platform hold only.'),
  c('RM-09', 'records', 'Financial, audit and security records kept apart from student-content retention.', 'partial', 'RETENTION.md', 'Audit and access logs have their own retention lines. Financial records have their own class: kept seven years after the end of the year they were made, then purged monthly for individual subscribers (D-132; `20260929130000_financial_retention.sql`, scheduled in `supabase/scheduler.sql`). An institution’s records follow its contract. Student-account ledgers (D-146) await a school-set schedule; the ledger has no purge.'),

  // ── E-discovery and export defensibility ───────────────────────────────
  c('ED-01', 'ediscovery', 'Authorised-requester verification.', 'owed', null, 'The only export today is a student’s own (`exportAccount`). No path exists for an institution’s verified requester.'),
  c('ED-02', 'ediscovery', 'Scope definition for a controlled export.', 'owed', null, 'Needs a request object naming accounts, date range and data classes, approved before anything is read.'),
  c('ED-03', 'ediscovery', 'Search and filter criteria.', 'owed', null, 'Follows ED-02; the criteria are part of the request, recorded with it.'),
  c('ED-04', 'ediscovery', 'Export approval.', 'partial', 'app/src/lib/ops/commitments.ts', 'The commitments register shows the approval shape the company uses: a named seat, dated, recorded. No export approval uses it yet.'),
  c('ED-05', 'ediscovery', 'Chain of custody.', 'owed', null, 'Who handled the export, when, and what they did with it — a log that does not exist because the export does not.'),
  c('ED-06', 'ediscovery', 'Hash or checksum of what was delivered.', 'partial', 'app/src/lib/workspace-backup.ts', 'A student’s own backup is a plain JSON file with no digest. A defensible export needs a recorded hash.'),
  c('ED-07', 'ediscovery', 'Redaction process.', 'owed', null, 'Other students’ data inside a shared object (a group, a thread) would need redacting before delivery. No process.'),
  c('ED-08', 'ediscovery', 'Secure delivery.', 'partial', 'docs/SECURITY-ACCESSIBILITY-READINESS.md', 'The trust packet is shared by expiring link to named reviewers and recorded. The same mechanism would carry an export; none has.'),
  c('ED-09', 'ediscovery', 'Access log for the export.', 'partial', 'supabase/support-access.check.sql', 'Support access to a student’s account is granted, time-limited and logged. An export is not a support grant and has no log.'),
  c('ED-10', 'ediscovery', 'Retention and deletion after delivery.', 'owed', null, 'How long the company keeps its copy of a delivered export, and the proof it was deleted.'),
  c('ED-11', 'ediscovery', 'Export metadata and evidence report.', 'owed', null, 'A report naming the request, scope, approver, hash, delivery and deletion. Follows all of the above.'),

  // ── Accessibility of generated content ─────────────────────────────────
  c('GA-01', 'generated', 'Generated images require an alt-text prompt.', 'owed', null, 'Figures generated for a course (`lib/figures` and the study guide) carry captions; nothing requires or checks an alt text before the figure is saved.'),
  c('GA-02', 'generated', 'Generated slides require a reading-order and contrast check.', 'owed', null, 'The deck maker produces slides with no reading-order or contrast check on output.'),
  c('GA-03', 'generated', 'Generated documents require heading, link and table checks.', 'owed', null, 'The essay and write tools export text; no structural check runs on the export.'),
  c('GA-04', 'generated', 'Generated charts require a data table, labels, units and a text summary.', 'partial', 'app/src/a11y/tellings.test.ts', 'The app’s own charts are held to “never colour alone”. A chart a student generates from a sheet is not checked for a data table or a summary.'),
  c('GA-05', 'generated', 'Generated video requires a caption and transcript workflow.', 'partial', 'app/src/lib/webvtt.ts', 'Captions are produced as WebVTT and attached with `<track>`. Nothing refuses a video that has none.'),
  c('GA-06', 'generated', 'Generated equations have accessible math rendering.', 'owed', null, 'Equations render visually; no MathML or spoken form is produced.'),
  c('GA-07', 'generated', 'Generated quiz items use accessible question structures.', 'partial', 'app/scripts/labels.mjs', 'Every control in the drill and quiz screens has a name, checked by the label rule. Question structure (grouping, instructions before choices) is not checked.'),
  c('GA-08', 'generated', 'AI does not claim generated output is accessible without validation.', 'partial', 'app/src/lib/source.ts', 'AI-assisted output is labelled as AI-assisted. No output is labelled accessible, which is the right default until a check exists.'),

  // ── Content rights, copyright and licensing ────────────────────────────
  c('CR-01', 'rights', 'Content ownership metadata.', 'partial', 'app/src/lib/where.ts', 'Every row carries where it came from (official, connected, made, yours, sample, stale). That is provenance, not ownership: nothing records who holds the copyright.'),
  c('CR-02', 'rights', 'Faculty and institution permission status.', 'partial', 'supabase/coursestudio.check.sql', 'Course Studio records what an instructor published and to whom. A syllabus a student uploads carries no permission status.'),
  c('CR-03', 'rights', 'Copyright and licensing classification.', 'owed', null, 'No field classifies a piece of material as the institution’s, the publisher’s, open, or unknown.'),
  c('CR-04', 'rights', 'Library-licence restrictions.', 'owed', null, 'Library-licensed readings are indistinguishable from any other upload.'),
  c('CR-05', 'rights', 'Course-material access boundary.', 'in-place', 'supabase/tenancy.check.sql', 'A student’s uploaded material is their own; row-level policy keeps it from every other account, tested as a second account in every build.'),
  c('CR-06', 'rights', 'AI-use eligibility by content type.', 'partial', 'app/src/screens/settings/Assistant.tsx', 'The student decides what the assistant may see. No content type is ineligible on its own account (a licensed reading, an exam).'),
  c('CR-07', 'rights', 'Download and export restriction.', 'owed', null, 'Everything a student holds exports; nothing marks a piece as not-for-export because of its licence.'),
  c('CR-08', 'rights', 'Citation and source attribution.', 'in-place', 'app/src/lib/cite.ts', 'Every card and answer built from material cites the piece it came from, and the assistant shows its sources.'),
  c('CR-09', 'rights', 'Content takedown and DMCA process.', 'owed', null, 'No published address, no form, no runbook for a rights-holder’s notice.'),
  c('CR-10', 'rights', 'Expiry at course end or licence end.', 'partial', 'app/src/lib/rollover.ts', 'A term can be closed and archived. Nothing expires a piece of material on a licence date.'),
  c('CR-11', 'rights', 'Revoke and re-index after removal.', 'partial', 'app/src/lib/changeset.ts', 'Removing a source removes the cards built from it. AI retrieval has no index to purge because retrieval reads the student’s own material at answer time.'),

  // ── Accreditation and assessment evidence ──────────────────────────────
  c('AC-01', 'accreditation', 'Outcome and competency mapping.', 'owed', null, 'No competency model exists; requirements are the student’s own degree requirements, typed in.'),
  c('AC-02', 'accreditation', 'Assessment evidence collection.', 'owed', null, 'There is no assessment engine (edge-case catalog EC-LMS-02), so nothing to collect.'),
  c('AC-03', 'accreditation', 'Rubric and artefact alignment.', 'owed', null, 'No rubrics (EC-LMS-05).'),
  c('AC-04', 'accreditation', 'Programme-level aggregate reporting.', 'partial', 'docs/COURSE-DEMAND-FORECASTING.md', 'Course-demand snapshots report only at n ≥ 10. The same suppression rule would govern programme reporting; no programme report exists.'),
  c('AC-05', 'accreditation', 'Faculty review workflow.', 'partial', 'docs/FACULTY-COURSE-STUDIO-DESIGN.md', 'Course Studio has a publish step by the instructor. Review of evidence by faculty is not a workflow.'),
  c('AC-06', 'accreditation', 'Accreditation export and report templates.', 'owed', null, 'None. Would be written with the first institution that asks, from its accreditor’s template, never from ours.'),
  c('AC-07', 'accreditation', 'Evidence retention and audit trail.', 'owed', null, 'Follows RM-01: accreditation evidence would be a retention class with its own line.'),
  c('AC-08', 'accreditation', 'Privacy thresholds on aggregate evidence.', 'in-place', 'docs/COURSE-DEMAND-FORECASTING.md', 'Aggregate-only, n ≥ 10, enforced in code and in the database, for the one aggregate that exists.'),
  c('AC-09', 'accreditation', 'Methodology and interpretation notes on every report.', 'partial', 'docs/PROOF-CALENDAR.md', 'The proof standard requires methodology, cohort, timeframe and limitations beside any measure. No accreditation report exists to carry them.'),

  // ── Learning analytics ethics ──────────────────────────────────────────
  c('LA-01', 'analytics', 'Learning-analytics policy.', 'in-place', 'docs/PRODUCT-ANALYTICS-DATA-ETHICS.md', 'What is measured, what is promised never to be measured, and the test that holds each promise.'),
  c('LA-02', 'analytics', 'Approved metric catalog.', 'in-place', 'ANALYTICS.md', 'Exactly three server marks (opened, course, studied), enforced by a check constraint; each new mark needs its own PR and owner review (D-005).'),
  c('LA-03', 'analytics', 'Prohibited metric catalog.', 'in-place', 'docs/ANALYTICS-EVENTS.md', '“What is never collected”: titles, anything typed, per-screen or per-session data, time of day, an identifiable clarity answer.'),
  c('LA-04', 'analytics', 'Student transparency notice.', 'in-place', 'app/src/lib/privacy.ts', 'The privacy screen states every field the sync sends, checked by test against what it actually sends.'),
  c('LA-05', 'analytics', 'Opt-in where needed.', 'partial', 'app/src/lib/usage.ts', 'On-device screen counts have a toggle. Server marks have none because they are presence-only; a richer mark would need consent, and D-005 says so.'),
  c('LA-06', 'analytics', 'Aggregation and suppression rules.', 'in-place', 'docs/COURSE-DEMAND-FORECASTING.md', 'n ≥ 10 on the one aggregate table, in code and in the database.'),
  c('LA-07', 'analytics', 'No individual predictive-risk labelling.', 'in-place', 'docs/PRODUCT-ANALYTICS-DATA-ETHICS.md', 'Promised in the policy and in the public site’s product page: Semester does not score students or predict grades. No model in the tree does.'),
  c('LA-08', 'analytics', 'Human review for any high-impact intervention.', 'partial', 'docs/operating-model/AI-LIFECYCLE-GATES.md', 'The AI gates require human review before a use case reaches production. No intervention exists to review.'),
  c('LA-09', 'analytics', 'Bias and fairness review.', 'partial', 'docs/EQUITY-REVIEW.md', 'Fifteen ranking and recommending surfaces are reviewed and gated (D-1019), with the owner as named reviewer and not independently, with eight findings open; no outcome is measured because no demographic data reaches this code (the owner says some is collected; the repository cannot confirm it), and the AI recommendation evaluation harness is designed and not run.'),
  c('LA-10', 'analytics', 'Research versus operational analytics kept separate.', 'owed', null, 'No research use exists and no policy says how one would be approved, consented and separated.'),
  c('LA-11', 'analytics', 'Faculty and advisor dashboard scope controls.', 'partial', 'supabase/expansion.check.sql', 'An advisor sees only what a student shared, for as long as they shared it. There is no dashboard, so no dashboard scope.'),

  // ── Accommodations across the lifecycle ────────────────────────────────
  c('AP-01', 'accommodations', 'Disability-services issuer workflow.', 'owed', null, 'The accommodation share is student-created. No issuer role for a disability-services office exists.'),
  c('AP-02', 'accommodations', 'Functional accommodation summary only, no diagnosis.', 'in-place', 'docs/CONSENT-SHARING-DESIGN.md', 'The design holds the share to functional terms and the schema has no diagnosis field.'),
  c('AP-03', 'accommodations', 'Student-controlled sharing by recipient, course and term.', 'in-place', 'supabase/expansion.check.sql', 'accommodation_shares name the recipient and carry expiry; the student creates and revokes.'),
  c('AP-04', 'accommodations', 'Time-limited shares.', 'in-place', 'supabase/expansion.check.sql', 'Every share carries an expiry the policy enforces.'),
  c('AP-05', 'accommodations', 'Instructor access through an audited function.', 'partial', 'supabase/expansion.check.sql', 'Reads are policy-gated. Whether each read is logged as an access event is not yet tested.'),
  c('AP-06', 'accommodations', 'Student read-history view.', 'partial', 'app/src/lib/cloud.ts', 'Access logs exist for advisor shares (`readAccessLog`). No screen shows a student who read an accommodation share.'),
  c('AP-07', 'accommodations', 'Immediate revoke.', 'in-place', 'supabase/expansion.check.sql', 'Revocation stops the next read; tested.'),
  c('AP-08', 'accommodations', 'Assessment accommodation application.', 'owed', null, 'No assessment engine, so no extra time or alternative format to apply (EC-LMS-04).'),
  c('AP-09', 'accommodations', 'Course-material accessibility support.', 'partial', 'app/src/lib/speak.ts', 'Read-aloud exists in one screen; text size, spacing and typeface are settings. Alternative formats of a specific upload are not produced.'),
  c('AP-10', 'accommodations', 'Expiry and renewal workflow.', 'partial', 'supabase/expansion.check.sql', 'Expiry is enforced. Renewal is a new share; nothing prompts before expiry.'),
  c('AP-11', 'accommodations', 'No unauthorised staff visibility.', 'in-place', 'supabase/expansion.check.sql', 'Row-level policy: only the named recipient, within the window.'),

  // ── Minors, guardians and dual enrollment ──────────────────────────────
  c('MN-01', 'minors', 'Source for minor age or status.', 'in-place', 'supabase/minimum-age.check.sql', 'Stated at sign-up or once afterwards, never changed; only the day a minor turns 18 is kept (D-139). Self-reported, so it is a stated age, not a verified one.'),
  c('MN-02', 'minors', 'Guardian consent where required.', 'owed', null, 'No guardian model. The supporter and family privacy model says it needs the minors decision before building.'),
  c('MN-03', 'minors', 'Age-of-majority transition.', 'in-place', 'supabase/minimum-age.check.sql', 'The restriction lifts on the 18th birthday with nothing to run. Nobody is told; the Account screen stops saying it.'),
  c('MN-04', 'minors', 'Dual-enrollment sharing rules.', 'owed', null, 'A high-school student in a university course would be a minor in an institutional tenant; no rule exists.'),
  c('MN-05', 'minors', 'Parent and supporter limited-grant model.', 'partial', 'docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md', 'The model is designed: a student grants a supporter a limited view. Built for adults’ supporters, not for guardians of minors.'),
  c('MN-06', 'minors', 'Restricted career matching, reviews and messaging for minors.', 'in-place', 'supabase/minimum-age.check.sql', 'A minor is not a verified student, so every policy that asks refuses; mentor requests, connections, study matching and employer opt-in refuse by trigger. Reporting and guardian sharing stay open.'),
  c('MN-07', 'minors', 'Consent renewal and expiry.', 'owed', null, 'Follows MN-02: a consent that never expires is not a consent.'),
  c('MN-08', 'minors', 'Safe communications policy.', 'partial', 'docs/COMMUNITY-MEDIA-SAFETY.md', 'Community safety rules exist for all users. Nothing is specific to minors.'),
  c('MN-09', 'minors', 'Identity and guardian verification where necessary.', 'owed', null, 'No verification path for a guardian.'),
  c('MN-10', 'minors', 'State and jurisdiction review.', 'partial', 'docs/FERPA-COPPA-1EDTECH-READINESS.md', 'COPPA is in the readiness register. State-by-state student-privacy law is not reviewed.'),

  // ── Digital-accessibility procurement law ──────────────────────────────
  c('LW-01', 'lawwatch', 'Monitor ADA Title II and public-sector digital-access obligations.', 'partial', 'docs/operating-model/ACCESSIBILITY-GOVERNANCE.md', 'The council’s charter names WCAG 2.2 AA as the bar, which is what the Title II rule adopts. No watch process is scheduled.'),
  c('LW-02', 'lawwatch', 'Monitor Section 508 and state accessibility requirements.', 'owed', null, 'Not tracked; would join LW-01 as one quarterly reading.'),
  c('LW-03', 'lawwatch', 'Track university VPAT and ACR requirements.', 'in-place', 'docs/trust/HECVAT-VPAT-PLAN.md', 'The VPAT/ACR checklist and the 90-day plan to a first report.'),
  c('LW-04', 'lawwatch', 'Update contract clauses and VPAT scope with the product.', 'owed', null, 'No contract exists to carry a clause; the pilot agreement outline has no accessibility clause yet.'),
  c('LW-05', 'lawwatch', 'Review the accessibility policy at least quarterly.', 'partial', 'docs/operating-model/OPERATING-RHYTHM.md', 'A quarterly policy review is in the rhythm. The seat is vacant and none has happened.'),
  c('LW-06', 'lawwatch', 'Track product changes that require an ACR update.', 'owed', null, 'Would follow the first ACR: a release note field saying whether the change touches a reported criterion.'),
  c('LW-07', 'lawwatch', 'Keep the accessibility vendor and subprocessor review current.', 'partial', 'docs/SUBPROCESSORS.md', 'Subprocessors are registered and held to the content-security policy. Their accessibility (of anything user-facing) is not reviewed.'),

  // ── Physical security and device management ────────────────────────────
  c('DV-01', 'devices', 'Company device-management policy.', 'owed', null, 'The company is a single-member LLC by the owner’s attestation (HECVAT COMP-01, 28 September) and has no device policy. One founder’s device operates everything.'),
  c('DV-02', 'devices', 'Disk encryption.', 'owed', null, 'Not attested. Would be the first line of DV-01.'),
  c('DV-03', 'devices', 'Endpoint protection.', 'owed', null, 'Not attested.'),
  c('DV-04', 'devices', 'Screen lock and password policy.', 'owed', null, 'Not attested.'),
  c('DV-05', 'devices', 'Remote wipe.', 'owed', null, 'Not attested.'),
  c('DV-06', 'devices', 'Asset inventory.', 'owed', null, 'None; a one-line list of devices is the whole control at this size.'),
  c('DV-07', 'devices', 'Secure disposal.', 'owed', null, 'None; nothing has been disposed of yet.'),
  c('DV-08', 'devices', 'BYOD rules.', 'owed', null, 'None; every device is personal today, which is the problem.'),
  c('DV-09', 'devices', 'Secure Wi-Fi and network policy.', 'owed', null, 'None written; would be a line in DV-01.'),
  c('DV-10', 'devices', 'Physical document handling.', 'owed', null, 'None; nothing is printed, which is not a policy.'),
  c('DV-11', 'devices', 'Visitor and access policy, if offices exist.', 'owed', null, 'No office exists, so none is needed yet.'),

  // ── Developer experience ───────────────────────────────────────────────
  c('DX-01', 'devex', 'Local development environment standard.', 'in-place', 'SETUP.md', 'One documented setup; the gates are listed in CLAUDE.md and REGRESSION-CHECKLIST.md.'),
  c('DX-02', 'devex', 'Seed and synthetic data tooling.', 'in-place', 'app/src/data/institutional-preview.ts', 'Synthetic institutions and personas for the demo and the institutional preview; the sample semester ships with the app.'),
  c('DX-03', 'devex', 'Developer sandbox.', 'in-place', 'STAGING.md', 'A staging project and a preview build, with the demo built to /demo/ on every deploy.'),
  c('DX-04', 'devex', 'Test data policy.', 'partial', 'docs/PSEUDONYMITY-POLICY.md', 'Fixtures are synthetic and the preview has no account service. No written rule forbids production data in tests.'),
  c('DX-05', 'devex', 'API mocks.', 'in-place', 'app/vite.config.ts', 'The mocked test project and its allow-listed modules; the gateway smoke script runs against a local server.'),
  c('DX-06', 'devex', 'Feature-flag workflow.', 'in-place', 'docs/FEATURE-FLAG-REGISTRY.md', 'Every flag in `lib/flags.ts` is in the registry, held by test.'),
  c('DX-07', 'devex', 'Preview environment per pull request.', 'partial', '.github/workflows/pages.yml', 'Main deploys the product and the demo. No per-PR preview URL.'),
  c('DX-08', 'devex', 'Migration test harness.', 'in-place', 'docs/LAUNCH-HARDENING-REPORT.md', 'Migrations run twice in CI and every policy has a check file.'),
  c('DX-09', 'devex', 'Code ownership.', 'owed', null, 'No CODEOWNERS file; one person owns everything.'),
  c('DX-10', 'devex', 'Architecture decision records.', 'in-place', 'docs/architecture/README.md', 'Ten ADRs, indexed.'),
  c('DX-11', 'devex', 'Internal developer portal.', 'partial', 'SEMESTER-OPERATING-SYSTEM.md', 'The operating system links the authoritative version of everything. It is a page, not a portal, and that is enough at this size.'),
  c('DX-12', 'devex', 'Engineering metrics: lead time, deployment frequency, change failure rate, MTTR.', 'partial', 'ROLLBACK.md', 'Deploys are per merge and rollbacks are recorded, which gives frequency and failure rate on inspection. Nothing computes them.'),

  // ── Cost governance ────────────────────────────────────────────────────
  c('FO-01', 'finops', 'Cloud cost allocation by tenant, module and environment.', 'owed', null, 'One Supabase project, one AI gateway; no tags, no allocation.'),
  c('FO-02', 'finops', 'AI cost allocation by use case, model and tenant.', 'partial', 'docs/architecture/0004-ai-through-a-metered-gateway.md', 'AI runs through a metered gateway with per-account limits. Cost is not rolled up by use case or tenant.'),
  c('FO-03', 'finops', 'Budget and alert thresholds.', 'owed', null, 'No budget is set on any provider.'),
  c('FO-04', 'finops', 'Cost anomaly detection.', 'owed', null, 'None; follows FO-03, since an anomaly is measured against a budget.'),
  c('FO-05', 'finops', 'Storage lifecycle controls.', 'partial', 'RETENTION.md', 'Retention says how long things are kept. No lifecycle rule moves or expires storage automatically.'),
  c('FO-06', 'finops', 'Egress monitoring.', 'owed', null, 'None; the provider’s dashboard is read by hand, if at all.'),
  c('FO-07', 'finops', 'Idle environment cleanup.', 'owed', null, 'None; there is one environment.'),
  c('FO-08', 'finops', 'Vendor spend review.', 'partial', 'docs/trust/VENDOR-RISK-REGISTER.md', 'Vendors are registered for risk, not for spend.'),
  c('FO-09', 'finops', 'Unit-cost model: per active student, course, AI action, integration, assessment.', 'partial', 'docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'Commercial governance names the drivers. No unit cost is measured.'),
  c('FO-10', 'finops', 'Margin guardrails.', 'owed', null, 'Nothing is sold, so there is no margin to guard; the rule should exist before the first invoice.'),

  // ── Cloud-provider exit ────────────────────────────────────────────────
  c('EX-01', 'exit', 'Cloud and provider dependency inventory.', 'in-place', 'docs/SUBPROCESSORS.md', 'Every third party data can reach, held to the content-security policy by test.'),
  c('EX-02', 'exit', 'Data export format.', 'in-place', 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'Open formats for a student and for an institution, and what offboarding removes.'),
  c('EX-03', 'exit', 'Infrastructure as code.', 'partial', 'MIGRATION-HISTORY.md', 'The database is fully described by migrations. Project settings, auth configuration and DNS are not in code.'),
  c('EX-04', 'exit', 'Environment recreation procedure.', 'partial', 'RESTORE.md', 'A restore into a disposable project is written down; a timed rehearsal is owed (proof calendar month 1).'),
  c('EX-05', 'exit', 'Provider outage plan.', 'partial', 'docs/market-readiness/DISASTER_RECOVERY.md', 'Marked NOT_STARTED in its own words; the app keeps working on the device without the provider, which is the real plan today.'),
  c('EX-06', 'exit', 'Alternate provider assessment.', 'owed', null, 'None has been assessed; the exit plan is the export format and the migrations (EX-02, EX-03).'),
  c('EX-07', 'exit', 'Database migration playbook.', 'partial', 'docs/market-readiness/MIGRATION_PLAYBOOK.md', 'Written for moving an institution’s data in, not for moving Semester’s database out.'),
  c('EX-08', 'exit', 'Object-storage migration plan.', 'owed', null, 'None; uploaded files live in the provider’s storage with no copy elsewhere.'),
  c('EX-09', 'exit', 'DNS and CDN transition plan.', 'owed', null, 'The app is on GitHub Pages under the repository’s address; no custom domain, so no transition to plan yet.'),
  c('EX-10', 'exit', 'Contract and termination review.', 'owed', null, 'No provider contract has been reviewed for termination terms.'),

  // ── Accessibility and security of internal tools ───────────────────────
  c('IT-01', 'internal', 'WCAG 2.2 testing for console workflows.', 'partial', 'app/scripts/accessibility-smoke.mjs', 'The axe run covers the app’s screens, staff screens included, since they are the same app. No separate console exists.'),
  c('IT-02', 'internal', 'Keyboard support for incident, support and approval flows.', 'partial', 'app/src/screens/Moderation.test.tsx', 'The moderation console is tested for keyboard use. Support tickets and approvals are screens of the same app under the same rules.'),
  c('IT-03', 'internal', 'Screen-reader-accessible tables and charts.', 'in-place', 'app/src/a11y/tellings.test.ts', 'Nothing is said with colour alone, across every screen.'),
  c('IT-04', 'internal', 'Accessible document room.', 'partial', 'app/src/screens/TrustRoom.tsx', 'The NDA room is an app screen and inherits the app’s checks. Its documents are Markdown, which reads well; no PDF is served.'),
  c('IT-05', 'internal', 'Accessible customer implementation materials.', 'partial', 'docs/LAUNCH-CONTENT-AND-TRAINING.md', 'Materials are plain text and Markdown. No check of the slides or recordings a launch would produce.'),
  c('IT-06', 'internal', 'Accessible internal training.', 'owed', null, 'No internal training exists.'),
  c('IT-07', 'internal', 'Role-specific accessibility testing.', 'owed', null, 'The smoke run drives a student. Faculty, advisor and staff journeys are not driven.'),
  c('IT-08', 'internal', 'High-contrast and zoom support.', 'in-place', 'app/src/lib/contrast.test.ts', 'Every ground is measured against every surface, and the OS high-contrast preference raises the tokens; 200% zoom is in the accessibility baseline.'),

  // ── Data residency ─────────────────────────────────────────────────────
  c('DR-01', 'residency', 'Supported regions.', 'partial', 'app/src/lib/privacy.ts', 'The privacy screen states the one region the project runs in. No second region is offered.'),
  c('DR-02', 'residency', 'Customer region selection.', 'owed', null, 'Not offered; there is one region to choose.'),
  c('DR-03', 'residency', 'Backup region.', 'owed', null, 'Backups are the provider’s, in the same region.'),
  c('DR-04', 'residency', 'Encryption-key location.', 'owed', null, 'Provider-managed; not stated to customers.'),
  c('DR-05', 'residency', 'Subprocessor locations.', 'partial', 'docs/SUBPROCESSORS.md', 'Each subprocessor is named; its processing region is not recorded for every row.'),
  c('DR-06', 'residency', 'Cross-border transfer mechanism.', 'owed', null, 'No non-US customer, no mechanism.'),
  c('DR-07', 'residency', 'Tenant migration between regions.', 'owed', null, 'Not offered; follows DR-02.'),
  c('DR-08', 'residency', 'Regional incident and support model.', 'owed', null, 'One model, one time zone.'),
  c('DR-09', 'residency', 'Contract language.', 'owed', null, 'Follows counsel’s DPA (trust package).'),
  c('DR-10', 'residency', 'Residency evidence.', 'owed', null, 'Would be the provider’s attestation of region, filed under docs/evidence/.'),

  // ── Ethics of growth and pricing ───────────────────────────────────────
  c('GR-01', 'growth', 'No dark patterns.', 'in-place', 'docs/ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md', 'The engagement policy names them and the test suite forbids streaks, guilt and time-in-app as an achievement.'),
  c('GR-02', 'growth', 'No hidden paywall around a student’s own data.', 'in-place', 'app/src/lib/plans.ts', 'Export, deletion and saved plans are on every plan, written into the data and tested.'),
  c('GR-03', 'growth', 'No manipulative student nudges.', 'in-place', 'app/src/donotbuild.test.ts', 'Notifications only from allow-listed files, no ad or tracking hosts, no streaks.'),
  c('GR-04', 'growth', 'Fair student pricing.', 'partial', 'app/src/lib/plans.ts', 'Free covers everything a student needs to plan; paid plans add capacity and comparison. Only Plus is on sale, in the app and on test keys, so fairness is still a design more than a record.'),
  c('GR-05', 'growth', 'Transparent institutional implementation pricing.', 'partial', 'app/src/site/more.tsx', 'The public “how pricing works” page names the four drivers and what implementation includes. No price list exists.'),
  c('GR-06', 'growth', 'Clear AI and usage costs.', 'partial', 'app/src/screens/settings/Assistant.tsx', 'The assistant settings say what a question costs the student (nothing) and what the gateway meters. Institutional allowance terms are unwritten.'),
  c('GR-07', 'growth', 'Accessible refund and cancellation.', 'owed', null, 'Cancellation reaches Stripe (D-132); the refund policy is still a proposal and is owed before a live payment.'),
  c('GR-08', 'growth', 'Ambassador disclosure.', 'owed', null, 'No ambassador programme; if one starts, every ambassador discloses.'),
  c('GR-09', 'growth', 'Responsible advertising and sponsorship policy.', 'in-place', 'docs/operating-model/TRUST-BRAND-AND-LEGAL.md', 'No advertising and no selling of student data, stated publicly and held by the no-tracking-hosts test.'),
  c('GR-10', 'growth', 'Equity, access and accessibility discount policy.', 'owed', null, 'Not decided. Belongs with the first price list.'),

  // ── Disaster scenarios beyond technology ───────────────────────────────
  c('DS-01', 'disaster', 'Founder unavailable.', 'partial', 'docs/operating-model/RISK-GOVERNANCE.md', 'Named as a key-person risk with a mitigation. No delegate holds credentials; SECRETS.md says where they are, not who else may use them.'),
  c('DS-02', 'disaster', 'Entire support team unavailable.', 'owed', null, 'The support team is one person (DS-01).'),
  c('DS-03', 'disaster', 'Key vendor insolvency.', 'partial', 'docs/trust/VENDOR-RISK-REGISTER.md', 'Vendors are tiered. No exit plan per vendor (EX-06).'),
  c('DS-04', 'disaster', 'Payment provider outage.', 'owed', null, 'No payment provider.'),
  c('DS-05', 'disaster', 'Major public-relations event.', 'partial', 'docs/operating-model/INCIDENT-COMMUNICATIONS.md', 'Templates by audience exist for incidents. A press statement and a spokesperson are not among them.'),
  c('DS-06', 'disaster', 'Legal injunction.', 'owed', null, 'No plan; would need counsel and a hold workflow (RM-02).'),
  c('DS-07', 'disaster', 'Large-scale institution outage.', 'partial', 'docs/OFFLINE-MODE.md', 'The app keeps working on the device without any server. The institutional side (SSO down, SIS down) has no runbook because no institution is connected.'),
  c('DS-08', 'disaster', 'Ransomware or data-extortion attempt.', 'partial', 'docs/market-readiness/INCIDENT_RESPONSE.md', 'The incident process covers a breach. A restore has not been rehearsed (proof calendar), which is the control that matters here.'),
  c('DS-09', 'disaster', 'Major natural disaster affecting a region.', 'owed', null, 'One region, one operator. See DR-03.'),
  c('DS-10', 'disaster', 'Sudden regulatory change.', 'partial', 'docs/operating-model/TRUST-BRAND-AND-LEGAL.md', 'A quarterly legal review is in the rhythm. No watch process between reviews (LW-01).'),
  c('DS-11', 'disaster', 'Critical employee departure.', 'owed', null, 'No employee; the founder case is DS-01.'),

  // ── Adoption and change management ─────────────────────────────────────
  c('AD-01', 'adoption', 'Stakeholder mapping.', 'in-place', 'docs/INSTITUTIONAL-CHANGE-MANAGEMENT.md', 'Roles, what each fears and what each gains, by campus office.'),
  c('AD-02', 'adoption', 'Change-readiness assessment.', 'in-place', 'docs/operating-model/CHANGE-MANAGEMENT.md', 'Assess readiness, set goals, secure buy-in, implement, evaluate.'),
  c('AD-03', 'adoption', 'Faculty, advisor and student champion network.', 'partial', 'docs/LAUNCH-READINESS-COUNCIL.md', 'The champion seat exists and is vacant. A network of champions follows the first one.'),
  c('AD-04', 'adoption', 'Training reinforcement.', 'partial', 'docs/LAUNCH-CONTENT-AND-TRAINING.md', 'Training content is planned by role. Reinforcement after launch is in the 90-day programme, untested.'),
  c('AD-05', 'adoption', 'Resistance and feedback management.', 'partial', 'app/src/lib/feedback.ts', 'In-app feedback reaches the team with a route shape and no personal data. Institutional resistance is a conversation, and the playbook says who has it.'),
  c('AD-06', 'adoption', 'Communication calendar.', 'partial', 'docs/90-DAY-LAUNCH-PROGRAM.md', 'Communications are placed in the 90 days. Not a calendar an institution can take and fill.'),
  c('AD-07', 'adoption', 'Office hours.', 'partial', 'docs/market-readiness/HUMAN_HELP.md', 'Human help is designed and off by flag. Scheduled office hours are not in it.'),
  c('AD-08', 'adoption', 'Role-specific success metrics.', 'in-place', 'app/src/lib/ops/firstyear.ts', 'First-year measures by role, with the baseline each needs.'),
  c('AD-09', 'adoption', 'Adoption barriers log.', 'owed', null, 'Nothing collects barriers by institution. Would live with the pilot scorecard.'),
  c('AD-10', 'adoption', 'Change impact assessment.', 'partial', 'app/src/lib/governance/release-readiness.ts', 'Release readiness scores a change on fixed dimensions. Who at the institution is affected is not one of them.'),
  c('AD-11', 'adoption', 'Post-launch learning review.', 'in-place', 'docs/PROOF-CALENDAR.md', 'The pilot outcome baseline and the midpoint report are scheduled, with what each must contain.'),

  // ── Documentation resilience ───────────────────────────────────────────
  c('DO-01', 'docs', 'Documentation quality review.', 'partial', 'SEMESTER-OPERATING-SYSTEM.md', 'Every controlled document has a review date and a status; a passed date is a finding. Quality beyond “read and stands” is not assessed.'),
  c('DO-02', 'docs', 'Documentation ownership rotation.', 'owed', null, 'Owners are seats, all vacant; rotation needs two people.'),
  c('DO-03', 'docs', 'Expired-document alert.', 'in-place', 'app/src/lib/ops/operatingsystem.ts', 'A next-review date that has passed fails the register test.'),
  c('DO-04', 'docs', 'Runbook test dates.', 'partial', 'docs/RUNBOOKS.md', 'Runbooks are indexed. None records when it was last walked, and the restore drill has not been.'),
  c('DO-05', 'docs', 'New-hire onboarding validation.', 'owed', null, 'No hire has followed SETUP.md cold; the first one is the test.'),
  c('DO-06', 'docs', '“Can a new employee operate this?” exercise.', 'owed', null, 'Follows DO-05, for operations rather than development.'),
  c('DO-07', 'docs', 'Critical-process video walkthroughs.', 'owed', null, 'None recorded; the restore drill would be the first worth filming.'),
  c('DO-08', 'docs', 'Offline and emergency runbook copies.', 'partial', 'RESTORE.md', 'Runbooks live in the repository, which every clone carries offline. No printed or out-of-band copy of the recovery steps.'),
  c('DO-09', 'docs', 'Documentation search quality.', 'partial', 'app/src/lib/settings.ts', 'The app’s own help and settings are searchable by keyword. The repository’s documents are searched with grep.'),

  // ── Market and competitive intelligence ────────────────────────────────
  c('CI-01', 'intel', 'Competitor category map.', 'in-place', 'COMPETITION.md', 'Ten direct competitors, compared against the code.'),
  c('CI-02', 'intel', 'Public feature tracking.', 'in-place', 'COMPETITION.md', 'Feature-by-feature, from public material only.'),
  c('CI-03', 'intel', 'Pricing and packaging monitoring.', 'partial', 'MARKET-POSITION.md', 'Positioning names the price bands. No schedule re-reads competitors’ public pricing.'),
  c('CI-04', 'intel', 'Standards and certification monitoring.', 'partial', 'docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md', 'The certifications that matter are listed with what each takes. No watch on changes to them.'),
  c('CI-05', 'intel', 'Customer feedback themes.', 'partial', 'app/src/lib/feedback.ts', 'Feedback arrives categorised. No theming across it has been done because there is little of it.'),
  c('CI-06', 'intel', 'Procurement and RFP analysis.', 'in-place', 'docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md', 'The questions procurement asks, with what exists to answer each.'),
  c('CI-07', 'intel', 'Win/loss analysis.', 'owed', null, 'No deal has been won or lost.'),
  c('CI-08', 'intel', 'Feature-gap review.', 'in-place', 'COMPETITIVE-REVIEW.md', 'The gaps against competitors, and which to adopt.'),
  c('CI-09', 'intel', 'Market trend review.', 'partial', 'MARKET-POSITION.md', 'A position taken once, in September 2026. Not reviewed on a schedule.'),
  c('CI-10', 'intel', 'Positioning updates.', 'partial', 'docs/operating-model/DEFENSIBILITY.md', 'The moat is stated. Nothing schedules its re-reading against the market.'),
  c('CI-11', 'intel', 'No scraping restricted systems or using confidential competitor information.', 'in-place', 'COMPETITION.md', 'Every comparison cites public material; the file says so in its header, and the stance above is the rule.'),
];

export interface Coverage {
  inPlace: number;
  partial: number;
  owed: number;
}

/** How many controls are in place, partial and owed. */
export function coverage(controls: readonly Control[] = CONTROLS): Coverage {
  return {
    inPlace: controls.filter((x) => x.status === 'in-place').length,
    partial: controls.filter((x) => x.status === 'partial').length,
    owed: controls.filter((x) => x.status === 'owed').length,
  };
}

/** The areas where nothing at all is in place: the brief's genuine blind spots. */
export function bare(controls: readonly Control[] = CONTROLS): MaturityArea[] {
  return (Object.keys(MATURITY_AREAS) as MaturityArea[]).filter((a) => !controls.some((x) => x.area === a && x.status === 'in-place'));
}
