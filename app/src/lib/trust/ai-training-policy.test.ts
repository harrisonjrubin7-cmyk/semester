import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULE, DEFAULT_RULE_IN_FULL, GOVERNANCE, PERMITTED_USES, PRIVACY_PAGE_SAYS, PROGRAMME_CONDITIONS, PROHIBITED_DATA, PROVIDER_INVENTORY, PROVIDER_RULE,
  REQUIREMENTS, SCOPE, SOURCE, STATUSES, TRANSPARENCY,
} from './ai-training-policy';

/**
 * Holds the AI model-training policy to the tree: the privacy page and the
 * privacy-policy draft already promise no training, and this policy must say
 * the same thing; every implementation requirement cites the kind of file
 * its status claims; every cited path exists.
 *
 * `docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md` is rendered from the
 * data; run `npm run registers` from app/ to rewrite it. The last test fails
 * while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('the AI model-training policy', () => {
  it('keeps the supplied document where it says, and never cites it as evidence', () => {
    expect(existsSync(join(root, SOURCE.path))).toBe(true);
    for (const r of REQUIREMENTS) for (const e of r.evidence) expect(e.path, `${r.id} cites the supplied PDF`).not.toBe(SOURCE.path);
  });

  it('says what the privacy page and the privacy-policy draft already promise', () => {
    expect(read('app/src/lib/privacy.ts')).toContain(PRIVACY_PAGE_SAYS);
    expect(read('docs/legal/PRIVACY-POLICY-DRAFT.md')).toMatch(/do not use (it|your information) to train AI models/);
    expect(DEFAULT_RULE).toMatch(/does not use .* to train general-purpose AI models by default/);
    expect(DEFAULT_RULE_IN_FULL).toHaveLength(2);
  });

  it('keeps the lists whole', () => {
    expect(PERMITTED_USES).toHaveLength(7);
    expect(PROHIBITED_DATA).toHaveLength(9);
    expect(PROGRAMME_CONDITIONS).toHaveLength(12);
    expect(PROVIDER_INVENTORY).toHaveLength(10);
    expect(TRANSPARENCY).toHaveLength(6);
    expect(SCOPE).toMatch(/fine-tuning/);
    expect(PROVIDER_RULE).toMatch(/approval is documented/);
    expect(GOVERNANCE).toMatch(/corrective action/);
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-policy-evidence.md'))).toBe(false);
  });

  it('holds each of the eleven implementation requirements to the kind of file it claims, with a gap', () => {
    expect(REQUIREMENTS).toHaveLength(11);
    for (const r of REQUIREMENTS) {
      const paths = r.evidence.map((e) => e.path);
      for (const p of paths) expect(existsSync(join(root, p)), `${r.id} cites ${p}`).toBe(true);
      expect(STATUSES, r.id).toContain(r.status);
      if (r.status === 'designed') expect(paths.some(isDoc), `${r.id} is designed and cites no document`).toBe(true);
      if (r.status === 'building') expect(paths.some(isCode), `${r.id} is building and cites no code`).toBe(true);
      if (r.status === 'tested') expect(paths.some(isTest), `${r.id} is tested and cites no test`).toBe(true);
      if (r.status === 'not-started') expect(paths.every(isDoc), `${r.id} is not started yet cites code`).toBe(true);
      expect(r.gap.trim().length, r.id).toBeGreaterThan(12);
    }
  });

  it(`is what ${DOC} says, banner included`, () => {
    const rendered = render();
    expect(rendered).toContain('Not in force');
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const count = (s: string) => REQUIREMENTS.filter((r) => r.status === s).length;
  return [
    '# AI Model Training and Data Use Policy',
    '',
    '<!-- Rendered from app/src/lib/trust/ai-training-policy.ts by ai-training-policy.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    '**Not in force.** A draft policy section for privacy, security, legal and',
    'institutional review, from a document of 28 September 2026',
    `([${SOURCE.title}](../${SOURCE.path.replace(/^docs\//, '')})). The privacy page`,
    `already says “${PRIVACY_PAGE_SAYS}” and the privacy-policy draft says the same;`,
    'this is that promise in policy form, and the test holds the three to one another.',
    '',
    '## The stance',
    '',
    `**${DEFAULT_RULE}** Any deviation requires a separately negotiated agreement, a`,
    'documented legal basis, informed authorization where required, technical',
    'segregation and an explicit opt-in workflow. This stance is easier to explain,',
    'safer for institutional procurement, and aligned with the sensitivity of',
    'academic, support and basic-needs data.',
    '',
    '## Purpose and scope',
    '',
    SCOPE,
    '',
    '## Default rule',
    '',
    ...DEFAULT_RULE_IN_FULL.map((r) => `${r}\n`),
    '## Permitted operational uses',
    '',
    'Subject to applicable agreements and documented controls, Semester may process',
    'the minimum information necessary to:',
    '',
    ...PERMITTED_USES.map((u) => `- ${u}`),
    '',
    'Semester limits these uses by purpose, retention, access and data classification.',
    '',
    '## Prohibited data uses',
    '',
    'Semester does not use the following for general-purpose model training,',
    'behavioural advertising, student ranking or undisclosed profiling:',
    '',
    ...PROHIBITED_DATA.map((d) => `- ${d}`),
    '',
    '## Optional customer-authorized improvement programme',
    '',
    'Any optional programme involving customer production data meets all of these:',
    '',
    ...PROGRAMME_CONDITIONS.map((c) => `- ${c}`),
    '',
    '## Model provider controls',
    '',
    'Semester maintains a current inventory of AI providers and models, including:',
    '',
    ...PROVIDER_INVENTORY.map((p) => `- ${p}`),
    '',
    PROVIDER_RULE,
    '',
    'Today the inventory is [the subprocessor register](../SUBPROCESSORS.md) and',
    '[`VENDOR-RISK-REGISTER.md`](VENDOR-RISK-REGISTER.md): providers and regions, with',
    'retention and training terms marked “to confirm”, and the published terms',
    'recorded verbatim in [`PROVIDER-TERMS.md`](PROVIDER-TERMS.md), none signed. The',
    '[DPA checklist](DPA-CHECKLIST.md) carries the no-training clause unchecked for',
    'the same reason.',
    '',
    '## Transparency and user control',
    '',
    'When AI is used, Semester provides, where appropriate:',
    '',
    ...TRANSPARENCY.map((t) => `- ${t}`),
    '',
    '## Governance and enforcement',
    '',
    GOVERNANCE,
    '',
    '## Implementation requirements',
    '',
    'A policy is credible only if enforced in architecture. Each requirement, and',
    'where the tree stands, read at main commit 92952f0 on 28 September 2026:',
    '`designed` cites a document, `building` code, `tested` a test that runs on every',
    'change.',
    '',
    `| ${STATUSES.join(' | ')} |`,
    `| ${STATUSES.map(() => '---:').join(' | ')} |`,
    `| ${STATUSES.map(count).join(' | ')} |`,
    '',
    '| ID | Requirement | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- |',
    ...REQUIREMENTS.map((r) => `| ${r.id} | ${cell(r.requirement)} | ${r.status} | ${r.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>')} | ${cell(r.gap)} |`),
    '',
    'The misuse-risk checklist and the audit matrix this policy sits inside are',
    '[the AI assurance page](../operating-model/AI-ASSURANCE.md).',
    '',
  ].join('\n');
}
