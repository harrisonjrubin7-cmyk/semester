import { describe, expect, it } from 'vitest';
import { shiftIso } from './date';
import {
  EMPTY_RESETS,
  HELP_TEXT,
  PROMPT_IDS,
  PROMPT_TEXT,
  STEPS,
  STEP_TEXT,
  advance,
  answerPrompt,
  back,
  busyDays,
  choosePicks,
  chooseHelp,
  currentStep,
  placeStudyBlocks,
  readResets,
  resume,
  rollForward,
  setShared,
  shareable,
  skip,
  startReflection,
  startReset,
  summary,
  withoutReflections,
} from './weekly-reset';

// Sunday 27 September 2026.
const WEEK = '2026-09-27';
const SHAME = /at risk|fail|behind|overdue|late\b|missed|streak|lazy|should have|falling/i;

describe('steps', () => {
  it('walks the five steps in order and stops at the end', () => {
    let r = startReset(WEEK);
    const seen: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      seen.push(currentStep(r));
      r = advance(r);
    }
    expect(seen).toEqual([...STEPS, null, null]);
    expect(r.step).toBe(STEPS.length);
    expect(back(r).step).toBe(STEPS.length - 1);
    expect(back(startReset(WEEK)).step).toBe(0);
  });

  it('can be skipped from every step, changing nothing but the flag', () => {
    let r = choosePicks(startReset(WEEK), { academic: 'Finish the lab report' });
    for (let i = 0; i <= STEPS.length; i++) {
      const s = skip(r);
      expect(s).toEqual({ ...r, skipped: true });
      expect(s.picks).toEqual(r.picks);
      expect(s.step).toBe(r.step);
      r = advance(r);
    }
  });

  it('keeps no count, run or last-done date to turn into a streak', () => {
    const keys = Object.keys(startReset(WEEK)).sort();
    expect(keys).toEqual(['help', 'picks', 'skipped', 'step', 'weekStart']);
    expect(Object.keys(EMPTY_RESETS).sort()).toEqual(['reflections', 'resets', 'version']);
  });

  it('can be picked up again after skipping', () => {
    const r = skip(advance(startReset(WEEK)));
    expect(resume(r)).toEqual({ ...r, skipped: false });
  });

  it('trims and caps picks, and leaves an unchosen pick as it was', () => {
    let r = choosePicks(startReset(WEEK), { academic: '  Read ch. 4  ', practical: 'x'.repeat(900) });
    expect(r.picks.academic).toBe('Read ch. 4');
    expect(r.picks.practical).toHaveLength(500);
    r = choosePicks(r, { support: 'Tutoring' });
    expect(r.picks.academic).toBe('Read ch. 4');
  });
});

describe('summary', () => {
  it('lists only what was chosen, with no gaps flagged', () => {
    const r = chooseHelp(choosePicks(startReset(WEEK), { academic: 'Lab report', support: 'Writing center' }), 'tutoring');
    expect(summary(r)).toEqual([
      'Academic: Lab report',
      'Personal support: Writing center',
      `Help to ask for: ${HELP_TEXT.tutoring.label}`,
    ]);
  });

  it('says a skipped reset is a plain choice', () => {
    const lines = summary(skip(startReset(WEEK)));
    expect(lines).toEqual(['You set this one aside. Nothing is waiting on it.']);
  });

  it('uses no blame words anywhere the student reads', () => {
    const copy = [
      ...Object.values(STEP_TEXT).flatMap((s) => [s.title, s.prompt]),
      ...Object.values(HELP_TEXT).flatMap((h) => [h.label, h.note]),
      ...Object.values(PROMPT_TEXT),
      ...summary(skip(startReset(WEEK))),
      ...summary(skip(choosePicks(startReset(WEEK), { academic: 'a' }))),
      ...summary(startReset(WEEK)),
      rollForward([{ id: 'a', title: 'A' }], WEEK).line,
      rollForward([], WEEK).line,
      ...busyDays([1, 2, 3].map((n) => ({ day: '2026-09-30', title: `T${n}` }))).map((b) => b.line),
    ];
    for (const line of copy) expect(line).not.toMatch(SHAME);
  });
});

describe('placeStudyBlocks', () => {
  const fixed = [
    { day: '2026-09-28', startMin: 9 * 60, endMin: 15 * 60, label: 'Classes' },
    { day: '2026-09-29', startMin: 10 * 60, endMin: 12 * 60, label: 'Shift' },
  ];

  it('places blocks only in gaps, clear of every commitment', () => {
    const blocks = placeStudyBlocks(WEEK, fixed, { blocks: 5, minutes: 90 });
    expect(blocks).toHaveLength(5);
    for (const b of blocks) {
      for (const c of fixed.filter((f) => f.day === b.day)) {
        expect(b.startMin + b.minutes <= c.startMin || b.startMin >= c.endMin).toBe(true);
      }
      expect(b.startMin).toBeGreaterThanOrEqual(9 * 60);
      expect(b.startMin + b.minutes).toBeLessThanOrEqual(21 * 60);
    }
  });

  it('spreads blocks over different days before doubling up', () => {
    const blocks = placeStudyBlocks(WEEK, fixed, { blocks: 7, minutes: 60 });
    expect(new Set(blocks.map((b) => b.day)).size).toBe(7);
  });

  it('gives fewer blocks, not an overlap, when the week has no room', () => {
    const full = Array.from({ length: 7 }, (_, i) => ({ day: shiftIso(WEEK, i), startMin: 9 * 60, endMin: 21 * 60, label: 'Away' }));
    expect(placeStudyBlocks(WEEK, full, { blocks: 3, minutes: 60 })).toEqual([]);
  });

  it('keeps a break after a commitment', () => {
    const [b] = placeStudyBlocks(WEEK, [{ day: WEEK, startMin: 9 * 60, endMin: 10 * 60, label: 'x' }], { blocks: 1, minutes: 60 });
    expect(b.day).toBe(WEEK);
    expect(b.startMin).toBe(10 * 60 + 15);
  });
});

describe('busyDays', () => {
  const ds = (day: string, n: number) => Array.from({ length: n }, (_, i) => ({ day, title: `${day}#${i}` }));

  it('names a day with three deadlines and asks, in the spec words', () => {
    // 30 September 2026 is a Wednesday.
    const [b] = busyDays(ds('2026-09-30', 3));
    expect(b.line).toBe('Wednesday has three deadlines. Start two actions earlier?');
    expect(b.startEarly).toBe(2);
  });

  it('is silent for two and singular for a threshold of two', () => {
    expect(busyDays(ds('2026-09-30', 2))).toEqual([]);
    expect(busyDays(ds('2026-09-30', 2), 2)[0].line).toBe('Wednesday has two deadlines. Start one action earlier?');
  });

  it('reports days in date order', () => {
    const r = busyDays([...ds('2026-10-02', 3), ...ds('2026-09-29', 4)]);
    expect(r.map((b) => b.day)).toEqual(['2026-09-29', '2026-10-02']);
  });
});

describe('rollForward', () => {
  it('carries the same items to the next week unchanged', () => {
    const src = [{ id: 'a', title: 'Chapter 4 notes' }];
    const c = rollForward(src, WEEK);
    expect(c.weekStart).toBe('2026-10-04');
    expect(c.items).toEqual(src);
    expect(c.items[0]).not.toBe(src[0]);
  });
});

describe('reflection', () => {
  const written = () =>
    PROMPT_IDS.reduce((r, id) => answerPrompt(r, id, `answer ${id}`), startReflection(WEEK));

  it('has the five prompts', () => {
    expect(PROMPT_IDS).toHaveLength(5);
    expect(Object.values(PROMPT_TEXT)).toEqual([
      'What did you finish?',
      'What was harder than you expected?',
      'What do you want to change next week?',
      'What evidence is worth keeping?',
      'What do you want to carry into next term?',
    ]);
  });

  it('starts private and unshared', () => {
    const r = startReflection(WEEK, 'term');
    expect(r.private).toBe(true);
    expect(r.shared).toBe(false);
  });

  it('shares nothing until the student sets it, and takes it back', () => {
    const r = written();
    expect(shareable(r)).toBeNull();
    const s = shareable(setShared(r, true));
    expect(s?.answers.finished).toBe('answer finished');
    expect(s).not.toHaveProperty('private');
    expect(shareable(setShared(setShared(r, true), false))).toBeNull();
  });

  it('shares a copy, so a later edit does not change what was shared', () => {
    const r = setShared(written(), true);
    const s = shareable(r)!;
    const later = answerPrompt(r, 'finished', 'changed');
    expect(s.answers.finished).toBe('answer finished');
    expect(shareable(later)!.answers.finished).toBe('changed');
  });

  it('is emptied for a backup', () => {
    const lib = { ...EMPTY_RESETS, reflections: [setShared(written(), true)] };
    const out = withoutReflections(lib);
    expect(JSON.stringify(out)).not.toMatch(/answer /);
    expect(out.reflections[0].shared).toBe(false);
    expect(out.reflections[0].private).toBe(true);
  });

  it('exports no function that sends a reflection anywhere', async () => {
    const mod = await import('./weekly-reset');
    const names = Object.keys(mod).filter((k) => typeof (mod as Record<string, unknown>)[k] === 'function');
    expect(names.filter((n) => /export|send|upload|submit|publish|sync/i.test(n))).toEqual([]);
  });
});

describe('readResets', () => {
  const good = () => ({
    version: 1,
    resets: [skip(startReset(WEEK))],
    reflections: [written()],
  });
  const written = () => answerPrompt(startReflection(WEEK), 'finished', 'x');

  it('round-trips a valid library', () => {
    expect(readResets(JSON.parse(JSON.stringify(good())))).toEqual(good());
  });

  it('refuses a reflection stored as not private rather than repairing it', () => {
    const g = JSON.parse(JSON.stringify(good()));
    g.reflections[0].private = false;
    expect(() => readResets(g)).toThrow(/not valid/);
  });

  it('refuses malformed records', () => {
    for (const mutate of [
      (g: any) => (g.version = 2),
      (g: any) => (g.resets[0].step = 9),
      (g: any) => (g.resets[0].weekStart = 'Sunday'),
      (g: any) => (g.resets[0].help = 'pizza'),
      (g: any) => g.resets.push(g.resets[0]),
      (g: any) => delete g.reflections[0].answers.carry,
    ]) {
      const g = JSON.parse(JSON.stringify(good()));
      mutate(g);
      expect(() => readResets(g)).toThrow();
    }
    expect(() => readResets(null)).toThrow();
  });
});
