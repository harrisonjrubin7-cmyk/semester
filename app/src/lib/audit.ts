/**
 * The four-pillar audit: website, application and console, operations, and
 * funnels — the 45 controls of the audit workbook, each scored against the
 * tree, and the scoring model the workbook uses for what the audit finds.
 *
 * The workbook (the brief's `semester_saas_4_pillar_audit.xlsx`) is the
 * master structure: four pillar sheets with numbered controls, a findings
 * register, a priority matrix and a conversion-leak detector. This file is
 * that workbook as data the tests can hold, in the same ids, so that the
 * filled workbook and this register cannot disagree: the workbook is
 * rendered from here (`scripts/audit-workbook.py` reads the rendered page).
 *
 * ## The scale
 *
 *   0  Missing, unknown or unsafe — fix or explicitly stop the workflow
 *   1  Exists informally — document owner, policy and minimum process
 *   2  Implemented inconsistently — standardise and instrument
 *   3  Implemented and measured — add monitoring and recurring review
 *   4  Evidence-led and continuously improved — share as a proof point
 *
 * A score of 3 or 4 cites a path that exists and names how it is measured;
 * a 4 needs a test or check that runs on every change. Nothing here is a 4
 * that a test does not hold, and the test refuses a 4 without one.
 *
 * ## Prioritising a finding
 *
 *   priority = (2·harm + 2·revenue + frequency + strategic + confidence) ÷ effort
 *
 * with every input 1–5, and bands P1 ≥ 12, P2 8–11.99, P3 < 8. The
 * mandatory override: anything involving security, privacy, legal exposure,
 * an inaccessible critical path, data loss, or misleading official or AI
 * guidance is P0 whatever the formula says. The impact-versus-effort
 * quadrant is a second reading of the same finding.
 *
 * `docs/operating-model/FOUR-PILLAR-AUDIT.md` is rendered from this file by
 * `audit.test.ts`; edit the data, then `npm run registers` from app/.
 */

export type Pillar = 'website' | 'app' | 'operations' | 'funnels';

export const PILLARS: Record<Pillar, { title: string; question: string; failure: string; outcome: string }> = {
  website: { title: 'Website', question: 'Can the right visitor understand, trust and act?', failure: 'Confusion and distrust', outcome: 'Clear positioning plus credible conversion' },
  app: { title: 'App and Console', question: 'Can each role complete important work safely and easily?', failure: 'Friction, ambiguity, inaccessible workflows', outcome: 'Calm, source-aware, role-specific execution' },
  operations: { title: 'Operations', question: 'Can Semester reliably keep its promises at scale?', failure: 'Hidden risk and reactive work', outcome: 'Observable, auditable, resilient delivery' },
  funnels: { title: 'Funnels', question: 'Can interest become adoption and advocacy without leakage?', failure: 'Slow routing, weak activation, broken handoffs', outcome: 'Measurable progression from intent to value' },
};

export type Score = 0 | 1 | 2 | 3 | 4;

export const SCORE_MEANING: Record<Score, { means: string; action: string }> = {
  0: { means: 'Missing, unknown or unsafe', action: 'Fix or explicitly stop the affected workflow' },
  1: { means: 'Exists informally', action: 'Document owner, policy and minimum viable process' },
  2: { means: 'Implemented inconsistently', action: 'Standardise and instrument it' },
  3: { means: 'Implemented and measured', action: 'Add automated monitoring and recurring review' },
  4: { means: 'Evidence-led and continuously improved', action: 'Share as a market proof point' },
};

export interface Control {
  id: string;
  pillar: Pillar;
  domain: string;
  /** The control, in the workbook's words. */
  control: string;
  score: Score;
  /** A path that shows it; required at 3 or 4, and a test or check at 4. */
  evidence: string | null;
  /** The gap, or what is measured. */
  gap: string;
}

const c = (id: string, pillar: Pillar, domain: string, control: string, score: Score, evidence: string | null, gap: string): Control => ({ id, pillar, domain, control, score, evidence, gap });

export const CONTROLS: readonly Control[] = [
  // ── Website ──────────────────────────────────────────────────────────────
  c('WEB-001', 'website', 'Positioning', 'Homepage names the category without jargon and explains the primary outcome before features.', 3, 'app/src/site/site.test.tsx', 'The home page leads with the promise and “what brings you”; the test holds both. No five-second test with visitors has been run.'),
  c('WEB-002', 'website', 'Positioning', 'Student, institution, faculty/advisor, and partner audiences have dedicated paths.', 2, 'app/src/site/pages.tsx', 'Students and institutions have pages; faculty and advisors share the institutions page; partners have only careers and contact. The home router sends each visitor to a real page.'),
  c('WEB-003', 'website', 'Trust', 'Security, privacy, accessibility, AI, status, and system-boundaries content is discoverable.', 4, 'app/src/site/site.test.tsx', 'All six are in the footer and the test holds every link to a real page; the status page is linked from readiness, help and product quality.'),
  c('WEB-004', 'website', 'Trust', 'Claims link to evidence; logos, testimonials, metrics, and certifications are verified.', 4, 'app/src/lib/ops/claims.test.ts', 'Every capability prints a register word the test refuses to overstate; there is no logo, testimonial, metric or certification on the site, and the proof rules say why.'),
  c('WEB-005', 'website', 'Conversion', 'Each high-intent page has one clear primary CTA matched to visitor intent.', 2, 'app/src/site/pages.tsx', 'Get started is the one button on most pages; institutions and demo end in a mail link. No click-through has been measured.'),
  c('WEB-006', 'website', 'Conversion', 'Forms ask only for necessary information and state what happens next.', 3, 'app/src/site/site.test.tsx', 'There is no form: the site’s policy is form-action none, and contact is a mail link routed to a seat with no promised response time. The next step is stated on the contact page.'),
  c('WEB-007', 'website', 'Conversion', 'Demo/resource/booking paths work on mobile and failures are monitored.', 2, 'app/src/site/more.tsx', 'The demo page hands off to the built demo; no booking exists; the site is checked at phone width in the accessibility smoke. Nothing monitors a failed handoff.'),
  c('WEB-008', 'website', 'Accessibility', 'Critical journeys are keyboard-operable, readable at high zoom, and tested with assistive technology.', 3, 'app/src/site/site.test.tsx', 'One main, a skip link, one h1 and a language on every page by test, and the app’s axe run; no assistive-technology session has been recorded.'),
  c('WEB-009', 'website', 'Design', 'Design system is consistent across typography, spacing, colors, states, content voice, and responsive behavior.', 3, 'app/src/site/site.test.tsx', 'The site’s colours are held equal to the app’s tokens by test, and the style and label lints run on every change. Content voice is reviewed by hand.'),
  c('WEB-010', 'website', 'Performance', 'Performance budgets and monitoring exist for LCP, INP, CLS, scripts, and media assets.', 1, 'docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md', 'Content pages ship no script and the tool bundle is measured by hand at about 71 kB gzipped. No web-vitals budget, no field measurement.'),
  c('WEB-011', 'website', 'Measurement', 'UTM governance, CTA events, form events, booking events, and qualified-pipeline attribution are implemented.', 1, 'app/src/lib/gtm/utm.ts', 'Campaign naming and standard attribution are code with tests. The site sets no cookie and fires no event by design; only first-party server counts exist, so CTA and pipeline attribution are not implemented.'),

  // ── App and Console ──────────────────────────────────────────────────────
  c('APP-001', 'app', 'Context', 'Users can see and safely switch institution, term, course, role, and permissions.', 3, 'app/src/lib/capabilities.ts', 'School, term and role are shown and switchable; capabilities come from the database, never the selector, and the control plane refuses a cross-tenant view. No institution has more than one campus to switch between.'),
  c('APP-002', 'app', 'Completing work', 'Each role has a useful home screen and clear next important action.', 3, 'app/src/lib/explain.ts', 'Today leads with one next step for a student; the institution screen leads with services for staff. Role-specific homes for faculty and advisors are the role-launch register’s open items.'),
  c('APP-003', 'app', 'Completing work', 'Core workflows avoid internal jargon, use progressive disclosure, and have clear empty states.', 3, 'app/src/content/terms.ts', 'The vocabulary lint refuses retired words on screen; About this screen is disclosed in place; empty, loading, error and success states have one spec. Not every empty state has been checked against it.'),
  c('APP-004', 'app', 'Trust', 'Important data shows Source, Scope, and Status; estimates are distinct from official outcomes.', 4, 'app/src/lib/source.test.ts', 'Five source labels held to the database’s check constraints; source, scope and status as one shape; every estimate labelled and never called official.'),
  c('APP-005', 'app', 'AI governance', 'AI output identifies grounding, policy state, limitations, and review/escalation route.', 4, 'app/src/ai/quality.test.ts', 'Source strength, policy state, what it can and cannot claim, and six reasons to mark a reply, under every answer.'),
  c('APP-006', 'app', 'Recovery', 'High-impact actions offer preview, confirmation, undo/recovery, and meaningful error guidance.', 3, 'app/src/lib/undo.ts', 'Nothing is sent or shared without a preview; undo exists for the assistant’s applied actions and for deletions; Recovery is one screen under Me. Error copy is not yet audited screen by screen.'),
  c('APP-007', 'app', 'Sharing', 'Shares show recipient, scope, duration, purpose, and immediate revoke control.', 3, 'app/src/lib/advisor-shares.test.ts', 'Recipient, scope, expiry and revoke are held by test for advising and supporter shares. Purpose is not a field the recipient sees.'),
  c('APP-008', 'app', 'Accessibility', 'Keyboard, screen reader, zoom, contrast, motion, mobile, and non-drag alternatives are tested.', 3, 'app/src/a11y/axe.test.tsx', 'axe on twelve desktop and three phone screens; the contrast ramp on every ground; no drag-only planning. No human assistive-technology review has been recorded.'),
  c('APP-009', 'app', 'Console control', 'Tenant changes use permissions, review, version history, preview, and rollback.', 2, 'app/src/lib/governance/config-tiers.ts', 'Every setting has a tier and reviewers, the policy simulator previews a change, and the gateway applies with a receipt. Version history and rollback of a tenant setting are designed, not built.'),
  c('APP-010', 'app', 'Console control', 'Support access is least-privilege, time-bound, auditable, and revocable.', 4, 'supabase/support-access.check.sql', 'A support read needs a live, time-limited grant the student can see and revoke, and the grant is logged; held by a check that runs on every change.'),
  c('APP-011', 'app', 'Integration', 'Integrations show scope, owner, freshness, last success, failure state, and fallback guidance.', 2, 'app/src/lib/integration/dashboard.ts', 'The staff dashboard shows all six behind an off-by-default flag; the trust dashboard shows a student’s connections with last sync. No institutional connection is live to be measured.'),

  // ── Operations ───────────────────────────────────────────────────────────
  c('OPE-001', 'operations', 'Reliability', 'Service objectives, monitoring, alert ownership, status communication, and incident runbooks exist.', 2, 'app/src/lib/governance/error-budgets.ts', 'SLOs and error budgets are code; the status page checks from the reader’s browser; runbooks are indexed. No synthetic monitoring has run long enough to publish an uptime figure, and alert ownership is one person.'),
  c('OPE-002', 'operations', 'Incident response', 'Severity, impact, communications, evidence, post-incident review, and follow-through are tracked.', 2, 'app/src/lib/governance/incident-comms.ts', 'Severity, audiences and templates are code; the process has not been exercised, even as a tabletop, which is on the proof calendar.'),
  c('OPE-003', 'operations', 'Security', 'MFA, access review, secrets, encryption, backups, vulnerability management, and logging have evidence.', 2, 'SECURITY.md', 'Secrets scanning and RLS run on every change; a restore passes locally. MFA is planned, no access review has been held, and no independent test has run.'),
  c('OPE-004', 'operations', 'Privacy', 'Data inventory, retention, export, deletion, legal holds, subprocessors, and access controls are enforceable.', 3, 'app/src/lib/retention.test.ts', 'The inventory, retention and deletion are held by bidirectional tests; export and deletion are self-serve; subprocessors are listed. Legal holds do not exist (maturity RM-02).'),
  c('OPE-005', 'operations', 'AI operations', 'Model/provider, prompt, retrieval, evaluation, safety incidents, retention, and changes are inventoried.', 2, 'app/src/lib/governance/ai-lifecycle.ts', 'The lifecycle gates and the kill switch are code; providers are listed with what each receives; the gateway keeps metadata 180 days. No evaluation has run and no change log exists per deployment.'),
  c('OPE-006', 'operations', 'Release management', 'Release impact covers tenants, roles, integrations, accessibility, security, docs, support, and rollback.', 3, 'app/src/lib/governance/consolechecks.ts', 'Release impact and customer-promise checks are pure functions with tests; release readiness scores eight dimensions with a floor. No release has been scored for a real tenant.'),
  c('OPE-007', 'operations', 'Customer promises', 'Contractual commitments map to operational controls, entitlements, support tiers, and monitoring.', 3, 'app/src/lib/ops/commitments.test.ts', 'Every customer commitment names its seat, date and record, and the promise checker reads them. No contract exists to map.'),
  c('OPE-008', 'operations', 'Support', 'Support routing, escalation, permissions, knowledge base quality, and ticket resolution analytics are managed.', 2, 'app/src/lib/help-routes.ts', 'Routing to offices and to Semester support is code; tickets carry a handoff; escalation policy is written. No resolution analytics, and support is one person.'),
  c('OPE-009', 'operations', 'Continuity', 'Business continuity covers vendor outage, staff loss, cyber incident, regional disruption, and communications.', 1, 'docs/market-readiness/DISASTER_RECOVERY.md', 'Recovery is written and a restore passes locally; the app works offline. Founder-unavailable, vendor-insolvency and regional scenarios are named in the maturity register as owed.'),
  c('OPE-010', 'operations', 'FinOps', 'Cloud, AI, storage, observability, and integration costs are allocated, monitored, and governed.', 1, 'app/src/lib/spend.ts', 'AI spend is metered per account and shown to the student. Nothing attributes cloud spend to a tenant or module, and no anomaly alert exists.'),
  c('OPE-011', 'operations', 'Knowledge', 'Runbooks have owners, test dates, expiry review, onboarding validation, and emergency/offline access.', 2, 'app/src/lib/ops/operatingsystem.ts', 'Every controlled document has an owner seat, a review date, and a test that fails when the date passes. No runbook records when it was last walked, and no hire has followed setup cold.'),

  // ── Funnels ──────────────────────────────────────────────────────────────
  c('FUN-001', 'funnels', 'Audience', 'ICP, jobs-to-be-done, messaging, proof, CTA, and qualification path are explicit by segment.', 2, 'docs/INSTITUTIONAL-GTM-PLAYBOOK.md', 'The ICP is ordered by fit, messaging is code with tests, and the home page routes six audiences. Qualification is described, not run; no lead has arrived.'),
  c('FUN-002', 'funnels', 'Acquisition', 'Campaigns have message match, source attribution, landing pages, and qualified-traffic measures.', 1, 'app/src/lib/gtm/campaign.ts', 'Campaign objects, audience rules and approvals are code behind a flag. No campaign has run and no traffic is measured.'),
  c('FUN-003', 'funnels', 'Conversion', 'Track visit→CTA, CTA→form start, form→submit, submit→booking, and booking→meeting.', 0, null, 'None of these is tracked: the site fires no event by design, and there is no form or booking. The leak detector below is the shape the measurement will take.'),
  c('FUN-004', 'funnels', 'Lead routing', 'Every lead is matched, assigned, acknowledged, SLA-tracked, escalated if unclaimed, and outcome-logged.', 1, 'docs/INSTITUTIONAL-GTM-PLAYBOOK.md', 'Contact topics route to a council seat by mail subject. No CRM, no SLA clock, no escalation; the routing rules below are the design.'),
  c('FUN-005', 'funnels', 'Lead quality', 'Lead scoring uses declared intent and account fit; it avoids unnecessary behavioral surveillance.', 2, 'app/src/lib/gtm/campaign.ts', 'Prohibited targeting fields are refused in code. There is no scoring because there are no leads; the rule that scoring uses declared intent only is stated here.'),
  c('FUN-006', 'funnels', 'Sales handoff', 'Sales has source, stated intent, account context, prior actions, and required consent information.', 1, 'app/src/lib/gtm/stages.ts', 'Deal stages and what each needs are code. No handoff has happened.'),
  c('FUN-007', 'funnels', 'Activation', 'Track signup→verified→context selected→first meaningful outcome→week-one retention.', 1, 'ANALYTICS.md', 'First-party counts exist for a few events; none of these five transitions is measured as a funnel.'),
  c('FUN-008', 'funnels', 'Onboarding', 'New users reach a useful first outcome quickly with progressive, role-specific guidance.', 3, 'app/scripts/golden-path.mjs', 'The golden path drives a new student to a usable week and is run as a smoke; onboarding is progressive and can be restarted from Help. Time-to-value is not measured for real users.'),
  c('FUN-009', 'funnels', 'Adoption', 'Measure repeat value, feature adoption, invite/share signals, support friction, and role-level success.', 2, 'app/src/lib/ops/firstyear.ts', 'First-year measures by role, with the baseline each needs, are code. Nothing is measured yet because nobody is enrolled.'),
  c('FUN-010', 'funnels', 'Expansion', 'Customer health and expansion are based on transparent value, adoption, fit, and success-plan signals.', 1, 'docs/PILOT-TO-ANNUAL-CONVERSION.md', 'Four real outcomes and a decision meeting are written; no customer to apply them to.'),
  c('FUN-011', 'funnels', 'Retention', 'Renewal process starts early and uses agreed value evidence, risk review, and mutual success plan.', 1, 'app/src/lib/gtm/pilot.ts', 'A pilot refuses to end without a signed decision and a conversion date inside its window. No renewal has occurred.'),
  c('FUN-012', 'funnels', 'Advocacy', 'References, case studies, community, research, and referrals are permissioned and evidence-led.', 3, 'app/src/lib/ops/claims.ts', 'The proof rules forbid a logo, testimonial or number without permission and method; the research page sets the method before the data. There is nothing to reference yet.'),
];

// ── Prioritising a finding ──────────────────────────────────────────────────

export type Override = 'security' | 'privacy' | 'legal' | 'critical-accessibility' | 'data-loss' | 'misleading-guidance';

export const OVERRIDES: Record<Override, string> = {
  security: 'Security',
  privacy: 'Privacy',
  legal: 'Legal or compliance exposure',
  'critical-accessibility': 'Critical accessibility failure',
  'data-loss': 'Data loss',
  'misleading-guidance': 'Misleading official or AI guidance',
};

export interface Finding {
  harm: number;
  revenue: number;
  frequency: number;
  strategic: number;
  confidence: number;
  effort: number;
  override?: Override | null;
}

export type Band = 'P0' | 'P1' | 'P2' | 'P3';
export type Quadrant = 'P0' | 'quick-win' | 'strategic-bet' | 'fill-in' | 'defer';

const one2five = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;

/** The workbook's formula. Throws on an input outside 1–5. */
export function priority(f: Finding): number {
  for (const [k, v] of Object.entries({ harm: f.harm, revenue: f.revenue, frequency: f.frequency, strategic: f.strategic, confidence: f.confidence, effort: f.effort })) {
    if (!one2five(v)) throw new Error(`${k} must be 1–5, got ${v}`);
  }
  return (2 * f.harm + 2 * f.revenue + f.frequency + f.strategic + f.confidence) / f.effort;
}

export function band(f: Finding): Band {
  if (f.override) return 'P0';
  const p = priority(f);
  return p >= 12 ? 'P1' : p >= 8 ? 'P2' : 'P3';
}

/** Impact is the greater of harm and revenue; high is 4–5, low effort is 1–2. */
export function quadrant(f: Finding): Quadrant {
  if (f.override) return 'P0';
  priority(f);
  const impact = Math.max(f.harm, f.revenue) >= 4;
  const cheap = f.effort <= 2;
  if (impact && cheap) return 'quick-win';
  if (impact) return 'strategic-bet';
  return cheap ? 'fill-in' : 'defer';
}

export const QUADRANT_ACTION: Record<Quadrant, string> = {
  P0: 'Contain and correct immediately; overrides the formula',
  'quick-win': 'Prioritise next sprint, once P0 is controlled',
  'strategic-bet': 'Fund in phases with an owner, discovery, measurement and a staged release',
  'fill-in': 'Bundle with adjacent work; never displaces a quick win',
  defer: 'Defer, simplify or decline; reassess only with new evidence',
};

// ── The conversion-leak detector ────────────────────────────────────────────

export const STAGES: readonly string[] = [
  'Landing page viewed', 'CTA clicked', 'Form started', 'Form submitted', 'Meeting booked', 'Meeting completed', 'Qualified opportunity', 'Proposal / pilot', 'Closed won',
  'Account created', 'Email verified', 'Context selected', 'First meaningful outcome', 'Day 7 retained', 'Day 30 retained',
];

export interface StageCount {
  stage: string;
  n: number;
  /** The target step conversion from the prior stage, 0–1, when one is set. */
  target?: number | null;
}

export interface Leak {
  stage: string;
  n: number;
  prior: number | null;
  /** Step conversion from the prior stage, 0–1, or null on the first stage or a zero prior. */
  conversion: number | null;
  dropOff: number | null;
  /** True when a target is set and the conversion is under it. */
  investigate: boolean;
}

/** Step conversion and drop-off per stage, flagged where a target is missed. */
export function leaks(counts: readonly StageCount[]): Leak[] {
  return counts.map((s, i) => {
    const prior = i === 0 ? null : counts[i - 1].n;
    const conversion = prior === null || prior <= 0 ? null : s.n / prior;
    return {
      stage: s.stage,
      n: s.n,
      prior,
      conversion,
      dropOff: conversion === null ? null : 1 - conversion,
      investigate: conversion !== null && typeof s.target === 'number' && conversion < s.target,
    };
  });
}

// ── Reading the scores ──────────────────────────────────────────────────────

export interface PillarSummary {
  pillar: Pillar;
  controls: number;
  total: number;
  max: number;
  /** Controls at 0 or 1: the pillar's remediation queue. */
  weak: string[];
}

export function byPillar(controls: readonly Control[] = CONTROLS): PillarSummary[] {
  return (Object.keys(PILLARS) as Pillar[]).map((p) => {
    const rows = controls.filter((x) => x.pillar === p);
    return { pillar: p, controls: rows.length, total: rows.reduce((n, x) => n + x.score, 0), max: rows.length * 4, weak: rows.filter((x) => x.score <= 1).map((x) => x.id) };
  });
}

export function histogram(controls: readonly Control[] = CONTROLS): Record<Score, number> {
  const h: Record<Score, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const x of controls) h[x.score] += 1;
  return h;
}
