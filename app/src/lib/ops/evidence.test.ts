import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEATS } from '../launchreadiness';
import { NEEDS_EVIDENCE_DIR, REGISTER } from '../masterregister';
import { CLAIMS, STATUS_LABEL, claim, problems, type Facts } from './claims';
import { ESCALATION } from './console';
import { EVIDENCE, EVIDENCE_WORD_MEANING, addDays, daysBetween, evidence, evidenceState, expiredUnder, staleRows, type EvidenceRecord } from './evidence';
import { CALENDAR } from './proofcalendar';
import { CAPABILITY_DEFINITIONS } from '../governance/capability-governance';
import { cell, controlLine, isIsoDate, link, renderedFrom, table } from './render';

/**
 * The evidence register, held to the files it cites and to the calendar.
 *
 * A record is a date and a validity, so the checks are about those: the file
 * a record names exists and states the date the record carries (as an ISO
 * date, or as "28 September 2026"), the owner is a seat, every claim and row
 * it names is registered, and `evidenceState()` is shown a day on each side
 * of each escalation step before it is trusted. Every date is passed in; the
 * one test that reads the clock asks the only question the clock can answer —
 * whether, today, an expired record sits under an "available" claim — and
 * accepts either "no" or "yes, and `problems()` says so".
 *
 * `docs/EVIDENCE-REGISTER.md` is rendered from the data without the clock, so
 * it is stale only when the data changes; `npm run registers` from app/
 * rewrites it, and the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const DOC = 'docs/EVIDENCE-REGISTER.md';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Whether `text` states the ISO date `iso`, either as written or as "28 September 2026". */
function statesDate(text: string, iso: string): boolean {
  if (text.includes(iso)) return true;
  const [y, m, d] = iso.split('-').map(Number);
  return text.includes(`${d} ${MONTHS[m - 1]} ${y}`);
}

const claimIds = new Set(CLAIMS.map((c) => c.id));
const rowIds = new Set(REGISTER.map((r) => r.id));

/** Facts enough for `problems()` without rendering the site: the pages are unknown, so only the register rules run. */
const facts = (today: string, records: readonly EvidenceRecord[] = EVIDENCE): Facts => ({
  capabilityExists: (id) => CAPABILITY_DEFINITIONS.some((capability) => capability.id === id),
  rowStatus: (id) => REGISTER.find((r) => r.id === id)?.status,
  exists: (p) => existsSync(at(p)),
  proofExists: (id) => CALENDAR.some((c) => c.id === id),
  routes: [...new Set(CLAIMS.flatMap((c) => c.pages))],
  page: () => undefined,
  expiredEvidence: expiredUnder(records, today),
});

describe('dates', () => {
  it('adds days across a month and a year, and counts them back', () => {
    expect(addDays('2026-09-21', 91)).toBe('2026-12-21');
    expect(addDays('2026-12-28', 30)).toBe('2027-01-27');
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(daysBetween('2026-09-28', '2026-12-21')).toBe(84);
    expect(daysBetween('2026-12-21', '2026-09-28')).toBe(-84);
    expect(daysBetween('2026-09-28', '2026-09-28')).toBe(0);
  });

  it('can tell a file that states a date from one that does not', () => {
    expect(statesDate('rehearsal, passed 2026-09-21;', '2026-09-21')).toBe(true);
    expect(statesDate('Written 28 September 2026 from', '2026-09-28')).toBe(true);
    expect(statesDate('Written 28 September 2026 from', '2026-09-27')).toBe(false);
    expect(statesDate('passed 2026-09-21', '2026-09-22')).toBe(false);
    expect(statesDate('no date here', '2026-09-28')).toBe(false);
  });
});

describe('evidenceState', () => {
  const record = { produced: '2026-01-01', validFor: 100 }; // expires 2026-04-11

  it('expires validFor days after production', () => {
    expect(evidenceState(record, '2026-01-01').expires).toBe('2026-04-11');
  });

  it('is current, then expiring at each step, then expired, on each side of each boundary', () => {
    const on = (today: string) => {
      const s = evidenceState(record, today);
      return [s.daysLeft, s.state, s.step?.daysLeft ?? null];
    };
    expect(on('2026-03-01')).toEqual([41, 'current', null]);
    expect(on('2026-03-11')).toEqual([31, 'current', null]);
    expect(on('2026-03-12')).toEqual([30, 'expiring', 30]);
    expect(on('2026-04-03')).toEqual([8, 'expiring', 30]);
    expect(on('2026-04-04')).toEqual([7, 'expiring', 7]);
    expect(on('2026-04-10')).toEqual([1, 'expiring', 7]);
    expect(on('2026-04-11')).toEqual([0, 'expired', 0]);
    expect(on('2026-04-20')).toEqual([-9, 'expired', 0]);
  });

  it('uses the ladder from console.ts, whose steps it names', () => {
    expect(ESCALATION.map((e) => e.daysLeft)).toEqual([30, 7, 0]);
    expect(evidenceState(record, '2026-04-11').step).toBe(ESCALATION[2]);
  });

  it('names the expired records under a claim, and nothing under another', () => {
    const stale: EvidenceRecord = { id: 'stale', artifact: 'a', path: 'README.md', produced: '2025-01-01', validFor: 30, owner: 'security', claims: ['rls'], rows: [] };
    const fresh: EvidenceRecord = { ...stale, id: 'fresh', produced: '2026-09-01', validFor: 365 };
    const under = expiredUnder([stale, fresh], '2026-09-28');
    expect(under('rls')).toEqual(['stale']);
    expect(under('secrets')).toEqual([]);
    expect(expiredUnder([stale, fresh], '2025-01-15')('rls')).toEqual([]);
  });
});

/** The one clock read in this file. */
const TODAY = new Date().toISOString().slice(0, 10);

describe('the register', () => {
  it('names each record once, as a slug, with a positive validity and an ISO date', () => {
    expect(new Set(EVIDENCE.map((r) => r.id)).size).toBe(EVIDENCE.length);
    for (const r of EVIDENCE) {
      expect(/^[a-z0-9-]+$/.test(r.id), r.id).toBe(true);
      expect(isIsoDate(r.produced), `${r.id} produced ${r.produced}`).toBe(true);
      expect(Number.isInteger(r.validFor) && r.validFor > 0, `${r.id} validFor ${r.validFor}`).toBe(true);
      expect(SEATS, r.id).toContain(r.owner);
      expect(r.artifact.length, r.id).toBeGreaterThan(20);
    }
    expect(evidence('restore-rehearsal').produced).toBe('2026-09-21');
    expect(() => evidence('nothing')).toThrow(/No evidence record/);
  });

  it('cites a file that exists and states the date it carries', () => {
    for (const r of EVIDENCE) {
      expect(existsSync(at(r.path)), `${r.id} cites ${r.path}`).toBe(true);
      expect(statesDate(read(r.path), r.produced), `${r.path} does not state ${r.produced}, which ${r.id} carries`).toBe(true);
    }
  });

  it('registers every file under docs/evidence/, and cites nothing there that is not', () => {
    // The directory's first files were the two AI drills of 29 September. A
    // file filed there without a record here would be evidence nobody dates.
    const filedHere = (dir: string): string[] =>
      readdirSync(at(dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filedHere(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
    const cited = new Set(EVIDENCE.map((r) => r.path).filter((p) => p.startsWith('docs/evidence/')));
    const filed = existsSync(at('docs/evidence')) ? filedHere('docs/evidence') : [];
    expect(filed.sort()).toEqual([...cited].sort());
    expect(filed.length).toBeGreaterThan(0);
  });

  it('rests every record under registered claims and rows, and under at least one of them', () => {
    for (const r of EVIDENCE) {
      expect(r.claims.length + r.rows.length, `${r.id} supports nothing`).toBeGreaterThan(0);
      for (const c of r.claims) expect(claimIds.has(c), `${r.id} names claim ${c}`).toBe(true);
      for (const row of r.rows) expect(rowIds.has(row), `${r.id} names row ${row}`).toBe(true);
    }
  });

  it('says the restore is rehearsed, not drilled, because the claim is not available', () => {
    expect(evidence('restore-rehearsal').claims).toEqual(['restore-drill']);
    expect(claim('restore-drill').status).toBe('in-preparation');
  });

  it('takes an available word away from a claim whose record has expired', () => {
    // Exercise the expiry rule independently of the real claim's conservative status.
    const available = { ...claim('rls'), status: 'available' as const };
    const stale: EvidenceRecord = { ...evidence('restore-rehearsal'), id: 'stale-drill', claims: ['rls'] };
    const today = addDays(stale.produced, stale.validFor); // the day it expires
    expect(problems([available], facts(today, [stale]))).toContain('rls is available and rests on stale-drill, which has expired.');
    expect(problems([available], facts(addDays(today, -1), [stale]))).toEqual([]);
  });

  it('has, today, no expired record under an available claim — or problems() names it', () => {
    const today = TODAY;
    const expired = CLAIMS.filter((c) => c.status === 'available').flatMap((c) => expiredUnder(EVIDENCE, today)(c.id).map((id) => `${c.id} is available and rests on ${id}, which has expired.`));
    const found = problems(CLAIMS, facts(today)).filter((p) => p.includes('which has expired'));
    expect(found).toEqual(expired);
  });

  it('lets a register row stay past `tested` only while an artifact it cites is current', () => {
    const drill = evidence('ai-killswitch-drill');
    const row = { id: 'AI-012', evidence: [{ path: drill.path }, { path: 'app/src/lib/aikillswitch.test.ts' }] };
    const expires = addDays(drill.produced, drill.validFor);
    expect(staleRows([row], [drill], addDays(expires, -1))).toEqual([]);
    expect(staleRows([row], [drill], expires)).toEqual(['AI-012']);
    // A filed path with no record here is no evidence of freshness at all.
    expect(staleRows([{ id: 'AI-012', evidence: [{ path: 'docs/evidence/ai/unregistered.json' }] }], [drill], addDays(expires, -1))).toEqual(['AI-012']);
    // Today: every row past `tested` is still current, or this names it.
    expect(staleRows(REGISTER.filter((r) => NEEDS_EVIDENCE_DIR.includes(r.status)), EVIDENCE, TODAY)).toEqual([]);
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
  const status = (id: string) => REGISTER.find((r) => r.id === id)?.status ?? '?';
  const word = (id: string) => STATUS_LABEL[claim(id).status];
  const out: string[] = [
    '# Evidence register',
    '',
    renderedFrom('app/src/lib/ops/evidence.ts', 'evidence.test.ts'),
    '',
    controlLine(DOC),
    '',
    'Every dated artifact the repository holds today: the date its file states,',
    'how long it is good for, and the public claims and register rows resting on',
    'it. A record carries a date and a validity rather than the word “current”,',
    'because a word beside a document is a claim nothing re-checks; the state is',
    'computed for the day it is asked on, by the console’s Evidence view and by',
    `${ref('app/src/lib/ops/claims.test.ts')}, which refuses an “available” claim`,
    'resting on a record that has expired.',
    '',
    '`docs/evidence/` holds dated AI, advisor, restore, and milestone-verification',
    'artifacts, and every file there is a record below. The',
    '[master register](MASTER-LAUNCH-READINESS-REGISTER.md) lets a',
    'row past `tested` only by citing one, and the [proof calendar](PROOF-CALENDAR.md)',
    'still schedules the artifacts that would move the rest. This page is what',
    'does exist, with when it runs out.',
    '',
    '## The records',
    '',
    ...table(
      ['Artifact', 'Produced', 'Valid for', 'Expires', 'Owner', 'Claims resting on it', 'Rows', 'Stated in'],
      EVIDENCE.map((r) => [
        `**${cell(r.artifact)}**${r.note ? `<br>${cell(r.note)}` : ''}`,
        r.produced,
        `${r.validFor} days`,
        addDays(r.produced, r.validFor),
        `\`${r.owner}\``,
        r.claims.length ? r.claims.map((c) => `\`${c}\` (${word(c)})`).join(', ') : '—',
        r.rows.length ? r.rows.map((row) => `\`${row}\` (${status(row)})`).join(', ') : '—',
        ref(r.path),
      ]),
    ),
    '',
    '## What the state means',
    '',
    ...table(['State', 'Meaning'], (Object.keys(EVIDENCE_WORD_MEANING) as (keyof typeof EVIDENCE_WORD_MEANING)[]).map((w) => [`**${w}**`, EVIDENCE_WORD_MEANING[w]])),
    '',
    'The steps are the escalation ladder in',
    `${ref('ops/operations-console/README.md')}: at thirty days the owning seat is`,
    'notified; at seven the security and privacy seats are, and the item is on the',
    'weekly operations review; at expiry the artifact is superseded, leaves the',
    'procurement pack, and every claim resting on it is flagged. The state is not',
    'printed here on purpose: a page that said “current” would be the word this',
    'register replaces.',
    '',
    '## How a record counts',
    '',
    '1. The artifact exists in the tree and states its own date. A record names',
    '   the file that states it, and the test reads the file.',
    '2. Its validity is the cadence that renews it: monthly for the registers,',
    '   quarterly for the reviews the operating rhythm schedules, six months for',
    '   the whitepaper by its own control table, yearly for a HECVAT.',
    '3. The claims it names are ids of the claims register; the rows are ids of',
    '   the master register. A record that supports nothing is refused.',
    '4. When an artifact under `docs/evidence/` is filed, it joins this page with',
    '   its date, and the master register rows it moves cite it.',
    '',
    '## How this page is held',
    '',
    `${ref('app/src/lib/ops/evidence.test.ts')} fails when a record cites a file`,
    'that does not exist or does not state the record’s date, when its owner is',
    'not a seat, when a claim or row it names is not registered, when the state',
    'is wrong on either side of a step, when — on the day the test runs — an',
    'expired record sits under an “available” claim that `problems()` does not',
    'name, or when this page is stale.',
    '',
  ];
  return out.join('\n');
}
