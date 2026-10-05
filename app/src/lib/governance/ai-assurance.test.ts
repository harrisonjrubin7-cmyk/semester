import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ANSWER_LABELS, ARTIFACTS, ASSESSED, CHECKLIST, CHECKLIST_SECTION_NAMES, EVALUATION_GOVERNANCE, FUNCTIONS, INTAKE_REFUSALS, MATRIX, METRICS,
  MODES_FIRST, MODES_PROHIBITED, NOT_METRICS, PIPELINE, RELEASE_GATE, RISK_TIERS, SOURCES, STATUSES, STATUS_CAVEAT, TIER4_NOT_YET_REFUSED,
} from './ai-assurance';
import { AI_RELEASE_GATE, GATE_IDS, LIFECYCLE, NIST_FUNCTIONS, NIST_LABEL, PROHIBITED_STARTING_SCOPE } from './ai-lifecycle';

/**
 * Holds the AI assurance matrix and checklist to the same rule as the
 * expansion register — every cited file exists, and each status cites the
 * kind of file it claims — and to the lifecycle already in code: a matrix row
 * names a real gate owned by its own function, a tier-4 refusal is a scope the
 * intake really refuses, a prohibited mode names a refusal that exists, and
 * the release gate names only items `AI_RELEASE_GATE` has.
 *
 * `docs/operating-model/AI-ASSURANCE.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/operating-model/AI-ASSURANCE.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p) && !p.startsWith('.github/');
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const isCode = (p: string) => !isDoc(p);

describe('the AI assurance matrix', () => {
  it('keeps the three supplied documents where it says, and never cites them as evidence', () => {
    expect(SOURCES).toHaveLength(3);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    const supplied = new Set(SOURCES.map((s) => s.path));
    for (const a of ASSESSED) for (const e of a.evidence) expect(supplied.has(e.path), `${a.id} cites a supplied PDF as evidence`).toBe(false);
  });

  it('has twenty-one rows, ids once, every function and every gate represented', () => {
    expect(MATRIX).toHaveLength(21);
    expect(new Set(ASSESSED.map((a) => a.id)).size).toBe(ASSESSED.length);
    for (const fn of NIST_FUNCTIONS) expect(MATRIX.some((r) => r.fn === fn), fn).toBe(true);
    for (const g of GATE_IDS) expect(MATRIX.some((r) => r.gate === g), g).toBe(true);
    expect(FUNCTIONS.map((f) => f.fn)).toEqual([...NIST_FUNCTIONS]);
  });

  it('evidences each row at a gate its own function owns', () => {
    for (const r of MATRIX) {
      const gate = LIFECYCLE.find((g) => g.id === r.gate)!;
      expect(gate.owner, `${r.id} (${r.fn}) is evidenced at ${r.gate}, owned by ${gate.owner}`).toBe(r.fn);
    }
  });

  it('can tell a missing file from a present one', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/no-such-assurance-evidence.md'))).toBe(false);
  });

  it('cites only files that exist', () => {
    for (const a of ASSESSED) for (const e of a.evidence) expect(existsSync(join(root, e.path)), `${a.id} cites ${e.path}`).toBe(true);
    for (const a of ARTIFACTS) if (a.path) expect(existsSync(join(root, a.path)), `${a.artifact} → ${a.path}`).toBe(true);
  });

  it('holds each status to the kind of file it claims, and names a gap for every item', () => {
    for (const a of ASSESSED) {
      const paths = a.evidence.map((e) => e.path);
      expect(STATUSES, a.id).toContain(a.status);
      if (a.status === 'designed') expect(paths.some(isDoc), `${a.id} is designed and cites no document`).toBe(true);
      if (a.status === 'building') expect(paths.some(isCode), `${a.id} is building and cites no code`).toBe(true);
      if (a.status === 'tested') expect(paths.some(isTest), `${a.id} is tested and cites no test`).toBe(true);
      if (a.status === 'not-started') expect(paths.every(isDoc), `${a.id} is not started yet cites code`).toBe(true);
      expect(a.gap.trim().length, a.id).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps the checklist in its seven sections, each with items', () => {
    expect(CHECKLIST_SECTION_NAMES).toHaveLength(7);
    for (const s of CHECKLIST_SECTION_NAMES) expect(CHECKLIST.filter((c) => c.section === s).length, s).toBeGreaterThan(5);
    expect(EVALUATION_GOVERNANCE).toHaveLength(12);
  });

  it('refuses tier 4 only where the intake really refuses it, and says what it does not yet refuse', () => {
    const tier4 = RISK_TIERS.find((t) => t.tier === 4)!;
    expect(tier4.refuses!.length).toBeGreaterThan(0);
    for (const r of tier4.refuses!) expect(INTAKE_REFUSALS, r).toContain(r);
    expect(INTAKE_REFUSALS).toEqual([...PROHIBITED_STARTING_SCOPE]);
    for (const t of RISK_TIERS) if (t.tier < 4) expect(t.refuses).toBeUndefined();
    for (const d of TIER4_NOT_YET_REFUSED) expect(INTAKE_REFUSALS.some((r) => r.toLowerCase().includes(d.split(' ')[0].toLowerCase())), d).toBe(false);
    expect(RISK_TIERS.map((t) => t.tier)).toEqual([0, 1, 2, 3, 4]);
  });

  it('names only release-gate items and intake refusals that exist', () => {
    const gate = new Set<string>(AI_RELEASE_GATE);
    const refusals = new Set<string>(PROHIBITED_STARTING_SCOPE);
    expect(RELEASE_GATE).toHaveLength(11);
    for (const r of RELEASE_GATE) if (r.carriedBy) expect(gate.has(r.carriedBy), `${r.ask} → ${r.carriedBy}`).toBe(true);
    for (const r of RELEASE_GATE) if (!r.carriedBy) expect(r.note, r.ask).toBeTruthy();
    expect(MODES_PROHIBITED).toHaveLength(9);
    for (const m of MODES_PROHIBITED) {
      if (m.refusedBy) expect(gate.has(m.refusedBy) || refusals.has(m.refusedBy), `${m.mode} → ${m.refusedBy}`).toBe(true);
      else expect(m.note, m.mode).toBeTruthy();
    }
    expect(MODES_FIRST).toHaveLength(8);
    expect(ANSWER_LABELS.map((l) => l.label)).toEqual(['Source', 'Status', 'Policy', 'Limits', 'Action']);
    expect(PIPELINE[0]).toBe('User request');
    expect(METRICS).toHaveLength(11);
    expect(NOT_METRICS).toHaveLength(3);
  });

  it('lists the twenty-two artifacts, and says why each that has no file has none', () => {
    expect(ARTIFACTS).toHaveLength(22);
    for (const a of ARTIFACTS) expect(a.note.trim().length, a.artifact).toBeGreaterThan(3);
  });

  it(`is what ${DOC} says, caveat included`, () => {
    const rendered = render();
    expect(rendered).toContain(STATUS_CAVEAT);
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const ev = (e: readonly { path: string; shows: string }[]) => (e.length ? e.map((x) => `\`${x.path}\` — ${cell(x.shows)}`).join('<br>') : '—');
const count = (rows: readonly { status: string }[], s: string) => rows.filter((r) => r.status === s).length;

function render(): string {
  const out: string[] = [
    '# AI assurance: NIST AI RMF and NIST AI 800-1, audit-ready',
    '',
    '<!-- Rendered from app/src/lib/governance/ai-assurance.ts by ai-assurance.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'Three documents arrived on 28 September 2026 and are kept under `docs/expansion/`',
    'as supplied. [`AI-LIFECYCLE-GATES.md`](AI-LIFECYCLE-GATES.md) already runs each',
    'AI capability through six gates owned by the four functions of the NIST AI Risk',
    'Management Framework, and refuses ten starting scopes at intake. The documents',
    'do not replace that; they ask what an auditor would want to see at each',
    'function, and add the misuse lens of NIST AI 800-1. So every matrix row names',
    'the gate it is evidenced at, every line of the release gate names the',
    '`AI_RELEASE_GATE` item that already carries it or says none does, every',
    'prohibited mode names the refusal already in code or says none is, and a risk',
    'tier that says "do not deploy" is held to `PROHIBITED_STARTING_SCOPE`.',
    '',
    `**Status caveat.** ${STATUS_CAVEAT}`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](../${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## Where it stands',
    '',
    'Statuses were read at `origin/main` `92952f0` on 28 September 2026. A test holds',
    'every cited file to existing and each status to the kind of file it cites:',
    '`designed` a document, `building` code, `tested` a test that runs on every',
    'change. The supplied PDFs are never cited as evidence. Nothing is above',
    '`tested`, because nothing has an artifact under `docs/evidence/`.',
    '',
    `| | ${STATUSES.join(' | ')} | Total |`,
    `| --- | ${STATUSES.map(() => '---:').join(' | ')} | ---: |`,
    `| Control matrix | ${STATUSES.map((s) => count(MATRIX, s)).join(' | ')} | ${MATRIX.length} |`,
    `| 800-1 checklist | ${STATUSES.map((s) => count(CHECKLIST, s)).join(' | ')} | ${CHECKLIST.length} |`,
    '',
    '## The four functions',
    '',
    '| Function | Semester purpose | Key question | Operating result |',
    '| --- | --- | --- | --- |',
    ...FUNCTIONS.map((f) => `| ${NIST_LABEL[f.fn]} | ${cell(f.purpose)} | ${cell(f.question)} | ${cell(f.result)} |`),
    '',
    'A loop, not a line: Govern → Map → Measure → Manage → update governance,',
    'policies, inventory, evaluations and launch gates.',
    '',
    '## The audit-ready control matrix',
    '',
    'Each row: what AI 800-1 emphasises, Semester’s control, the artifact an',
    'auditor asks for, what they check, the lifecycle gate the artifact is',
    'evidenced at, and where the tree stands.',
    '',
    '| ID | Function | AI 800-1 emphasis | Semester control | Required artifact | Audit checkpoint | Gate | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...MATRIX.map((r) => `| ${r.id} | ${NIST_LABEL[r.fn]} | ${cell(r.emphasis)} | ${cell(r.control)} | ${cell(r.artifact)} | ${cell(r.checkpoint)} | ${r.gate} | ${r.status} | ${ev(r.evidence)} | ${cell(r.gap)} |`),
    '',
    '## Govern: model evaluation belongs here',
    '',
    'Model evaluation belongs in Govern, not only in Measure, because leadership',
    'decides in advance what "good enough" means, which harms are unacceptable, who',
    'can approve exceptions, and what evidence must exist before launch.',
    '',
    ...EVALUATION_GOVERNANCE.map((e) => `- [ ] ${e}`),
    '',
    '### Evaluation policy by risk tier',
    '',
    '| Tier | Example | Evaluation requirement | Launch authority |',
    '| ---: | --- | --- | --- |',
    ...RISK_TIERS.map((t) => `| ${t.tier} | ${cell(t.example)} | ${cell(t.evaluation)} | ${cell(t.authority)} |`),
    '',
    `Tier 4 is not deployed for automated decision-making. Of the domains it names, the intake already refuses ${RISK_TIERS[4].refuses!.map((r) => `*${r.toLowerCase()}*`).join(', ')}; ${TIER4_NOT_YET_REFUSED.map((d) => `*${d.toLowerCase()}*`).join(' and ')} are not yet named in \`PROHIBITED_STARTING_SCOPE\`, and the page says so rather than implying they are.`,
    '',
    '## The NIST AI 800-1 misuse-risk checklist',
    '',
    'AI 800-1 is aimed most directly at developers of dual-use foundation models.',
    'Semester develops none and accesses provider models through its own key or the',
    'student’s, so it applies the parts relevant to a SaaS deployer: provider',
    'governance, capability assessment, misuse threat modelling, access control,',
    'monitoring, incident response and transparency.',
    '',
  ];
  for (const s of CHECKLIST_SECTION_NAMES) {
    out.push(`### ${s}`, '', '| ID | Item | Status | Evidence | Gap |', '| --- | --- | --- | --- | --- |');
    for (const c of CHECKLIST.filter((x) => x.section === s)) out.push(`| ${c.id} | ${cell(c.item)} | ${c.status} | ${ev(c.evidence)} | ${cell(c.gap)} |`);
    out.push('');
  }
  out.push(
    '## The artifact set',
    '',
    'A control is not audit-ready until it produces evidence. Each artifact the',
    'audit names, and the file that is it today — or none.',
    '',
    '| Artifact | Where | Note |',
    '| --- | --- | --- |',
    ...ARTIFACTS.map((a) => `| ${cell(a.artifact)} | ${a.path ? `\`${a.path}\`` : '**none**'} | ${cell(a.note)} |`),
    '',
    '## The release gate, against the one in code',
    '',
    'No AI feature enters production until the accountable owner can answer yes to',
    'all of these. Each is held to `AI_RELEASE_GATE` in `ai-lifecycle.ts`: the item',
    'that already carries it, or a note on why none does.',
    '',
    '| Ask | Carried by | Note |',
    '| --- | --- | --- |',
    ...RELEASE_GATE.map((r) => `| ${cell(r.ask)} | ${r.carriedBy ? `\`${r.carriedBy}\`` : '**none**'} | ${r.note ? cell(r.note) : '—'} |`),
    '',
    '## Safe AI for students',
    '',
    'Source-grounded, policy-aware, reversible and human-routed. The modes to',
    'build first, each with the control it needs:',
    '',
    '| AI mode | Student value | Required safety control |',
    '| --- | --- | --- |',
    ...MODES_FIRST.map((m) => `| ${cell(m.mode)} | ${cell(m.value)} | ${cell(m.control)} |`),
    '',
    '### Modes to prohibit or tightly restrict',
    '',
    'Each names the refusal already in code — an intake refusal or a release-gate',
    'item — or says none is.',
    '',
    '| Mode | Refused by | Note |',
    '| --- | --- | --- |',
    ...MODES_PROHIBITED.map((m) => `| ${cell(m.mode)} | ${m.refusedBy ? `\`${m.refusedBy}\`` : '**none**'} | ${m.note ? cell(m.note) : '—'} |`),
    '',
    '### What every answer shows',
    '',
    '| Label | Says |',
    '| --- | --- |',
    ...ANSWER_LABELS.map((l) => `| ${l.label} | ${cell(l.says)} |`),
    '',
    'The five source labels in `lib/source.ts` (Institution verified, Imported,',
    'Student entered, Estimated, Needs review) are the **Source** line; the',
    '**Status**, **Policy**, **Limits** and **Action** lines are not yet one',
    'vocabulary across answers (AM-20).',
    '',
    '### The safety pipeline',
    '',
    ...PIPELINE.map((p, i) => `${i + 1}. ${p}`),
    '',
    '### Governance metrics',
    '',
    ...METRICS.map((m) => `- ${m}`),
    '',
    `Never a proxy for student success: ${NOT_METRICS.map((m) => m.toLowerCase()).join(', ')}.`,
    '',
  );
  return out.join('\n');
}
