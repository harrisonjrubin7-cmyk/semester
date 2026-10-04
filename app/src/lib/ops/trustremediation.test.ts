import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEATS } from '../launchreadiness';
import { cell, controlLine, isIsoDate, link, renderedFrom, table } from './render';
import { CONTROLS, PROOF_SHAPE, control } from './trustcontrols';
import { ITEMS, POINTS, POINT_TITLE, item, ordered, priority } from './trustremediation';

/**
 * The remediation sequence, held to the register it answers.
 *
 * The point of the sequence is that no gap in the control register goes
 * untracked, so the strongest check is the first one: every control that is
 * not enforced is moved by at least one item. Past that, an item is held to
 * what it cites (every source exists, every control and dependency is real, no
 * dependency cycle, nothing needs an item due later than itself), and a
 * finished item must name a test, check or workflow that fails without it.
 *
 * `REMEDIATION-SEQUENCE.md` is rendered; `npm run registers` from app/
 * rewrites it.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const exists = (p: string) => existsSync(at(p));
const DOC = 'docs/integrated-trust/REMEDIATION-SEQUENCE.md';

describe('the sequence', () => {
  it('has unique, well-formed ids', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) expect(i.id).toMatch(/^RM-\d{2}$/);
  });

  it('tracks every control that is not enforced', () => {
    const moved = new Set(ITEMS.flatMap((i) => i.moves));
    const untracked = CONTROLS.filter((c) => c.state !== 'enforced' && !moved.has(c.id)).map((c) => c.id);
    expect(untracked).toEqual([]);
  });

  it('moves only controls that exist, and every item moves one', () => {
    for (const i of ITEMS) {
      expect(i.moves.length, i.id).toBeGreaterThan(0);
      for (const c of i.moves) expect(control(c), `${i.id} ${c}`).toBeDefined();
    }
  });

  it('cites only files that exist', () => {
    const missing = ITEMS.flatMap((i) => i.sources.filter((s) => !exists(s)).map((s) => `${i.id}: ${s}`));
    expect(missing).toEqual([]);
  });

  it('is owned by seats, and says what is filed', () => {
    for (const i of ITEMS) {
      expect(SEATS, i.id).toContain(i.owner);
      expect(i.files.length, i.id).toBeGreaterThan(5);
      expect(i.finding.length, i.id).toBeGreaterThan(40);
      expect(i.fix.length, i.id).toBeGreaterThan(30);
    }
  });

  it('depends only on items that exist, on none due later, and has no cycle', () => {
    for (const i of ITEMS) {
      for (const n of i.needs ?? []) {
        const d = item(n);
        expect(d, `${i.id} needs ${n}`).toBeDefined();
        expect(POINTS.indexOf(d!.before), `${i.id} needs ${n}, due later`).toBeLessThanOrEqual(POINTS.indexOf(i.before));
        expect(n, `${i.id} needs itself`).not.toBe(i.id);
      }
    }
    expect(() => ordered()).not.toThrow();
    expect(ordered()).toHaveLength(ITEMS.length);
  });

  it('puts every item after the ones it needs, in the order', () => {
    const position = new Map(ordered().map((i, n) => [i.id, n]));
    for (const i of ITEMS) for (const n of i.needs ?? []) expect(position.get(n)!, `${n} before ${i.id}`).toBeLessThan(position.get(i.id)!);
  });

  it('keeps the nearest point short enough to do', () => {
    const p0 = ITEMS.filter((i) => priority(i) === 'P0');
    expect(p0.length).toBeLessThanOrEqual(12);
    expect(p0.length).toBeGreaterThan(0);
  });

  it('calls a finished item finished only when a guard that fails without it exists', () => {
    const done = ITEMS.filter((i) => i.done);
    expect(done.length).toBeGreaterThan(0);
    for (const i of done) {
      expect(exists(i.done!.proof), `${i.id} ${i.done!.proof}`).toBe(true);
      expect(PROOF_SHAPE.test(i.done!.proof), `${i.id} proof is not a test, check or workflow`).toBe(true);
      expect(isIsoDate(i.done!.on), i.id).toBe(true);
    }
  });

  it('names the work only a person can do, so code is not mistaken for closing it', () => {
    const people = ITEMS.filter((i) => i.person);
    expect(people.length).toBeGreaterThan(5);
    // Anything that names counsel, a vendor, an assessor or staffing a seat is a person item.
    for (const i of ITEMS.filter((x) => /\b(counsel|assessor|auditor|firm|vCISO|accept each seat|Decide)\b/i.test(`${x.title} ${x.fix}`))) {
      expect(i.person, `${i.id} names someone to engage but is not marked as needing a person`).toBe(true);
    }
  });

  it('renders the sequence from the data', () => {
    const rendered = renderDoc();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(readFileSync(at(DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

function renderDoc(): string {
  const lines: string[] = [];
  const open = ITEMS.filter((i) => !i.done);
  lines.push('# Remediation sequence', '');
  lines.push(renderedFrom('app/src/lib/ops/trustremediation.ts', 'trustremediation.test.ts'), '');
  lines.push(controlLine(DOC), '');
  lines.push(
    `${ITEMS.length} items, ${ITEMS.length - open.length} finished and ${open.length} open, closing the gaps recorded in the [control register](CONTROL-FRAMEWORK.md). ` +
      'A test requires every control that is not enforced to be moved by at least one item, so a gap cannot be recorded without a plan for it.',
    '',
    '**Priority is the point at which the item has to be done**, not how hard it is. The four points are the release profiles in `release-profiles.ts`: ' +
      POINTS.map((p) => `${priority({ before: p } as never)} — ${POINT_TITLE[p].toLowerCase()}`).join('; ') + '. ' +
      '**Effort** is S (a day or two), M (a week or two), L (longer, or dependent on others).',
    '',
    '**Items marked *person*** cannot be closed by writing software: they need counsel, an assessor, a vendor, an institution contact, or someone to accept a seat. The sequence says so, so it does not read as a coding backlog. ' +
      'Where an item turns on a legal conclusion it says *requires qualified human counsel review*.',
    '',
    'An item is finished only when a test, check or workflow that fails without it is in the tree. A finished item still has to file its record before the control it moves is described as operated.',
    '',
    '## Summary',
    '',
    ...table(
      ['Priority', 'Before', 'Items', 'Open', 'Needs a person'],
      POINTS.map((p) => {
        const set = ITEMS.filter((i) => i.before === p);
        return [priority({ before: p } as never), POINT_TITLE[p], String(set.length), String(set.filter((i) => !i.done).length), String(set.filter((i) => i.person).length)];
      }),
      ['left', 'left', 'right', 'right', 'right'],
    ),
    '',
  );

  for (const p of POINTS) {
    lines.push(`## ${priority({ before: p } as never)} — ${POINT_TITLE[p]}`, '');
    lines.push(
      ...table(
        ['ID', 'Item', 'Finding', 'Fix', 'Moves', 'Owner', 'Effort', 'Needs', 'When done, file'],
        ITEMS.filter((i) => i.before === p).map((i) => [
          i.id,
          cell(`${i.done ? '✔ ' : ''}${i.title}${i.person ? ' *(person)*' : ''}`),
          cell(`${i.finding} Shown by ${i.sources.map((s) => `[${s.split('/').pop()}](${link(DOC, s)})`).join(', ')}.`),
          cell(i.done ? `${i.fix} **Done ${i.done.on}:** [${i.done.proof.split('/').pop()}](${link(DOC, i.done.proof)}) fails without it.` : i.fix),
          i.moves.join(', '),
          i.owner,
          i.effort,
          (i.needs ?? []).join(', ') || '—',
          cell(i.files),
        ]),
      ),
      '',
    );
  }

  lines.push('## Order of work', '', 'Every item after the ones it needs, nearest point first:', '', ordered().map((i) => i.id).join(' → '), '');
  return lines.join('\n') + '\n';
}
