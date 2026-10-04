/**
 * The higher-ed RFP response library, as data a test can hold to the tree.
 *
 * The launch command's rule is the whole reason this is code: **no claim can be
 * marked available without source, evidence and status.** An RFP answer is a
 * promise read by a procurement officer and quoted back in a contract, and the
 * failure it invites is the one this repository has already had in its own
 * readiness documents — a status that says more than the code can show.
 *
 * So every answer carries one of the command's six statuses (plus one for
 * facts only the company can supply), the files that show it, and — for
 * security, privacy, accessibility and AI answers — the HECVAT control it
 * rests on. `rfp.test.ts` refuses:
 *
 *   - an `available`, `tenant-configuration` or `feature-flagged-pilot` answer
 *     with no evidence, or evidence that does not exist;
 *   - an `available` answer resting on a HECVAT control that is not `READY`
 *     in `docs/market-readiness/HECVAT_READINESS.md`;
 *   - any `approved-integration` answer while the production adapter registry
 *     (`app/server/institution/adapters.ts`) is empty — which it is;
 *   - certification language ("compliant", "certified", "guarantee",
 *     "real-time", …) anywhere it is not negated.
 *
 * Answers are written for a reader outside the company, in the words the
 * company can defend. Where the honest answer is "no", it says no.
 */

export const STATUSES = [
  'available',
  'tenant-configuration',
  'approved-integration',
  'feature-flagged-pilot',
  'planned',
  'not-supported',
  'company-input',
] as const;
export type ClaimStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  available: 'Available now',
  'tenant-configuration': 'Available with tenant configuration',
  'approved-integration': 'Available through an approved integration',
  'feature-flagged-pilot': 'Feature-flagged pilot',
  planned: 'Planned / not available',
  'not-supported': 'Not supported',
  'company-input': 'Company to supply',
};

/** Statuses that assert something exists, and so must cite what shows it. */
export const NEEDS_EVIDENCE: readonly ClaimStatus[] = ['available', 'tenant-configuration', 'feature-flagged-pilot'];

export const SECTIONS = [
  'executive-summary',
  'company-profile',
  'product-scope',
  'functional-requirements',
  'technical-architecture',
  'security',
  'privacy-ferpa',
  'accessibility',
  'ai-governance',
  'integrations',
  'implementation',
  'support-sla',
  'pricing',
  'references',
  'contract-terms',
] as const;
export type Section = (typeof SECTIONS)[number];

export interface Answer {
  id: string;
  section: Section;
  question: string;
  answer: string;
  status: ClaimStatus;
  /** Repository-relative files that show the answer is true. */
  evidence: string[];
  /** HECVAT register controls the answer rests on. */
  hecvat?: string[];
  /** For `approved-integration`: the installed adapter's id in app/server/institution/adapters.ts. */
  adapter?: string;
}

/** Sections whose `available` answers must rest on at least one HECVAT control. */
export const REGULATED: readonly Section[] = ['security', 'privacy-ferpa', 'accessibility', 'ai-governance'];

/**
 * Words that assert an outside party's judgement, or a promise no code makes.
 * Each may appear only negated — "Semester does not claim …", "no SOC 2 report".
 */
const CLAIM_WORDS = /\b(compliant|compliance|certified|certification|conforman(?:t|ce)|guarantee[sd]?|real-time|HIPAA|fully secure|unhackable)\b/gi;
const NEGATION = /\b(not|no|never|without|nor)\b/i;

/** Certification language in `text` that is not negated just before it. */
export function unsupportedClaims(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(CLAIM_WORDS)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
    // A sentence boundary, a comma or a contrast ends the reach of a negation:
    // "No audit, but it is certified" negates the audit, not the certificate.
    const clause = before.split(/[.;:!?,]|\b(?:but|however|yet|although|though)\b/i).pop() ?? '';
    if (!NEGATION.test(clause)) found.push(m[0]);
  }
  return found;
}

export const LIBRARY: readonly Answer[] = [
  // ── Executive summary ───────────────────────────────────────────────────
  {
    id: 'ES-1', section: 'executive-summary', status: 'available',
    question: 'Summarize the solution and its role on campus.',
    answer: 'Semester is a planning and experience layer over university life: a student sees deadlines, degree progress, registration planning, study tools and campus help in one place, on phone and desktop. It is not a system of record. It does not submit registrations, grades or forms to university systems, and says so on screen.',
    evidence: ['docs/market-readiness/EXECUTIVE_READINESS.md', 'app/src/screens/Today.tsx', 'app/server/institution/adapters.ts'],
  },
  // ── Company profile ─────────────────────────────────────────────────────
  {
    id: 'CP-1', section: 'company-profile', status: 'company-input',
    question: 'Company ownership, size, years in operation, financial standing.',
    answer: 'To be written by the company from its own records for each response. This repository holds no company records by design.',
    evidence: [],
  },
  // ── Product scope ───────────────────────────────────────────────────────
  {
    id: 'PS-1', section: 'product-scope', status: 'available',
    question: 'Which student workflows does the product support today?',
    answer: 'Today (next actions and deadlines), courses and assignments, calendar, degree planning from published requirements, registration planning, study tools and campus directories. The in-app guide is generated from the shipped screens, so it cannot describe a screen that does not exist.',
    evidence: ['app/src/screens/Today.tsx', 'app/src/screens/Degree.tsx', 'app/src/screens/Yes.tsx', 'app/src/lib/guidebook.ts'],
  },
  {
    id: 'PS-2', section: 'product-scope', status: 'available',
    question: 'Does the product work offline and across devices?',
    answer: 'Yes. It is local-first: a student’s work is on their device and, when signed in, merged field by field across devices. It shows what it has when offline and says it is offline.',
    evidence: ['app/src/lib/cloud.ts', 'app/src/lib/merge.ts', 'app/src/lib/offline.ts'],
  },
  // ── Functional requirements ─────────────────────────────────────────────
  {
    id: 'FR-1', section: 'functional-requirements', status: 'not-supported',
    question: 'Can students register for courses through the product?',
    answer: 'No. Semester helps a student plan a schedule and find conflicts; registration is completed in the university’s own system. No registration adapter is installed.',
    evidence: ['app/server/institution/adapters.ts'],
  },
  {
    id: 'FR-2', section: 'functional-requirements', status: 'available',
    question: 'Does the product support degree planning?',
    answer: 'Yes, from the university’s published requirements, labelled as a plan rather than an official audit.',
    evidence: ['app/src/screens/Degree.tsx'],
  },
  {
    id: 'FR-3', section: 'functional-requirements', status: 'planned',
    question: 'Does the product read the official degree audit?',
    answer: 'Not yet. A degree-audit integration is designed and exercised only against mock providers; no university’s audit system is connected.',
    evidence: ['app/src/lib/integration/catalog.ts'],
  },
  {
    id: 'FR-4', section: 'functional-requirements', status: 'feature-flagged-pilot',
    question: 'Can a student reach a person at a campus office from the product?',
    answer: 'Yes, behind a feature flag. The student sees exactly what will be sent (their name, confirmed email and only what they wrote and ticked) before sending; only staff who answer for that office can read it, and every open is shown to the student. Wellbeing needs route to a crisis line and are never stored as requests.',
    evidence: ['supabase/help-requests.check.sql', 'app/src/lib/experience-flags.ts'],
  },
  // ── Technical architecture ──────────────────────────────────────────────
  {
    id: 'TA-1', section: 'technical-architecture', status: 'available',
    question: 'Describe hosting and data storage.',
    answer: 'A static web application; account data in Supabase Postgres with row-level security on every table, tested by policy suites in CI against the Postgres major version production runs; an institutional gateway as serverless functions for university integrations.',
    evidence: ['supabase/check.sh', '.github/workflows/ci.yml', '.github/workflows/pages.yml', 'app/server/institution/runtime.ts'],
  },
  {
    id: 'TA-2', section: 'technical-architecture', status: 'planned',
    question: 'Is each institution’s data isolated from every other?',
    answer: 'Isolation is enforced and tested with cross-tenant negative checks for the institutional data layer. Extending the same proof to every older table is in progress, so this is not yet claimed for the whole schema.',
    evidence: ['supabase/tenancy.check.sql'],
    hecvat: ['TEN-1'],
  },
  // ── Security ────────────────────────────────────────────────────────────
  {
    id: 'SEC-1', section: 'security', status: 'tenant-configuration',
    question: 'Do you support institutional single sign-on?',
    answer: 'SAML single sign-on through the platform’s SSO, bound to one authorized identity provider per institution, with first sign-in bound to a provisioned membership. It is enabled per institution after an acceptance test with its identity team; no institution is live yet.',
    evidence: ['supabase/migrations/20260924150142_institution_identity_provisioning.sql', 'supabase/migrations/20260924154500_bind_institution_sso_membership.sql', 'docs/vanderbilt/identity-scim-acceptance.md'],
    hecvat: ['IAM-1'],
  },
  {
    id: 'SEC-2', section: 'security', status: 'available',
    question: 'How is access to administrative functions controlled?',
    answer: 'By capability, not by role name: each role carries named capabilities over a scope, grants are audited, and the database checks the capability on every protected read and write.',
    evidence: ['supabase/migrations/20260922012000_capabilities.sql', 'supabase/capabilities.check.sql'],
    hecvat: ['IAM-2'],
  },
  {
    id: 'SEC-3', section: 'security', status: 'available',
    question: 'Describe your secure development lifecycle.',
    answer: 'Every change runs type, lint, unit, shuffled-order and database-policy checks in CI, with secret and dependency scanning.',
    evidence: ['.github/workflows/ci.yml', '.gitleaks.toml'],
    hecvat: ['SDLC-1', 'SDLC-2'],
  },
  {
    id: 'SEC-4', section: 'security', status: 'planned',
    question: 'Has an independent penetration test been performed?',
    answer: 'No. An external test is planned; its report and remediation plan will be shared under NDA once it exists.',
    evidence: [],
    hecvat: ['VULN-2'],
  },
  {
    id: 'SEC-5', section: 'security', status: 'not-supported',
    question: 'Provide your SOC 2 Type II report.',
    answer: 'Semester has no SOC 2 report and does not plan one before a first pilot. The HECVAT readiness register is available instead.',
    evidence: [],
    hecvat: ['LEGAL-1'],
  },
  {
    id: 'SEC-6', section: 'security', status: 'planned',
    question: 'State your recovery time and recovery point objectives.',
    answer: 'Not yet stated. A restore rehearsal has been run locally; a timed restore of production, from which the objectives will be measured rather than chosen, has not.',
    evidence: [],
    hecvat: ['BCP-1'],
  },
  // ── Privacy / FERPA ─────────────────────────────────────────────────────
  {
    id: 'PF-1', section: 'privacy-ferpa', status: 'planned',
    question: 'Will you sign a data protection agreement with FERPA school-official terms?',
    answer: 'A DPA is drafted by counsel on request; none has been signed yet. Semester does not claim FERPA compliance on its own authority; it describes its controls and the institution’s counsel decides.',
    evidence: [],
    hecvat: ['PRIV-4'],
  },
  {
    id: 'PF-2', section: 'privacy-ferpa', status: 'available',
    question: 'Provide a data inventory and retention schedule.',
    answer: 'Every table has a written retention answer, and a test fails if a table is added without one.',
    evidence: ['RETENTION.md', 'app/src/lib/retention.test.ts'],
    hecvat: ['PRIV-1'],
  },
  {
    id: 'PF-3', section: 'privacy-ferpa', status: 'available',
    question: 'Can a student export and delete their data?',
    answer: 'Yes, themselves: a portable export (CSV, Markdown, calendar, restorable JSON) and account deletion that empties every table it claims to, proven by a database check.',
    evidence: ['app/src/lib/export.ts', 'supabase/deletion.check.sql'],
    hecvat: ['PRIV-2'],
  },
  {
    id: 'PF-4', section: 'privacy-ferpa', status: 'planned',
    question: 'List your subprocessors.',
    answer: 'A register of every destination student data can reach exists, labelled as subprocessor, institution-directed or student-directed, and a test holds it to the app’s content-security policy and its server functions. It is a draft: counsel has not reviewed it, each provider’s own terms and hosting regions are not yet on file, and it has not been published to institutions.',
    evidence: ['docs/SUBPROCESSORS.md', 'app/src/lib/trust/subprocessors.test.ts'],
    hecvat: ['PRIV-5'],
  },
  {
    id: 'PF-5', section: 'privacy-ferpa', status: 'available',
    question: 'Do you sell data, advertise to students, or score students for risk?',
    answer: 'No to all three. The privacy disclosure is written as data and a test fails when it drifts from the code; student risk scoring was considered and refused in writing.',
    evidence: ['app/src/lib/privacy.ts', 'app/src/lib/privacy.test.ts', 'docs/superpowers/specs/2026-09-23-semester-intelligence-expansion-design.md'],
    hecvat: ['PRIV-3'],
  },
  // ── Accessibility ───────────────────────────────────────────────────────
  {
    id: 'AX-1', section: 'accessibility', status: 'available',
    question: 'How is accessibility tested?',
    answer: 'Automated audits of the critical student journeys run in CI in a real browser, at desktop width and at the 320-pixel reflow width, alongside component-level focus, label, landmark and motion tests.',
    evidence: ['app/scripts/accessibility-smoke.mjs', 'app/src/a11y'],
    hecvat: ['A11Y-1'],
  },
  {
    id: 'AX-2', section: 'accessibility', status: 'planned',
    question: 'Provide a current VPAT / Accessibility Conformance Report.',
    answer: 'No ACR exists yet; it requires a formal evaluation, which is planned. Semester does not claim WCAG conformance until that evaluation is done.',
    evidence: [],
    hecvat: ['A11Y-2'],
  },
  {
    id: 'AX-3', section: 'accessibility', status: 'planned',
    question: 'Has the product been tested with screen readers?',
    answer: 'Not yet by a recorded manual pass. NVDA and VoiceOver passes of the critical journeys are planned.',
    evidence: [],
    hecvat: ['A11Y-3'],
  },
  // ── AI governance ───────────────────────────────────────────────────────
  {
    id: 'AI-1', section: 'ai-governance', status: 'tenant-configuration',
    question: 'How is generative AI governed?',
    answer: 'AI that uses institutional data runs only through a provider the institution has approved, with sources held on the server, a metered budget per tenant, and data classified so that sensitive classes never reach a consumer model; it is off until the institution turns it on. Separately, the student study toolkit is on in the public app, with code execution and external connectors off, and can be switched off by a rebuild.',
    evidence: ['docs/market-readiness/AI_GOVERNANCE.md', 'docs/ai-toolkit/DATA-CLASSIFICATION-AND-TOOL-GOVERNANCE.md', 'docs/ai-toolkit/AI-TOOLKIT-FEATURE-FLAGS.md'],
    hecvat: ['AI-1'],
  },
  {
    id: 'AI-2', section: 'ai-governance', status: 'planned',
    question: 'How are models evaluated for accuracy and bias?',
    answer: 'An evaluation set built from approved course sources is planned. No model evaluation results exist yet.',
    evidence: [],
    hecvat: ['AI-2'],
  },
  // ── Integrations ────────────────────────────────────────────────────────
  {
    id: 'INT-1', section: 'integrations', status: 'tenant-configuration',
    question: 'Do you support LTI 1.3?',
    answer: 'Yes: launch, deep linking and assignment scores, registered per institution. Names and Roles (the course roster) is deliberately not requested.',
    evidence: ['supabase/functions/lti/index.ts', 'supabase/lti.check.sql', 'app/src/lib/ltikey.test.ts'],
  },
  {
    id: 'INT-2', section: 'integrations', status: 'planned',
    question: 'Do you support SCIM provisioning?',
    answer: 'The SCIM 2.0 service and its audited data layer are built and tested; it is not yet reachable in production. Group-to-role mapping is always approved by the institution’s administrator.',
    evidence: ['app/server/institution/scim.ts', 'supabase/identity-provisioning.check.sql'],
  },
  {
    id: 'INT-3', section: 'integrations', status: 'planned',
    question: 'Which SIS, LMS and CRM systems do you integrate with?',
    answer: 'None is connected today. The integration contract, control plane and adapters are built against mock providers; each real connection is approved, credentialed and tested per institution before it is described as available.',
    evidence: ['app/server/institution/adapters.ts', 'docs/UNIVERSITY-OS-ARCHITECTURE.md'],
  },
  {
    id: 'INT-4', section: 'integrations', status: 'not-supported',
    question: 'Can you import full course rosters?',
    answer: 'No, by design: Semester does not request rosters, grades or enrollment lists through identity or LMS flows.',
    evidence: ['app/src/lib/ltikey.test.ts'],
  },
  // ── Implementation ──────────────────────────────────────────────────────
  {
    id: 'IM-1', section: 'implementation', status: 'available',
    question: 'Describe your implementation approach.',
    answer: 'A time-boxed paid pilot of 26 weeks with a written plan: an executive sponsor and an operational champion at the institution, a minimum-necessary data plan, a measured baseline and success criteria agreed before launch, and a signed decision to convert, expand, pause or stop.',
    evidence: ['docs/PAID-PILOT-FRAMEWORK.md', 'docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md'],
  },
  // ── Support / SLA ───────────────────────────────────────────────────────
  {
    id: 'SS-1', section: 'support-sla', status: 'planned',
    question: 'Describe support tiers and response times.',
    answer: 'Tiers and an incident process are written; a staffed support desk with stated response times is not yet in place and will be agreed per pilot.',
    evidence: [],
    hecvat: ['SUP-1'],
  },
  {
    id: 'SS-2', section: 'support-sla', status: 'not-supported',
    question: 'What uptime do you commit to contractually?',
    answer: 'No uptime commitment is offered before a first pilot. Production is monitored hourly by a synthetic check.',
    evidence: [],
  },
  // ── Pricing ─────────────────────────────────────────────────────────────
  {
    id: 'PR-1', section: 'pricing', status: 'company-input',
    question: 'Provide pricing.',
    answer: 'Priced per response by the company under the deal-desk policy; the figures in the repository are proposed defaults, not a price book.',
    evidence: ['docs/operating-model/COMMERCIAL-GOVERNANCE.md', 'app/src/lib/governance/deal-desk.ts'],
  },
  // ── References ──────────────────────────────────────────────────────────
  {
    id: 'RF-1', section: 'references', status: 'company-input',
    question: 'Provide three institutional references.',
    answer: 'There is no institutional customer yet. Do not name one; offer design-partner conversations instead, and only with that person’s written consent.',
    evidence: [],
  },
  // ── Contract terms ──────────────────────────────────────────────────────
  {
    id: 'CT-1', section: 'contract-terms', status: 'company-input',
    question: 'Provide your standard terms, order form and DPA.',
    answer: 'Drafts exist in the repository of a master subscription agreement, order form, statement of work, data processing addendum and pilot agreement. None has been reviewed by qualified counsel, approved or signed, so none can be offered as Semester’s terms. Counsel prepares the terms that are offered; the procurement checklist tracks what exists.',
    evidence: [
      'docs/legal-drafts/MASTER-SUBSCRIPTION-AGREEMENT-DRAFT.md',
      'docs/legal-drafts/ORDER-FORM-TEMPLATE-DRAFT.md',
      'docs/legal-drafts/STATEMENT-OF-WORK-TEMPLATE-DRAFT.md',
      'docs/legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md',
      'docs/legal-drafts/PILOT-AGREEMENT-DRAFT.md',
      'docs/market-readiness/PROCUREMENT_CHECKLIST.md',
    ],
  },
];

/** The library as a Markdown table, which the document must contain verbatim. */
export function renderLibrary(entries: readonly Answer[] = LIBRARY): string {
  const cell = (s: string) => s.replace(/\|/g, '\\|');
  const rows = entries.map((a) =>
    `| ${a.id} | ${cell(a.question)} | ${STATUS_LABELS[a.status]} | ${cell(a.answer)} | ${
      [...a.evidence.map((e) => `\`${e}\``), ...(a.hecvat ?? []).map((h) => `HECVAT ${h}`)].join(', ') || '—'
    } |`);
  return ['| ID | Question | Status | Answer | Evidence |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
}
