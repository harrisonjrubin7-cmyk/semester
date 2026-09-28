import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMITMENTS, INITIATIVES, ITEMS, STANCES, bare, coverage, type Commitment } from './benchmark';
import { cell, controlLine, link, renderedFrom, table } from './ops/render';

const root = join(import.meta.dirname, '../../..');
const exists = (p: string) => existsSync(join(root, p));
const DOC = 'docs/operating-model/BENCHMARK.md';
const KEYS = Object.keys(COMMITMENTS) as Commitment[];

describe('the benchmark register', () => {
  it('names the twenty-five initiatives once each, under one of six commitments', () => {
    expect(INITIATIVES.map((x) => x.n)).toEqual(Array.from({ length: 25 }, (_, k) => k + 1));
    for (const x of INITIATIVES) expect(KEYS).toContain(x.commitment);
    for (const k of KEYS) {
      expect(INITIATIVES.some((x) => x.commitment === k), k).toBe(true);
      expect(STANCES[k].length, k).toBeGreaterThan(60);
    }
  });

  it('breaks every initiative into at least one item, and cites evidence that exists', () => {
    const ids = ITEMS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const it of INITIATIVES) expect(ITEMS.some((x) => x.initiative === it.n), `initiative ${it.n} has no item`).toBe(true);
    for (const x of ITEMS) {
      expect(x.note.length, x.id).toBeGreaterThan(20);
      if (x.status === 'owed') expect(x.evidence, `${x.id} is owed and cites ${x.evidence}`).toBeNull();
      else {
        expect(x.evidence, `${x.id} is ${x.status} and cites nothing`).not.toBeNull();
        expect(exists(x.evidence!), `${x.id} cites ${x.evidence}, which is missing`).toBe(true);
      }
    }
  });

  it('never marks in place by a document alone', () => {
    for (const x of ITEMS.filter((y) => y.status === 'in-place')) expect(x.evidence, `${x.id} is in place by a document`).not.toMatch(/\.md$/);
  });

  it('states the finding', () => {
    expect(ITEMS).toHaveLength(39);
    expect(coverage()).toEqual({ inPlace: 19, partial: 17, owed: 3 });
    expect(bare()).toEqual([2, 4, 5, 9, 11, 12, 14, 15, 19, 20, 21, 22, 25]);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

const WORD = { 'in-place': 'in place', partial: 'partial', owed: 'owed' } as const;

function render(): string {
  const c = coverage();
  const out: string[] = [
    '# The benchmark register',
    '',
    renderedFrom('app/src/lib/benchmark.ts', 'benchmark.test.ts'),
    '',
    controlLine(DOC),
    '',
    'The strategy brief’s six public commitments and twenty-five initiatives, each',
    'broken into the brief’s own checkable items and each item marked with what',
    'the tree holds. An item in place cites the thing, never a page about it; an',
    'owed item says what would close it.',
    '',
    `**${c.inPlace} of ${ITEMS.length} items are in place, ${c.partial} are partial and ${c.owed} are owed.**`,
    `Nothing at all is in place in ${bare().length} initiatives: ${bare().map((n) => `${n} (${INITIATIVES[n - 1].title})`).join('; ')}.`,
    '',
    '## The commitments',
    '',
    ...KEYS.flatMap((k) => [`### ${COMMITMENTS[k]}`, '', `> ${STANCES[k]}`, '', ...INITIATIVES.filter((x) => x.commitment === k).map((x) => `- ${x.n}. ${x.title}`), '']),
    '## The initiatives',
    '',
  ];
  for (const it of INITIATIVES) {
    const rows = ITEMS.filter((x) => x.initiative === it.n);
    out.push(`### ${it.n}. ${it.title}`, '', `${COMMITMENTS[it.commitment]} · ${rows.filter((x) => x.status === 'in-place').length} of ${rows.length} in place.`, '');
    out.push(...table(['ID', 'Item', 'Status', 'Evidence', 'What it shows, or what would close it'], rows.map((x) => [x.id, cell(x.item), WORD[x.status], x.evidence ? `[\`${x.evidence}\`](${link(DOC, x.evidence)})` : '—', cell(x.note)])), '');
  }
  return out.join('\n');
}
