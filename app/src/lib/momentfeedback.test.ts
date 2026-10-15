import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_COHORT } from './institution-ops';
import { SEATS } from './launchreadiness';
import { DESTINATIONS } from './nav';
import {
  CATEGORIES,
  CHANGES,
  DAILY_CAP,
  EMPTY,
  GAP_DAYS,
  KEEP,
  MOMENTS,
  MOMENT_IDS,
  NOTHING_YET,
  STOP_AFTER_SKIPS,
  WIRED,
  aggregate,
  answer,
  clearFeedback,
  isOpen,
  mayAsk,
  recordShown,
  momentFeedbackFlag,
  momentFeedbackOn,
  readFeedback,
  routeFor,
  setMuted,
  skip,
  youSaidWeChanged,
  type Change,
} from './momentfeedback';

const root = join(import.meta.dirname, '../../..');
const registered = new Set<string>(DESTINATIONS.map((d) => d.screen));

describe('feedback at the moment it is about', () => {
  it('asks at the eight moments the brief names, once each', () => {
    expect(MOMENTS.map((m) => m.id)).toEqual([...MOMENT_IDS]);
    expect(MOMENT_IDS).toHaveLength(8);
  });

  it('gives every moment one question, a "worked" answer, an owner who is a seat, and a real place to fix it', () => {
    for (const m of MOMENTS) {
      expect(m.question.endsWith('?'), m.id).toBe(true);
      expect(m.choices.filter((c) => c.category === 'worked'), m.id).toHaveLength(1);
      expect(new Set(m.choices.map((c) => c.id)).size, m.id).toBe(m.choices.length);
      for (const c of m.choices) expect(CATEGORIES, `${m.id}/${c.id}`).toContain(c.category);
      expect(SEATS, m.id).toContain(m.owner);
      if (m.fix) expect(registered.has(m.fix), `${m.id} fixes at ${m.fix}`).toBe(true);
    }
  });

  it('has no free-text field: an answer is a choice, a category and a date, nothing typed', () => {
    const s = answer(EMPTY, 'first-plan', 'some', '2026-10-01');
    expect(Object.keys(s.answers[0]).sort()).toEqual(['category', 'choice', 'moment', 'on']);
    expect(answer(EMPTY, 'first-plan', 'a sentence somebody typed', '2026-10-01')).toBe(EMPTY);
  });

  it('counts a prompt that was shown and never answered against the daily cap and the thirty-day gap', () => {
    const shown = recordShown(EMPTY, 'advising', '2026-10-01');
    expect(shown.shown).toEqual([{ moment: 'advising', on: '2026-10-01' }]);
    expect(recordShown(shown, 'advising', '2026-10-01')).toBe(shown); // once a day
    expect(mayAsk(shown, 'advising', '2026-10-01').ok).toBe(false); // the same visit again
    expect(mayAsk(shown, 'first-plan', '2026-10-01').ok).toBe(false); // the day's one prompt
    expect(mayAsk(shown, 'advising', '2026-10-30').ok).toBe(false); // 29 days
    expect(mayAsk(shown, 'advising', '2026-10-31').ok).toBe(true); // 30 days
    expect(recordShown(shown, 'first-plan', '2026-10-01')).toBe(shown); // a moment that may not be asked is not recorded
  });

  it('lets a prompt that is on screen today be answered or skipped, and nothing else the day has used up', () => {
    const shown = recordShown(EMPTY, 'advising', '2026-10-01');
    expect(isOpen(shown, 'advising', '2026-10-01')).toBe(true);
    expect(answer(shown, 'advising', 'thin', '2026-10-01').answers).toHaveLength(1);
    expect(skip(shown, 'advising', '2026-10-01').skips).toHaveLength(1);
    expect(answer(shown, 'first-plan', 'yes', '2026-10-01')).toBe(shown); // never shown
    expect(isOpen(shown, 'advising', '2026-10-02')).toBe(false); // a different day
    expect(isOpen(answer(shown, 'advising', 'thin', '2026-10-01'), 'advising', '2026-10-01')).toBe(false); // already closed out
    expect(isOpen(setMuted(shown, true), 'advising', '2026-10-01')).toBe(false);
    expect(answer(setMuted(shown, true), 'advising', 'thin', '2026-10-01').answers).toHaveLength(0);
  });

  it('reads back what was shown, checked against the moments, and drops anything else', () => {
    const read = readFeedback({ shown: [{ moment: 'advising', on: '2026-10-01' }, { moment: 'x', on: '2026-10-01' }, { moment: 'advising', on: 'never' }] });
    expect(read.shown).toEqual([{ moment: 'advising', on: '2026-10-01' }]);
    expect(readFeedback({ shown: 3 }).shown).toEqual([]);
    expect(readFeedback({ answers: [] }).shown).toEqual([]); // data written before this field existed
  });

  it('caps: one prompt a day, thirty days between asks, and never again after three skips', () => {
    expect([DAILY_CAP, GAP_DAYS, STOP_AFTER_SKIPS]).toEqual([1, 30, 3]);
    let s = answer(EMPTY, 'first-plan', 'yes', '2026-10-01');
    expect(mayAsk(s, 'advising', '2026-10-01').ok).toBe(false); // the day's one prompt is used
    expect(mayAsk(s, 'advising', '2026-10-02').ok).toBe(true);
    expect(mayAsk(s, 'first-plan', '2026-10-30').ok).toBe(false); // 29 days
    expect(mayAsk(s, 'first-plan', '2026-10-31').ok).toBe(true); // 30 days
    s = skip(EMPTY, 'advising', '2026-10-01');
    s = skip(s, 'advising', '2026-12-01');
    s = skip(s, 'advising', '2027-02-01');
    expect(s.skips).toHaveLength(3);
    const later = mayAsk(s, 'advising', '2028-01-01');
    expect(later.ok).toBe(false);
    expect(later.why).toMatch(/not asked again/);
  });

  it('refuses a second answer inside the gap rather than recording it', () => {
    const s = answer(EMPTY, 'ai-answer', 'wrong', '2026-10-01');
    expect(answer(s, 'ai-answer', 'yes', '2026-10-05')).toBe(s);
    expect(skip(s, 'ai-answer', '2026-10-05')).toBe(s);
  });

  it('routes anything that did not work to its owner, and nothing that did', () => {
    const bad = answer(EMPTY, 'support-routed', 'wrong', '2026-10-01').answers[0];
    expect(routeFor(bad)).toEqual({ owner: 'success', fix: 'help' });
    const ok = answer(EMPTY, 'support-routed', 'yes', '2026-10-01').answers[0];
    expect(routeFor(ok)).toBeNull();
    expect(routeFor(answer(EMPTY, 'ai-answer', 'nosource', '2026-10-01').answers[0])).toEqual({ owner: 'trust' });
  });

  it('shows an institution only counts at the floor, and withholds the complement of a small cell', () => {
    const many = (moment: 'advising' | 'first-plan', category: 'worked' | 'unclear', n: number) =>
      Array.from({ length: n }, () => ({ moment, category }));
    const cells = aggregate([...many('advising', 'worked', MIN_COHORT + 5), ...many('advising', 'unclear', MIN_COHORT - 1), ...many('first-plan', 'worked', MIN_COHORT)]);
    const by = (k: string) => cells.find((c) => c.key === k)!;
    expect(by('first-plan|worked').shown).toBe(MIN_COHORT);
    expect(by('advising|unclear').shown).toBeNull();
    expect(by('advising|unclear').why).toBe('small');
    // One cell withheld in the group would let the total give it back, so the next smallest goes too.
    expect(by('advising|worked').shown).toBeNull();
    expect(by('advising|worked').why).toBe('complement');
    expect(MIN_COHORT).toBe(10);
  });

  it('starts with an empty "You said, we changed" that says so, not a flattering example', () => {
    expect(CHANGES).toHaveLength(0);
    expect(youSaidWeChanged()).toEqual([NOTHING_YET]);
    expect(NOTHING_YET).toMatch(/Nothing has changed yet/);
  });

  it('lists a change newest first, and only if it shows its evidence', () => {
    const c = (on: string, evidence: string): Change => ({ moment: 'advising', said: 'agendas were thin.', changed: 'agendas now list your open questions.', on, evidence });
    const list = [c('2026-11-01', 'README.md'), c('2026-12-01', 'README.md')];
    const lines = youSaidWeChanged(list);
    expect(lines[0]).toContain('2026-12-01');
    expect(lines[0]).toMatch(/^You said: .* We changed: /);
    for (const x of [...CHANGES, ...list]) expect(existsSync(join(root, x.evidence)), x.evidence).toBe(true);
    expect(existsSync(join(root, 'no/such/evidence.md'))).toBe(false);
  });

  it('reads stored feedback back only as far as it can be trusted', () => {
    expect(readFeedback(null)).toBe(EMPTY);
    expect(readFeedback([])).toBe(EMPTY);
    const read = readFeedback({
      muted: true,
      answers: [
        { moment: 'advising', choice: 'thin', category: 'worked', on: '2026-10-01' }, // stored category is ignored
        { moment: 'advising', choice: 'invented', on: '2026-10-01' },
        { moment: 'nowhere', choice: 'yes', on: '2026-10-01' },
        { moment: 'ai-answer', choice: 'wrong', on: '2026-13-01' },
        { moment: 'ai-answer', choice: 'wrong', on: '2026-10-02', note: 'something typed' },
      ],
      skips: [{ moment: 'registration', on: '2026-10-03' }, { moment: 'registration', on: 'never' }, { moment: 'x', on: '2026-10-03' }],
    });
    expect(read.muted).toBe(true);
    expect(read.answers).toEqual([
      { moment: 'advising', choice: 'thin', category: 'unclear', on: '2026-10-01' }, // the moment decides the category
      { moment: 'ai-answer', choice: 'wrong', category: 'inaccurate', on: '2026-10-02' },
    ]);
    expect(Object.keys(read.answers[1]).sort()).toEqual(['category', 'choice', 'moment', 'on']);
    expect(read.skips).toEqual([{ moment: 'registration', on: '2026-10-03' }]);
    expect(readFeedback({ answers: 'x', skips: 4 })).toEqual(EMPTY);
    const many = readFeedback({ answers: Array.from({ length: KEEP + 25 }, (_, i) => ({ moment: 'advising', choice: 'yes', on: `2026-10-${String((i % 28) + 1).padStart(2, '0')}` })) });
    expect(many.answers).toHaveLength(KEEP);
  });

  it('asks nothing while muted, says why, and does not let a mute be undone by deleting answers', () => {
    const muted = setMuted(EMPTY, true);
    const why = mayAsk(muted, 'first-plan', '2026-10-01');
    expect(why.ok).toBe(false);
    expect(why.why).toMatch(/turned these questions off/);
    expect(answer(muted, 'first-plan', 'yes', '2026-10-01')).toBe(muted);
    expect(skip(muted, 'first-plan', '2026-10-01')).toBe(muted);
    const held = answer(setMuted(EMPTY, false), 'first-plan', 'yes', '2026-10-01');
    const cleared = clearFeedback(setMuted(held, true));
    expect(cleared).toEqual({ answers: [], skips: [], shown: [], muted: true });
    expect(mayAsk(setMuted(cleared, false), 'first-plan', '2026-10-01').ok).toBe(true); // the memory of asking went with the answers
  });

  it('is off unless a real state is set, and does not follow anything else', () => {
    expect(momentFeedbackFlag({})).toBe('off');
    expect(momentFeedbackFlag({ VITE_ME_MOMENT_FEEDBACK: 'nonsense' })).toBe('off');
    expect(momentFeedbackFlag({ VITE_ME_MOMENT_FEEDBACK: 'production' })).toBe('production');
    expect(momentFeedbackFlag({ VITE_INSTITUTIONAL_PREVIEW: 'true' })).toBe('off');
    expect(momentFeedbackOn('off')).toBe(false);
    expect(momentFeedbackOn('preview')).toBe(true);
  });

  it('says only what is wired: a moment names the file that asks it, the file asks it, and no other moment is asked anywhere', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const rel = `${dir}/${name}`;
        if (statSync(join(root, rel)).isDirectory()) walk(rel);
        else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) files.push(rel);
      }
    };
    walk('app/src');
    const asked = new Map<string, string[]>();
    for (const f of files) {
      for (const m of readFileSync(join(root, f), 'utf8').matchAll(/<MomentPromptSlot moment="([a-z-]+)"/g)) asked.set(m[1], [...(asked.get(m[1]) ?? []), f]);
    }
    for (const id of MOMENT_IDS) {
      const at = WIRED[id];
      if (at === null) expect(asked.get(id), `${id} is declared not wired but is asked in ${asked.get(id)}`).toBeUndefined();
      else {
        expect(existsSync(join(root, at)), `${id} is wired at ${at}, which is missing`).toBe(true);
        expect(asked.get(id), `${id} is declared at ${at} but no prompt is there`).toEqual([at]);
      }
    }
    expect(Object.values(WIRED).filter(Boolean)).toHaveLength(2);
    expect(WIRED['ai-answer']).toBe('app/src/ai/Chat.tsx');
    expect(WIRED['support-routed']).toBe('app/src/components/GetHelp.tsx');
  });

  it('asks about an answer only on the last finished one, and only when it has a source', () => {
    const chat = readFileSync(join(root, 'app/src/ai/Chat.tsx'), 'utf8');
    const at = chat.indexOf('<MomentPromptSlot moment="ai-answer" />');
    expect(at).toBeGreaterThan(0);
    expect(chat.slice(at - 120, at)).toMatch(/\(talk\.response \|\| talk\.used\.length > 0\) && $/);
    // Inside the block that is drawn only for the last turn, and only once the answer has stopped streaming.
    const before = chat.slice(0, at);
    expect(before.lastIndexOf('i === talk.turns.length - 1 && !talk.busy')).toBeGreaterThan(before.lastIndexOf('<Reply'));
  });
});
