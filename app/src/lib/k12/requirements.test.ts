import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASELINE, COUNSEL, REQUIREMENTS, STATUSES, districtReady, type Held } from './requirements';
import { COUNCIL, SEATS } from '../launchreadiness';

/**
 * Holds the K–12 requirements to the communities register's rule — every
 * cited file exists and each status cites the kind of file it claims — and
 * the district gate to the baseline. `docs/k12/K12-REQUIREMENTS.md` is
 * rendered from the data; run `npm run registers` from app/ to rewrite it.
 */

const root = join(import.meta.dirname, '../../../..');
const exists = (p: string) => existsSync(join(root, p));
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const DOC = 'docs/k12/K12-REQUIREMENTS.md';

const isDoc = (p: string) => /\.(md|pdf|json)$/.test(p);
const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
const ALL: readonly Held[] = [...BASELINE, ...REQUIREMENTS];

describe('the K–12 requirements', () => {
  it('carry the brief’s sixteen baseline items, once each', () => {
    expect(BASELINE).toHaveLength(16);
    expect(new Set(ALL.map((r) => r.id)).size).toBe(ALL.length);
  });

  it('can tell a missing file from a present one', () => {
    expect(exists('README.md')).toBe(true);
    expect(exists('docs/no-such-k12-evidence.md')).toBe(false);
  });

  it('cite only files that exist, and hold each status to the kind of file it claims', () => {
    for (const r of ALL) {
      const paths = r.evidence.map((e) => e.path);
      for (const p of paths) expect(exists(p), `${r.id} cites ${p}`).toBe(true);
      expect(STATUSES, r.id).toContain(r.status);
      if (r.status === 'designed') expect(paths.some(isDoc), `${r.id} is designed and cites no document`).toBe(true);
      if (r.status === 'building') expect(paths.some((p) => !isDoc(p)), `${r.id} is building and cites no code`).toBe(true);
      if (r.status === 'tested') expect(paths.some(isTest), `${r.id} is tested and cites no test`).toBe(true);
      if (r.status === 'not-started') expect(paths.some((p) => !isDoc(p)), `${r.id} is not started and cites code`).toBe(false);
      if (r.status !== 'tested') expect(r.gap.length, `${r.id} is short of tested and says nothing about why`).toBeGreaterThan(10);
      expect(SEATS, r.id).toContain(r.owner);
    }
  });

  it('never cites a supplied brief as evidence', () => {
    for (const r of ALL) for (const e of r.evidence) expect(e.path.startsWith('docs/expansion/'), `${r.id} cites a brief`).toBe(false);
  });

  it('point every counsel question at rows that exist', () => {
    const ids = new Set(ALL.map((r) => r.id));
    expect(COUNSEL.length).toBeGreaterThan(0);
    for (const c of COUNSEL) for (const m of c.moves) expect(ids.has(m), `${c.question} → ${m}`).toBe(true);
  });

  it('refuse district data while any baseline item is short of tested or has a gap, and not otherwise', () => {
    const now = districtReady();
    expect(now.ready).toBe(false);
    expect(now.short.length).toBe(BASELINE.filter((b) => b.status !== 'tested' || b.gap !== '').length);
    // The control: a baseline all tested with nothing left to do is ready,
    // and one item short is not.
    const met = BASELINE.map((b) => ({ ...b, status: 'tested' as const, gap: '' }));
    expect(districtReady(met)).toEqual({ ready: true, short: [] });
    expect(districtReady([...met.slice(1), { ...met[0], status: 'designed' as const }]).ready).toBe(false);
    // Tested, but with its gap still written against it: not met (KB-06 was
    // marked tested while saying no class boundary exists).
    expect(districtReady([...met.slice(1), { ...met[0], gap: 'Not done yet.' }]).ready).toBe(false);
  });

  it('refuse a baseline that leaves any of the sixteen out', () => {
    const met = BASELINE.map((b) => ({ ...b, status: 'tested' as const, gap: '' }));
    expect(districtReady([]).ready).toBe(false);
    expect(districtReady([]).short).toHaveLength(BASELINE.length);
    const partial = districtReady(met.slice(1));
    expect(partial.ready).toBe(false);
    expect(partial.short).toEqual([`${BASELINE[0].id} ${BASELINE[0].item} (not given)`]);
  });

  it('keep the class boundary short of tested while no class boundary exists', () => {
    const kb06 = BASELINE.find((b) => b.item.startsWith('Strict role, school, class'))!;
    expect(kb06.gap).toMatch(/No grade or class-section boundary exists/);
    expect(kb06.status).not.toBe('tested');
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const holder = (seat: string) => COUNCIL.find((c) => c.seat === seat)?.holder ?? null;
const seat = (s: string) => `\`${s}\`${holder(s) ? '' : ' (vacant)'}`;
const ev = (r: Held) => (r.evidence.length ? r.evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>') : '—');
const table = (list: readonly Held[]) => [
  '| ID | Item | Status | Evidence | Gap | Owner |',
  '| --- | --- | --- | --- | --- | --- |',
  ...list.map((r) => `| ${r.id} | ${cell(r.item)} | ${r.status} | ${ev(r)} | ${cell(r.gap) || '—'} | ${seat(r.owner)} |`),
];

function render(): string {
  const gate = districtReady();
  const count = (list: readonly Held[], s: string) => list.filter((r) => r.status === s).length;
  const areas = [...new Set(REQUIREMENTS.map((r) => r.area))];
  return [
    '# K–12 requirements',
    '',
    '<!-- Rendered from app/src/lib/k12/requirements.ts by requirements.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'What the K–12 edition must do, and what a district’s student data waits on.',
    'The minimum age is 13 (D-139), so K–12 here means only the grades where',
    'students are 13 and over: in practice high school, early college and career',
    'and technical education. Nothing here says a district may be served today.',
    '',
    `**May a district’s student data be accepted?** ${gate.ready ? 'Yes.' : `No. ${gate.short.length} of ${BASELINE.length} baseline items are short of tested or still have a gap.`}`,
    '',
    `Baseline: ${STATUSES.map((s) => `${count(BASELINE, s)} ${s}`).join(', ')}.`,
    '',
    '## The district baseline',
    '',
    'Before any district’s student data is accepted, every item here is tested.',
    '',
    ...table(BASELINE),
    '',
    '## What the edition must do',
    '',
    ...areas.flatMap((a) => [`### ${a}`, '', ...table(REQUIREMENTS.filter((r) => r.area === a)), '']),
    '## For counsel',
    '',
    'What the tree cannot decide. Each question names the rows its answer would move.',
    '',
    ...COUNSEL.map((c, i) => `${i + 1}. ${c.question} (${c.moves.join(', ')})`),
    '',
  ].join('\n');
}
