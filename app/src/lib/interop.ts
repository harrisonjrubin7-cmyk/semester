/**
 * Interoperability: the standards Semester supports or intends to, in the
 * order the brief sets, and the principles each is implemented under.
 *
 * The rule from the brief, kept exactly: support the right standards in the
 * right order, prove conformance, and make customer data portable — and do
 * not claim a certification before it is awarded. So every row here names
 * the claims-register entry that prints its status word on the public
 * integration registry (`/platform/integrations/`), and the register refuses
 * a word above what the readiness rows support. A row with no claim is a row
 * the site does not name as a capability at all.
 *
 * `docs/INTEROPERABILITY-ROADMAP.md` is rendered from this file by
 * `interop.test.ts`; edit the data, then `npm run registers` from app/.
 */

export type Priority = 1 | 2 | 3;
export type Timing = 'foundation' | 'after core value' | 'when assessment is real' | 'when competency mapping is real' | 'credential phase';

export interface Standard {
  id: string;
  standard: string;
  priority: Priority;
  /** What Semester uses it for. */
  use: string;
  /** Which way data moves, for the public registry. */
  direction: string;
  /** What is in scope, for the public registry. */
  scope: string;
  timing: Timing;
  /** The claims-register id that prints this row’s status word. */
  claim: string;
  /** Where the implementation or the design lives. */
  documentation: string;
}

export const STANDARDS: readonly Standard[] = [
  { id: 'lti', standard: 'LTI 1.3 / LTI Advantage', priority: 1, use: 'Secure launch from the learning system, roles, course context; deep linking and grade services where a faculty workflow justifies them.', direction: 'LMS → Semester', scope: 'The configured course context; a grade written back only under an approved scope', timing: 'foundation', claim: 'lti', documentation: 'docs/LTI-1.3-LAUNCH-RUNBOOK.md' },
  { id: 'lti-advantage', standard: 'LTI Advantage services (Deep Linking, AGS, NRPS)', priority: 1, use: 'Placing Semester content from the LMS picker and returning a grade; roster membership deliberately not requested.', direction: 'LMS ⇄ Semester', scope: 'Deep-linked placements and gated grade passback; no roster claim', timing: 'foundation', claim: 'lti-advantage', documentation: 'docs/LTI-1.3-LAUNCH-RUNBOOK.md' },
  { id: 'oneroster', standard: 'OneRoster 1.2', priority: 1, use: 'Roster, course, class and enrollment exchange where the institution supports it — an authorised feed, never an open source.', direction: 'SIS → Semester', scope: 'Approved roster fields only, under a data contract', timing: 'foundation', claim: 'oneroster', documentation: 'docs/FERPA-COPPA-1EDTECH-READINESS.md' },
  { id: 'identity', standard: 'OAuth 2.0 / OpenID Connect / SAML / SCIM', priority: 1, use: 'Secure identity, single sign-on, lifecycle provisioning and deprovisioning.', direction: 'Identity provider → Semester', scope: 'Identity claims and the user lifecycle; the narrowest OAuth scope each call needs', timing: 'foundation', claim: 'sso', documentation: 'docs/INSTITUTIONAL-SSO-ARCHITECTURE.md' },
  { id: 'scim', standard: 'SCIM provisioning', priority: 1, use: 'Accounts created, changed and retired from the identity provider.', direction: 'Identity provider → Semester', scope: 'User lifecycle; off by default, enabled per tenant', timing: 'foundation', claim: 'scim', documentation: 'docs/SCIM-LIFECYCLE-MANAGEMENT.md' },
  { id: 'api', standard: 'REST APIs, webhooks and versioned data contracts', priority: 1, use: 'Customer, partner and internal integration architecture.', direction: 'Semester ⇄ institution', scope: 'Named fields under a versioned contract; no undocumented endpoint', timing: 'foundation', claim: 'data-contracts', documentation: 'docs/data-contract.md' },
  { id: 'sis', standard: 'Read-only student-system connections', priority: 1, use: 'Registration windows, holds and dates, read-only and reconciled before first production sync.', direction: 'SIS → Semester', scope: 'Read-only; a reconciliation report before the first sync', timing: 'foundation', claim: 'sis', documentation: 'docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md' },
  { id: 'caliper', standard: 'Caliper Analytics', priority: 2, use: 'Standards-aligned learning events, only with transparent governance and minimal collection.', direction: 'Semester → institution', scope: 'Documented event types, aggregated and suppressed under n = 10; never a risk score', timing: 'after core value', claim: 'caliper', documentation: 'docs/PRODUCT-ANALYTICS-DATA-ETHICS.md' },
  { id: 'qti', standard: 'QTI', priority: 2, use: 'Portable assessment items, once Semester holds assessment content.', direction: 'LMS ⇄ Semester', scope: 'Question banks and their validation report', timing: 'when assessment is real', claim: 'qti', documentation: 'docs/LMS-LEARNING-ROADMAP.md' },
  { id: 'case', standard: 'CASE', priority: 2, use: 'Competency, outcome and skills frameworks, once competency mapping is real.', direction: 'Institution → Semester', scope: 'Framework references beside course outcomes', timing: 'when competency mapping is real', claim: 'qti', documentation: 'docs/LMS-LEARNING-ROADMAP.md' },
  { id: 'badges', standard: 'Open Badges 3.0', priority: 3, use: 'Verifiable individual achievement assertions, issuer-controlled and learner-held.', direction: 'Issuer → learner', scope: 'Real, evidence-backed achievements only; never decoration', timing: 'credential phase', claim: 'credentials', documentation: 'docs/CREDENTIAL-WALLET.md' },
  { id: 'clr', standard: 'Comprehensive Learner Record (CLR) and W3C Verifiable Credentials', priority: 3, use: 'A portable, learner-controlled record across academic, co-curricular, skills and work experience.', direction: 'Learner-controlled', scope: 'Export, share and revoke under the learner’s control', timing: 'credential phase', claim: 'credentials', documentation: 'docs/CREDENTIAL-WALLET.md' },
];

/** How a standard is implemented, in the brief's words, so a reviewer can hold the code to them. */
export const PRINCIPLES: Record<'lti' | 'oneroster' | 'caliper', readonly string[]> = {
  lti: [
    'LTI 1.3, never a legacy version.',
    'Platform registration and key rotation.',
    'Validate issuer, audience, deployment, nonce, state and the JWT signature.',
    'Every launch is tenant- and context-scoped.',
    'Minimal personal data in launch claims.',
    'Course and role context, and the institution’s configuration, are respected.',
    'Launch events are logged without storing unnecessary payloads.',
    'Deep linking only where there is a clear faculty workflow.',
    'A write to the LMS is opt-in, explicit, previewable and audited.',
    'A graceful fallback when LTI is unavailable.',
  ],
  oneroster: [
    'An authorised roster and context feed, never an open data source.',
    'Data mapping, source freshness, field minimisation and customer approval.',
    'Last successful sync, errors, records affected and remediation steps are shown.',
    'Student work is never silently deleted when a roster status changes.',
    'Adds, drops, term transitions and historical records are handled deliberately.',
    'A reconciliation report before the first production sync.',
  ],
  caliper: [
    'Only events tied to a clear product or institutional purpose.',
    'Event types and fields are documented.',
    'Aggregation and suppression in institution dashboards.',
    'Operational analytics are separate from research.',
    'No hidden personal trait is inferred and no high-impact risk score is created.',
    'Institution-level policy controls and student transparency.',
    'Events are retained under an explicit schedule.',
  ],
};

export interface Stage {
  n: 1 | 2 | 3 | 4;
  title: string;
  steps: readonly string[];
  /** Where the company stands on it. */
  standing: string;
}

export const STAGES: readonly Stage[] = [
  { n: 1, title: 'Join and learn', steps: ['Become a 1EdTech member.', 'Join the LTI, OneRoster, TrustEd Apps, CLR and data-privacy workstreams.', 'Build relationships with procurement and interoperability leaders.'], standing: 'Not started. No membership; nothing here needs code.' },
  { n: 2, title: 'Build correctly', steps: ['Implement the first standards with automated conformance tests.', 'An internal interoperability test tenant and a synthetic-data suite.', 'Publish implementation guides and data maps.', 'Track standards and version support publicly.'], standing: 'Under way: LTI 1.3 launch, deep linking and grade services are tested against a test platform; the public registry is this page; the synthetic tenant is designed.' },
  { n: 3, title: 'Certify only when ready', steps: ['Pursue LTI and OneRoster certification after a stable implementation.', 'Complete TrustEd Apps privacy and security readiness.', 'Never claim a certification before it is awarded.'], standing: 'Not started, and the site says so: no certification is claimed anywhere.' },
  { n: 4, title: 'Turn interoperability into proof', steps: ['Publish supported standards, versions, data flows, limitations and customer settings.', 'Include migration and export capability in procurement materials.', 'Make interoperability a customer right, not an enterprise upsell.'], standing: 'Begun with this registry and the availability matrix; export is on every plan.' },
];

/** The credential lifecycle, in order; a badge ships only when every step is real. */
export const CREDENTIAL_LIFECYCLE: readonly string[] = [
  'Achievement definition',
  'Issuer authorisation',
  'Criteria',
  'Evidence attachment',
  'Learner acceptance and control',
  'Verifiable assertion',
  'Export, share and revoke lifecycle',
  'CLR aggregation',
];

export function standardById(id: string): Standard {
  const s = STANDARDS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown standard ${id}`);
  return s;
}
