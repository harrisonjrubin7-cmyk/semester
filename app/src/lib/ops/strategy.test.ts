import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEATS } from '../launchreadiness';
import { written } from './decisionlog';
import { MEASURES } from './firstyear';
import { SOURCES } from './operatingsystem';
import { OPERATING_SYSTEM, isIsoDate as looksLikeIsoDate } from './render';

/**
 * The company strategy, held to the tree.
 *
 * `docs/strategy/` is prose, and prose about targets, risks and decisions is
 * worth exactly as much as the checking behind it. The package names measures,
 * council seats, decisions, gates and two other risk registers that already
 * exist, and it makes counts ("36 risks", "17 decisions") that a later edit
 * can quietly falsify. So:
 *
 *   - every file exists, shows the control line, and every relative link resolves;
 *   - every identifier cited is defined where the package says it is defined;
 *   - the scorecard maps to the first-year measures by exact name, in both
 *     directions, and every metric it adds says so;
 *   - risk scores are likelihood times impact, owners are seats, and the
 *     top-ten tables agree with the register they summarise;
 *   - every deadline is a real date that has not already passed;
 *   - nothing in the decision log is anything but PROPOSED (an agent cannot
 *     approve the founder's decision), and each entry offers a real choice;
 *   - the counts the prose states are the counts the tables hold;
 *   - the operating-system register points at this package rather than at nothing.
 *
 * It sets no target and records no decision. Both stay the founder's.
 */

const root = join(import.meta.dirname, '../../../..');
const DIR = 'docs/strategy';
const FILES = [
  'README.md',
  'THREE-YEAR-STRATEGY.md',
  'BOARD-MEMO.md',
  'SCORECARD.md',
  'MARKET-ENTRY-PLAN.md',
  'FOUNDER-DECISION-LOG.md',
  'MOAT-PLAN.md',
  'RISK-REGISTER.md',
  'ADVISORS.md',
] as const;

/** The date and commit every file of the package states its evidence against. */
const EVIDENCE_DATE = '2026-10-04';
const EVIDENCE_COMMIT = '7287ddc';
const HORIZON_END = '2029-09-30';

const read = (p: string): string => readFileSync(join(root, p), 'utf8');
const doc = (f: (typeof FILES)[number]): string => read(`${DIR}/${f}`);
const ALL = FILES.map((f) => ({ file: f, text: doc(f) }));
const everything = ALL.map((d) => d.text).join('\n');

/** The cells of every table row in `text` whose first cell passes `first`. */
function rows(text: string, first: RegExp): string[][] {
  return text
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((cells) => cells.length > 0 && first.test(cells[0] ?? ''));
}

const strip = (s: string): string => s.replace(/\*/g, '').trim();

/**
 * A real calendar date. `isIsoDate` in render.ts accepts `2027-02-30`, because
 * `Date.parse` rolls an impossible day over instead of refusing it, so a
 * guard built on it alone cannot tell a typo from a date. Round-tripping can.
 */
const isIsoDate = (s: string): boolean => looksLikeIsoDate(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const seatsIn = (cell: string): string[] => [...cell.matchAll(/`([a-z]+)`/g)].map((m) => m[1] ?? '');
const idsIn = (text: string, re: RegExp): string[] => [...new Set([...text.matchAll(re)].map((m) => m[0]))];

describe('the strategy package', () => {
  describe('is whole', () => {
    it('has every file, each displaying the control line', () => {
      for (const { file, text } of ALL) {
        expect(existsSync(join(root, DIR, file)), `${file} is missing`).toBe(true);
        expect(text.includes(OPERATING_SYSTEM), `${file} does not display the control line`).toBe(true);
      }
    });

    it('resolves every relative link', () => {
      for (const { file, text } of ALL) {
        for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
          const href = m[1] ?? '';
          if (/^(https?:|mailto:|#)/.test(href)) continue;
          const target = resolve(dirname(join(root, DIR, file)), href.split('#')[0] ?? '');
          expect(existsSync(target), `${file} links to ${href}, which does not exist`).toBe(true);
        }
      }
    });

    it('states one evidence date and one commit, in every file', () => {
      for (const { file, text } of ALL) {
        expect(text.includes(EVIDENCE_DATE), `${file} does not state ${EVIDENCE_DATE}`).toBe(true);
        expect(text.includes(EVIDENCE_COMMIT), `${file} does not state ${EVIDENCE_COMMIT}`).toBe(true);
      }
    });

    it('lists every file in the index of the README', () => {
      const readme = doc('README.md');
      for (const f of FILES) if (f !== 'README.md') expect(readme.includes(`(${f})`), `README does not link ${f}`).toBe(true);
    });
  });

  describe('cites only what is defined', () => {
    const readme = doc('README.md');
    const defined = (text: string, re: RegExp): Set<string> => new Set(rows(text, re).map((c) => strip(c[0] ?? '')));

    it('assumptions', () => {
      const have = defined(readme, /^A-\d{2}$/);
      expect(have.size).toBe(20);
      for (const id of idsIn(everything, /\bA-\d{2}\b/g)) expect(have.has(id), `${id} is cited but not in the README assumptions register`).toBe(true);
    });

    it('risks', () => {
      const have = defined(doc('RISK-REGISTER.md'), /^SR-\d{3}$/);
      for (const id of idsIn(everything, /\bSR-\d{3}\b/g)) expect(have.has(id), `${id} is cited but not in the risk register`).toBe(true);
    });

    it('decisions', () => {
      const have = defined(doc('FOUNDER-DECISION-LOG.md'), /^FD-2026-\d{3}$/);
      for (const m of everything.matchAll(/\bFD-(?:2026-)?(\d{3})\b/g)) {
        const id = `FD-2026-${m[1]}`;
        expect(have.has(id), `${m[0]} is cited but ${id} is not in the decision log`).toBe(true);
      }
    });

    it('gates, claim levels and replacement rungs', () => {
      const gates = defined(doc('BOARD-MEMO.md'), /^\*\*G\d\*\*$/);
      const levels = defined(doc('MARKET-ENTRY-PLAN.md'), /^\*\*C\d\*\*$/);
      const rungs = defined(doc('MARKET-ENTRY-PLAN.md'), /^\*\*R\d\*\*$/);
      expect([...gates]).toEqual(['G0', 'G1', 'G2', 'G3', 'G4']);
      expect([...levels]).toEqual(['C0', 'C1', 'C2', 'C3', 'C4']);
      expect([...rungs]).toEqual(['R0', 'R1', 'R2', 'R3', 'R4', 'R5']);
      for (const id of idsIn(everything, /\bG[0-9]\b/g)) expect(gates.has(id), `gate ${id} is cited but undefined`).toBe(true);
      for (const id of idsIn(everything, /\bC[0-9]\b/g)) expect(levels.has(id), `claim level ${id} is cited but undefined`).toBe(true);
      for (const id of idsIn(everything, /\bR[0-9]\b/g)) expect(rungs.has(id), `rung ${id} is cited but undefined`).toBe(true);
    });

    it('launch and company risks, claims and decisions that live elsewhere', () => {
      const fr = read('LAUNCH-RISK-REGISTER.md');
      const cr = read('docs/company/RISK-REGISTER.md');
      const clm = read('PUBLIC-CLAIMS-APPROVAL-REGISTER.md');
      for (const id of idsIn(everything, /\bFR-\d{3}\b/g)) expect(fr.includes(`| ${id} |`), `${id} is not in LAUNCH-RISK-REGISTER.md`).toBe(true);
      for (const id of idsIn(everything, /\bCR-\d{3}\b/g)) expect(cr.includes(`| ${id} |`), `${id} is not in docs/company/RISK-REGISTER.md`).toBe(true);
      for (const id of idsIn(everything, /\bCLM-\d{3}\b/g)) expect(clm.includes(`| ${id} |`), `${id} is not in the claims register`).toBe(true);
      for (const id of idsIn(everything, /\bD-\d{3,4}\b/g)) expect(written(root, id), `${id} is cited but not written down`).toBe(true);
    });
  });

  describe('the scorecard', () => {
    const score = rows(doc('SCORECARD.md'), /^[SIPBL]\d+$/);
    const name = (cells: string[]): string => /\*\*(.+?)\*\*/.exec(cells[1] ?? '')?.[1] ?? '';
    const isNew = (cells: string[]): boolean => /\*\(new/.test(cells[1] ?? '');

    it('has well-formed rows with unique ids', () => {
      expect(score.length).toBe(37);
      expect(new Set(score.map((c) => c[0])).size).toBe(score.length);
      for (const c of score) expect(c.length, `${c[0]} has ${c.length} cells`).toBe(9);
    });

    it('maps to the first-year measures by exact name, in both directions', () => {
      const names = new Set(MEASURES.map((m) => m.name));
      for (const m of MEASURES) {
        const hits = score.filter((c) => !isNew(c) && name(c) === m.name);
        expect(hits.length, `first-year measure "${m.name}" appears ${hits.length} times in the scorecard`).toBe(1);
      }
      for (const c of score) {
        if (isNew(c)) expect(names.has(name(c)), `${c[0]} is marked new but "${name(c)}" is a first-year measure`).toBe(false);
        else expect(names.has(name(c)), `${c[0]} "${name(c)}" is not marked new and is not a first-year measure`).toBe(true);
      }
      expect(score.filter(isNew).length).toBe(score.length - MEASURES.length);
    });

    it('names a launch-council seat as the owner of every metric', () => {
      for (const c of score) {
        const seats = seatsIn(c[3] ?? '');
        expect(seats.length, `${c[0]} names no seat`).toBeGreaterThan(0);
        for (const s of seats) expect((SEATS as readonly string[]).includes(s), `${c[0]} owner ${s} is not a seat`).toBe(true);
      }
    });

    it('sets no target: it says so, and proposes every number', () => {
      const text = doc('SCORECARD.md');
      expect(text.includes('NO TARGET IN THIS FILE IS SET')).toBe(true);
      expect(text.includes('PROPOSED')).toBe(true);
    });
  });

  describe('the risk register', () => {
    const risks = rows(doc('RISK-REGISTER.md'), /^SR-\d{3}$/);
    const score = (c: string[]): number => Number(strip(c[5] ?? ''));

    it('has numbered, unique risks with every cell present', () => {
      expect(risks.length).toBe(36);
      expect(risks.map((c) => c[0])).toEqual(Array.from({ length: 36 }, (_, i) => `SR-${String(i + 1).padStart(3, '0')}`));
      for (const c of risks) expect(c.length, `${c[0]} has ${c.length} cells`).toBe(11);
    });

    it('scores each risk as likelihood times impact, on a 1 to 5 scale', () => {
      for (const c of risks) {
        const l = Number(c[3]);
        const i = Number(c[4]);
        expect(l >= 1 && l <= 5 && i >= 1 && i <= 5, `${c[0]} L${l} I${i} is off the scale`).toBe(true);
        expect(score(c), `${c[0]} scores ${score(c)}, not ${l}x${i}`).toBe(l * i);
      }
    });

    it('is owned by seats and due on real dates', () => {
      for (const c of risks) {
        const seats = seatsIn(c[8] ?? '');
        expect(seats.length, `${c[0]} names no seat`).toBeGreaterThan(0);
        for (const s of seats) expect((SEATS as readonly string[]).includes(s), `${c[0]} owner ${s} is not a seat`).toBe(true);
        const due = c[9] ?? '';
        if (!['Standing', 'Per cohort', 'Per charter'].includes(due)) {
          expect(isIsoDate(due) && due >= EVIDENCE_DATE && due <= HORIZON_END, `${c[0]} is due "${due}"`).toBe(true);
        }
      }
    });

    it('has top-ten tables that agree with the register', () => {
      const byId = new Map(risks.map((c) => [c[0], score(c)] as const));
      const listed = (text: string): { id: string; s: number }[] =>
        rows(text, /^(?:[1-9]|10)$/)
          .filter((c) => /^SR-\d{3}$/.test(c[1] ?? ''))
          .map((c) => ({ id: c[1] ?? '', s: Number(c[2]) }));
      for (const f of ['RISK-REGISTER.md', 'BOARD-MEMO.md'] as const) {
        const top = listed(doc(f));
        expect(top.length, `${f} lists ${top.length} risks in its top ten`).toBe(10);
        for (const t of top) expect(byId.get(t.id), `${f}: ${t.id} is listed at ${t.s}`).toBe(t.s);
        for (let k = 1; k < top.length; k++) expect((top[k]?.s ?? 0) <= (top[k - 1]?.s ?? 0), `${f}: not in score order at ${top[k]?.id}`).toBe(true);
        const floor = Math.min(...top.map((t) => t.s));
        const out = risks.filter((c) => !top.some((t) => t.id === c[0]));
        expect(Math.max(...out.map(score)), `${f}: a risk outside the ten outscores the tenth`).toBeLessThanOrEqual(floor);
      }
    });
  });

  describe('the plan', () => {
    const milestones = rows(doc('THREE-YEAR-STRATEGY.md'), /^\d\.\d+$/);

    it('gives every milestone a seat and a real, future, in-horizon deadline', () => {
      expect(milestones.length).toBe(31);
      for (const c of milestones) {
        const seats = seatsIn(c[2] ?? '');
        expect(seats.length, `${c[0]} names no seat`).toBeGreaterThan(0);
        for (const s of seats) expect((SEATS as readonly string[]).includes(s), `${c[0]} owner ${s} is not a seat`).toBe(true);
        const d = c[3] ?? '';
        expect(isIsoDate(d) && d >= EVIDENCE_DATE && d <= HORIZON_END, `${c[0]} is due "${d}"`).toBe(true);
      }
    });

    it('writes only real calendar dates', () => {
      for (const d of idsIn(everything, /\b\d{4}-\d{2}-\d{2}\b/g)) {
        expect(isIsoDate(d), `${d} is not a date`).toBe(true);
        expect(d >= '2026-01-01' && d <= '2029-12-31', `${d} is outside the years the package covers`).toBe(true);
      }
    });
  });

  describe('the decision log', () => {
    const text = doc('FOUNDER-DECISION-LOG.md');
    const index = rows(text, /^FD-2026-\d{3}$/);
    const sections = text.split(/^### (?=FD-2026-\d{3} · )/m).slice(1);

    it('proposes seventeen decisions and approves none', () => {
      expect(index.length).toBe(17);
      expect(sections.length).toBe(17);
      for (const c of index) expect(c[5], `${c[0]} is ${c[5]}, and only the founder can approve it`).toBe('PROPOSED');
    });

    it('gives each decision a real choice, a recommendation, and a date that agrees with the index', () => {
      for (const s of sections) {
        const id = /^(FD-2026-\d{3}) · /.exec(s)?.[1] ?? '';
        const entry = index.find((c) => c[0] === id);
        expect(entry, `${id} is in the log but not the index`).toBeDefined();
        expect((s.match(/^\| [A-C]\. /gm) ?? []).length, `${id} offers fewer than two options`).toBeGreaterThanOrEqual(2);
        expect(s.includes('**Recommendation'), `${id} makes no recommendation`).toBe(true);
        const by = /\*\*Decide by:\*\* (\d{4}-\d{2}-\d{2})/.exec(s)?.[1] ?? '';
        expect(by, `${id}: entry says ${by}, index says ${entry?.[2]}`).toBe(entry?.[2]);
        expect(isIsoDate(by) && by >= EVIDENCE_DATE, `${id} must be decided by "${by}"`).toBe(true);
      }
    });
  });

  describe('the numbers the prose states', () => {
    it('are the numbers the tables hold', () => {
      const readme = doc('README.md');
      const scoreRows = rows(doc('SCORECARD.md'), /^[SIPBL]\d+$/).length;
      expect(readme.includes(`${scoreRows} metrics`), `README should say ${scoreRows} metrics`).toBe(true);
      expect(readme.includes('36 risks') && doc('BOARD-MEMO.md').includes('36 risks'), 'both should say 36 risks').toBe(true);
      expect(readme.includes('17 proposed decisions'), 'README should say 17 proposed decisions').toBe(true);
    });

    it('agree across files on the headline figures', () => {
      expect(doc('README.md').includes('$1.55M to $5.15M') && doc('BOARD-MEMO.md').includes('$1.55M to $5.15M')).toBe(true);
      for (const f of ['README.md', 'THREE-YEAR-STRATEGY.md', 'SCORECARD.md'] as const) {
        expect(doc(f).includes('floor 4') && doc(f).includes('stretch 12'), `${f} disagrees about the Year 3 agreement targets`).toBe(true);
      }
    });
  });

  describe('stays consistent with the pricing architecture', () => {
    const PRICING = 'docs/commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md';

    it('cites it, and the claims it leans on are still there', () => {
      expect(existsSync(join(root, PRICING)), `${PRICING} is gone`).toBe(true);
      const pricing = read(PRICING);
      for (const f of ['README.md', 'BOARD-MEMO.md', 'FOUNDER-DECISION-LOG.md', 'SCORECARD.md', 'RISK-REGISTER.md', 'MARKET-ENTRY-PLAN.md'] as const) {
        expect(doc(f).includes('PRICING-UNIT-ECONOMICS-ARCHITECTURE.md'), `${f} does not cite the pricing architecture`).toBe(true);
      }
      // the cost floor and the shared-key finding the assumptions rest on
      expect(pricing.includes('$54,292') && pricing.includes('$110,763'), 'the department cost floors changed').toBe(true);
      expect(pricing.includes('capped in calls, not dollars'), 'the shared-key finding changed').toBe(true);
    });

    it('treats a package label as a claim: the rule exists and the decision log points at it', () => {
      expect(doc('MARKET-ENTRY-PLAN.md').includes('## 3a. Package labels are claims')).toBe(true);
      expect(doc('FOUNDER-DECISION-LOG.md').includes('MARKET-ENTRY-PLAN.md) §3a')).toBe(true);
      expect(doc('MARKET-ENTRY-PLAN.md').includes('may not say "Replace"')).toBe(true);
    });

    it('sizes the illustrative contract value, and gates G1 on a dollar cap', () => {
      expect(doc('README.md').includes('department of about 750 active students')).toBe(true);
      expect(doc('SCORECARD.md').includes('department of about 750 active students')).toBe(true);
      const g1 = rows(doc('BOARD-MEMO.md'), /^\*\*G1\*\*$/)[0]?.join(' ') ?? '';
      expect(g1.includes('capped in dollars'), 'G1 does not require the dollar cap').toBe(true);
    });
  });

  describe('the register of authoritative documents', () => {
    it('points company strategy at the package, no longer at nothing', () => {
      const s = SOURCES.find((x) => x.id === 'strategy');
      expect(s?.path).toBe(`${DIR}/README.md`);
      expect(s?.status).not.toBe('missing');
    });
  });
});
