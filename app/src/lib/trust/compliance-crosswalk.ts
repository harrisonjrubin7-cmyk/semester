/**
 * The compliance crosswalk: HECVAT 4, the 1EdTech TrustEd Apps rubrics and
 * the EDUCAUSE 2026 priorities as one control library with three views, the
 * way five documents of 28 September 2026 ask for it — and every score read
 * off the registers the repository already keeps, never asserted here.
 *
 * ## Crosswalk, not a fourth register
 *
 * The HECVAT readiness register (`docs/market-readiness/HECVAT_READINESS.md`),
 * the FERPA/COPPA/1EdTech register (`docs/FERPA-COPPA-1EDTECH-READINESS.md`),
 * the master launch readiness register (`masterregister.ts`) and the
 * operational-maturity register (`governance/maturity.ts`) already carry a
 * status per control, each held to the tree by its own test. A domain here
 * names the rows it rests on and nothing else; `compliance-crosswalk.test.ts`
 * reads those registers, checks every id is real, and computes the 0–4 score
 * from their statuses. A score cannot be typed into this file, which is the
 * point: a scorecard that can be edited is a scorecard that will be.
 *
 * ## The 0–4 scale, and the ceiling
 *
 * The documents' scale: 0 missing, 1 policy or design only, 2 implemented but
 * manually operated or partially evidenced, 3 implemented, owned, monitored,
 * tested and audit-evidenced, 4 independently tested and transparently
 * reported. A 3 needs an artifact somebody produced by operating the control —
 * the master register keeps those under `docs/evidence/`, and that directory
 * does not exist. So while it is absent the ceiling is 2, for every domain,
 * and the test holds the ceiling to the directory rather than to a sentence.
 *
 * ## What a supplied PDF may do
 *
 * It may say what a domain is, what HECVAT asks, what TrustEd asks, where the
 * two overlap and what evidence would be required. It may not raise a score.
 * The documents are kept under `docs/expansion/` as supplied and listed as
 * sources; nothing cites one as evidence.
 *
 * `docs/trust/COMPLIANCE-CROSSWALK.md` is rendered from this file by its
 * test; edit the data, then `npm run registers` from app/.
 *
 * HECVAT is a questionnaire, not a certification; the TrustEd Apps rubrics
 * are self-assessments and a certification programme with its own review.
 * Semester has completed neither. Nothing on the rendered page says otherwise.
 */

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/HECVAT-vs-TrustEd-Apps-Compliance-Scorecard.pdf',
    title: 'HECVAT vs 1EdTech TrustEd Apps compliance matrix: map overlap and gaps',
    what: 'The 0–4 scale, the full scorecard by domain, the cloud-infrastructure mapping, the four rubric criteria, the P0/P1/P2 plan and the four dashboard values.',
  },
  {
    path: 'docs/expansion/HECVAT-vs-TrustEd-Apps-Interactive-Crosswalk.pdf',
    title: 'Interactive cross-walk: HECVAT vs 1EdTech TrustEd Apps rubrics',
    what: 'The crosswalk table with overlap and primary gap per domain, the procurement-fit matrix, the vendor intake tiers and the AI governance overlay.',
  },
  {
    path: 'docs/expansion/HECVAT-vs-TrustEd-Apps-Rubric-Overlap-and-Intake-Workflow.pdf',
    title: 'HECVAT vs 1EdTech TrustEd Apps: map rubric overlaps and coverage gaps',
    what: 'The coverage rule, the intake workflow and decision states, the request object, the vendor-request email and the AI governance rubric.',
  },
  {
    path: 'docs/expansion/Campus-EdTech-Vendor-Intake-Policy.pdf',
    title: 'Semester Campus EdTech Vendor Intake Policy',
    what: 'The intake policy a university would apply to Semester: principles, roles, tiers, required evidence, launch gates, reassessment and exceptions.',
  },
  {
    path: 'docs/expansion/Compliance-Matrix-HECVAT-Mapping-and-Dashboard-API.pdf',
    title: 'Build an edtech compliance matrix: HECVAT mapping table, TrustEd evidence checklist, dashboard API',
    what: 'The HECVAT mapping table by domain, the TrustEd Apps evidence checklist, the dashboard calculations, the release manifest and the guardrails.',
  },
];

// ── The scale ────────────────────────────────────────────────────────────────

export type Level = 0 | 1 | 2 | 3 | 4;

export const SCALE: Record<Level, string> = {
  0: 'Missing, unknown, unsafe, or contradicted by the implementation',
  1: 'Policy or design exists; implementation or evidence is incomplete',
  2: 'Implemented, but manually operated, partially tested or partially evidenced',
  3: 'Implemented, owned, monitored, tested and audit-evidenced',
  4: 'Independently tested, automated where appropriate, continuously improved and transparently reported',
};

/** The directory a 3 needs. While it is absent, no domain may score above `CEILING_WITHOUT_EVIDENCE`. */
export const EVIDENCE_DIR = 'docs/evidence';
export const CEILING_WITHOUT_EVIDENCE: Level = 2;

/**
 * How each register's own vocabulary reads on the 0–4 scale. `tested` and
 * `READY` are 2, not 3: a test that runs on every change proves the control
 * is implemented, and says nothing about whether anybody operates it.
 */
export const MASTER_LEVEL: Record<string, Level> = {
  'not-started': 0, blocked: 0, designed: 1, building: 1, implemented: 2, tested: 2, evidenced: 3, operational: 3, 'launch-approved': 4,
};
export const REGISTER_LEVEL: Record<string, Level> = { NOT_STARTED: 0, BLOCKED: 0, IN_PROGRESS: 1, TESTING: 2, READY: 2 };
export const MATURITY_LEVEL: Record<string, Level> = { owed: 0, partial: 1, 'in-place': 2 };

/** Which register owns an id, by its shape. The registers' own tests hold the shapes. */
export type Register = 'master' | 'hecvat' | 'ferpa' | 'maturity';

export function registerOf(id: string): Register {
  if (/^(FERPA|COPPA|EDT)-\d+$/.test(id)) return 'ferpa';
  if (/^[A-Z]{2}-\d{2}$/.test(id)) return 'maturity';
  if (/^[A-Z0-9]+-\d{3}$/.test(id)) return 'master';
  return 'hecvat';
}

/** What the test learns about one row, from the register that owns it. */
export interface Standing {
  id: string;
  register: Register;
  level: Level;
  /** An automated test runs the control on every change (master `tested`, HECVAT/FERPA `READY` or `TESTING`, maturity `in-place`). */
  tested: boolean;
  /** Master rows only. */
  severity?: 'P0' | 'P1' | 'P2';
}

/**
 * A domain's score is the lower median of its rows' levels, capped at the
 * ceiling: the level the middle row reaches, so one tested row cannot carry a
 * domain and one owed row cannot sink it. Pure.
 */
export function score(levels: readonly Level[], ceiling: Level = 4): Level {
  if (levels.length === 0) return 0;
  const sorted = [...levels].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  return Math.min(median, ceiling) as Level;
}

// ── The domains ──────────────────────────────────────────────────────────────

export type Overlap = 'high' | 'medium-high' | 'medium';

export type Rubric = 'privacy' | 'security' | 'accessibility' | 'genai' | 'interoperability';

export const RUBRIC_TITLE: Record<Rubric, string> = {
  privacy: 'Data Privacy Rubric',
  security: 'Security Practices Rubric',
  accessibility: 'Accessibility Rubric',
  genai: 'Generative AI Data Rubric',
  interoperability: 'Interoperability standards and certification',
};

export const EDUCAUSE = {
  cyber: 'Collaborative cybersecurity',
  connected: 'Connected campus experience',
  data: 'Data foundations and governance',
  resilient: 'Resilient digital services',
  trust: 'Student trust and data agency',
  ai: 'AI literacy and responsible adoption',
  access: 'Equitable digital access',
  ecosystem: 'Connected technology ecosystem',
} as const;

export type Educause = keyof typeof EDUCAUSE;

export interface Domain {
  /** A slug, stable. */
  id: string;
  title: string;
  hecvat: string;
  trusted: string;
  rubric: Rubric;
  educause: Educause;
  overlap: Overlap;
  /** The coverage gap the documents say to manage between the two instruments. */
  gap: string;
  objective: string;
  evidence: string;
  /** The rows of the four registers this domain rests on. Each must exist; the test computes the score from them. */
  rests: readonly string[];
}

export const DOMAINS: readonly Domain[] = [
  {
    id: 'governance', title: 'Governance and accountability',
    hecvat: 'Organization, policy governance, risk management, workforce controls, insurance, audit process',
    trusted: 'Public company and policy information; responsible supplier practice',
    rubric: 'security', educause: 'cyber', overlap: 'high',
    gap: 'HECVAT requires more formal operational evidence: minutes, a RACI, an exception record.',
    objective: 'Named executives, a RACI, risk appetite, policy review and exception approval.',
    evidence: 'Governance charter, RACI, policy register, risk register, review minutes.',
    rests: ['GOV-1', 'GOV-2', 'PRG-001', 'SEC-001', 'LEGAL-2'],
  },
  {
    id: 'security-program', title: 'Security program',
    hecvat: 'Security management, awareness training, risk assessment, audits',
    trusted: 'Security procedures, processes and baseline technical practices',
    rubric: 'security', educause: 'cyber', overlap: 'high',
    gap: 'TrustEd is a baseline rubric and not a substitute for technical assurance; HECVAT asks for implementation detail.',
    objective: 'A security program with tested controls and workforce accountability.',
    evidence: 'Training records, control register, control-testing schedule, assessment reports.',
    rests: ['GOV-1', 'SEC-001', 'SEC-002', 'SEC-011'],
  },
  {
    id: 'assets', title: 'Asset inventory',
    hecvat: 'Product and infrastructure assets and their ownership',
    trusted: 'System-management practices',
    rubric: 'security', educause: 'data', overlap: 'high',
    gap: 'Neither instrument accepts a list; the inventory needs an owner per item and a review log.',
    objective: 'Inventory cloud accounts, services, repositories, data stores, integrations and endpoints.',
    evidence: 'Asset inventory, owner list, review log.',
    rests: ['PRG-006', 'EX-01', 'DV-06', 'SEC-010'],
  },
  {
    id: 'cloud', title: 'Cloud infrastructure',
    hecvat: 'Hosting, network, compute, storage, configuration, operations, monitoring',
    trusted: 'Systems management and third-party hosting disclosure',
    rubric: 'security', educause: 'resilient', overlap: 'high',
    gap: 'HECVAT probes architecture and operations more deeply than a hosting disclosure.',
    objective: 'A segmented, encrypted, monitored and hardened environment, with the provider’s share of it named.',
    evidence: 'Architecture diagram, infrastructure as code, configuration evidence, monitoring reports.',
    rests: ['CRYPTO-1', 'MON-1', 'SRE-002', 'EX-03', 'EX-04', 'DR-01'],
  },
  {
    id: 'identity', title: 'Identity and access',
    hecvat: 'Authentication, MFA, authorization, privileged access, access reviews, offboarding',
    trusted: 'Authentication and account-management practices',
    rubric: 'security', educause: 'cyber', overlap: 'high',
    gap: 'Operating evidence, not statements: a quarterly access review that was actually run.',
    objective: 'SSO, MFA for privileged roles, least privilege, access review, offboarding, break-glass control.',
    evidence: 'IAM architecture, MFA policy, RBAC matrix, quarterly access review, break-glass log.',
    rests: ['IAM-1', 'IAM-2', 'IAM-3', 'IAM-003', 'IAM-004', 'IAM-005', 'IAM-006', 'IAM-010', 'IAM-011'],
  },
  {
    id: 'sdlc', title: 'Secure development',
    hecvat: 'SDLC, secure coding, testing, change and release control, vulnerability handling',
    trusted: 'Software development and maintenance practices',
    rubric: 'security', educause: 'cyber', overlap: 'high',
    gap: 'HECVAT asks for deeper testing and remediation evidence: SAST/DAST output, threat models, release approvals.',
    objective: 'Threat modelling, CI security gates, code review, dependency and secrets scanning, rollback.',
    evidence: 'PR and CI evidence, scan results, threat models, release approvals.',
    rests: ['SDLC-1', 'SDLC-2', 'SEC-002', 'SEC-003', 'SRE-008'],
  },
  {
    id: 'encryption', title: 'Encryption and secrets',
    hecvat: 'Encryption in transit and at rest, key management, credential protection',
    trusted: 'Protection of data in transit and at rest',
    rubric: 'security', educause: 'trust', overlap: 'high',
    gap: 'Key lifecycle and implementation proof, not a statement that encryption is on.',
    objective: 'TLS everywhere, encrypted storage and backups, managed keys, rotation, a secret vault, no secret in code.',
    evidence: 'TLS settings, KMS design, key-rotation record, secret-vault policy.',
    rests: ['CRYPTO-1', 'SDLC-2', 'IAM-009', 'DR-04'],
  },
  {
    id: 'tenant', title: 'Multi-tenant separation',
    hecvat: 'Data segregation, authorization, infrastructure isolation',
    trusted: 'Hosting and data-separation practices; responsible data handling',
    rubric: 'security', educause: 'ecosystem', overlap: 'high',
    gap: 'Must demonstrate technical enforcement and test results, not an architecture claim.',
    objective: 'No cross-institution, cross-course or cross-role data access.',
    evidence: 'Tenant-isolation test suite, row-level authorization policy, penetration-test scope and results.',
    rests: ['TEN-1', 'IAM-007', 'IAM-008', 'UOS-009', 'FERPA-8'],
  },
  {
    id: 'logging', title: 'Monitoring and logging',
    hecvat: 'Security logging, alerting, monitoring, investigation support',
    trusted: 'Security monitoring and process disclosure',
    rubric: 'security', educause: 'cyber', overlap: 'medium-high',
    gap: 'Define what is logged, who can read it, how long it is kept, and show an alert being tested.',
    objective: 'Central audit and security logging with retention, alerting and investigation.',
    evidence: 'Log architecture, sample investigation, alert test, retention configuration.',
    rests: ['LOG-1', 'MON-1', 'SEC-006', 'FERPA-4', 'SRE-003'],
  },
  {
    id: 'vulnerability', title: 'Vulnerability management',
    hecvat: 'Scanning, patching, remediation SLAs, penetration testing',
    trusted: 'Security assessment and maintenance process',
    rubric: 'security', educause: 'cyber', overlap: 'high',
    gap: 'Evidence of a severity SLA and of remediation actually happening.',
    objective: 'Severity SLAs, scanning, patching, an independent test, tracked exceptions.',
    evidence: 'Scan reports, patch dashboard, penetration-test summary, exception register.',
    rests: ['VULN-1', 'VULN-2', 'SEC-004', 'SEC-005'],
  },
  {
    id: 'incident', title: 'Incident response',
    hecvat: 'Incident plan, notification timelines, exercises, post-incident actions',
    trusted: 'Security incident procedures',
    rubric: 'security', educause: 'resilient', overlap: 'high',
    gap: 'HECVAT asks for response-time commitments and exercise evidence.',
    objective: 'Detect, contain, investigate, notify, learn and improve — exercised, not only written.',
    evidence: 'IR runbook, tabletop evidence, post-mortem tracker, status templates.',
    rests: ['IR-1', 'SEC-007', 'AI-014', 'FERPA-10'],
  },
  {
    id: 'continuity', title: 'Business continuity',
    hecvat: 'Backup, disaster recovery, availability, RTO/RPO',
    trusted: 'General operational reliability',
    rubric: 'security', educause: 'resilient', overlap: 'medium',
    gap: 'TrustEd does not replace a detailed recovery review; a restore has to have been performed and timed.',
    objective: 'Tested RTO/RPO, restore capability, provider-outage and key-person contingency.',
    evidence: 'Restore-test results, DR plan, RTO/RPO record, vendor-outage playbook.',
    rests: ['BCP-1', 'SRE-004', 'SRE-005', 'SRE-006', 'EX-05'],
  },
  {
    id: 'data-inventory', title: 'Data inventory and classification',
    hecvat: 'Classification, processing, data flows, privacy governance',
    trusted: 'Data collected, collection method, purpose, ownership',
    rubric: 'privacy', educause: 'data', overlap: 'high',
    gap: 'Link every field and integration to an operational purpose and a retention answer.',
    objective: 'A data map with an owner, purpose, classification, storage, sharing and retention per class.',
    evidence: 'Data inventory, data-flow diagrams, field-classification registry.',
    rests: ['PRIV-1', 'SEC-008', 'TRUST-003', 'RM-01'],
  },
  {
    id: 'ownership', title: 'Data ownership and control',
    hecvat: 'Privacy, contractual use, access, data rights',
    trusted: 'Learner and customer ownership, collection and use; no sale of student data',
    rubric: 'privacy', educause: 'trust', overlap: 'high',
    gap: 'Clarify the contract roles and show the technical user controls working.',
    objective: 'The student owns their data: export, deletion, share and revoke, each logged.',
    evidence: 'DPA, privacy policy, export/delete/share-revoke workflows and their tests.',
    rests: ['PRIV-2', 'PRIV-3', 'PRIV-6', 'FERPA-5', 'FERPA-6', 'UOS-007', 'STU-011'],
  },
  {
    id: 'retention', title: 'Retention, deletion and legal hold',
    hecvat: 'Record lifecycle, disposal, backup handling, legal obligations',
    trusted: 'Retention and deletion rights; clear policy per data class',
    rubric: 'privacy', educause: 'data', overlap: 'high',
    gap: 'Operational deletion across caches, indexes and backups, and what a hold does to it.',
    objective: 'A schedule by data class, a deletion workflow, backup expiry, a legal hold that overrides deletion.',
    evidence: 'Retention schedule, deletion test, legal-hold runbook, backup-expiry evidence.',
    rests: ['PRIV-1', 'PRIV-2', 'FERPA-7', 'LEG-004', 'RM-01', 'RM-02', 'RM-04', 'RM-05'],
  },
  {
    id: 'subprocessors', title: 'Data sharing and subprocessors',
    hecvat: 'Vendor risk, third parties, transfers, contractual controls',
    trusted: 'Hosting and sharing disclosure; policy transparency',
    rubric: 'privacy', educause: 'cyber', overlap: 'high',
    gap: 'Onward-transfer, residency and exit evidence, not only a list.',
    objective: 'A public subprocessor list, due diligence, DPAs, ongoing review, an exit plan.',
    evidence: 'Subprocessor list, vendor assessments, agreements, offboarding plan.',
    rests: ['PRIV-5', 'FERPA-11', 'SEC-010', 'DR-05', 'EX-10'],
  },
  {
    id: 'ferpa', title: 'FERPA and education records',
    hecvat: 'Privacy, legal and contractual safeguards',
    trusted: 'Education-data ownership and transparency',
    rubric: 'privacy', educause: 'trust', overlap: 'medium-high',
    gap: 'The school-official, consent and exception analysis is institution-specific and needs counsel.',
    objective: 'A signed agreement with school-official terms, purpose-limited use, minimum-necessary flows, consent with a record.',
    evidence: 'FERPA workflow, consent ledger, disclosure log, access matrix, DPA.',
    rests: ['PRIV-4', 'FERPA-1', 'FERPA-2', 'FERPA-3', 'FERPA-9', 'SEC-009'],
  },
  {
    id: 'accessibility', title: 'Accessibility',
    hecvat: 'IT accessibility, conformance, alternatives',
    trusted: 'Documentation, procurement communication, conformance, alternatives and accommodations',
    rubric: 'accessibility', educause: 'access', overlap: 'high',
    gap: 'Test every role and workflow, not only the public site; an ACR from a human evaluation.',
    objective: 'A WCAG 2.2 AA programme: ACR/VPAT, manual testing, remediation tracking, accessible authoring.',
    evidence: 'Current ACR/VPAT, manual test evidence, issue tracker, release-gate evidence.',
    rests: ['A11Y-1', 'A11Y-2', 'A11Y-3', 'A11Y-4', 'A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004', 'A11Y-005', 'A11Y-006', 'A11Y-007', 'IT-01'],
  },
  {
    id: 'interoperability', title: 'Interoperability',
    hecvat: 'API and integration security, data transfer',
    trusted: 'LTI, OneRoster, QTI, CLR/Open Badges; certification and conformance',
    rubric: 'interoperability', educause: 'ecosystem', overlap: 'medium',
    gap: 'HECVAT does not prove education-standard conformance; only 1EdTech’s own suite does.',
    objective: 'Standards-first integrations, versioned APIs, data maps, a sandbox, documented offboarding.',
    evidence: 'LTI/OneRoster/QTI test logs, API documentation, sandbox, integration data maps.',
    rests: ['INT-1', 'EDT-1', 'EDT-2', 'EDT-3', 'EDT-4', 'EDT-5', 'EDT-6', 'INT-002', 'INT-004', 'INT-005', 'INT-006', 'INT-007', 'INT-014'],
  },
  {
    id: 'community', title: 'Community and social safety',
    hecvat: 'Privacy, user-generated content, incident handling',
    trusted: 'Social-interaction transparency and data practices',
    rubric: 'privacy', educause: 'connected', overlap: 'medium-high',
    gap: 'Moderation, harassment, escalation, appeal and retention controls, with a case audit.',
    objective: 'Moderation, reports, block and mute, escalation, appeal, limited staff access.',
    evidence: 'Community policy, moderation runbooks, training, case-audit evidence.',
    rests: ['TS-1', 'UOS-003', 'COPPA-2'],
  },
  {
    id: 'ai-disclosure', title: 'AI disclosure and transparency',
    hecvat: 'AI governance, data, vendor and change controls (HECVAT 4 AI section)',
    trusted: 'AI-use notice, purpose, source, internal versus third-party provider',
    rubric: 'genai', educause: 'ai', overlap: 'high',
    gap: 'The interface must match the policy: what the screen says AI does has to be what the model does.',
    objective: 'Source, scope and status labels on every generated output; a model and provider notice; a report route.',
    evidence: 'AI policy, product screenshots, model and provider inventory.',
    rests: ['AI-1', 'AI-002', 'AI-005', 'AI-008', 'AI-013', 'TRUST-001', 'TRUST-004'],
  },
  {
    id: 'ai-data', title: 'AI data use and training',
    hecvat: 'AI data flow, vendors, privacy and security controls',
    trusted: 'Training, retention and ownership transparency; user choice',
    rubric: 'genai', educause: 'ai', overlap: 'high',
    gap: 'Technically enforce the no-training default and show deletion propagating to provider-held data.',
    objective: 'No general-model training on production student data by default; tenant-scoped retrieval; provider terms reviewed.',
    evidence: 'Provider terms, gateway configuration, AI data-flow diagram, deletion tests.',
    rests: ['AI-1', 'FERPA-9', 'AI-002', 'AI-004', 'AI-006'],
  },
  {
    id: 'ai-quality', title: 'AI quality, safety and misuse',
    hecvat: 'AI risk governance, security, evaluation, operations',
    trusted: 'Broad transparency and data-practice expectations',
    rubric: 'genai', educause: 'ai', overlap: 'medium',
    gap: 'Add NIST AI RMF and AI 800-1 evaluations, red teaming, a kill switch and an AI incident route.',
    objective: 'Grounding, hallucination, fairness, prompt-injection and accessibility evaluations; no consequential action without review; a kill switch that everything reads.',
    evidence: 'Risk register, evaluation reports, red-team evidence, AI incident runbook.',
    rests: ['AI-2', 'AI-3', 'AI-009', 'AI-010', 'AI-011', 'AI-012', 'AI-014'],
  },
  {
    id: 'grades', title: 'Assessment and grade integrity',
    hecvat: 'Product integrity, data accuracy, audit, availability',
    trusted: 'Responsible learner-data and AI disclosure',
    rubric: 'genai', educause: 'trust', overlap: 'medium',
    gap: 'Educational validity, human judgment, rubric provenance and an appeal path are outside both instruments.',
    objective: 'Versioned rubrics, a grade ledger, human approval, reconciliation, appeal.',
    evidence: 'Calculation tests, grade audit sample, change and appeal logs.',
    rests: ['LMS-006', 'LMS-011', 'LMS-012', 'LMS-013', 'AI-009', 'INT-005'],
  },
  {
    id: 'workforce', title: 'Physical and workforce security',
    hecvat: 'Endpoint, device, facility and HR controls',
    trusted: 'Company security practice',
    rubric: 'security', educause: 'cyber', overlap: 'high',
    gap: 'A one-person company still needs the device policy written down and the device managed.',
    objective: 'Managed, encrypted, lockable devices; secure disposal; onboarding and offboarding.',
    evidence: 'Device-management reports, asset inventory, HR and offboarding evidence.',
    rests: ['DV-01', 'DV-02', 'DV-03', 'DV-04', 'DV-05', 'DV-07'],
  },
  {
    id: 'assurance', title: 'Customer assurance',
    hecvat: 'Questionnaire completion, contracts, evidence sharing',
    trusted: 'Public transparency; the Trusted Apps directory and certification path',
    rubric: 'security', educause: 'cyber', overlap: 'medium-high',
    gap: 'Keep evidence fresh and customer-specific; never present a questionnaire as a certification.',
    objective: 'A secure procurement room, evidence freshness, a customer trust view.',
    evidence: 'HECVAT answer library, Trust Center, evidence-vault index, customer trust dashboard.',
    rests: ['SEC-011', 'SEC-012', 'SEC-013', 'COM-003', 'PRG-002', 'EDT-7', 'LEGAL-1'],
  },
];

// ── The four TrustEd Apps rubrics, as a checklist ────────────────────────────

export interface RubricItem {
  rubric: Rubric;
  section: string;
  item: string;
  /** Rows that carry it. Empty means nothing does, and the page says so. */
  rests: readonly string[];
}

const r = (rubric: Rubric, section: string, item: string, rests: readonly string[]): RubricItem => ({ rubric, section, item, rests });

export const RUBRIC_ITEMS: readonly RubricItem[] = [
  // Data Privacy Rubric
  r('privacy', 'Data collected', 'Every category, source, purpose and collection method is inventoried.', ['PRIV-1', 'SEC-008']),
  r('privacy', 'Data collected', 'Data minimization is implemented and evidenced.', ['FERPA-3', 'PRIV-6', 'EDT-4']),
  r('privacy', 'Data collected', 'Sensitive and education-record classes have enhanced controls.', ['FERPA-9', 'UOS-007']),
  r('privacy', 'Ownership and control', 'Student and customer ownership and control language is clear.', ['LEG-003', 'LEG-002']),
  r('privacy', 'Ownership and control', 'Sharing is purpose-bound, role-bound, logged and revocable.', ['FERPA-5', 'PRIV-6', 'UOS-007']),
  r('privacy', 'Ownership and control', 'No sale of student data and no undisclosed secondary use.', ['FERPA-2', 'COPPA-2']),
  r('privacy', 'Deletion and retention', 'Retention rules are specific by data class.', ['PRIV-1', 'RM-01']),
  r('privacy', 'Deletion and retention', 'Deletion, export and correction work in the product.', ['PRIV-2', 'FERPA-6']),
  r('privacy', 'Deletion and retention', 'Backup lifecycle and legal-hold override are documented.', ['RM-02', 'RM-04', 'SRE-004']),
  r('privacy', 'Policy transparency', 'Public privacy policy and terms are current, plain-language, versioned and operationally accurate.', ['LEG-003', 'PRIV-3']),
  r('privacy', 'Policy transparency', 'Cookies, analytics, advertising and third parties are disclosed.', ['COPPA-2', 'PRIV-5']),
  r('privacy', 'Policy transparency', 'A privacy contact and an escalation process are published.', ['VULN-1']),
  r('privacy', 'Social interactions', 'Community, club and mentorship data use is disclosed.', ['TS-1', 'UOS-003']),
  r('privacy', 'Social interactions', 'Visibility, messaging, reporting, moderation and retention rules are clear.', ['TS-1']),
  r('privacy', 'Social interactions', 'No undisclosed social-graph analysis or sensitive inference.', ['FERPA-2', 'UOS-008']),
  // Security Practices Rubric
  r('security', 'Documentation and company information', 'Security contact, policy set, risk ownership, incident process and external-assessment posture exist.', ['GOV-1', 'GOV-2', 'VULN-1', 'IR-1']),
  r('security', 'Data', 'Encryption, access control, separation, backup, retention, secure deletion and sensitive-data handling are documented and tested.', ['CRYPTO-1', 'IAM-2', 'TEN-1', 'BCP-1', 'PRIV-2']),
  r('security', 'Systems management', 'Secure SDLC, patching, vulnerability management, monitoring, logging, authentication, authorization, incident response and continuity operate.', ['SDLC-1', 'SDLC-2', 'VULN-1', 'MON-1', 'LOG-1', 'IAM-1', 'IR-1', 'BCP-1']),
  r('security', 'Third-party assessment', 'Cloud and subprocessor inventory, due diligence, contractual controls, attestation review, change notification and an exit plan are maintained.', ['PRIV-5', 'SEC-010', 'EX-10']),
  // Accessibility Rubric
  r('accessibility', 'Information and documentation', 'Public and customer documentation is accessible.', ['IT-04', 'IT-05']),
  r('accessibility', 'Information and documentation', 'An accessibility statement and contacts are published.', ['A11Y-4']),
  r('accessibility', 'Procurement communications', 'ACR/VPAT materials are current, evidence-based and disclose limitations.', ['A11Y-2', 'A11Y-007']),
  r('accessibility', 'Procurement communications', 'Accessibility claims are accurate and versioned.', ['PRG-002', 'LW-03']),
  r('accessibility', 'Conformance', 'A WCAG 2.2 AA target and test scope are documented.', ['A11Y-1', 'A11Y-001', 'A11Y-002', 'A11Y-003', 'A11Y-004']),
  r('accessibility', 'Conformance', 'Student, faculty, admin and operations-console journeys are tested.', ['A11Y-3', 'A11Y-006', 'IT-01', 'IT-07']),
  r('accessibility', 'Alternatives and accommodations', 'Core workflows have accessible alternatives.', ['A11Y-005', 'GA-01']),
  r('accessibility', 'Alternatives and accommodations', 'Accommodation-related settings are privacy-preserving.', ['AP-01', 'LMS-009']),
  r('accessibility', 'Alternatives and accommodations', 'Accessibility defects have support, remediation and communication paths.', ['A11Y-4']),
  // Generative AI Data Rubric
  r('genai', 'Disclosure', 'Users can tell when AI is used, what it does, and its limitations.', ['AI-008', 'AI-013', 'TRUST-004']),
  r('genai', 'Disclosure', 'Source, and provider or internal-versus-third-party status, are disclosed.', ['AI-005', 'AI-002', 'TRUST-001']),
  r('genai', 'Data use', 'Training, retention, sharing and ownership rules are clear.', ['AI-1', 'FERPA-9']),
  r('genai', 'Data use', 'No general-purpose model training on production student or customer data by default.', ['AI-1', 'PRIV-3']),
  r('genai', 'Data use', 'A provider and model inventory and data-flow controls exist.', ['AI-002', 'AI-004']),
  r('genai', 'User choice', 'Course and tenant-level policy controls exist.', ['AI-006', 'AI-1']),
  r('genai', 'User choice', 'Eligible AI history, sharing and deletion controls are available.', ['AI-013', 'PRIV-2']),
  r('genai', 'User choice', 'Opt-in and opt-out expectations are clear where applicable.', ['AI-013']),
  r('genai', 'Quality and risk', 'Bias, accuracy, accessibility, grounding, prompt-injection and misuse tests exist.', ['AI-2', 'AI-010', 'AI-011']),
  r('genai', 'Quality and risk', 'Human review is required for high-impact outputs and actions.', ['AI-009']),
  r('genai', 'Quality and risk', 'Report, correction, escalation and incident-response mechanisms exist.', ['AI-3', 'AI-014', 'AI-012']),
];

// ── The AI governance overlay ────────────────────────────────────────────────

export interface OverlayRow {
  domain: string;
  hecvat: string;
  trusted: string;
  semester: string;
  rests: readonly string[];
}

export const AI_OVERLAY: readonly OverlayRow[] = [
  { domain: 'Inventory', hecvat: 'Identify AI features, models, vendors, data, access, integrations', trusted: 'Disclose whether AI is used and its purpose', semester: 'A model and system inventory by tenant, feature, provider, version and risk tier', rests: ['AI-002', 'AI-001'] },
  { domain: 'Transparency', hecvat: 'Document AI functionality, limitations and customer impact', trusted: 'Inform users when AI is used', semester: 'Source, scope and status labels; an AI label; limitations; an issue-report control', rests: ['TRUST-001', 'TRUST-004', 'AI-008'] },
  { domain: 'Data sources', hecvat: 'Classify inputs, outputs, retrieval and provider flow', trusted: 'Identify data sources and internal versus third-party AI', semester: 'Tenant-scoped retrieval, source anchors, no cross-tenant retrieval', rests: ['AI-004', 'AI-005', 'AI-1'] },
  { domain: 'Training and secondary use', hecvat: 'Govern provider training, retention and data sharing', trusted: 'Explain whether and how data is used with AI; user options', semester: 'No general-model training on production data by default', rests: ['AI-1', 'FERPA-9'] },
  { domain: 'User choice', hecvat: 'Configure policy, consent and data sharing', trusted: 'Opt-in, opt-out and preference options where applicable', semester: 'Tenant, course and user controls; no forced AI use for core access', rests: ['AI-006', 'AI-013'] },
  { domain: 'High-impact use', hecvat: 'Prohibit or limit automated decisions; require oversight', trusted: 'Transparency and responsible data handling', semester: 'No AI-only admissions, aid, discipline, accommodation, grading or risk decisions', rests: ['AI-009', 'AI-007'] },
  { domain: 'Quality and validity', hecvat: 'Test and monitor performance, bias, reliability', trusted: 'Data validity and bias considerations', semester: 'Grounding, hallucination, fairness, accessibility and evaluation thresholds', rests: ['AI-2', 'AI-011'] },
  { domain: 'Security and misuse', hecvat: 'Threat-model prompt injection, tool abuse, exfiltration, provider changes', trusted: 'Disclose provider and data behaviour', semester: 'Input and output safeguards, least-privilege tools, a kill switch, red-team tests', rests: ['AI-010', 'AI-012'] },
  { domain: 'Human escalation', hecvat: 'Incident response, support, appeals, change control', trusted: 'User transparency and options', semester: 'Human review, correction, appeal, feature disablement', rests: ['AI-3', 'AI-014', 'AI-012'] },
  { domain: 'Retention and deletion', hecvat: 'Define the prompt, output and log lifecycle', trusted: 'Disclose data handling', semester: 'Separate retention for prompts, outputs, retrieval caches and evaluation samples', rests: ['PRIV-1', 'AI-013'] },
  { domain: 'Accessibility', hecvat: 'Test AI output and AI controls for accessibility', trusted: 'Transparent, equitable access', semester: 'Accessible AI interface, generated-content checks, an alternative non-AI workflow', rests: ['GA-01', 'GA-02', 'GA-03', 'A11Y-006'] },
  { domain: 'Change management', hecvat: 'Reassess model, provider, prompt and tool changes', trusted: 'Update disclosures when practice changes', semester: 'An approval and retest workflow and a customer change notice', rests: ['AI-001', 'AI-011'] },
];

// ── Semester, through a university's own intake ──────────────────────────────

export type Tier = 'low' | 'moderate' | 'high' | 'critical';

export const TIERS: readonly { tier: Tier; trigger: string; review: string }[] = [
  { tier: 'low', trigger: 'No institutional personal data, no account, no integration, no AI, no consequential workflow.', review: 'Privacy, legal and accessibility baseline.' },
  { tier: 'moderate', trigger: 'Limited directory data, SSO, a low-risk learning or service use.', review: 'Data flow, privacy, security, accessibility and contract review.' },
  { tier: 'high', trigger: 'Education records, LTI/SIS/SCIM, AI, assessments, community, student-generated content, or a broad user population.', review: 'HECVAT, TrustEd evidence, ACR/VPAT, integration review, DPA, AI review.' },
  { tier: 'critical', trigger: 'Payments, proctoring, minors, health or basic-needs intake, agentic writes, high-stakes data or export.', review: 'Full HECVAT, DPIA/PIA, threat model, legal and executive approval, strict launch gates.' },
];

/**
 * Where Semester lands when a university applies the policy to it.
 * `critical`, on one trigger the tier table names outright — grades are
 * high-stakes data, and LTI grade services write scores into the
 * institution's gradebook — with the four `high` triggers underneath it.
 * The other five critical triggers are absent, and each absence is named
 * with the row that makes it true, so the line is re-read when a row moves.
 * Not `high`: a tier is the highest trigger present, and a reviewer who
 * found the grade write after being told `high` would be right to distrust
 * the rest of the page.
 */
export const SELF_TIER: Tier = 'critical';

export const SELF_TRIGGERS: readonly { trigger: string; tier: Tier; because: string; rows: readonly string[] }[] = [
  { trigger: 'Grades and grade passback', tier: 'critical', because: 'Synced grades are high-stakes education records, and LTI Assignment and Grade Services write scores into the institution’s own gradebook. Semester grades nothing itself: the gradebook is designed only, and no AI may assign a grade.', rows: ['INT-005', 'EDT-3', 'LMS-011', 'AI-009'] },
  { trigger: 'Education-record data', tier: 'high', because: 'A student’s synced courses, grades and plan are education records once an institution is the source.', rows: ['FERPA-1', 'STU-011'] },
  { trigger: 'SSO, SCIM and LTI', tier: 'high', because: 'SAML sign-in with provisioning, SCIM lifecycle and an LTI 1.3 launch exist.', rows: ['IAM-1', 'IAM-004', 'INT-002'] },
  { trigger: 'AI', tier: 'high', because: 'Two AI runtimes: the metered edge function and the institution gateway.', rows: ['AI-1', 'AI-003'] },
  { trigger: 'Community and student-generated content', tier: 'high', because: 'Clubs, groups and a moderated report queue.', rows: ['TS-1', 'UOS-003'] },
];

/** The critical triggers that are absent, each held to a row. */
export const NOT_TRIGGERED: readonly { trigger: string; why: string; rows: readonly string[] }[] = [
  { trigger: 'Payments', why: 'Billing stays out (D-009); the bill screen reads a statement and holds no card data.', rows: ['COM-001'] },
  { trigger: 'Proctoring', why: 'No proctoring or surveillance, held mechanically by the boundaries register.', rows: ['TRUST-003'] },
  { trigger: 'Basic-needs intake', why: 'The navigator is a directory that routes to an office; nothing is taken in, and nobody is notified.', rows: ['STU-012'] },
  { trigger: 'Minors', why: 'The service is not directed at children: the minimum age is 13, refused at sign-up by the database (D-139), and a minor aged 13 to 17 is kept out of every feature where others can find or message them. Dual enrollment is identified by the institution, not guessed.', rows: ['COPPA-1', 'COPPA-3'] },
  { trigger: 'Agentic writes', why: 'No consequential write without exact review and confirmation; the two-phase journal never retries an uncertain action.', rows: ['AI-009'] },
];

export type Have = 'have' | 'draft' | 'none';

export interface Artifact {
  /** As the intake policy names it. */
  artifact: string;
  /** What the request rules call it, machine-readable. */
  key: string;
  have: Have;
  /** The file, when there is one. `have` and `draft` cite one; `none` cites nothing. */
  path: string | null;
  note: string;
}

/** The evidence package a `high` vendor owes, and what Semester could hand over today. */
export const REQUIRED_EVIDENCE: readonly Artifact[] = [
  { artifact: 'Current privacy policy and terms of service', key: 'privacy_policy_and_terms', have: 'draft', path: 'docs/legal/PRIVACY-POLICY-DRAFT.md', note: 'Drafts for counsel; neither is in force. The in-app disclosure is live and held by test.' },
  { artifact: 'Accessibility statement', key: 'accessibility_statement', have: 'none', path: null, note: 'Owed (A11Y-4); the public site’s accessibility evidence table is not a statement.' },
  { artifact: 'Data categories and data-use description', key: 'data_use_description', have: 'have', path: 'RETENTION.md', note: 'Every table has a retention answer; the disclosure is kept true by test.' },
  { artifact: 'Subprocessor and third-party disclosure', key: 'subprocessor_list', have: 'draft', path: 'docs/SUBPROCESSORS.md', note: 'Held to the CSP and the Edge Functions by test; public once counsel has read it.' },
  { artifact: 'Security contact and incident contact', key: 'security_contact', have: 'have', path: 'app/public/.well-known/security.txt', note: 'A security.txt in RFC 9116 form under the app’s base path, linked from the site’s /security/ page, with SECURITY.md as its policy (D-114). The address is the owner’s: the security seat is vacant, so the incident contact is the same person.' },
  { artifact: 'Retention and deletion approach', key: 'retention_and_deletion', have: 'have', path: 'RETENTION.md', note: 'Per table and per device store; a legal-hold override does not exist.' },
  { artifact: 'Current HECVAT 4 workbook', key: 'hecvat_4_current_workbook', have: 'draft', path: 'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md', note: 'A first draft for owner review, held to the readiness register; not the workbook and not complete.' },
  { artifact: '1EdTech TrustEd Apps self-assessment materials', key: 'trust_ed_apps_self_assessment', have: 'none', path: null, note: 'The four rubrics are read against the registers on this page; no self-assessment has been submitted (EDT-7).' },
  { artifact: 'Current ACR/VPAT with known limitations', key: 'accessibility_acr_vpat', have: 'none', path: null, note: 'Needs a formal evaluation by a person; the automated scorecard is not one (A11Y-2).' },
  { artifact: 'Architecture and data-flow diagram', key: 'data_flow_diagram', have: 'have', path: 'docs/ARCHITECTURE.md', note: 'The current system and the target, with the data flows; hosting regions and key location are named as gaps.' },
  { artifact: 'DPA and standard contract terms', key: 'dpa', have: 'draft', path: 'docs/trust/DPA-CHECKLIST.md', note: 'Clause requirements and starting language for counsel; nothing signed (PRIV-4).' },
  { artifact: 'Incident-response and business-continuity summary', key: 'incident_response_overview', have: 'draft', path: 'docs/market-readiness/INCIDENT_RESPONSE.md', note: 'Written and never exercised; no restore has been performed and no RTO/RPO stated (IR-1, BCP-1).' },
  { artifact: 'Integration and API documentation with data scopes', key: 'integration_documentation', have: 'draft', path: 'docs/INTEGRATION-PERMISSION-MATRIX.md', note: 'Scopes and the LTI runbook exist; the adapter registry is empty by design.' },
  { artifact: 'Data-export and offboarding guide', key: 'export_and_offboarding', have: 'draft', path: 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md', note: 'The student export exists and is tested; the institutional offboarding path is written, not built (FERPA-7).' },
  { artifact: 'Independent security assessment or penetration-test summary', key: 'security_assessment_or_penetration_test_summary', have: 'none', path: null, note: 'The plan exists; no test has been performed (VULN-2).' },
  { artifact: 'AI feature inventory, providers, data flow, training terms, user notice, decision boundaries, evaluation and incident process', key: 'ai_data_use_and_provider_disclosure', have: 'draft', path: 'docs/operating-model/AI-ASSURANCE.md', note: 'The audit matrix and the no-training policy draft; provider terms are recorded as published in docs/trust/PROVIDER-TERMS.md and none is signed, and no evaluation has run (AI-2).' },
  // What the critical tier adds to the high tier’s package.
  { artifact: 'Data protection or privacy impact assessment (DPIA/PIA)', key: 'dpia_or_pia', have: 'none', path: null, note: 'Owed by the critical tier; the module privacy model is the material one would be written from, not the assessment.' },
  { artifact: 'Threat model', key: 'threat_model', have: 'draft', path: 'docs/INTEGRATION-THREAT-MODEL.md', note: 'The integration threat model is written; the platform threat model is designed only (SEC-002).' },
  { artifact: 'Legal review', key: 'legal_review', have: 'none', path: null, note: 'No counsel has reviewed any document; the trust index lists what blocks a signature.' },
  { artifact: 'Executive risk acceptance and periodic re-review', key: 'executive_risk_acceptance', have: 'none', path: null, note: 'The risk register’s exception record is empty and the founder seat, which accepts risk, is vacant.' },
];

/** The gates before a `high` or `critical` service may go live, each resting on rows. */
export const LAUNCH_GATES: readonly { gate: string; rests: readonly string[] }[] = [
  { gate: 'A named business owner and technical owner exist.', rests: ['PRG-001', 'SUP-003'] },
  { gate: 'Privacy, security, accessibility, AI, legal and integration reviews are approved.', rests: ['SEC-011', 'A11Y-007', 'AI-001', 'LEG-002', 'INT-001'] },
  { gate: 'Contract and DPA requirements are complete.', rests: ['PRIV-4', 'LEG-002'] },
  { gate: 'The data map and retention configuration are approved.', rests: ['PRIV-1', 'RM-01'] },
  { gate: 'SSO and integration scope are tested in a sandbox.', rests: ['IAM-1', 'INT-001', 'INT-002'] },
  { gate: 'Least-privilege roles and privileged-access controls are configured.', rests: ['IAM-2', 'IAM-011'] },
  { gate: 'Accessibility acceptance criteria and known limitations are documented.', rests: ['A11Y-1', 'A11Y-2'] },
  { gate: 'AI policy, provider and evaluation controls are approved.', rests: ['AI-1', 'AI-2', 'AI-006'] },
  { gate: 'Support, incident escalation and student communications are ready.', rests: ['SUP-1', 'IR-1', 'SUP-001'] },
  { gate: 'Export, offboarding and credential-revocation procedures are documented.', rests: ['FERPA-7', 'LEG-004'] },
  { gate: 'Open findings are accepted, remediated or formally risk-accepted.', rests: ['GOV-2'] },
];

export const DECISION_STATES: readonly { state: string; meaning: string }[] = [
  { state: 'Approved', meaning: 'Evidence and controls meet the applicable risk requirements.' },
  { state: 'Approved with conditions', meaning: 'A defined remediation, configuration restriction, contract clause or launch gate is required.' },
  { state: 'Pilot only', meaning: 'Limited duration and scope; synthetic or de-identified data where feasible; no production integration unless explicitly approved.' },
  { state: 'Deferred', meaning: 'Business purpose, ownership, evidence or data scope is not sufficiently defined.' },
  { state: 'Not approved', meaning: 'Risk, control gap, contractual position or unsupported workflow is unacceptable.' },
];

export const INTAKE_RULE = 'A vendor is never marked approved merely because it provided a completed questionnaire. Approval is an institution-specific conclusion about evidence, residual risk, contractual terms, configuration and the proposed use.';

export const REASSESSMENT: readonly string[] = [
  'At renewal.',
  'At least annually for high- and critical-risk services.',
  'After a material product, AI model or provider, data-use, hosting or subprocessor change.',
  'After a material security, privacy, accessibility or safety incident.',
  'Before expanding data scope, users, integrations or external actions.',
];

/** The procurement-fit matrix: which instrument a situation calls for. */
export const FIT: readonly { situation: string; full: string; lite: string; trusted: string; decision: string }[] = [
  { situation: 'Public informational tool; no login or personal data', full: 'Usually unnecessary', lite: 'Possible if local policy requires', trusted: 'Public privacy and accessibility review', decision: 'Lightweight review and an accessibility check' },
  { situation: 'Departmental instructional tool with SSO and limited student data', full: 'May be excessive initially', lite: 'Appropriate starting point', trusted: 'Request the self-assessments if available', decision: 'Moderate review plus data-flow and DPA review' },
  { situation: 'LMS, assessment, student-success, advising, community or AI tool', full: 'Usually appropriate', lite: 'Only if the institution’s risk process allows', trusted: 'Strongly recommended: privacy, accessibility, AI and interoperability evidence', decision: 'High-risk review with HECVAT, TrustEd materials, ACR/VPAT and an integration test' },
  { situation: 'SIS, gradebook, payment, proctoring, health or basic-needs intake, or broad production export', full: 'Required or strongly expected', lite: 'Insufficient alone', trusted: 'Useful complement, not sufficient', decision: 'Full HECVAT, technical security review, DPIA/PIA, legal review, executive approval' },
  { situation: 'Vendor claiming 1EdTech certification', full: 'Still useful for security and procurement depth', lite: 'May supplement initial triage', trusted: 'Verify the exact certification and its scope', decision: 'Never treat a certification as a substitute for HECVAT' },
  { situation: 'AI-enabled tool with education-record data', full: 'Appropriate, by data and use risk', lite: 'Only for a constrained low-risk pilot', trusted: 'Request the Generative AI Data Rubric materials', decision: 'Add an AI impact assessment, provider review, model evaluation and contractual AI controls' },
];

// ── The four dashboard values ────────────────────────────────────────────────

export interface Dashboard {
  rows: number;
  /** Rows at 2 or above: built and configured. */
  implementation: number;
  /** Rows at 3 or above: current proof that the control operated. */
  evidence: number;
  /** Rows an automated test runs on every change. */
  effectiveness: number;
  /** Master rows at P0 that are not yet tested: the open release blockers. */
  risk: number;
}

/** The documents' rule: four values, never one "compliance percentage". Pure. */
export function dashboard(rows: readonly Standing[]): Dashboard {
  return {
    rows: rows.length,
    implementation: rows.filter((s) => s.level >= 2).length,
    evidence: rows.filter((s) => s.level >= 3).length,
    effectiveness: rows.filter((s) => s.tested).length,
    risk: rows.filter((s) => s.register === 'master' && s.severity === 'P0' && !s.tested).length,
  };
}

/** Every id the page names, once. */
export function allRests(): string[] {
  const ids = new Set<string>();
  for (const d of DOMAINS) for (const id of d.rests) ids.add(id);
  for (const i of RUBRIC_ITEMS) for (const id of i.rests) ids.add(id);
  for (const o of AI_OVERLAY) for (const id of o.rests) ids.add(id);
  for (const t of SELF_TRIGGERS) for (const id of t.rows) ids.add(id);
  for (const n of NOT_TRIGGERED) for (const id of n.rows) ids.add(id);
  for (const g of LAUNCH_GATES) for (const id of g.rests) ids.add(id);
  return [...ids];
}
