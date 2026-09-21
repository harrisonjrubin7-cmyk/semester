import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  check,
  checkAll,
  draftShots,
  SHOT_KIND_IDS,
  SHOT_MAX,
  SHOT_MIN,
  SHOT_SECONDS,
  shotJobs,
  shotPrompt,
  SUBJECT_MAX,
  withinCeiling,
  type Shot,
} from '../../../pipeline/broll.mjs';
import { BROLL_FADE, shotAt } from '../../../video/src/broll';

/**
 * What the documentary's B-roll is allowed to ask a provider for.
 *
 * The failure this exists to prevent is specific and it was already in the
 * code: `render-documentary.mjs` built its clip jobs with `prompt: c.name`, so
 * the fourteen clips it priced for ECON would have been generated from "Cold
 * open", "Optimisation and opportunity cost" and "The formula sheet". None of
 * those is a thing a camera can point at, the estimate would have looked
 * exactly like a good one, and the money is real.
 *
 * So a shot list is drafted blank and nothing prices or buys one with blanks
 * in it. The guard lives here because `pipeline/broll.mjs` and
 * `video/src/broll.ts` are both pure and this is where CI runs.
 */

const CHAPTERS = join('..', 'audio', 'scripts');
const SHOTS = join('..', 'video', 'shots');

const episode = (chapters: { s: number; name: string }[]) => ({
  course: 'econ',
  chapters: chapters.map((c) => ({ ...c, t: '0:00' })),
});

const shot = (over: Partial<Shot> = {}): Shot => ({
  slot: 'econ/chapter-0',
  at: 0,
  seconds: SHOT_SECONDS,
  kind: 'establishing',
  chapter: 'Supply, demand, equilibrium',
  subject: 'a queue outside a food truck at noon',
  ...over,
});

describe('drafting a shot list', () => {
  const drafted = draftShots(
    episode([
      { s: 0, name: 'Cold open' },
      { s: 35, name: 'How to actually pass' },
    ]),
  );

  it('lands a shot on the second each chapter does', () => {
    // The same second the lower third animates on, which is what makes the
    // cut read as one event rather than two.
    expect(drafted.map((s: Shot) => s.at)).toEqual([0, 35]);
  });

  it('leaves every subject blank, which is the whole point', () => {
    expect(drafted.every((s: Shot) => s.subject === '')).toBe(true);
    expect(checkAll(drafted)).toHaveLength(2);
    for (const problem of checkAll(drafted)) expect(problem.why).toContain('no subject yet');
  });

  it('carries the chapter name so somebody knows what they are writing for', () => {
    expect(drafted.map((s: Shot) => s.chapter)).toEqual(['Cold open', 'How to actually pass']);
  });
});

describe('what a shot is allowed to be of', () => {
  it('refuses the chapter title pasted across', () => {
    /*
     * The lazy path, and the likeliest one: the name is right there in the
     * file, it is the wrong thing, and it is exactly what the code did before
     * a shot list existed.
     */
    expect(check(shot({ subject: 'Supply, demand, equilibrium' }))[0]).toContain("chapter's own title");
    expect(check(shot({ subject: 'supply, demand, EQUILIBRIUM' }))[0]).toContain("chapter's own title");
  });

  it('refuses what a video model renders as convincing nonsense', () => {
    /*
     * Not squeamishness about text. This frame already carries the real
     * chapter card and the real captions, typeset from the script — so a
     * generated whiteboard beside them is not "a slightly wrong graph", it is
     * one frame holding the course's actual words and a fake version of them.
     */
    for (const subject of [
      'a whiteboard covered in equations',
      'a newspaper on a café table',
      'a chart of rising prices',
      'a lecture slide about elasticity',
      'a street sign at a junction',
    ]) {
      expect(check(shot({ subject })), subject).toEqual([expect.stringContaining('nonsense')]);
    }
  });

  it('refuses a subject that points at somebody', () => {
    // The same rule `personas.mjs` enforces on an appearance note, out of the
    // same module: §7 is about free text reaching a generative model, not
    // about personas.
    expect(check(shot({ subject: 'a lecturer who looks like a famous economist' }))[0]).toContain(
      'points at somebody',
    );
  });

  it('refuses a shot that has become a screenplay', () => {
    expect(check(shot({ subject: 'x'.repeat(SUBJECT_MAX + 1) }))[0]).toContain('one thing');
    expect(check(shot({ subject: 'x'.repeat(SUBJECT_MAX) }))).toEqual([]);
  });

  it('holds the length to something that reads and does not take over', () => {
    expect(check(shot({ seconds: SHOT_MIN - 1 }))[0]).toContain('outside');
    expect(check(shot({ seconds: SHOT_MAX + 1 }))[0]).toContain('outside');
    expect(check(shot({ seconds: SHOT_MIN }))).toEqual([]);
    expect(check(shot({ seconds: SHOT_MAX }))).toEqual([]);
  });

  it('refuses a treatment that is not one of the three', () => {
    expect(check(shot({ kind: 'drone-fly-through' }))[0]).toContain('kind');
    for (const kind of SHOT_KIND_IDS) expect(check(shot({ kind })), kind).toEqual([]);
  });

  it('accepts the shots somebody would actually write', () => {
    for (const subject of [
      'an empty lecture hall before dawn',
      'crates of fruit being stacked at a market stall',
      'a ferry crossing at dusk',
    ]) {
      expect(check(shot({ subject })), subject).toEqual([]);
    }
  });
});

describe('the prompt a provider would be given', () => {
  it('carries the subject, the treatment and the refusals', () => {
    const prompt = shotPrompt(shot());
    expect(prompt).toContain('a queue outside a food truck at noon');
    expect(prompt).toContain('wide, static, eye level');
    // Not optional, and not left to whoever writes the subject: every one of
    // these is a thing the frame already draws properly.
    expect(prompt).toMatch(/no text, no writing, no signage, no logos, no charts/i);
    expect(prompt).toMatch(/no identifiable real person/i);
  });

  it('says the same thing twice, so a bought clip is not bought again', () => {
    expect(shotPrompt(shot())).toBe(shotPrompt(shot()));
  });

  it('prices as video, not as a still', () => {
    const [job] = shotJobs([shot()], 'someprovider', 'somemodel');
    expect(job.seconds).toBe(SHOT_SECONDS);
    expect(job.slot).toBe('econ/chapter-0');
  });
});

describe('the ceiling', () => {
  /*
   * The third guardrail, and the one §7 does not ask for. The manifest stops a
   * second run paying for the first run's clips; a `--dry-run` shows the cost
   * to whoever reads it. Neither stops a run that is correctly priced,
   * correctly deduplicated and four hundred dollars because somebody added a
   * shot every thirty seconds.
   */
  it('lets a run through at or under the number', () => {
    expect(withinCeiling(840, 1000).ok).toBe(true);
    expect(withinCeiling(840, 840).ok).toBe(true);
  });

  it('refuses a cent over, and says by how much', () => {
    const verdict = withinCeiling(841, 840);
    expect(verdict.ok).toBe(false);
    expect(verdict.over).toBe(1);
  });

  it('refuses a run with no ceiling at all, rather than treating that as unlimited', () => {
    expect(withinCeiling(1, undefined as unknown as number).ok).toBe(false);
    expect(withinCeiling(0, Number.POSITIVE_INFINITY).ok).toBe(false);
  });
});

describe('which insert is on screen', () => {
  const shots = [
    { at: 10, seconds: 6, file: '/video/broll/econ/chapter-0.mp4' },
    { at: 100, seconds: 6, file: '/video/broll/econ/chapter-1.mp4' },
  ];

  it('shows nothing before, between and after', () => {
    expect(shotAt(shots, 9.9)).toBeUndefined();
    expect(shotAt(shots, 16)).toBeUndefined();
    expect(shotAt(shots, 50)).toBeUndefined();
    expect(shotAt(shots, 200)).toBeUndefined();
    expect(shotAt([], 12)).toBeUndefined();
  });

  it('fades in and out symmetrically, and is fully up in between', () => {
    // Literal seconds rather than `10 + BROLL_FADE`, which is the expression
    // the function evaluates and would agree with itself at any fade at all.
    expect(BROLL_FADE).toBe(0.5);
    expect(shotAt(shots, 10)!.opacity).toBe(0);
    expect(shotAt(shots, 10.25)!.opacity).toBeCloseTo(0.5, 5);
    expect(shotAt(shots, 10.5)!.opacity).toBe(1);
    expect(shotAt(shots, 13)!.opacity).toBe(1);
    expect(shotAt(shots, 15.5)!.opacity).toBe(1);
    expect(shotAt(shots, 15.75)!.opacity).toBeCloseTo(0.5, 5);
    expect(shotAt(shots, 15.99)!.opacity).toBeCloseTo(0.02, 2);
  });

  it('never goes over 1, even when a shot is shorter than two fades', () => {
    const brief = [{ at: 0, seconds: 0.4, file: 'a.mp4' }];
    for (let t = 0; t < 0.4; t += 0.02) {
      const o = shotAt(brief, t)!.opacity;
      expect(o, `at ${t.toFixed(2)}`).toBeGreaterThanOrEqual(0);
      expect(o, `at ${t.toFixed(2)}`).toBeLessThanOrEqual(1);
    }
  });

  it('shows the earlier of two that were edited into overlapping', () => {
    const overlapping = [
      { at: 10, seconds: 6, file: 'first.mp4' },
      { at: 12, seconds: 6, file: 'second.mp4' },
    ];
    expect(shotAt(overlapping, 13)!.shot.file).toBe('first.mp4');
  });
});

describe('the shot lists in the repository', () => {
  const lists = existsSync(SHOTS) ? readdirSync(SHOTS).filter((f) => f.endsWith('.json')) : [];

  it('has one for every course with an episode', () => {
    const courses = readdirSync(CHAPTERS)
      .filter((f) => f.endsWith('.chapters.json'))
      .map((f) => JSON.parse(readFileSync(join(CHAPTERS, f), 'utf8')).course)
      .sort();
    expect(lists.map((f) => f.replace('.json', '')).sort()).toEqual(courses);
  });

  it('has a shot on every chapter mark, at the second it was measured at', () => {
    /*
     * Read out of the chapter files rather than restated. A shot list that
     * drifted from the marks would put an insert somewhere no chapter starts,
     * and the failure would be a clip fading up mid-sentence rather than an
     * error.
     */
    for (const file of lists) {
      const list = JSON.parse(readFileSync(join(SHOTS, file), 'utf8'));
      const meta = JSON.parse(
        readFileSync(join(CHAPTERS, `${marksFor(list.course)}.chapters.json`), 'utf8'),
      );
      expect(list.shots.map((s: Shot) => s.at), list.course).toEqual(
        meta.chapters.map((c: { s: number }) => c.s),
      );
      expect(list.shots.map((s: Shot) => s.chapter), list.course).toEqual(
        meta.chapters.map((c: { name: string }) => c.name),
      );
    }
  });

  it('has every written subject passing the rules it was written under', () => {
    /*
     * ECON is written; the other three are not. That asymmetry is the point
     * of this test rather than an accident of it — the first course through
     * is where a subject that does not survive `check` would show up, and
     * "all four are blank" would have gone on passing whatever anybody wrote.
     *
     * A list is either wholly blank or wholly written. A half-filled one is
     * somebody interrupted, and it is worth failing on rather than shipping:
     * `broll-shots.mjs` refuses to price it anyway, so a half-filled list in
     * the repository is a list nobody can use and nothing says why.
     */
    for (const file of lists) {
      const list = JSON.parse(readFileSync(join(SHOTS, file), 'utf8'));
      const problems = checkAll(list.shots).length;
      expect(problems === 0 || problems === list.shots.length, `${file} is half-filled`).toBe(true);
    }
  });

  it('still has courses nobody has written yet, and says which', () => {
    // The state of the work, asserted. When the last one is filled in, this
    // is the line that tells whoever did it to retire this test rather than
    // weaken it.
    const blank = lists.filter((file) => {
      const list = JSON.parse(readFileSync(join(SHOTS, file), 'utf8'));
      return checkAll(list.shots).length === list.shots.length;
    });
    expect(blank.sort()).toEqual(['bus.json', 'core.json', 'psci.json']);
  });
});

/** `econ` → `econ1020`, by asking the chapter files rather than guessing. */
function marksFor(course: string): string {
  const file = readdirSync(CHAPTERS)
    .filter((f) => f.endsWith('.chapters.json'))
    .find((f) => JSON.parse(readFileSync(join(CHAPTERS, f), 'utf8')).course === course);
  if (!file) throw new Error(`no chapter marks for ${course}`);
  return file.replace('.chapters.json', '');
}
