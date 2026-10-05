/**
 * How a long-horizon capability is ranked, which frameworks Semester steers
 * by, the tiers and phases a capability belongs to, and the gate it must pass
 * before active delivery. The capabilities themselves, and where the
 * repository stands on each, are in `expansionregister.ts`.
 *
 * ## How this relates to what is already here
 *
 * `governance/scorecard.ts` already decides **what kind** of build a request
 * gets — core, module, pilot, partner or decline — from eleven 0–3 criteria,
 * and `governance/charters.ts` holds each flag's problem, user, owners, kill
 * switch and review date. Neither ranks one capability *against another*, and
 * neither asks the long-horizon questions (staffing approved, a controlled
 * test environment, a sunset path). This file adds those and nothing else:
 * `admit` requires a scorecard route rather than inventing a second one.
 */

import type { Route } from './governance/scorecard';

// ── Prioritisation ──────────────────────────────────────────────────────────

/** Each scored 1–5. The last two count against. */
export const DIMENSIONS = {
  trust: { weight: 1.5, question: 'Does it materially reduce security, privacy, accessibility, or operational risk?' },
  revenue: { weight: 1.3, question: 'Does it unlock a customer segment, contract, or renewal?' },
  studentValue: { weight: 1.2, question: 'Does it make a recurring student decision or action clearer?' },
  differentiation: { weight: 1.1, question: "Does it improve Semester's defensibility in university buying?" },
  dependency: { weight: 1.2, question: 'Does it unblock several other capabilities?' },
  evidenceUrgency: { weight: 1.2, question: 'Is it needed for HECVAT, VPAT, SOC 2, DPA, SLA, or procurement?' },
  readiness: { weight: 0.8, question: 'Can Semester staff support it now?' },
  complexity: { weight: -1.0, question: 'How much team time, vendor spend, and ongoing maintenance does it require?' },
  irreversibility: { weight: -1.0, question: 'How hard is it to pilot safely and roll back?' },
} as const;

export type Dimension = keyof typeof DIMENSIONS;

/**
 * The priority score. A decision aid for the quarterly review, never a
 * replacement for it: two capabilities a point apart are a tie, and the
 * review says which goes first and why. An incomplete or out-of-range card
 * returns `null` rather than a number, because a blank is not a 3.
 */
export function priority(scores: Partial<Record<Dimension, number>>): number | null {
  let total = 0;
  for (const [d, { weight }] of Object.entries(DIMENSIONS) as [Dimension, { weight: number }][]) {
    const s = scores[d];
    if (s === undefined || !Number.isInteger(s) || s < 1 || s > 5) return null;
    total += s * weight;
  }
  return Math.round(total * 10) / 10;
}

// ── Tiers and phases ────────────────────────────────────────────────────────

export const TIERS = {
  0: 'Must exist before enterprise launch',
  1: 'Unlocks repeatable institutional scale',
  2: 'High differentiation after the operational base',
  3: 'Strategic expansion after proof',
  4: 'Only with strict governance and demonstrated need',
} as const;

export type Tier = keyof typeof TIERS;

export const PHASES = {
  0: { name: 'Foundations and risk controls', objective: 'A secure, accessible, operable foundation before broad customer commitments.' },
  1: { name: 'Full launch core', objective: 'Make every advertised critical student, LMS, institution and company operation real.' },
  2: { name: 'Repeatable institution scale', objective: 'Turn launches into a repeatable operating model.' },
  3: { name: 'Durable differentiation', objective: 'Portability, career evidence, and trust-based network effects.' },
  4: { name: 'Ecosystem and global scale', objective: 'Extend responsibly through standards, partners, and geography.' },
} as const;

export type Phase = keyof typeof PHASES;

// ── Frameworks ──────────────────────────────────────────────────────────────

export type Adopt = 'now' | 'readiness-now' | 'when-justified';

export interface Framework {
  name: string;
  use: string;
  adopt: Adopt;
  /** What the repository already does against it; empty when nothing. */
  evidence: readonly string[];
  note: string;
}

/**
 * Alignment is a planning tool, not a certification claim. A test holds every
 * `note` to that: none may say Semester is certified or compliant.
 */
export const FRAMEWORKS: readonly Framework[] = [
  { name: 'NIST CSF 2.0', use: 'Umbrella security programme: govern, suppliers, incident, recovery', adopt: 'now', evidence: ['docs/SUPPLY-CHAIN.md', 'docs/SECURITY-GAP-ANALYSIS.md'], note: 'No crosswalk from CSF functions to controls exists yet.' },
  { name: 'NIST Privacy Framework', use: 'Privacy risk, data lifecycle, user control', adopt: 'now', evidence: ['docs/STUDENT-DATA-CONTROL-CENTER.md', 'RETENTION.md'], note: 'Controls exist; not mapped to the framework.' },
  { name: 'NIST AI RMF 1.0', use: 'Map, measure, manage and govern Semester Intelligence', adopt: 'now', evidence: ['docs/operating-model/AI-LIFECYCLE-GATES.md', 'app/src/lib/governance/ai-lifecycle.test.ts'], note: 'AI gates G0–G5 exist and are tested; the RMF mapping is not written.' },
  { name: 'CIS Controls', use: 'Practical technical-control baseline', adopt: 'now', evidence: [], note: 'Not assessed.' },
  { name: 'OWASP ASVS', use: 'Application-security verification in the SDLC', adopt: 'now', evidence: [], note: 'Not assessed. The RLS and capability checks cover part of V4 (access control) without saying so.' },
  { name: 'OWASP Top 10 / API Top 10', use: 'Threat coverage in threat models and tests', adopt: 'now', evidence: ['docs/INTEGRATION-THREAT-MODEL.md'], note: 'One threat model; not keyed to the Top 10.' },
  { name: 'OWASP SAMM', use: 'Software-assurance maturity plan', adopt: 'now', evidence: [], note: 'Not assessed.' },
  { name: 'SLSA', use: 'Build pipeline and artifact integrity', adopt: 'now', evidence: ['app/src/lib/supplychain.test.ts'], note: 'Scripted build on a hosted runner; no signed provenance, so below SLSA build level 2.' },
  { name: 'SBOM (CycloneDX / SPDX)', use: 'Dependency transparency', adopt: 'now', evidence: ['.github/workflows/pages.yml', 'app/src/lib/supplychain.test.ts'], note: 'CycloneDX SBOM of every deploy, kept 90 days.' },
  { name: 'NIST SP 800-161', use: 'Cyber supply-chain risk management', adopt: 'now', evidence: ['docs/SUPPLY-CHAIN.md', 'docs/SUBPROCESSORS.md'], note: 'Applied to dependencies and subprocessors informally.' },
  { name: 'HECVAT 4', use: 'Higher-ed vendor assessment', adopt: 'now', evidence: ['docs/market-readiness/HECVAT_READINESS.md', 'docs/trust/HECVAT-VPAT-PLAN.md'], note: 'Readiness tracked row by row; the response is not complete.' },
  { name: 'WCAG 2.2 AA', use: 'Product and public-site accessibility baseline', adopt: 'now', evidence: ['docs/WCAG-UI-AUDIT-SCORECARD.md', 'app/src/lib/contrast.test.ts'], note: 'Automated regression coverage; no formal third-party audit.' },
  { name: 'VPAT / ACR', use: 'Accessibility procurement evidence', adopt: 'now', evidence: ['docs/trust/HECVAT-VPAT-PLAN.md'], note: 'Planned; no ACR has been issued.' },
  { name: 'DPA / FERPA mapping', use: 'Contractual and technical privacy mapping', adopt: 'now', evidence: ['docs/trust/DPA-CHECKLIST.md', 'docs/FERPA-COPPA-1EDTECH-READINESS.md'], note: 'Checklists exist; counsel has not reviewed them.' },
  { name: 'SLOs and error budgets', use: 'Service operations', adopt: 'now', evidence: ['docs/operating-model/SLOS-AND-ERROR-BUDGETS.md', 'app/src/lib/governance/error-budgets.test.ts'], note: 'Budgets defined and tested; no production traffic measures them yet.' },
  { name: 'ITIL 4 (lightweight)', use: 'Incident, change and problem practice', adopt: 'now', evidence: ['docs/operating-model/INCIDENT-COMMUNICATIONS.md', 'app/src/lib/governance/incident-comms.test.ts'], note: 'Incident communications held; change and problem management informal.' },
  { name: 'LTI 1.3 / LTI Advantage', use: 'LMS launch, deep linking, grades', adopt: 'now', evidence: ['docs/LTI-1.3-LAUNCH-RUNBOOK.md', 'app/src/lib/lti.test.ts'], note: 'Implemented and tested; not 1EdTech certified.' },
  { name: 'OneRoster, QTI, Common Cartridge', use: 'Rostering, assessment and course interchange', adopt: 'now', evidence: ['docs/LMS-LEARNING-ROADMAP.md', 'docs/FERPA-COPPA-1EDTECH-READINESS.md'], note: 'Planned in the LMS learning plan.' },
  { name: 'CASE, Open Badges, CLR', use: 'Competencies, credentials, learner portability', adopt: 'when-justified', evidence: ['docs/CREDENTIAL-WALLET.md'], note: 'Designed for the wallet phases; nothing exports to them.' },
  { name: 'SOC 2 Type I / II', use: 'Independent assurance', adopt: 'readiness-now', evidence: ['docs/trust/SOC2-READINESS.md'], note: 'Readiness work only; no auditor engaged.' },
  { name: 'ISO/IEC 27001 and 27701', use: 'ISMS and privacy certification for global procurement', adopt: 'when-justified', evidence: [], note: 'When target customers or revenue justify the certification effort.' },
  { name: 'ISO/IEC 42001', use: 'AI management system', adopt: 'when-justified', evidence: [], note: 'As AI governance matures and enterprise demand warrants.' },
  { name: 'NIST SP 800-53', use: 'Control mapping for public-sector buyers', adopt: 'when-justified', evidence: [], note: 'Map selectively on a buyer requirement; never attempt the full catalogue unasked.' },
  { name: 'CSA Cloud Controls Matrix', use: 'Cloud/SaaS questionnaires (CAIQ)', adopt: 'when-justified', evidence: [], note: 'If customers send CAIQ.' },
  { name: 'ISO 22301', use: 'Business continuity management', adopt: 'when-justified', evidence: [], note: 'When an enterprise contract requires a formal BCMS.' },
  { name: 'COBIT', use: 'Enterprise IT governance and audit alignment', adopt: 'when-justified', evidence: [], note: 'For large institutional governance alignment.' },
  { name: 'FinOps practices', use: 'Cloud and AI cost governance', adopt: 'when-justified', evidence: [], note: 'As infrastructure and AI costs grow.' },
];

// ── What waits ──────────────────────────────────────────────────────────────

/**
 * Capabilities that could hurt trust if rushed. Semester is stronger because
 * it refuses to cross these lines casually. Each can enter only through `admit`
 * with a Tier 4 record: an explicit governance review, not a feature request.
 */
export const DEFERRED: readonly { what: string; why: string }[] = [
  { what: 'Health records', why: 'HIPAA/FERPA boundary; a breach is unrecoverable for trust.' },
  { what: 'Mental-health prediction', why: 'Clinical claims, false positives with real harm, and no consent a student can meaningfully give.' },
  { what: 'Behavioral risk scoring', why: 'An unexplained label follows a student; `DO-NOT-BUILD.md` rule 3 already forbids an unexplained score.' },
  { what: 'Disciplinary decision tools', why: 'Due process belongs to people; Semester would be evidence in a hearing.' },
  { what: 'Financial-aid eligibility decisions', why: 'A regulated determination; Semester may explain, never decide.' },
  { what: 'Biometric proctoring', why: 'Biometric law, accessibility harm, and surveillance.' },
  { what: 'Emotion recognition', why: 'Scientifically weak and restricted in education under the EU AI Act.' },
  { what: 'Student surveillance', why: 'The opposite of the product thesis.' },
  { what: 'Direct bank or payment credential storage', why: 'PCI scope and a breach target; payments stay with the processor.' },
  { what: 'Public social feeds', why: 'Moderation at scale, minors, and harassment; community stays scoped and moderated.' },
  { what: 'Unmoderated messaging', why: 'Safety and duty of care.' },
  { what: 'Unreviewed marketplace transactions', why: 'Fraud and liability.' },
  { what: 'Automated admissions or academic-dismissal decisions', why: 'High-impact decisions about a person need a person.' },
  { what: 'Direct registration writes', why: 'Tier 4: a wrong write loses a student a seat; read and prepare only.' },
  { what: 'Emergency disclosure', why: 'Tier 4: a FERPA health-or-safety disclosure is an institutional act.' },
  { what: 'International data residency expansion', why: 'Tier 4: needs transfer mechanisms and local counsel.' },
];

// ── The roadmap admission gate ──────────────────────────────────────────────

/**
 * Before a long-horizon capability enters active delivery. The first eight
 * are the final expansion test (the questions a student, parent, faculty
 * member, accessibility reviewer, privacy officer and regulator would ask);
 * the rest are the operating conditions. Each is answered with a written
 * reason, never a bare yes.
 */
export const GATE = [
  { id: 'problem', ask: 'Strategic problem and target user documented; it makes a real student decision clearer' },
  { id: 'value', ask: 'Student, customer or institution value evidenced — a safe, measurable benefit' },
  { id: 'source', ask: 'Data source and authority identified; source, limitation and privacy impact explainable' },
  { id: 'review', ask: 'Privacy, security and accessibility review completed' },
  { id: 'consent', ask: 'Role, scope and consent model defined' },
  { id: 'owner', ask: 'Operational owner and support model assigned; it can be supported, contracted and offboarded' },
  { id: 'failure', ask: 'SLO, failure, fallback and rollback defined — including during academic peak periods' },
  { id: 'proof', ask: 'Metrics and limitations defined, so it can be shown to work' },
  { id: 'contract', ask: 'Contract and commercial implications reviewed' },
  { id: 'staffing', ask: 'Staffing, cost, vendor and maintenance burden approved' },
  { id: 'sandbox', ask: 'Can be tested in a controlled environment' },
  { id: 'sunset', ask: 'Sunset, deprecation or exit path defined' },
  { id: 'explain', ask: 'Comfortable explaining it to a student, parent, faculty member, accessibility reviewer, privacy officer and regulator' },
] as const;

export type GateId = (typeof GATE)[number]['id'];

export interface Proposal {
  name: string;
  tier: Tier;
  /** From `governance/scorecard.ts#assess`. */
  route: Route;
  /** Each gate question, answered with its reason. A blank is a no. */
  answers: Partial<Record<GateId, string>>;
  /** Which `DEFERRED` line it touches, if any. */
  touchesDeferred?: string;
  /** For Tier 4 or a deferred line: the governance review that approved it. */
  governanceReview?: string;
}

export interface Admission {
  admitted: boolean;
  unanswered: GateId[];
  reasons: string[];
}

const MIN_REASON = 20;

export function admit(p: Proposal): Admission {
  const unanswered = GATE.map((g) => g.id).filter((id) => (p.answers[id]?.trim().length ?? 0) < MIN_REASON);
  const reasons: string[] = [];
  if (unanswered.length) reasons.push(`${unanswered.length} gate question(s) unanswered: ${unanswered.join(', ')}`);
  if (p.route === 'reject_or_redesign') reasons.push('its scorecard has a 0 or a blank');
  if (p.route === 'partner_or_decline') reasons.push('its scorecard routes it to partner or decline, not delivery');
  if (p.touchesDeferred && !DEFERRED.some((d) => d.what === p.touchesDeferred)) reasons.push(`"${p.touchesDeferred}" is not a deferred line`);
  if ((p.tier === 4 || p.touchesDeferred) && (p.governanceReview?.trim().length ?? 0) < MIN_REASON)
    reasons.push(p.touchesDeferred ? `it touches "${p.touchesDeferred}", which needs a recorded governance review` : 'Tier 4 needs a recorded governance review');
  return { admitted: reasons.length === 0, unanswered, reasons };
}
