import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEATS } from '../launchreadiness';
import { cell, controlLine, isIsoDate, link, renderedFrom, table } from '../ops/render';
import {
  ASSESSMENTS, GATE, OWED, QUESTION_IDS, QUESTIONS, coverage, held, isTest, type Assessment,
} from './pia';

/**
 * Holds the privacy impact assessment to the tree: the template asks its
 * eleven questions once each, every assessment answers every one with a
 * sentence and a file that exists, its owner is a council seat, its guard
 * answer cites a test, it names at least one thing that is not clearly yes,
 * the owed surfaces start from a file that exists, and the pull-request
 * template asks the gate's question verbatim.
 *
 * `docs/operating-model/PRIVACY-IMPACT-ASSESSMENT.md` is rendered from the
 * data; run `npm run registers` from app/ to rewrite it. The last test fails
 * while stale.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const exists = (p: string) => existsSync(join(root, p));
const DOC = 'docs/operating-model/PRIVACY-IMPACT-ASSESSMENT.md';

describe('the privacy impact assessment', () => {
  it('can tell a missing file from a present one, and a test from a document', () => {
    expect(exists('README.md')).toBe(true);
    expect(exists('app/src/lib/governance/no-such-file.test.ts')).toBe(false);
    expect(isTest('supabase/beta.check.sql')).toBe(true);
    expect(isTest('app/src/lib/privacy.test.ts')).toBe(true);
    expect(isTest('RETENTION.md')).toBe(false);
    expect(isTest('supabase/functions/claude/index.ts')).toBe(false);
  });

  it('asks eleven questions, once each, in the template’s order, each saying what clearly yes looks like', () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual([...QUESTION_IDS]);
    expect(QUESTIONS).toHaveLength(11);
    for (const q of QUESTIONS) {
      expect(q.ask, q.id).toMatch(/\?$/);
      expect(q.clear.trim().length, q.id).toBeGreaterThan(30);
    }
  });

  it('names each assessment once, dated, owned by a council seat, with a rating and something open', () => {
    const ids = ASSESSMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ASSESSMENTS) {
      expect(isIsoDate(a.assessed), `${a.id} is dated`).toBe(true);
      expect(SEATS, `${a.id} is owned by a seat`).toContain(a.owner);
      expect(['low', 'medium', 'high'], a.id).toContain(a.rating);
      expect(a.open.length, `${a.id} names what is not clearly yes`).toBeGreaterThan(0);
      for (const o of a.open) expect(o, `${a.id} open item names its question`).toMatch(/^[A-Z][A-Za-z]+: /);
    }
  });

  it('answers every question with a sentence and a file that exists', () => {
    for (const a of ASSESSMENTS) {
      for (const id of QUESTION_IDS) {
        const { answer, evidence } = a.answers[id];
        expect(answer.trim().length, `${a.id}.${id}`).toBeGreaterThan(20);
        expect(evidence.length, `${a.id}.${id} cites something`).toBeGreaterThan(0);
        for (const e of evidence) {
          expect(exists(e.path), `${a.id}.${id} cites ${e.path}, which is missing`).toBe(true);
          expect(e.shows.trim().length, `${a.id}.${id} says what ${e.path} shows`).toBeGreaterThan(5);
        }
      }
      expect(held(a.answers.guard.evidence), `${a.id}’s guard is a test`).toBe(true);
    }
  });

  it('owes surfaces that start from a file that exists and are not also assessed', () => {
    const assessed = new Set(ASSESSMENTS.map((a) => a.surface));
    for (const o of OWED) {
      expect(exists(o.start), `${o.surface} starts from ${o.start}`).toBe(true);
      expect(assessed.has(o.surface), `${o.surface} is owed and assessed`).toBe(false);
      expect(o.why.trim().length, o.surface).toBeGreaterThan(30);
    }
    expect(OWED.length).toBeGreaterThan(0);
  });

  it('is asked in the pull-request template, verbatim, after the scope questions', () => {
    const template = read(GATE.where);
    const at = template.indexOf(GATE.line);
    expect(at, `${GATE.where} lacks the gate line`).toBeGreaterThanOrEqual(0);
    expect(at).toBeGreaterThan(template.indexOf('9. How is it removed if it does not work?'));
  });

  it('states the finding: what is assessed, what is owed, how many answers a test holds', () => {
    const c = coverage();
    expect(c.assessed + c.owed).toBe(ASSESSMENTS.length + OWED.length);
    expect(c.heldAnswers + c.writtenAnswers).toBe(ASSESSMENTS.length * QUESTION_IDS.length);
    expect(c).toEqual({ assessed: 7, owed: 7, heldAnswers: 46, writtenAnswers: 31 });
  });

  it('would count an unheld answer as written, and a held one as held (control)', () => {
    const answers = Object.fromEntries(QUESTION_IDS.map((id) => [id, { answer: 'a written answer', evidence: [{ path: 'README.md', shows: 'a document' }] }])) as unknown as Assessment['answers'];
    const written: Assessment = { id: 'x', surface: 'x', what: 'x', owner: 'founder', assessed: '2026-09-29', answers, rating: 'low', open: [] };
    expect(coverage([written], [])).toEqual({ assessed: 1, owed: 0, heldAnswers: 0, writtenAnswers: 11 });
    const heldOne: Assessment = { ...written, answers: { ...answers, guard: { answer: 'held', evidence: [{ path: 'supabase/beta.check.sql', shows: 'a test' }] } } };
    expect(coverage([heldOne], []).heldAnswers).toBe(1);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

function render(): string {
  const c = coverage();
  const ask = (id: string) => QUESTIONS.find((q) => q.id === id)!.ask;
  const out: string[] = [
    renderedFrom('app/src/lib/governance/pia.ts', 'pia.test.ts'),
    '',
    '# Privacy impact assessment',
    '',
    controlLine(DOC),
    '',
    'The questions a surface that touches student data answers before it ships, the',
    'surfaces that have answered them, and the ones that owe an answer. R-15 in',
    `[RISK-GOVERNANCE.md](${link(DOC, 'docs/operating-model/RISK-GOVERNANCE.md')}) asked for the template so that a new`,
    'surface is asked the question before it ships; the eighth maturity system on the',
    'same page said no template, register or gate existed. This is the three.',
    '',
    `**${c.assessed} surfaces have answered; ${c.owed} owe an answer.** Of the ${c.assessed * QUESTIONS.length} answers written,`,
    `${c.heldAnswers} cite a test that runs on every change and ${c.writtenAnswers} cite code or a document only,`,
    'which is a weaker thing and is marked *written* below. No assessment has been',
    'reviewed by the privacy seat, which is vacant: these are the founder’s reading of',
    'the tree, and the seat’s first job is to read them again.',
    '',
    '## The rule',
    '',
    'An answer is a sentence and the file that shows it. If any answer is not clearly',
    'yes, the surface is not launch-ready: narrow the scope, add a control, or defer',
    'it. Each assessment’s **Open** list is where the not-clearly-yes answers go, so',
    'a reader finds them without reading every row.',
    '',
    '## The gate',
    '',
    `[\`${GATE.where}\`](${link(DOC, GATE.where)}) asks, of every pull request that adds a module:`,
    '',
    `> ${GATE.line}`,
    '',
    'A new module joins the assessed or the owed list below, never neither. The test',
    'holds the line in the template verbatim.',
    '',
    '## The template',
    '',
    ...table(['#', 'Question', 'What clearly yes looks like'], QUESTIONS.map((q, i) => [String(i + 1), cell(q.ask), cell(q.clear)])),
    '',
    '## Assessed',
    '',
  ];
  for (const a of ASSESSMENTS) {
    out.push(
      `### ${a.surface}`,
      '',
      `${a.what} Owner: **${a.owner}** seat. Assessed ${a.assessed}. Residual rating: **${a.rating}**.`,
      '',
      ...table(['Question', 'Answer', 'Shown by'], QUESTION_IDS.map((id) => {
        const { answer, evidence } = a.answers[id];
        const shown = evidence.map((e) => `\`${e.path}\` — ${cell(e.shows)}`).join('<br>');
        return [cell(ask(id)), `${cell(answer)}${held(evidence) ? '' : ' *(written)*'}`, shown];
      })),
      '',
      '**Open:**',
      '',
      ...a.open.map((o) => `- ${o}`),
      '',
    );
  }
  out.push(
    '## Owed',
    '',
    'Surfaces that touch student data and have not answered. Each starts from the',
    'design or model that already answers some of the questions.',
    '',
    ...table(['Surface', 'State', 'Starts from', 'Why it is owed'], OWED.map((o) => [cell(o.surface), o.state, `\`${o.start}\``, cell(o.why)])),
    '',
  );
  return out.join('\n');
}
