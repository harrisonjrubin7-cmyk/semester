import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLES } from '../rolelaunch';
import { SOURCE_LABELS, SOURCE_TEXT } from '../source';
import {
  AI_MODES, AI_NEVER_INFERS, BOUNDARIES, CONDITIONS, CONSENT_NOTE, CONTRACT_TERMS, COUNCIL, DATA, DECISION_RIGHTS, DEFAULT_DASHBOARD, EVIDENCE_REGISTER,
  INFORMATION_STATES, LAUNCH_GATES, PROCESSING_REGISTER, REQUIRED_CONTROLS, RISK_CONTROLS, ROLE_MATRIX, RULE, SAFETY_BOUNDARIES, SHARE_SCREEN, SOURCES, STATUSES,
} from './module-privacy';

/**
 * Holds the privacy-by-module model to the tree: every role the matrix names
 * is a row of the role register (itself held to `app_roles`), a role the
 * database lacks says so rather than borrowing one, every launch gate cites
 * the kind of file its status claims, every cited path exists, and the
 * information states the document asks every screen to show are held against
 * the five source labels the database enforces.
 *
 * `docs/MODULE-PRIVACY-MODEL.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/MODULE-PRIVACY-MODEL.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('privacy by module', () => {
  it('keeps the two supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(2);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const g of LAUNCH_GATES) for (const e of g.evidence) expect(supplied.has(e.path), `${g.id} cites a supplied PDF`).toBe(false);
  });

  it('covers the three modules, eighteen rows, four AI modes and six inferences AI never makes', () => {
    expect(DATA).toHaveLength(18);
    for (const m of ['Transfer Transition Hub', 'Career and workforce', 'Basic-Needs Navigator']) expect(DATA.filter((d) => d.module === m).length, m).toBe(6);
    expect(AI_MODES).toHaveLength(4);
    expect(AI_NEVER_INFERS).toHaveLength(6);
    expect(DEFAULT_DASHBOARD).toHaveLength(9);
    expect(CONDITIONS).toHaveLength(6);
    expect(RULE).toBe('Discover privately; share deliberately; act through the accountable office.');
  });

  it('names only roles the database can grant, and says so where it cannot', () => {
    const roles = new Set(ROLES.map((r) => r.role));
    expect(roles.has('academic_advisor')).toBe(true); // the control: the register is really loaded
    expect(roles.has('basic_needs_case_manager')).toBe(false);
    for (const r of ROLE_MATRIX) {
      if (r.role) expect(roles.has(r.role), `${r.label} → ${r.role}`).toBe(true);
      else expect(r.note, `${r.label} has no role and no note`).toBeTruthy();
    }
    expect(ROLE_MATRIX).toHaveLength(8);
  });

  it('keeps the matrix narrower than the role register’s own line on each role', () => {
    // A role the matrix lets see something must not be one the register says must never see it.
    for (const r of ROLE_MATRIX) {
      if (!r.role) continue;
      const row = ROLES.find((x) => x.role === r.role)!;
      for (const word of ['grades', 'health', 'AI']) {
        if (row.mustNever.toLowerCase().includes(word.toLowerCase())) expect(r.canSee.toLowerCase(), `${r.label} may see ${word}, which the register forbids ${r.role}`).not.toContain(word.toLowerCase());
      }
    }
  });

  it('names only source labels that exist, and keeps the three display states off the rows', () => {
    for (const s of INFORMATION_STATES) if (s.carriedBy) expect(SOURCE_LABELS, `${s.state} → ${s.carriedBy}`).toContain(s.carriedBy);
    expect(INFORMATION_STATES.filter((s) => s.carriedBy).length).toBe(4);
    expect(INFORMATION_STATES.map((s) => s.state)).toContain('AI generated');
    expect(INFORMATION_STATES.map((s) => s.state)).toContain('Emergency information');
    expect(SOURCE_TEXT.institution_verified).toBe(INFORMATION_STATES[0].state);
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-privacy-evidence.md'))).toBe(false);
  });

  it('cites only files that exist', () => {
    for (const g of LAUNCH_GATES) for (const e of g.evidence) expect(existsSync(join(root, e.path)), `${g.id} cites ${e.path}`).toBe(true);
  });

  it('holds each of the twelve launch gates to the kind of file it claims, with a gap', () => {
    expect(LAUNCH_GATES).toHaveLength(12);
    for (const g of LAUNCH_GATES) {
      const paths = g.evidence.map((e) => e.path);
      expect(STATUSES, g.id).toContain(g.status);
      if (g.status === 'designed') expect(paths.some(isDoc), `${g.id} is designed and cites no document`).toBe(true);
      if (g.status === 'building') expect(paths.some(isCode), `${g.id} is building and cites no code`).toBe(true);
      if (g.status === 'tested') expect(paths.some(isTest), `${g.id} is tested and cites no test`).toBe(true);
      if (g.status === 'not-started') expect(paths.every(isDoc), `${g.id} is not started yet cites code`).toBe(true);
      expect(g.gap.trim().length, g.id).toBeGreaterThan(8);
    }
  });

  it('keeps the lists whole', () => {
    expect(SHARE_SCREEN.map((s) => s.line)).toEqual(['You are sharing', 'With', 'Purpose', 'Access', 'Expires', 'Not included', 'You can']);
    expect(BOUNDARIES.map((b) => b.domain)).toEqual(['Transfer credit', 'Financial aid', 'Career', 'Basic needs', 'AI']);
    expect(PROCESSING_REGISTER).toHaveLength(15);
    expect(RISK_CONTROLS).toHaveLength(10);
    expect(SAFETY_BOUNDARIES).toHaveLength(7);
    expect(CONTRACT_TERMS).toHaveLength(10);
    expect(EVIDENCE_REGISTER).toHaveLength(11);
    expect(COUNCIL).toHaveLength(6);
    expect(REQUIRED_CONTROLS).toHaveLength(14);
    expect(DECISION_RIGHTS.map((d) => d.who)).toEqual(['Semester can', 'Institutional offices can', 'Students can', 'AI can', 'AI cannot']);
    expect(CONSENT_NOTE).toMatch(/not.*substitute/);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const count = (s: string) => LAUNCH_GATES.filter((g) => g.status === s).length;
  const out: string[] = [
    '# Privacy by module',
    '',
    '<!-- Rendered from app/src/lib/governance/module-privacy.ts by module-privacy.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    `**${RULE}** Semester can make help easier to find and coordinate, but it`,
    'minimizes sensitive data, keeps staff access purpose-bound, and never converts a',
    'student’s request for help into a hidden risk score. Under FERPA an institution',
    'may disclose education-record information to school officials with a defined',
    'legitimate educational interest, but access is not automatic or unlimited:',
    'written criteria, use limited to the stated purpose, and contractors under the',
    'institution’s direct control. A product and governance blueprint, not legal',
    'advice.',
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## 1. Privacy by module',
    '',
  ];
  for (const m of ['Transfer Transition Hub', 'Career and workforce', 'Basic-Needs Navigator'] as const) {
    const heads = m === 'Basic-Needs Navigator' ? '| User action | Default | Staff visibility | Minimum data practice |' : m === 'Career and workforce' ? '| Data type | Default state | Permitted sharing | Prohibited sharing |' : '| Data type | Default state | When staff can access | Staff should not receive |';
    out.push(`### ${m}`, '', heads, '| --- | --- | --- | --- |');
    for (const d of DATA.filter((x) => x.module === m)) out.push(`| ${cell(d.data)} | ${cell(d.default)} | ${cell(d.staff)} | ${cell(d.never)} |`);
    out.push('');
  }
  out.push(
    'Design rule: staff see only what is necessary to perform the selected workflow.',
    'A transfer advisor may need a student-shared agenda and the documents needed for',
    'review; they do not need the student’s complete private planning history, other',
    'community memberships, or AI chats. The basic-needs module is the highest-',
    'sensitivity one: browsing for food, housing, emergency aid, health, childcare,',
    'technology or safety resources is private.',
    '',
    '### The AI assistant',
    '',
    ...AI_MODES.map((a) => `- **${a.mode}.** ${a.rule}`),
    '',
    `AI conversations are never used to infer ${AI_NEVER_INFERS.join(', ')}. No general-purpose model is trained on institutional or student content unless a documented agreement, authorization and technical controls permit it ([\`AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md\`](trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md)).`,
    '',
    '## 2. What staff can see',
    '',
    'A minimum-necessary, role-based, purpose-bound model. Staff have no universal',
    '“student 360” profile. For many offices the appropriate view is operational and',
    'aggregate:',
    '',
    ...DEFAULT_DASHBOARD.map((d) => `- ${d}`),
    '',
    'That lets a basic-needs office improve access without knowing who merely looked',
    'for food assistance. Student-specific data appears only when all of these are true:',
    '',
    ...CONDITIONS.map((c, i) => `${i + 1}. ${c}`),
    '',
    '### Role matrix',
    '',
    'Each role as the document names it, the `app_roles` row that carries it (held to',
    '[`ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md) by the test), what it can see',
    'and what it cannot.',
    '',
    '| Role | App role | Can see | Cannot see |',
    '| --- | --- | --- | --- |',
    ...ROLE_MATRIX.map((r) => `| ${cell(r.label)} | ${r.role ? `\`${r.role}\`` : `**none** — ${cell(r.note ?? '')}`} | ${cell(r.canSee)} | ${cell(r.cannotSee)} |`),
    '',
    '### The data-sharing control screen',
    '',
    'Before a share, the student sees:',
    '',
    '| Line | Example |',
    '| --- | --- |',
    ...SHARE_SCREEN.map((s) => `| ${s.line} | ${cell(s.example)} |`),
    '',
    'That makes student agency tangible and reduces inadvertent over-sharing. The',
    'consent workflow behind it, field by field against the schema, is',
    '[`trust/FERPA-CONSENT-WORKFLOW.md`](trust/FERPA-CONSENT-WORKFLOW.md).',
    '',
    '## 3. Liability and risk controls',
    '',
    'Semester cannot eliminate institutional or company liability through disclaimers',
    'alone. It needs accurate product boundaries, technical controls, documented',
    'operating procedures, contracts, insurance and trained people.',
    '',
    '### Clear authority boundaries',
    '',
    `Every relevant interface states whether information is ${INFORMATION_STATES.map((s) => `*${s.state.toLowerCase()}*`).join(', ')}. Four of these are source labels of \`lib/source.ts\`, the five the database enforces (${INFORMATION_STATES.filter((s) => s.carriedBy).map((s) => `\`${s.carriedBy}\``).join(', ')}); *published policy*, *AI generated* and *emergency information* are display states that never reach a row, and *imported* is a source label the document does not name.`,
    '',
    '| Domain | The boundary, conspicuously |',
    '| --- | --- |',
    ...BOUNDARIES.map((b) => `| ${b.domain} | ${cell(b.says)} |`),
    '',
    '### Purpose limitation and data minimization',
    '',
    `For each feature, a data-processing register carries: ${PROCESSING_REGISTER.map((f) => f.toLowerCase()).join('; ')}. If a field does not support a defined purpose, do not collect it.`,
    '',
    `### Consent and appropriate authorization`,
    '',
    CONSENT_NOTE,
    '',
    '### High-risk workflow controls',
    '',
    '| Risk area | Required control |',
    '| --- | --- |',
    ...RISK_CONTROLS.map((r) => `| ${cell(r.risk)} | ${cell(r.control)} |`),
    '',
    '### Safety and escalation boundaries',
    '',
    ...SAFETY_BOUNDARIES.map((s) => `- ${s}`),
    '',
    '### Contracts, insurance and evidence',
    '',
    'Institutional contracts define:',
    '',
    ...CONTRACT_TERMS.map((c) => `- ${c}`),
    '',
    `An evidence register demonstrates — not merely claims — compliance: ${EVIDENCE_REGISTER.map((e) => e.toLowerCase()).join('; ')}.`,
    '',
    '## 4. Practical launch gates',
    '',
    'A module is not enabled for a tenant until it passes these. Statuses were read',
    'at `origin/main` `92952f0` on 28 September 2026, under the expansion register’s',
    'rule: `designed` cites a document, `building` code, `tested` a test.',
    '',
    `| ${STATUSES.join(' | ')} |`,
    `| ${STATUSES.map(() => '---:').join(' | ')} |`,
    `| ${STATUSES.map(count).join(' | ')} |`,
    '',
    '| ID | Gate | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- |',
    ...LAUNCH_GATES.map((g) => `| ${g.id} | ${cell(g.gate)} | ${g.status} | ${g.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>')} | ${cell(g.gap)} |`),
    '',
    'The pilot-to-production state machine (`rollout.ts`, `tenant_rollout`) already',
    'refuses a forward move without exit-gate evidence; these twelve are the module-',
    'level gates that machine does not yet name.',
    '',
    '## 5. Institutional governance',
    '',
    'These modules need a governance structure before they need more features: a',
    'Student Experience, Data and AI Governance Council with named authority and a',
    'written charter.',
    '',
    '| Area | Accountable owner | Required participants |',
    '| --- | --- | --- |',
    ...COUNCIL.map((c) => `| ${c.area} | ${cell(c.owner)} | ${cell(c.participants)} |`),
    '',
    '### Required controls',
    '',
    ...REQUIRED_CONTROLS.map((c) => `- ${c}`),
    '',
    '### Decision-rights rule',
    '',
    ...DECISION_RIGHTS.map((d) => `- **${d.who}:** ${d.can}`),
    '',
    'The benchmark outcome is a platform where staff receive just enough information',
    'to provide help, students retain control over private exploration and optional',
    'sharing, and Semester never mistakes a need for help as permission to monitor or',
    'judge a student.',
    '',
  );
  return out.join('\n');
}
