/**
 * The FERPA consent workflow: when consent is needed, the decision gate before
 * any disclosure, the flow a share follows, what the consent screen says, the
 * consent data model, and the fifteen controls the workflow must hold — each
 * held to the share and consent tables the migrations already create.
 *
 * `docs/CONSENT-SHARING-DESIGN.md` (D-037) settled the pattern: one consent
 * rule, three narrow tables (`family_grants`, `support_shares`,
 * `advisor_shares`), every share ending within a term, revocable, read only
 * through a function that logs the read. The document of 28 September 2026
 * that this file holds asks what FERPA needs *on top* of that: a signed, dated
 * consent that names the records, the purpose and the recipient, separate
 * from the product terms, with a recorded exception when one is asserted
 * instead. So each field of its data model names the column that already
 * carries it or says none does, and `ferpa-consent.test.ts` reads the
 * migrations to check the column is really there.
 *
 * `docs/trust/FERPA-CONSENT-WORKFLOW.md` is rendered from this file by that
 * test; edit the data, then `npm run registers` from app/.
 *
 * This is a product and governance blueprint, not legal advice. Counsel
 * validates it per institution, jurisdiction, contract and data flow; the
 * institution — not a product setting — determines and documents which FERPA
 * exception applies and on what conditions.
 */

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/FERPA-Consent-AI-Training-Policy-and-800-1-Checklist.pdf',
    title: 'Show me how to structure the FERPA consent workflow',
    what: 'When consent is needed, the decision gate, the consent flow and screen, the data model and the fifteen workflow controls.',
  },
  {
    path: 'docs/expansion/Privacy-by-Module-and-Liability-Controls.pdf',
    title: 'How do these modules protect student privacy (data-sharing control screen)',
    what: 'The share preview: what is shared, with whom, for what, at what access, until when, and what is not included.',
  },
];

export const GENERAL_RULE =
  'FERPA generally requires signed and dated written consent before personally identifiable information from an education record is disclosed, unless a specific exception applies. A valid consent identifies the records, the purpose and the recipient or recipient class; oral consent is not sufficient, and a generic “I agree to share my information” checkbox is not specific enough.';

/** The gate before any disclosure outside the student’s private workspace. */
export const DECISION_GATE: readonly string[] = [
  'Is the information personally identifiable information from an education record?',
  'Is Semester disclosing, transferring or permitting access to it to another person or entity?',
  'Does a documented FERPA exception apply? (A properly structured school-official arrangement; transfer to an institution where the student seeks or intends to enrol; a health or safety emergency; an audit, evaluation or study exception.)',
  'If no exception applies: obtain signed, dated, specific written consent before disclosure.',
  'If an exception is asserted: record the legal or policy basis, recipient, purpose, data scope, authorizing institution, expiry or review date and access controls.',
];

/** The flow, from the student’s choice to the automatic end. */
export const FLOW: readonly string[] = [
  'Student selects “Share with [recipient]”',
  'Semester creates a human-readable disclosure summary',
  'Student reviews the exact records and the recipient',
  'Student signs and dates electronically',
  'Semester records the consent version and the audit evidence',
  'The recipient receives only the approved scope',
  'Student can view active shares and revoke future access',
  'Access expires automatically at the selected date',
  'Revocation stops future disclosure; it does not necessarily erase records already lawfully received or retained',
];

/** What the consent screen shows, in order, before the student signs. */
export const SCREEN: readonly { line: string; says: string }[] = [
  { line: 'Recipient', says: 'The office or named person, at the named institution' },
  { line: 'Purpose', says: 'One sentence: what they will do with it' },
  { line: 'Records you are sharing', says: 'Each record or category, by name' },
  { line: 'Not included', says: 'What stays private: transcript or grades, financial-aid information, basic-needs activity, accessibility or accommodation information, transfer-credit documents, private AI conversations, club memberships, private notes' },
  { line: 'Access', says: 'Who, within the recipient, and at what level (view-only)' },
  { line: 'Duration', says: 'Until a date, unless the student revokes future access earlier' },
  { line: 'Your choices', says: 'Edit what is included; change the expiration date; cancel; sign and share' },
];

// ── The consent data model, field by field, against the schema ───────────────

export interface Field {
  field: string;
  /** The table and column that already carry it, or `null`. The test reads the migration to check the column is there. */
  column: { table: string; column: string } | null;
  note: string;
}

export const DATA_MODEL: readonly Field[] = [
  { field: 'consent_id', column: { table: 'advisor_shares', column: 'id' }, note: 'Each share row is the consent record for that disclosure.' },
  { field: 'tenant_id', column: { table: 'advisor_shares', column: 'tenant_id' }, note: 'Every share is bound to one school.' },
  { field: 'student_id', column: { table: 'advisor_shares', column: 'student_id' }, note: 'The student who consented; RLS lets only them create or revoke.' },
  { field: 'consent_version', column: { table: 'consent_record', column: 'policy_version' }, note: 'Recorded for capability consents (support access); a share row does not yet carry one.' },
  { field: 'signed_at', column: { table: 'advisor_shares', column: 'created_at' }, note: 'The moment the student confirmed the preview. A confirmation, not a signature.' },
  { field: 'signature_method', column: null, note: 'Nothing records how the student signed.' },
  { field: 'records_categories', column: { table: 'family_grants', column: 'category' }, note: 'Ten supporter categories; support_shares limits payload keys to six athlete items.' },
  { field: 'field_level_scope', column: { table: 'family_shared_items', column: 'item_id' }, note: 'One row per named item per share; a category alone grants nothing.' },
  { field: 'purpose', column: { table: 'support_access_grant', column: 'reason' }, note: 'Required for a support window; a student share carries a title, not a purpose.' },
  { field: 'recipient_type', column: { table: 'advisor_shares', column: 'advisor_id' }, note: 'The recipient must hold a live academic_advisor grant at the school; the class is implied by the table, not stored.' },
  { field: 'recipient_id', column: { table: 'advisor_shares', column: 'advisor_id' }, note: 'One named person per share.' },
  { field: 'legal_basis', column: null, note: 'Consent is the only basis the tables know; no exception can be recorded.' },
  { field: 'effective_at', column: { table: 'advisor_shares', column: 'created_at' }, note: 'A share is live on creation.' },
  { field: 'expires_at', column: { table: 'advisor_shares', column: 'expires_at' }, note: 'Not null, and at most 120 days (advisor), 200 (athlete support), 7 (support access).' },
  { field: 'revoked_at', column: { table: 'advisor_shares', column: 'revoked_at' }, note: 'The only column a student may update, and never back to null.' },
  { field: 'revocation_reason', column: null, note: 'Optional in the model; nothing stores one.' },
  { field: 'disclosure_log_ids', column: { table: 'advisor_share_events', column: 'share_id' }, note: 'One event per read, visible to the student.' },
  { field: 'policy_document_version', column: { table: 'consent_record', column: 'policy_version' }, note: 'Per capability consent; the terms of service are a draft (docs/legal/).' },
  { field: 'terms_snapshot_hash', column: { table: 'advisor_shares', column: 'payload' }, note: 'The previewed payload is stored whole, which is a snapshot but not a hash of the terms.' },
  { field: 'audit_correlation_id', column: null, note: 'Gateway audit rows carry a correlation id (20260928320000); share events do not.' },
];

// ── The fifteen required workflow controls ───────────────────────────────────

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Control {
  /** `FC-nn`, stable. */
  id: string;
  control: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

type Row = [control: string, status: Status, evidence: [path: string, shows: string][], gap: string];

const ROWS: readonly Row[] = [
  ['Digital signature is attributable to the eligible student', 'tested', [['supabase/advisor.check.sql', 'only the student, as auth.uid(), creates or revokes their share']], 'An authenticated action, not a signature: no signature method is recorded.'],
  ['Consent is signed and dated', 'building', [['supabase/migrations/20260928301000_advisor_shares.sql', 'created_at on every share']], 'Dated by the row; nothing is signed, and the confirmation is not linked to a consent version.'],
  ['Records are listed in understandable categories and, where possible, fields', 'tested', [['app/src/components/AthleteShare.test.tsx', 'offers only what the app holds, and says what is never shared'], ['app/src/lib/sharing.test.ts', 'a supporter sees named items only']], 'Categories and items are named; no share names a field of a record.'],
  ['Purpose is specific and understandable', 'building', [['supabase/migrations/20260925103000_support_access.sql', 'a support window needs a reason of 1–500 characters']], 'A student share carries a title and no purpose line.'],
  ['Recipient is named or a sufficiently specific recipient class is identified', 'tested', [['supabase/advisor.check.sql', 'the advisor is found only among live academic_advisor holders at the student’s school'], ['supabase/supportshares.check.sql', 'one named athletic academic support staff member']], 'A class (“career center staff assigned to your request”) cannot be a recipient; only a person can.'],
  ['Scope defaults to the minimum necessary data', 'tested', [['app/src/lib/help-routes.test.ts', 'starts with nothing ticked; a typed field is sent only when ticked'], ['app/src/components/AdvisorMeeting.test.tsx', 'follow-ups only when ticked']], 'Minimum by default; no rule stops a student ticking everything.'],
  ['Consent is separate from general product terms', 'building', [['supabase/migrations/20260923210000_intelligence_policy.sql', 'consent_record per capability and policy version, apart from any terms'], ['supabase/migrations/20260928090000_gtm_foundation.sql', 'gtm_consent append-only, with version and source']], 'A share confirmation writes no consent_record, so its separateness from the terms is by construction, not by record.'],
  ['Expiry is required; no indefinite sharing by default', 'tested', [['app/src/lib/sharing.test.ts', 'refuses no end date, a past one, and one past the cap'], ['app/src/lib/advisor-shares.test.ts', 'always sets an expiry, never past 120 days'], ['supabase/migrations/20260928308000_support_shares.sql', 'expires_at not null, at most 200 days']], 'Nothing missing here beyond the employer opt-in, which renews at 180 days rather than ending.'],
  ['Student can inspect active, expired and revoked consents', 'tested', [['app/src/components/TrustCenter.test.tsx', 'active and past shares; a live one revoked only after saying what happens'], ['app/src/components/AdvisorMeeting.test.tsx', 'lists shares by state and reads']], 'Each relationship has its own list; one Sharing list across all three is designed (D-037) and not yet built.'],
  ['Revocation prevents new disclosures going forward', 'tested', [['supabase/advisor.check.sql', 'a revoked share is not listed and cannot be un-revoked'], ['supabase/supportshares.check.sql', 'revoked or expired returns nothing; losing the role ends it too']], 'The student may also delete the row, so a revoked record is not always kept for audit.'],
  ['Every disclosure is logged with actor, recipient, fields, purpose, time and legal basis', 'tested', [['supabase/supportshares.check.sql', 'every read is one event the student sees and staff cannot insert'], ['supabase/migrations/20260921143653_access_log.sql', 'every read around RLS, per user, day and path']], 'Reader and time only: no fields, purpose or legal basis per event.'],
  ['Recipient access is role-bound, time-limited and auditable', 'tested', [['supabase/supportshares.check.sql', 'losing the role stops the share without anyone revoking it'], ['supabase/rolegrants.check.sql', 'role grants carry scope, expiry and revocation']], 'Supporters are not roles; a supporter’s access is bound to the invite, not to a grant that can lapse.'],
  ['If a FERPA exception is used, the system records the exception rationale and institutional authorization', 'not-started', [['docs/FERPA-COPPA-1EDTECH-READINESS.md', 'FERPA-1, school-official terms, is not started']], 'No table or code records an exception; every disclosure the tables allow is by the student’s consent.'],
  ['Export, correction, deletion, retention and legal-hold behaviour are defined', 'building', [['supabase/migrations/20260926150000_expansion_roles_and_features.sql', 'data_requests: export, delete, correct, restrict'], ['supabase/migrations/20260930100000_legal_holds.sql', 'a legal hold on an account, a school or the platform'], ['app/src/lib/retention.test.ts', 'every table has a retention answer']], 'A legal-hold object exists (`legal_holds`, maturity RM-02 partial) but no screen or runbook places one, and a hold is placed on an account, a school or the platform, not on a share.'],
  ['Accessibility review confirms keyboard, screen-reader, plain-language and mobile use', 'building', [['app/src/a11y/axe.test.tsx', 'axe-core over the rendered app'], ['docs/accessibility/AT-PASS-PROTOCOL.md', 'the manual assistive-technology pass, not yet done']], 'No manual assistive-technology pass of a share screen, and no plain-language review of the consent copy.'],
];

export const CONTROLS: readonly Control[] = ROWS.map(([control, status, evidence, gap], i) => ({
  id: `FC-${String(i + 1).padStart(2, '0')}`,
  control, status,
  evidence: evidence.map(([path, shows]) => ({ path, shows })),
  gap,
}));

/** The tables the data model may name. Each must be created by a migration; the test reads them. */
export const TABLES: readonly string[] = ['advisor_shares', 'advisor_share_events', 'support_shares', 'family_grants', 'family_shared_items', 'support_access_grant', 'consent_record'];
