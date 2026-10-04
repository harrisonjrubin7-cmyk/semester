import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITY_DEFINITIONS } from '../governance/capability-governance';
import { RISKS } from '../governance/risk';
import { SEATS, type Seat } from '../launchreadiness';
import { CAPABILITIES } from '../rollout-capabilities';
import { PLAYBOOKS } from './incidentplaybooks';
import { cell, controlLine, renderedFrom, table } from './render';
import {
  MAX_EXCEPTION_DAYS,
  MAX_PASS_DAYS,
  QUESTIONS,
  REVIEWS,
  SECTIONS,
  SECTION_OWNER,
  SECTION_TITLE,
  TOUCHES,
  TOUCH_TITLE,
  applicable,
  controlsKnown,
  counts,
  daysBetween,
  evaluate,
  gateFor,
  seatHeld,
  type Answer,
  type Review,
} from './riskreview';
import { control } from './trustcontrols';

/**
 * The combined risk review, held to its own rules.
 *
 * The evaluator is the part that has to be right, so it is shown every way it
 * can be fooled: a pass by the wrong seat, by a vacant seat, with evidence
 * that does not exist, with a document where a test was claimed, with
 * something that must have been operated backed by a file that only describes
 * it, a pass dated in the future, one that has lasted too long, one that ends
 * today. Each must be refused, and a review built to be sound must pass, so a
 * green result means the rules are right and not that the evaluator refuses
 * everything.
 *
 * `COMBINED-RISK-REVIEW.md` is rendered; `npm run registers` from app/
 * rewrites it.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const exists = (p: string) => existsSync(at(p));
const DOC = 'docs/integrated-trust/COMBINED-RISK-REVIEW.md';

/** The date the real reviews are evaluated at, fixed so the document does not move with the clock. */
const TODAY = '2026-10-04';

const everySeatHeld = () => true;

/** A file that exists under docs/evidence/, standing in for a filed record. */
const FILED = 'docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md';

/** The evidence a sound pass would name for a question. */
function soundEvidence(qId: string): string[] {
  const q = QUESTIONS.find((x) => x.id === qId)!;
  if (q.evidence === 'evidence-dir') return [FILED];
  const c = q.control ? control(q.control) : undefined;
  return c && c.proof.length > 0 ? [c.proof[0]] : ['SECURITY.md'];
}

/** A review in which the owning seat has passed every applicable question. */
function soundReview(touches: Review['touches'] = ['personalData', 'officialRecords']): Review {
  const base: Review = { capability: 'CAP-050', title: 'Sound', touches, opened: '2026-09-01', answers: {}, risks: [], playbooks: [] };
  const answers: Record<string, Answer> = {};
  for (const q of applicable(base)) {
    answers[q.id] = { status: 'pass', reviewer: SECTION_OWNER[q.section], reviewedOn: '2026-10-01', expiresOn: '2026-11-15', evidence: soundEvidence(q.id) };
  }
  return { ...base, answers };
}

const only = (r: Review, id: string, a: Answer): Review => ({ ...r, answers: { ...r.answers, [id]: a } });

describe('the questions', () => {
  it('have unique ids that carry their section, and cover every section', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const s of SECTIONS) expect(QUESTIONS.some((q) => q.section === s), s).toBe(true);
    for (const q of QUESTIONS) expect(q.id).toMatch(/^RR-[A-Z0-9]{2,3}-\d$/);
  });

  it('cite only controls that are in the register', () => {
    expect(controlsKnown()).toBe(true);
  });

  it('ask one thing each, as a question, and cite counsel wherever a legal conclusion would follow', () => {
    for (const q of QUESTIONS) {
      expect(q.ask.endsWith('?'), q.id).toBe(true);
      expect(q.ask.length, q.id).toBeGreaterThan(30);
    }
    for (const q of QUESTIONS.filter((x) => /counsel/.test(x.ask))) expect(q.ask, q.id).toMatch(/requires qualified human counsel review/);
  });

  it('give every section an owner that is a seat', () => {
    for (const s of SECTIONS) expect(SEATS).toContain(SECTION_OWNER[s]);
  });

  it('ask a touch-specific question only of a review that touches it', () => {
    const none: Review = { capability: 'CAP-001', title: 'x', touches: [], opened: TODAY, answers: {}, risks: [], playbooks: [] };
    const ids = applicable(none).map((q) => q.id);
    expect(ids).not.toContain('RR-AI-1');
    expect(ids).not.toContain('RR-PRV-1');
    expect(ids).toContain('RR-SEC-1');
    const ai: Review = { ...none, touches: ['ai'] };
    expect(applicable(ai).map((q) => q.id)).toContain('RR-AI-1');
    for (const t of TOUCHES) expect(TOUCH_TITLE[t].length).toBeGreaterThan(10);
  });
});

describe('the evaluator', () => {
  const sound = soundReview();

  it('passes a sound review when every owning seat is held', () => {
    const r = evaluate(sound, TODAY, exists, everySeatHeld);
    expect(r.hard).toEqual([]);
    expect(r.soft).toEqual([]);
    expect(r.strays).toEqual([]);
    expect(r.verdict).toBe('go');
  });

  it('refuses the same review today, because the security seat has no holder', () => {
    expect(seatHeld('security')).toBe(false);
    const r = evaluate(sound, TODAY, exists);
    expect(r.verdict).toBe('no-go');
    expect(r.hard.some((l) => l.standing === 'invalid' && /vacant/.test(l.why))).toBe(true);
  });

  it('refuses a pass by the wrong seat', () => {
    const r = evaluate(only(sound, 'RR-SEC-1', { status: 'pass', reviewer: 'product', reviewedOn: '2026-10-01', expiresOn: '2026-11-01', evidence: ['SECURITY.md'] }), TODAY, exists, everySeatHeld);
    expect(r.verdict).toBe('no-go');
    expect(r.lines.find((l) => l.question.id === 'RR-SEC-1')?.why).toMatch(/answered by the security seat/);
  });

  it('refuses evidence that does not exist, and a pass that names none', () => {
    const missing = evaluate(only(sound, 'RR-SEC-1', { status: 'pass', reviewer: 'security', reviewedOn: '2026-10-01', expiresOn: '2026-11-01', evidence: ['docs/nope.md'] }), TODAY, exists, everySeatHeld);
    expect(missing.lines.find((l) => l.question.id === 'RR-SEC-1')?.why).toMatch(/does not exist/);
    const none = evaluate(only(sound, 'RR-SEC-1', { status: 'pass', reviewer: 'security', reviewedOn: '2026-10-01', expiresOn: '2026-11-01', evidence: [] }), TODAY, exists, everySeatHeld);
    expect(none.lines.find((l) => l.question.id === 'RR-SEC-1')?.why).toMatch(/names no evidence/);
  });

  it('refuses a document where a thing that must have been operated is claimed', () => {
    const r = evaluate(only(sound, 'RR-REL-4', { status: 'pass', reviewer: 'operations', reviewedOn: '2026-10-01', expiresOn: '2026-11-01', evidence: ['RESTORE.md'] }), TODAY, exists, everySeatHeld);
    expect(r.lines.find((l) => l.question.id === 'RR-REL-4')?.why).toMatch(/docs\/evidence/);
    expect(r.verdict).toBe('no-go');
  });

  it('refuses a document where the control claims a test would fail', () => {
    const r = evaluate(only(sound, 'RR-SEC-2', { status: 'pass', reviewer: 'security', reviewedOn: '2026-10-01', expiresOn: '2026-11-01', evidence: ['SECURITY.md'] }), TODAY, exists, everySeatHeld);
    expect(r.lines.find((l) => l.question.id === 'RR-SEC-2')?.why).toMatch(/needs a test, check or workflow/);
  });

  it('ends a pass strictly before its expiry date, as release evidence now does', () => {
    const at = (day: string) => evaluate(sound, day, exists, everySeatHeld);
    expect(at('2026-11-14').verdict).toBe('go');
    expect(at('2026-11-15').verdict).toBe('no-go');
    expect(at('2026-11-15').lines.every((l) => l.standing === 'expired')).toBe(true);
  });

  it('refuses a pass dated in the future and one that lasts more than the limit', () => {
    const future = evaluate(only(sound, 'RR-SEC-1', { status: 'pass', reviewer: 'security', reviewedOn: '2026-10-05', expiresOn: '2026-11-01', evidence: ['SECURITY.md'] }), TODAY, exists, everySeatHeld);
    expect(future.lines.find((l) => l.question.id === 'RR-SEC-1')?.why).toMatch(/future/);
    const long = evaluate(only(sound, 'RR-SEC-1', { status: 'pass', reviewer: 'security', reviewedOn: '2026-10-01', expiresOn: '2027-03-01', evidence: ['SECURITY.md'] }), TODAY, exists, everySeatHeld);
    expect(long.lines.find((l) => l.question.id === 'RR-SEC-1')?.why).toMatch(new RegExp(`at most ${MAX_PASS_DAYS} days`));
    expect(daysBetween('2026-10-01', '2026-12-31')).toBe(91);
  });

  it('treats an unanswered question as a blocker and an answer to nothing asked as a stray', () => {
    const { ['RR-SEC-1']: _dropped, ...rest } = sound.answers;
    void _dropped;
    expect(evaluate({ ...sound, answers: rest }, TODAY, exists, everySeatHeld).verdict).toBe('no-go');
    const stray = evaluate(only(sound, 'RR-AI-1', { status: 'owed', note: 'x' }), TODAY, exists, everySeatHeld);
    expect(stray.strays).toEqual(['RR-AI-1']);
    expect(stray.verdict).toBe('no-go');
  });

  it('never lets a blocking question be excepted, and limits an exception to the founder, ninety days, and now', () => {
    const accept = (over: Partial<Extract<Answer, { status: 'accepted' }>> = {}): Answer => ({ status: 'accepted', acceptedBy: 'founder', reviewedOn: '2026-10-01', until: '2026-12-01', reason: 'accepted for the pilot window', ...over });
    const blocking = evaluate(only(sound, 'RR-SEC-1', accept()), TODAY, exists, everySeatHeld);
    expect(blocking.lines.find((l) => l.question.id === 'RR-SEC-1')?.why).toMatch(/cannot be excepted/);

    const soft = QUESTIONS.find((q) => !q.blocking && q.when === 'always')!.id;
    const ok = evaluate(only(sound, soft, accept()), TODAY, exists, everySeatHeld);
    expect(ok.verdict).toBe('conditional');
    expect(ok.hard).toEqual([]);

    expect(evaluate(only(sound, soft, accept({ acceptedBy: 'product' })), TODAY, exists, everySeatHeld).lines.find((l) => l.question.id === soft)?.why).toMatch(/only the founder/);
    expect(evaluate(only(sound, soft, accept({ until: '2027-06-01' })), TODAY, exists, everySeatHeld).lines.find((l) => l.question.id === soft)?.why).toMatch(new RegExp(`at most ${MAX_EXCEPTION_DAYS} days`));
    expect(evaluate(only(sound, soft, accept({ until: TODAY })), TODAY, exists, everySeatHeld).lines.find((l) => l.question.id === soft)?.standing).toBe('expired');
  });

  it('seeds an unanswered question from the control register: absent is a known gap, anything else is owed', () => {
    const r = evaluate({ ...sound, answers: {} }, TODAY, exists, everySeatHeld);
    const standing = (id: string) => r.lines.find((l) => l.question.id === id)?.standing;
    expect(control('TC-SEC-06')?.state).toBe('absent');
    expect(standing('RR-SEC-6')).toBe('known-gap');
    expect(control('TC-SEC-01')?.state).toBe('enforced');
    expect(standing('RR-SEC-2')).toBe('owed');
    expect(standing('RR-SEC-1')).toBe('unanswered');
    const c = counts(r);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(r.lines.length);
  });
});

describe('the reviews opened', () => {
  const highRisk = CAPABILITY_DEFINITIONS.filter((c) => c.activationClass === 'high-risk').map((c) => c.id);
  const riskIds = new Set(RISKS.map((r) => r.id));
  const playbookIds = new Set(PLAYBOOKS.map((p) => p.id));

  it('exist for every capability the activation register marks high risk', () => {
    expect(highRisk.length).toBeGreaterThan(0);
    for (const id of highRisk) expect(REVIEWS.map((r) => r.capability), id).toContain(id);
  });

  it('name real capabilities, risks and playbooks, and real touches', () => {
    const caps = new Set(CAPABILITIES.map((c) => c.id));
    for (const r of REVIEWS) {
      expect(caps.has(r.capability as never), r.capability).toBe(true);
      for (const id of r.risks) expect(riskIds.has(id), `${r.capability} ${id}`).toBe(true);
      for (const id of r.playbooks) expect(playbookIds.has(id), `${r.capability} ${id}`).toBe(true);
      for (const t of r.touches) expect(TOUCHES).toContain(t);
    }
  });

  it('answer nothing on behalf of a seat, and so are not releasable', () => {
    for (const r of REVIEWS) {
      expect(Object.keys(r.answers), r.capability).toEqual([]);
      expect(evaluate(r, TODAY, exists).verdict, r.capability).toBe('no-go');
    }
  });

  it('read a capability with no review as no-go, not as no objection', () => {
    expect(gateFor('CAP-001', TODAY, exists)).toEqual({ verdict: 'no-go', reviewed: false });
    expect(gateFor('CAP-050', TODAY, exists).reviewed).toBe(true);
  });

  it('renders the template and the opened reviews from the data', () => {
    const rendered = renderDoc();
    if (process.env.REGISTERS === 'write') writeFileSync(at(DOC), rendered);
    expect(readFileSync(at(DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── Rendering ──

const seatNames = (s: Seat) => s;

function renderDoc(): string {
  const lines: string[] = [];
  lines.push('# Combined risk review', '');
  lines.push(renderedFrom('app/src/lib/ops/riskreview.ts', 'riskreview.test.ts'), '');
  lines.push(controlLine(DOC), '');
  lines.push(
    'One record per capability, answered by the seats that own each section, required before the capability is released to anyone beyond its builders. ' +
      'It joins what was kept apart: the privacy assessment, the risk register, the accessibility evidence, the service-level objective, the support route and the incident playbook, all keyed by the same `CAP-nnn` id the rest of the governance uses.',
    '',
    '## The rule',
    '',
    '- **Required.** No capability the activation register marks high risk, and no release profile beyond the invitation-only validation, proceeds without a review whose verdict is *go* or *conditional*. A capability with no review is *no-go*; the absence of a record is the thing this makes visible.',
    '- **A pass is evidence, not an opinion.** It names files that exist. Anything that has to have been *operated* — a restore, an alert reaching a person, a screen-reader pass, a drill — needs a file under `docs/evidence/`, because the master register lets no row past `tested` without one. A test in the tree shows a build would notice; it does not show anyone did the thing.',
    '- **A vacant seat cannot sign.** Each section has an owning seat. If the launch council names no holder, nothing it says counts. Today that makes the security, trust and data sections unpassable, which is true.',
    `- **Evidence expires, strictly.** A pass is good before its \`expiresOn\` and not on it, the rule release evidence adopted on 3 October. A pass lasts at most ${MAX_PASS_DAYS} days.`,
    `- **Exceptions are narrow.** Only the founder seat can accept a risk, only on a question not marked blocking, for at most ${MAX_EXCEPTION_DAYS} days, with a reason. Any unresolved blocking question is *no-go*; unresolved non-blocking ones make the verdict *conditional*.`,
    '- **Legal conclusions are not made here.** A question that would end in one says *requires qualified human counsel review*, and a pass on it needs a closed row in the [legal review queue](../../LEGAL-REVIEW-QUEUE.md), filed as evidence.',
    '',
    'The evaluator is `evaluate()` in `app/src/lib/ops/riskreview.ts`. It reads no clock, disk or network: the day and the file-existence check are passed in, so the same review always gives the same verdict. ' +
      'It is not yet a gate in `release-profiles.ts` or in CI — see RM-49 in the [remediation sequence](REMEDIATION-SEQUENCE.md) — so today it is consulted by its own test and by whoever runs a release.',
    '',
    '## How a review is run',
    '',
    '1. **Open** it: add a `Review` to `REVIEWS` for the capability, list what it touches, and name the risks and playbooks that apply. Opening costs nothing and already shows the known gaps, because every unanswered question is seeded from the [control register](CONTROL-FRAMEWORK.md).',
    '2. **Answer** it, section by section, by the owning seat. A seat answers `pass` with evidence and dates, `fail` or `owed` with a note, or — for a non-blocking question only — asks the founder to accept.',
    '3. **File** what has to be operated first: run the drill, the restore, the assistive-technology pass, and save the record under `docs/evidence/` with its date; cite it in the matching evidence record.',
    '4. **Read the verdict** with `gateFor(capability, today, exists)`. *Go* releases; *conditional* releases with the listed conditions and their dates; *no-go* does not.',
    '5. **Renew** before `expiresOn`, and on any change that touches what a section asked about — a new data class, a new provider, a changed model, a new role.',
    '',
    '## The questions',
    '',
    `${QUESTIONS.length} questions in ${SECTIONS.length} sections. A question applies when the review touches the thing in the second column, or always.`,
    '',
  );
  for (const s of SECTIONS) {
    lines.push(`### ${SECTION_TITLE[s]}`, '', `Answered by the **${SECTION_OWNER[s]}** seat${seatHeld(SECTION_OWNER[s]) ? '' : ' (vacant: no pass counts until it has a holder)'}.`, '');
    lines.push(
      ...table(
        ['ID', 'Applies when', 'Blocking', 'Evidence', 'Control', 'Question'],
        QUESTIONS.filter((q) => q.section === s).map((q) => [q.id, q.when === 'always' ? 'always' : TOUCH_TITLE[q.when], q.blocking ? 'yes' : 'no', q.evidence === 'evidence-dir' ? 'operated: `docs/evidence/`' : 'repository', q.control ?? '—', cell(q.ask)]),
      ),
      '',
    );
  }

  lines.push(
    '## The record',
    '',
    'A review in `REVIEWS`:',
    '',
    '```ts',
    '{',
    "  capability: 'CAP-050',",
    "  title: 'Registration',",
    "  touches: ['personalData', 'officialRecords', 'integrations'],",
    "  opened: '2026-10-04',",
    '  answers: {',
    "    'RR-SEC-2': { status: 'pass', reviewer: 'security', reviewedOn: '2026-11-02', expiresOn: '2027-01-15',",
    "                  evidence: ['supabase/rls-coverage.check.sql', 'supabase/tenancy.check.sql'] },",
    "    'RR-SEC-6': { status: 'accepted', acceptedBy: 'founder', reviewedOn: '2026-11-02', until: '2027-01-15',",
    "                  reason: 'Code scanning lands with RM-15; the pilot window is eight weeks.' },",
    "    'RR-REL-4': { status: 'owed', note: 'Provider restore drill TT-03 is scheduled for week 6.' },",
    '  },',
    "  risks: ['R-01', 'R-08'],",
    "  playbooks: ['IR-03', 'IR-05', 'IR-06'],",
    '}',
    '```',
    '',
    '## Reviews opened',
    '',
    `Read at ${TODAY}. Each is opened with no answers: the seats that must give them are mostly vacant, and an answer written here on their behalf would be the thing this record exists to prevent. What each shows is what the control register already knows.`,
    '',
  );

  const rows = REVIEWS.map((review) => {
    const r = evaluate(review, TODAY, exists);
    const c = counts(r);
    return { review, r, c };
  });
  lines.push(
    ...table(
      ['Capability', 'Touches', 'Questions', 'Blocking unresolved', 'Known gaps', 'Owed', 'Not yet reviewed', 'Verdict'],
      rows.map(({ review, r, c }) => [
        `${review.capability} ${review.title}`,
        cell(review.touches.map((t) => TOUCH_TITLE[t]).join('; ')),
        String(r.lines.length),
        String(r.hard.length),
        String(c['known-gap']),
        String(c.owed),
        String(c.unanswered),
        `**${r.verdict}**`,
      ]),
      ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
    ),
    '',
  );
  for (const { review, r } of rows) {
    lines.push(`### ${review.capability} ${review.title}`, '', `Risks: ${review.risks.join(', ')}. Playbooks: ${review.playbooks.join(', ')}.`, '', 'Blocking questions unresolved:', '');
    lines.push(...r.hard.map((l) => `- **${l.question.id}** (${seatNames(SECTION_OWNER[l.question.section])}, ${l.standing}): ${l.why}`), '');
  }
  return lines.join('\n') + '\n';
}
