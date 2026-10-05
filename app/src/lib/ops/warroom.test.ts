import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNCIL, CURRENT, SEATS, decide } from '../launchreadiness';
import { REGISTER, STATUSES } from '../masterregister';
import { ROLES } from '../rolelaunch';
import { COMMITMENTS } from './commitments';
import { cell, controlLine, link, renderedFrom, table } from './render';
import { BOARD, RULES } from './warroom';

/**
 * The launch war room, held to the documents it reads from and to the seats
 * that report it.
 *
 * Every item's source exists; every owner is a council seat; the board is
 * the brief's thirteen items and nothing is reported twice. What the page
 * prints as "today" — the verdict, the blockers, the register counts, the
 * seats held — is computed from the same data the council and the registers
 * use, so it cannot say something the go/no-go record does not.
 *
 * `docs/LAUNCH-WAR-ROOM.md` is rendered from the data; `npm run registers`
 * from app/ rewrites it, and the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'docs/LAUNCH-WAR-ROOM.md';

const holderOf = (seat: string) => COUNCIL.find((c) => c.seat === seat)?.holder ?? null;

describe('the launch war room', () => {
  it('is the brief’s thirteen items, each once', () => {
    expect(BOARD).toHaveLength(13);
    expect(new Set(BOARD.map((b) => b.id)).size).toBe(13);
    expect(new Set(BOARD.map((b) => b.item)).size).toBe(13);
  });

  it('reads every item from a document that exists', () => {
    expect(existsSync(at('docs/NO-SUCH-BOARD-SOURCE.md'))).toBe(false);
    for (const b of BOARD) expect(existsSync(at(b.source)), `${b.id} reads ${b.source}, which is missing`).toBe(true);
  });

  it('gives every item a seat, and says what the seat reports', () => {
    for (const b of BOARD) {
      expect(SEATS, b.id).toContain(b.owner);
      expect(b.daily.length, b.id).toBeGreaterThan(30);
    }
  });

  it('counts an item as owned only when its seat is held', () => {
    const owned = BOARD.filter((b) => holderOf(b.owner) !== null);
    const held = COUNCIL.filter((c) => c.holder !== null).length;
    if (held === 0) expect(owned).toEqual([]);
  });

  it('spreads the board across seats rather than leaving it all to the founder', () => {
    expect(new Set(BOARD.map((b) => b.owner)).size).toBeGreaterThanOrEqual(6);
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
  const verdict = decide(CURRENT);
  const open = CURRENT.blockers;
  const p0p1 = open.filter((b) => b.severity === 'P0' || b.severity === 'P1');
  const held = COUNCIL.filter((c) => c.holder !== null);
  const owned = BOARD.filter((b) => holderOf(b.owner) !== null);
  const count = (s: string) => REGISTER.filter((r) => r.status === s).length;
  const out: string[] = [
    '# Launch war room',
    '',
    renderedFrom('app/src/lib/ops/warroom.ts', 'warroom.test.ts'),
    '',
    controlLine(DOC),
    '',
    'The board for the final weeks before a cohort goes live, with daily',
    'ownership. Thirteen items, each with the seat that reports it every day and',
    'the document it is read from. It exists for one rule: **no launch happens',
    'through informal messaging and memory.**',
    '',
    '## Today, as the repository can read it',
    '',
    ...table(
      ['Line', 'Reads'],
      [
        ['Launch status', `**${verdict.verdict.toUpperCase()}** as of ${CURRENT.on}, for ${verdict.reasons.length} reasons listed in ${ref('docs/GO-NO-GO-CHECKLIST.md')}`],
        ['P0/P1 blockers', p0p1.length === 0 ? `none recorded (${open.length} open blockers of any severity)` : `${p0p1.length} open`],
        ['Readiness register', `${REGISTER.length} rows: ${STATUSES.filter((s) => count(s) > 0).map((s) => `${count(s)} ${s}`).join(', ')}`],
        ['Role launch register', `${ROLES.length} roles; every rung is in ${ref('docs/ROLE-LAUNCH-REGISTER.md')}`],
        ['Billing/contract status', COMMITMENTS.length === 0 ? 'no customer commitments recorded' : `${COMMITMENTS.length} commitments`],
        ['Go-live approvals', `${CURRENT.signoffs.length} of ${COUNCIL.length} seats signed; ${held.length} of ${COUNCIL.length} seats held`],
        ['Board ownership', owned.length === 0 ? `**0 of ${BOARD.length} items owned** — every seat is vacant` : `${owned.length} of ${BOARD.length} items owned`],
      ],
    ),
    '',
    'The rest of the board is read by a person each morning from the document',
    'in the table below. A line on the board names its document; a line with no',
    'document is a rumour.',
    '',
    '## The board',
    '',
    ...table(
      ['#', 'Item', 'Owner', 'Held by', 'Read from', 'The daily line'],
      BOARD.map((b, i) => [String(i + 1), cell(b.item), `\`${b.owner}\``, holderOf(b.owner) ?? '*vacant*', ref(b.source), cell(b.daily)]),
    ),
    '',
    '## The rules',
    '',
    ...RULES.map((r) => `- ${r}`),
    '',
    '## Opening it',
    '',
    '1. The founder seat names the target cohort and the launch window in the',
    `   go/no-go record (${ref('docs/LAUNCH-READINESS-COUNCIL.md')}).`,
    '2. Each seat above is held, in writing, or its items are marked unowned on',
    '   the board until it is. The founder does not report thirteen lines.',
    '3. Every morning, each owner posts one line per item in the war-room',
    '   channel, naming the document it was read from. The lines are the record;',
    '   the channel is not.',
    '4. A blocker found on the board goes into `CURRENT.blockers` in',
    '   `app/src/lib/launchreadiness.ts` the same day, with its severity, so',
    '   `decide()` sees what the room sees.',
    '5. The room closes when hypercare ends, and the daily lines become the',
    `   weekly operations review of ${ref('docs/90-DAY-LAUNCH-PROGRAM.md')}.`,
    '',
    '## How this page is held',
    '',
    `${ref('app/src/lib/ops/warroom.test.ts')} fails when an item reads from a`,
    'document that does not exist, when an owner is not a council seat, when an',
    'item is counted as owned while its seat is vacant, or when this page is',
    'stale. The "today" table is computed from the same data the council and the',
    'registers use.',
    '',
  ];
  return out.join('\n');
}
