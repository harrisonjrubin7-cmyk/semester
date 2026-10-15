import { REGISTER, SIGNOFFS, type Status } from '../masterregister';
import questions from './standards-rfp.json';
import { EDUCATION_DATA_MAP } from './education-data-map';

export type AuditMode = 'Observe' | 'Assist' | 'Operate';
export type Maturity = 0 | 1 | 2 | 3 | 4;
export const MATURITY_LABELS = ['Absent', 'Planned', 'Partial', 'Enterprise-ready', 'Assured'] as const;
const LEVEL: Record<Status, Maturity> = {
  'not-started': 0, blocked: 0, designed: 1, building: 1, implemented: 2,
  tested: 2, evidenced: 3, operational: 3, 'launch-approved': 4,
};

// AR/AP/DI/DM/IP/SE/TR/UL in the supplied PDFs are Rev. 4 Appendix J
// families. Use actual Rev. 5 controls; a crosswalk is not equivalency.
export const STANDARD_REFERENCES = [
  { title: 'NIST SP 800-53 Rev. 5, including Release 5.2.0', url: 'https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final' },
  { title: 'NIST SP 800-53A assessment procedures', url: 'https://csrc.nist.gov/pubs/sp/800/53/a/r5/final' },
  { title: 'Edu-API v1.0 (Candidate Final)', url: 'https://standards.1edtech.org/edu-api/' },
  { title: 'LTI standards', url: 'https://www.1edtech.org/standards/lti' },
] as const;

export interface AuditRequirement {
  id: string;
  title: string;
  standard: string;
  controls: readonly string[];
  rows: readonly string[];
  owner: string;
  mode: AuditMode;
  weight: number;
  mandatory: boolean;
  evidenceNeeded: string;
}

function requirement(id: string, title: string, standard: string, controls: string, rows: string, owner: string, mode: AuditMode, evidenceNeeded: string): AuditRequirement {
  return { id, title, standard, controls: controls.split(' '), rows: rows.split(' '), owner, mode, weight: mode === 'Operate' ? 3 : 2, mandatory: true, evidenceNeeded };
}

export const AUDIT_REQUIREMENTS: readonly AuditRequirement[] = [
  requirement('identity', 'Identity and account lifecycle', 'OIDC / SAML / SCIM', 'AC-2 AC-3 IA-2 IA-5', 'IAM-003 IAM-004 IAM-005', 'Identity', 'Observe', 'Tenant SSO and deprovisioning UAT; privileged MFA evidence'),
  requirement('isolation', 'Tenant and object isolation', 'All integrations', 'AC-3 AC-6 SC-4', 'IAM-007 IAM-008 IAM-009', 'Security', 'Observe', 'Cross-tenant database, storage, cache and context tests'),
  requirement('lti-launch', 'Signed LMS contextual launch', 'LTI 1.3', 'IA-2 IA-5 AC-3 SC-23 SI-10 AU-12', 'INT-002', 'Integrations', 'Observe', 'Institution LMS UAT, durable launch audit and conformance evidence'),
  requirement('lti-nrps', 'Course membership and roster expiry', 'LTI NRPS', 'AC-2 AC-3 AC-6 PT-3 SI-12', 'INT-003', 'Integrations', 'Observe', 'Scoped roster retrieval, add/drop expiry and platform UAT'),
  requirement('lti-deep-link', 'Faculty content placement', 'LTI Deep Linking', 'AC-3 CM-3 SI-10', 'INT-004', 'Faculty and integrations', 'Assist', 'Faculty placement UAT and versioned content approval'),
  requirement('lti-ags', 'Confirmed and reconciled grade passback', 'LTI AGS', 'AC-3 AC-6 AU-2 AU-12 PT-3 SI-10', 'INT-005 AI-009', 'Faculty and integrations', 'Operate', 'Faculty approval, preview, confirmation, idempotency, reconciliation and rollback'),
  requirement('oneroster', 'Roster exchange compatibility', 'OneRoster 1.2', 'AC-6 PT-3 SI-10 SI-12', 'INT-006', 'Integrations', 'Observe', 'CSV/REST resource-specific conformance and institution UAT'),
  requirement('edu-api', 'Canonical enterprise data and source mappings', 'Edu-API', 'PT-2 PT-3 SI-10 SI-12', 'INT-001 INT-009', 'Data governance', 'Observe', 'Approved entity/field mappings, source ownership and real SIS reconciliation'),
  requirement('qti', 'Assessment portability', 'QTI', 'AC-3 SI-10 CM-3', 'INT-007', 'Learning systems', 'Assist', 'Import/export corpus and validation reports'),
  requirement('cartridge', 'Course migration and portability', 'Common Cartridge', 'CM-3 SI-10', 'INT-008 MIG-002', 'Implementation', 'Assist', 'Representative course import, mapping and error report'),
  requirement('provenance', 'Source lineage and freshness', 'All integrations', 'SI-10 SI-12 PT-5', 'TRUST-001 TRUST-002 AI-004 AI-005', 'Data governance', 'Observe', 'Source registry, owner, timestamps and stale-source refusals'),
  requirement('purpose', 'Authority, purpose and minimization', 'All integrations', 'PT-2 PT-3 AC-6 SI-12', 'SEC-008 TRUST-003 AI-006', 'Privacy', 'Observe', 'Field/purpose register, authority records and retrieval denial tests'),
  requirement('consent', 'Student-controlled sharing and revocation', 'Cross-cutting privacy', 'PT-4 PT-5 AC-3', 'UOS-007 TRUST-003', 'Privacy', 'Assist', 'Recipient/object scope, expiry and downstream revocation tests'),
  requirement('retention', 'Retention, legal hold, deletion and exit', 'Cross-cutting privacy', 'SI-12 MP-6 PT-3', 'SEC-008 SEC-009', 'Privacy and operations', 'Observe', 'Retention configuration, deletion records and approved exit process'),
  requirement('audit', 'Read, write, consent and AI audit trail', 'All integrations', 'AU-2 AU-3 AU-6 AU-9 AU-12', 'SEC-006', 'Security', 'Observe', 'Sanitized correlated traces, tamper safeguards and SIEM export'),
  requirement('access-review', 'Privileged and support access review', 'OIDC / SAML / SCIM', 'AC-2 AC-6 IA-2', 'IAM-010 IAM-011', 'Security', 'Observe', 'Signed access review and scoped support-access log'),
  requirement('ai-registry', 'Agent, model and tool governance', 'AI governance', 'RA-3 CA-2 CM-2 CM-3 PT-3', 'AI-001 AI-002 AI-003 AI-013', 'AI governance', 'Assist', 'Approved model/vendor terms, owners, tools and release evaluations'),
  requirement('ai-integrity', 'Course and assessment policy enforcement', 'AI governance', 'AC-3 PT-3 SI-10', 'AI-006 AI-007', 'Faculty and AI governance', 'Assist', 'Server policy decisions and restricted-assessment adversarial tests'),
  requirement('ai-security', 'Prompt injection and exfiltration protection', 'AI governance', 'SI-10 AC-3 SC-7 RA-3', 'AI-010 AI-011', 'Security and AI governance', 'Assist', 'Adversarial test report with source, tool and cross-user leak cases'),
  requirement('ai-kill', 'AI safe mode and incident escalation', 'AI governance', 'IR-4 IR-6 CA-7', 'AI-012 AI-014', 'AI governance and operations', 'Assist', 'Kill-switch drill, report routing and incident tabletop'),
  requirement('writes', 'Official workflow authority and confirmation', 'Institution APIs', 'AC-3 AC-6 AU-12 CM-3 SI-10', 'AI-009 INT-001', 'Institution workflow owner', 'Operate', 'Exact authorized preview, staff approval, single-use confirmation and readback receipt'),
  requirement('reliability', 'Integration outage safety and recovery', 'Institution APIs', 'CP-10 SI-13 CA-7', 'INT-001 INT-013 INT-014', 'Integrations', 'Observe', 'Circuit-breaker, replay, duplicate prevention and real-source reconciliation drill'),
  requirement('backup', 'Backup restoration and disaster recovery', 'Operations', 'CP-2 CP-4 CP-9 CP-10', 'SRE-004 SRE-005 SRE-006', 'Operations', 'Observe', 'Completed restore/DR drill with measured RTO/RPO'),
  requirement('monitoring', 'Service health and academic peak capacity', 'Operations', 'CA-7 SI-4', 'SRE-001 SRE-002 SRE-003 SRE-007 SRE-009 SRE-010', 'Operations', 'Observe', 'SLO measurements, alerts, status process and load test'),
  requirement('sdlc', 'Secure releases and vulnerability remediation', 'Operations', 'SA-11 SA-15 SI-2 CM-3', 'SEC-002 SEC-003 SEC-004 SEC-005 SRE-008', 'Engineering and security', 'Observe', 'Threat model, SBOM, scans, pen test and release/rollback record'),
  requirement('vendors', 'Vendor, residency and subprocessor controls', 'Supply chain', 'SR-3 SR-6 SA-9 PT-2 PT-3', 'SEC-010 AI-002', 'Privacy and procurement', 'Observe', 'Signed DPA, approved regions and vendor assessments'),
  requirement('incident', 'Security and privacy incident operations', 'Operations', 'IR-4 IR-6 IR-8', 'SEC-007', 'Security and operations', 'Observe', 'Staffed escalation and completed tabletop with notification record'),
  requirement('accessibility', 'Accessible product, content and workflow delivery', 'Accessibility', 'SA-8 SA-11 PL-2', 'A11Y-001 A11Y-002 A11Y-003 A11Y-004 A11Y-005 A11Y-006 A11Y-007', 'Accessibility', 'Observe', 'Human keyboard/screen-reader QA, current ACR and remediation evidence; WCAG is the direct standard'),
  requirement('launch', 'Phased institution configuration and migration', 'Observe / Assist / Operate', 'CM-2 CM-3 CA-6 CP-10', 'IMP-001 MIG-001 MIG-005 MIG-006 UOS-009', 'Implementation', 'Operate', 'Named tenant, configuration approvals, parallel-run UAT and rollback rehearsal'),
  requirement('knowledge', 'Campus knowledge and support routing', 'Enterprise capability', 'PT-3 SI-10 SI-12', 'UOS-001 UOS-002', 'Student services', 'Assist', 'Owned official sources, service routing and source correction workflow'),
  requirement('career', 'Student-selected career evidence and opportunities', 'CASE / Open Badges / CLR', 'PT-3 PT-4 AC-3', 'UOS-004 UOS-005 UOS-007', 'Career services', 'Assist', 'Student selection, artifact provenance, share preview and portable credential verification'),
  requirement('analytics', 'Aggregate outcomes and experimentation', 'Caliper / value analytics', 'PT-3 PT-4 RA-3', 'UOS-008', 'Institutional research', 'Assist', 'Small-cohort suppression, opt-in experiments and no individual behavioral ranking'),
];

export interface AuditRow extends AuditRequirement {
  maturity: Maturity;
  status: string;
  gaps: string[];
  evidence: readonly { path: string; shows: string }[];
}

/** Weakest required control wins. A passing average can never hide a blocker. */
export function auditRows(requirements: readonly AuditRequirement[] = AUDIT_REQUIREMENTS): AuditRow[] {
  return requirements.map((r) => {
    const records = r.rows.map((id) => REGISTER.find((entry) => entry.id === id));
    const maturity = Math.min(...records.map((entry) => entry ? LEVEL[entry.status] : 0)) as Maturity;
    return { ...r, maturity, status: MATURITY_LABELS[maturity],
      gaps: records.map((entry, i) => entry ? `${entry.id}: ${entry.gap}` : `${r.rows[i]}: no control record`),
      evidence: records.flatMap((entry) => entry?.evidence ?? []),
    };
  });
}

export function auditSummary(rows: readonly AuditRow[], mode: AuditMode) {
  const applicable = rows.filter((r) => r.mode === 'Observe' || (mode !== 'Observe' && r.mode === 'Assist') || mode === 'Operate');
  const weight = applicable.reduce((total, r) => total + r.weight, 0);
  const percent = weight ? Math.round(100 * applicable.reduce((total, r) => total + r.weight * r.maturity, 0) / (4 * weight)) : 0;
  const blockers = applicable.filter((r) => r.mandatory && r.maturity < 3);
  // Repository evidence describes product capability. It grants no tenant authority.
  return { percent, blockers, capabilityReady: applicable.length > 0 && blockers.length === 0, tenantAuthorized: false as const };
}

export function filterAudit(rows: readonly AuditRow[], filters: { search?: string; standard?: string; family?: string; owner?: string; blockersOnly?: boolean }): AuditRow[] {
  const q = (filters.search ?? '').trim().toLowerCase();
  return rows.filter((r) => (!filters.standard || r.standard === filters.standard)
    && (!filters.family || r.controls.some((c) => c.startsWith(`${filters.family}-`)))
    && (!filters.owner || r.owner === filters.owner)
    && (!filters.blockersOnly || r.maturity < 3)
    && (!q || [r.id, r.title, r.standard, r.owner, ...r.controls, ...r.gaps].join(' ').toLowerCase().includes(q)));
}

export const RFP_QUESTIONS = questions;

/** Export the entire scope even when the screen is filtered. No student data. */
export function auditEvidencePack(now: Date = new Date()): string {
  const rows = auditRows();
  return JSON.stringify({ schemaVersion: '1.0', generatedAt: now.toISOString(), scope: 'Repository capability assessment; no named tenant authorization',
    framework: 'NIST SP 800-53 Rev. 5', references: STANDARD_REFERENCES,
    legacyPrivacyFamilies: 'AR/AP/DI/DM/IP/SE/TR/UL are Rev. 4 Appendix J labels, not Rev. 5 control IDs',
    certification: 'No certification or independent assessment is asserted by this export',
    summaries: Object.fromEntries((['Observe', 'Assist', 'Operate'] as const).map((mode) => [mode, auditSummary(rows, mode)])),
    signoffs: SIGNOFFS, requirements: rows, educationDataMap: EDUCATION_DATA_MAP,
    questionnaire: RFP_QUESTIONS.map((question) => ({ ...question, response: '', evidenceId: '', evidenceDate: '', accountableOwner: '', limitation: '', remediationTarget: '', appliesToProduction: null })),
  }, null, 2);
}

/** Spreadsheet-safe questionnaire; unanswered questions stay unanswered. */
export function rfpCsv(): string {
  const cell = (value: string) => `"${(/^[=+@-]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
  return [['ID', 'Category', 'Question', 'Yes / No / Partial / Planned', 'Evidence ID', 'Evidence date', 'Accountable owner', 'Limitation', 'Remediation target', 'Applies to production'],
    ...RFP_QUESTIONS.map((q) => [q.id, q.category, q.question, '', '', '', '', '', '', ''])].map((row) => row.map(cell).join(',')).join('\r\n');
}
