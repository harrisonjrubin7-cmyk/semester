import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEATS } from '../launchreadiness';
import { TASKS } from '../launch/ninety-day';
import { NEEDS_EVIDENCE_DIR, REGISTER } from '../masterregister';
import { CALENDAR, WINDOWS, WINDOW_TITLE, filed, type EvidenceDir, type ProofItem } from './proofcalendar';
import { cell, controlLine, link, renderedFrom, table } from './render';

/**
 * The proof calendar, held to the registers it promises to move.
 *
 * Every item names register rows, a 90-day task or a quarterly review, and
 * an artifact under docs/evidence/. Each reference is checked against the
 * thing it names, and `filed()` — which decides whether an artifact exists —
 * is shown a directory in which it must say yes before it is trusted to say
 * no about the real one, where today it says no about every item.
 *
 * `docs/PROOF-CALENDAR.md` is rendered from the data; `npm run registers`
 * from app/ rewrites it, and the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'docs/PROOF-CALENDAR.md';

const real: EvidenceDir = {
  exists: (p) => existsSync(at(p)),
  list: () => (existsSync(at('docs/evidence')) ? readdirSync(at('docs/evidence')) : []),
};

const registerIds = new Set(REGISTER.map((r) => r.id));
const taskIds = new Set(TASKS.map((t) => t.id));

/** The rows of the quarterly table in OPERATING-RHYTHM.md, by their first cell. */
function quarterlyRows(): string[] {
  const text = read('docs/operating-model/OPERATING-RHYTHM.md');
  const section = text.split('\n## Quarterly\n')[1]?.split('\n## ')[0] ?? '';
  return section
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('| Item') && !l.startsWith('| ---'))
    .map((l) => l.split('|')[1].trim());
}

describe('the proof calendar', () => {
  describe('its shape', () => {
    it('has the brief’s twelve dated proofs and seven quarterly ones, each once', () => {
      expect(CALENDAR.filter((i) => i.window !== 'quarterly')).toHaveLength(12);
      expect(CALENDAR.filter((i) => i.window === 'quarterly')).toHaveLength(7);
      expect(new Set(CALENDAR.map((i) => i.id)).size).toBe(CALENDAR.length);
      expect(new Set(CALENDAR.map((i) => i.artifact)).size).toBe(CALENDAR.length);
    });

    it('is in window order, and every window has something in it', () => {
      const order = CALENDAR.map((i) => WINDOWS.indexOf(i.window));
      expect(order.every((w, i) => w >= 0 && (i === 0 || w >= order[i - 1]))).toBe(true);
      for (const w of WINDOWS) expect(CALENDAR.some((i) => i.window === w), w).toBe(true);
    });

    it('gives every item an owner that is a council seat, and says what the artifact contains', () => {
      for (const i of CALENDAR) {
        expect(SEATS, i.id).toContain(i.owner);
        expect(i.contains.length, i.id).toBeGreaterThan(40);
      }
    });

    it('files every artifact under docs/evidence/, and only quarterly ones per cycle', () => {
      for (const i of CALENDAR) {
        expect(i.artifact.startsWith('docs/evidence/'), i.id).toBe(true);
        expect(i.artifact.includes('{quarter}'), `${i.id} is ${i.window}`).toBe(i.window === 'quarterly');
      }
    });
  });

  describe('what it promises to move', () => {
    it('names only register rows that exist, and at least one per item', () => {
      for (const i of CALENDAR) {
        expect(i.moves.length, i.id).toBeGreaterThan(0);
        for (const id of i.moves) expect(registerIds.has(id), `${i.id} would move ${id}, which is not a register row`).toBe(true);
      }
    });

    it('names only 90-day tasks that exist', () => {
      for (const i of CALENDAR) if (i.ninetyDay) expect(taskIds.has(i.ninetyDay), `${i.id} closes ${i.ninetyDay}`).toBe(true);
    });

    it('puts every quarterly item on a row of the operating rhythm’s quarterly table', () => {
      const rows = quarterlyRows();
      expect(rows.length).toBeGreaterThan(5); // the control: the table was found
      for (const i of CALENDAR) {
        if (i.window === 'quarterly') expect(rows, `${i.id}: "${i.rhythm}" is not a quarterly row of OPERATING-RHYTHM.md`).toContain(i.rhythm);
        else expect(i.rhythm, `${i.id} is ${i.window} and names a rhythm row`).toBeUndefined();
      }
    });
  });

  describe('filed()', () => {
    const item = CALENDAR.find((i) => i.id === 'restore-drill')!;
    const quarterly = CALENDAR.find((i) => i.id === 'access-review')!;

    it('finds an exact artifact, and a quarterly one by its cycle', () => {
      const dir: EvidenceDir = { exists: (p) => p === item.artifact, list: () => ['access-review-2027Q1.md', 'unrelated.md'] };
      expect(filed(item, dir)).toBe(true);
      expect(filed(quarterly, dir)).toBe(true);
    });

    it('is not fooled by a near miss', () => {
      const dir: EvidenceDir = { exists: () => false, list: () => ['access-review-2027.md', 'access-review-2027Q5.md', 'access-review-2027Q1.md.draft'] };
      expect(filed(item, dir)).toBe(false);
      expect(filed(quarterly, dir)).toBe(false);
    });

    it('says nothing on the calendar is filed today, though the directory now holds the AI drills', () => {
      // docs/evidence/ai/ holds the kill-switch drill and the injection
      // red-team (29 September). Neither is an artifact this calendar names,
      // so every item is still due; the day one lands, this line fails.
      expect(existsSync(at('docs/evidence/ai'))).toBe(true);
      for (const i of CALENDAR) expect(filed(i, real), i.id).toBe(false);
      // And the one register row past `tested` rests on those drills, not on the calendar.
      expect(REGISTER.filter((r) => NEEDS_EVIDENCE_DIR.includes(r.status)).map((r) => r.id)).toEqual(['AI-012']);
    });
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ──────────────────────────────────────────────────────────────

function render(): string {
  const ref = (p: string) => `[\`${p}\`](${link(DOC, p)})`;
  const done = CALENDAR.filter((i) => filed(i, real)).length;
  const rowOf = (i: ProofItem) => [
    cell(i.proof),
    `\`${i.owner}\``,
    `\`${i.artifact}\``,
    cell(i.contains),
    i.moves.map((m) => `\`${m}\``).join(', '),
    i.ninetyDay ? `\`${i.ninetyDay}\`` : i.rhythm ? cell(i.rhythm) : '—',
    filed(i, real) ? 'filed' : 'due',
  ];
  const out: string[] = [
    '# Proof calendar',
    '',
    renderedFrom('app/src/lib/ops/proofcalendar.ts', 'proofcalendar.test.ts'),
    '',
    controlLine(DOC),
    '',
    'The schedule for producing the evidence needed to sell. The',
    `[master readiness register](MASTER-LAUNCH-READINESS-REGISTER.md) lets no row`,
    'above `tested` until it cites an artifact under `docs/evidence/`, and one',
    'does: the AI kill switch, on the drill of 29 September. This is the order in',
    'which the rest get made: three months of',
    'them, then a quarterly cycle, so that enterprise readiness is a recurring',
    'discipline and not a push before each procurement.',
    '',
    'Each item names the seat that produces it, the artifact it files, what the',
    'artifact contains, the register rows it would move, and where it already',
    'lives in the [90-day program](90-DAY-LAUNCH-PROGRAM.md) or the',
    '[operating rhythm](operating-model/OPERATING-RHYTHM.md). The clock starts',
    'with day 1 of the 90-day program; no date is invented here.',
    '',
    '## Where it stands',
    '',
    `**${done} of ${CALENDAR.length} artifacts filed.**${done === 0 ? ' `docs/evidence/` holds only the AI drills of 29 September, which this calendar does not schedule. The test reads the directory, so this line changes when the first artifact here lands.' : ''}`,
    '',
  ];
  for (const w of WINDOWS) {
    out.push(`## ${WINDOW_TITLE[w]}`, '');
    out.push(
      ...table(
        ['Proof', 'Owner', 'Artifact', 'Contains', 'Moves', w === 'quarterly' ? 'Rhythm row' : '90-day task', 'Status'],
        CALENDAR.filter((i) => i.window === w).map(rowOf),
      ),
      '',
    );
  }
  out.push(
    '## How an artifact counts',
    '',
    '1. The owner produces it and files it at the path above (a quarterly one',
    '   with its cycle, `access-review-2027Q1.md`).',
    '2. The register rows it moves are re-read, and the ones it now supports go',
    '   to `evidenced` in `app/src/lib/masterregister.ts`, citing the artifact.',
    '   The register’s test refuses `evidenced` without a `docs/evidence/` path.',
    '3. `npm run registers` rewrites this page and the register.',
    '',
    'An artifact that is not filed is not evidence, however thoroughly the work',
    'was done. That is the whole point of the directory.',
    '',
    '## How this page is held',
    '',
    `${ref('app/src/lib/ops/proofcalendar.test.ts')} fails when an item names a`,
    'register row, a 90-day task or a rhythm row that does not exist, when a',
    'quarterly item lacks a cycle in its artifact name, when `filed()` cannot tell',
    'a filed artifact from a near miss, or when this page is stale.',
    '',
  );
  return out.join('\n');
}
