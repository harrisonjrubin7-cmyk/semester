import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BAND,
  chapterText,
  chaptersOf,
  explainerTitle,
  hookEnd,
  hookQuestions,
  HOOK_MAX,
  HOOK_MIN,
  mmss,
  planExplainer,
  runWithin,
  timeline,
  UNIT_GAP,
  unitsOf,
  type Plan,
  type PlannedUnit,
  type Refused,
  type SourceUnit,
} from '../../../pipeline/explainer.mjs';

/**
 * A run of a course's units, assembled into one YouTube-length video.
 *
 * Nothing here is synthesised: the audio is the unit MP3s the app already
 * serves, the cues are those units' own cues offset onto one timeline, and the
 * chapter marks are the unit boundaries — known exactly, because the durations
 * are. What can go wrong is therefore all arithmetic, and arithmetic is what
 * goes wrong quietly: a timeline off by the beat between units puts every
 * chapter mark after the first in the wrong place and still looks like a list
 * of plausible numbers.
 *
 * The guard lives here because `pipeline/explainer.mjs` is pure and this is
 * where CI runs — the arrangement `restyle.test.ts`, `align.test.ts` and
 * `broll.test.ts` already use.
 */

const LESSONS = join('..', 'app', 'public', 'audio', 'lessons');

const unit = (n: number, seconds: number, cues: { at: number; kind: string; text: string }[] = []) => ({
  unit: n,
  title: `Unit ${n}`,
  file: `/audio/lessons/x/unit-${n}.mp3`,
  seconds,
  len: mmss(seconds),
  cues,
});

/**
 * The plan, or a failed assertion saying why there isn't one.
 *
 * `planExplainer` returns a union and every test below wants the built half.
 * Narrowing it here rather than casting at each use means a refusal fails as a
 * refusal — with its own reason printed — instead of as `undefined is not an
 * object` fifteen lines later.
 */
const planned = (result: Plan | Refused, label = ''): Plan => {
  expect(result.why, label).toBeUndefined();
  return result as Plan;
};

const qa = (at: number, n: number) => [
  { at, kind: 'q', text: `Question ${n}?` },
  { at: at + 3, kind: 'a', text: `Answer ${n}.` },
];

describe('reading the units out of lessons.json', () => {
  it('orders them as numbers, not as strings', () => {
    /*
     * A live trap rather than a hypothetical: ECON has eleven units, so its
     * keys are "0" through "10", and the default sort puts "10" between "1"
     * and "2". That would play unit 10 third and hand every chapter after it
     * the wrong mark — with no error anywhere, because a list of eleven units
     * in the wrong order is still a list of eleven units.
     */
    const lessons = Object.fromEntries([0, 1, 2, 10].map((n) => [String(n), unit(n, 60)]));
    expect(unitsOf(lessons).map((u: SourceUnit) => u.unit)).toEqual([0, 1, 2, 10]);
  });
});

describe('choosing the run', () => {
  const units = Array.from({ length: 10 }, (_, i) => unit(i, 120));

  it('counts the beat between units, not just the narration', () => {
    // Seven units of 120s is 840s of speech and 844.8s of video. Ignoring the
    // gaps is how a run creeps over the ceiling it was measured against.
    const seven = runWithin(units, 0, { min: 0, max: 900 }).units.length;
    expect(runWithin(units, 0, { min: 0, max: 840 }).seconds).toBe(6 * 120 + 5 * UNIT_GAP);
    expect(seven).toBe(7);
    expect(runWithin(units, 0, { min: 0, max: 900 }).seconds).toBeCloseTo(7 * 120 + 6 * UNIT_GAP, 5);
  });

  it('says how many it left behind', () => {
    expect(runWithin(units, 0, { min: 0, max: 900 }).left).toBe(3);
    expect(runWithin(units, 0, { min: 0, max: 100_000 }).left).toBe(0);
  });

  it('starts where it is told to', () => {
    const run = runWithin(units, 4, { min: 0, max: 400 });
    expect(run.units[0].unit).toBe(4);
    expect(run.left).toBe(10 - 4 - run.units.length);
  });

  it('returns nothing when the first unit alone is over the ceiling', () => {
    expect(runWithin([unit(0, 1200)], 0, { min: 0, max: 900 }).units).toEqual([]);
  });
});

describe('laying the units on one timeline', () => {
  const units = [unit(0, 100, qa(10, 1)), unit(1, 50, qa(5, 2)), unit(2, 30, qa(1, 3))];

  it('offsets each unit by everything before it and the beats between', () => {
    const laid = timeline(units);
    expect(laid.units.map((u: PlannedUnit) => u.at)).toEqual([0, 100 + UNIT_GAP, 150 + 2 * UNIT_GAP]);
    expect(laid.seconds).toBeCloseTo(180 + 2 * UNIT_GAP, 5);
  });

  it('re-addresses every cue to the whole video, and remembers which unit it came from', () => {
    const laid = timeline(units);
    const second = laid.cues.filter((c: { unit: number }) => c.unit === 1);
    expect(second[0].at).toBeCloseTo(100 + UNIT_GAP + 5, 5);
    expect(laid.cues.map((c: { at: number }) => c.at)).toEqual(
      [...laid.cues].sort((a, b) => a.at - b.at).map((c) => c.at),
    );
  });

  it('leaves the source cue times alone', () => {
    // `timeline` copies rather than edits: the same `lessons.json` object is
    // read by the app and by `shorts.py`, and a mutated cue is a short cut
    // from the wrong second.
    const before = JSON.stringify(units);
    timeline(units);
    expect(JSON.stringify(units)).toBe(before);
  });
});

describe('the hook', () => {
  it('ends on a cue rather than on the number', () => {
    /*
     * So the cut from the hook to the first slide lands where a sentence
     * starts instead of halfway through one. ECON's unit 0 has cues at 0,
     * 5.19 and 8.92 inside the first fifteen seconds, so the hook is the
     * title and the first question and the cut happens as the answer begins.
     */
    expect(hookEnd([{ at: 0 }, { at: 5.19 }, { at: 8.92 }, { at: 24.56 }])).toBe(8.92);
  });

  it('never runs past fifteen seconds, which is what the roadmap asks for', () => {
    expect(HOOK_MAX).toBe(15);
    expect(hookEnd([{ at: 0 }, { at: 14.9 }, { at: 15.1 }])).toBe(14.9);
  });

  it('never ends before the floor, so it cannot become a title card', () => {
    expect(HOOK_MIN).toBe(5);
    expect(hookEnd([{ at: 0 }, { at: 1 }, { at: 2 }])).toBe(HOOK_MIN);
    expect(hookEnd([])).toBe(HOOK_MIN);
  });

  it('promises what comes later, never what is being said underneath it', () => {
    /*
     * The opening narration is already asking and answering something. A hook
     * that listed the question being answered under it would be reading the
     * viewer their own subtitles.
     */
    const units = [unit(0, 60, qa(1, 0)), unit(1, 60, qa(1, 1)), unit(2, 60, qa(1, 2))];
    const asked = hookQuestions(units);
    expect(asked).not.toContain('Question 0?');
    expect(asked).toEqual(['Question 1?', 'Question 2?']);
  });

  it('spreads across the whole run rather than its first minute', () => {
    const units = Array.from({ length: 9 }, (_, i) => unit(i, 60, qa(1, i)));
    const asked = hookQuestions(units, 3);
    expect(asked).toHaveLength(3);
    // First and last of the later units, and one from the middle.
    expect(asked[0]).toBe('Question 1?');
    expect(asked[2]).toBe('Question 8?');
  });

  it('takes fewer than asked for when there are fewer to take', () => {
    expect(hookQuestions([unit(0, 60, qa(1, 0)), unit(1, 60, qa(1, 1))], 4)).toEqual(['Question 1?']);
    expect(hookQuestions([unit(0, 60, qa(1, 0))], 4)).toEqual([]);
  });
});

describe('the chapter list', () => {
  it('starts at 0:00, which YouTube requires', () => {
    const laid = timeline([unit(0, 100), unit(1, 50)]);
    const marks = chaptersOf(laid.units);
    expect(marks[0].t).toBe('0:00');
    expect(chapterText(marks).split('\n')[0]).toBe('0:00 Unit 0');
  });

  it('writes a line per unit, in order', () => {
    const laid = timeline([unit(0, 100), unit(1, 50), unit(2, 30)]);
    expect(chapterText(chaptersOf(laid.units)).split('\n')).toHaveLength(3);
  });
});

describe('what the video is called', () => {
  it('does not repeat the course code the frame already draws', () => {
    // The first cut returned "CORE 2500 — units 1–2" under a "CORE 2500"
    // kicker, so the code was on screen twice. `Documentary.tsx` has a
    // `withoutCode` for exactly this; not writing it is cheaper.
    expect(explainerTitle('Sports, Culture, and Society', { from: 0, to: 1, left: 4 })).not.toContain(
      'CORE',
    );
  });

  it('names the range only when something was left out', () => {
    expect(explainerTitle('Thinking at the Margin', { from: 0, to: 10, left: 0 })).toBe(
      'Thinking at the Margin',
    );
    expect(explainerTitle('Thinking at the Margin', { from: 0, to: 9, left: 1 })).toContain(
      'units 1–10',
    );
  });
});

describe('planning one, and refusing to', () => {
  it('refuses a course with no units, and a unit that is not there', () => {
    expect(planExplainer({}).why).toContain('no units');
    expect(planExplainer({ 0: unit(0, 60) }, { from: 3 }).why).toContain('no unit 3');
  });

  it('refuses when the first unit alone is over the ceiling, and says how long it is', () => {
    const why = planExplainer({ 0: unit(0, 1200) }).why;
    expect(why).toContain('20:00');
    expect(why).toContain('15:00');
  });

  it('flags a run under the floor without refusing it', () => {
    /*
     * The ceiling is what the format cannot exceed. The floor is advice about
     * whether a video is worth making, and a course with four short units is
     * allowed to have a six-minute explainer.
     */
    const plan = planned(planExplainer({ 0: unit(0, 60), 1: unit(1, 60) }));
    expect(plan.short).toBe(true);
    expect(plan.seconds).toBeLessThan(BAND.min);
  });

  it('takes an explicit range over the arithmetic', () => {
    const lessons = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [String(i), unit(i, 60)]));
    const plan = planned(planExplainer(lessons, { from: 1, to: 3 }));
    expect(plan.units.map((u: PlannedUnit) => u.unit)).toEqual([1, 2, 3]);
    expect(plan.left).toBe(2);
  });
});

describe('the four courses in the repository', () => {
  const courses = readdirSync(LESSONS).filter((c) => !c.includes('.'));

  it('has more than one, so this rule has something to hold', () => {
    expect(courses.length).toBeGreaterThan(1);
  });

  for (const course of courses) {
    it(`plans ${course} inside the band, with marks that line up`, () => {
      const lessons = JSON.parse(readFileSync(join(LESSONS, course, 'lessons.json'), 'utf8'));
      const plan = planned(planExplainer(lessons), course);

      // The ceiling is the hard edge and it is the reason a run is truncated.
      expect(plan.seconds, course).toBeLessThanOrEqual(BAND.max);
      expect(plan.short, course).toBe(false);

      // Every mark is a unit boundary, in order, inside the video.
      expect(plan.chapters[0].t, course).toBe('0:00');
      const marks = plan.chapters.map((c: { at: number }) => c.at);
      expect(marks, course).toEqual([...marks].sort((a, b) => a - b));
      expect(Math.max(...marks), course).toBeLessThan(plan.seconds);

      // And every cue lands inside the unit it came from.
      for (const cue of plan.cues) {
        const home = plan.units.find((u: PlannedUnit) => u.unit === cue.unit)!;
        expect(cue.at, `${course} unit ${cue.unit}`).toBeGreaterThanOrEqual(home.at);
        expect(cue.at, `${course} unit ${cue.unit}`).toBeLessThanOrEqual(home.at + home.seconds);
      }

      expect(plan.hook.until, course).toBeLessThanOrEqual(HOOK_MAX);
      expect(plan.hook.questions.length, course).toBeGreaterThan(0);
    });
  }
});

describe('saying a length', () => {
  it('writes it the way every other file here does', () => {
    expect(mmss(0)).toBe('0:00');
    expect(mmss(8.92)).toBe('0:08');
    expect(mmss(828)).toBe('13:48');
  });
});
