/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEEPEST, readTrail, samePlace, stepped, worthKeeping, writeTrail, type Visit } from './trail';
import type { Screen } from './types';

/**
 * The record behind Semester History.
 *
 * Two things are being held here and the second is the one that will be got
 * wrong later. The first is the fold — one entry per place, moved rather than
 * stacked — which is a decision about noise and is argued in the module.
 *
 * The second is the *line*: history is where you went, activity is what
 * changed, and master spec 176 says they stay apart. Nothing in the fold
 * enforces that; what enforces it is that a `Visit` has nowhere to put a
 * change and `lib/since.ts` has nowhere to put a time. So the last two cases
 * read the source, in the manner of `screens.test.ts`, because the fault they
 * are for compiles perfectly.
 */

const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

const at = (screen: Screen, id: string, when: number): Visit => ({ screen, id, at: when });
const places = (trail: Visit[]) => trail.map((v) => `${v.screen}${v.id ? `/${v.id}` : ''}`);

describe('a place, going on the record', () => {
  it('keeps the screen, which one, and when', () => {
    const trail = stepped([], at('course', 'econ', 1_000));
    expect(trail).toEqual([{ screen: 'course', id: 'econ', at: 1_000 }]);
  });

  it('is the newest first', () => {
    let trail = stepped([], at('home', '', 1_000));
    trail = stepped(trail, at('course', 'econ', 2_000));
    expect(places(trail)).toEqual(['course/econ', 'home']);
  });

  /*
   * The whole of the fold. A tab bar is four screens one tap apart, and
   * opening a course and coming back leaves Today twice inside ten seconds —
   * so a record that stacked would be mostly its own noise.
   */
  it('moves a place you go back to rather than stacking it', () => {
    let trail = stepped([], at('home', '', 1_000));
    trail = stepped(trail, at('course', 'econ', 2_000));
    trail = stepped(trail, at('home', '', 3_000));
    expect(places(trail)).toEqual(['home', 'course/econ']);
    expect(trail[0].at).toBe(3_000);
  });

  it('counts two of one screen as two places when they name two things', () => {
    let trail = stepped([], at('course', 'econ', 1_000));
    trail = stepped(trail, at('course', 'hist', 2_000));
    expect(places(trail)).toEqual(['course/hist', 'course/econ']);
  });

  it('tells a screen that names nothing from one that names something', () => {
    expect(samePlace(at('course', 'econ', 1), at('course', 'econ', 9))).toBe(true);
    expect(samePlace(at('course', 'econ', 1), at('course', '', 1))).toBe(false);
    expect(samePlace(at('course', 'econ', 1), at('note', 'econ', 1))).toBe(false);
  });

  /*
   * Called from an effect on every navigation, so a no-op has to be free:
   * a new array each time is a re-render of anything watching the trail.
   */
  it('is the same array when nothing about the place has moved', () => {
    const trail = stepped([], at('home', '', 1_000));
    expect(stepped(trail, at('home', '', 1_000))).toBe(trail);
  });

  it('is a new one when the same place is opened at a new time', () => {
    const trail = stepped([], at('home', '', 1_000));
    expect(stepped(trail, at('home', '', 1_001))).not.toBe(trail);
  });

  it('drops the least recently opened past the cap', () => {
    let trail: Visit[] = [];
    for (let i = 0; i < DEEPEST + 10; i += 1) trail = stepped(trail, at('note', `n${i}`, i));
    expect(trail).toHaveLength(DEEPEST);
    expect(trail[0].id).toBe(`n${DEEPEST + 9}`);
    expect(trail.some((v) => v.id === 'n0')).toBe(false);
  });

  /*
   * Being sent somewhere is not going there, and this is the one screen a
   * person does not choose. Without it, "Setting up" is the top row of the
   * first history anybody ever sees.
   */
  it('does not record being set up', () => {
    expect(worthKeeping('onboarding' as Screen)).toBe(false);
    const trail = stepped([], at('onboarding' as Screen, '', 1_000));
    expect(trail).toEqual([]);
  });
});

describe('a trail off the device', () => {
  it('comes back as it was written', () => {
    const was = [at('course', 'econ', 2_000), at('home', '', 1_000)];
    expect(readTrail(writeTrail(was))).toEqual(was);
  });

  it('answers with an empty trail rather than throwing on nonsense', () => {
    expect(readTrail('not json{')).toEqual([]);
    expect(readTrail(null)).toEqual([]);
    expect(readTrail('{"screen":"home"}')).toEqual([]);
    expect(readTrail('"home"')).toEqual([]);
  });

  it('drops the entries that are not a visit and keeps the ones that are', () => {
    const raw = JSON.stringify([
      { screen: 'home', id: '', at: 3_000 },
      { screen: 'course', at: 2_000 },
      { screen: 'course', id: 'econ', at: 'Tuesday' },
      { id: 'econ', at: 2_000 },
      { screen: 'note', id: 'n1', at: 1_000 },
    ]);
    expect(places(readTrail(raw))).toEqual(['home', 'note/n1']);
  });

  /*
   * A store written by hand, or by a build whose fold was different, cannot
   * put one place in the list twice — the reader holds the same rule the
   * writer does rather than trusting what it is handed.
   */
  it('folds a place stored twice back into one', () => {
    const raw = JSON.stringify([
      { screen: 'course', id: 'econ', at: 3_000 },
      { screen: 'course', id: 'econ', at: 1_000 },
    ]);
    expect(readTrail(raw)).toEqual([at('course', 'econ', 3_000)]);
  });

  it('will not come back longer than the cap, whatever was stored', () => {
    const raw = JSON.stringify(
      Array.from({ length: DEEPEST + 50 }, (_, i) => ({ screen: 'note', id: `n${i}`, at: i })),
    );
    expect(readTrail(raw)).toHaveLength(DEEPEST);
  });

  it('keeps being set up out, on the way in as well as on the way out', () => {
    const raw = JSON.stringify([{ screen: 'onboarding', id: '', at: 1_000 }]);
    expect(readTrail(raw)).toEqual([]);
  });
});

/*
 * Master spec 162 — do not record sensitive content unnecessarily — and the
 * property that keeps it. A visit has three fields and none of them is a
 * title, a body, or a search somebody typed. The promise is the shape, so the
 * shape is what is asserted: a fourth field added in a year would compile, and
 * this is the thing that would notice.
 */
describe('what a visit is allowed to carry', () => {
  it('is a place and a time, and nothing that was on the page', () => {
    const shape = /export interface Visit \{([\s\S]*?)\n\}/.exec(src('lib/trail.ts'))?.[1] ?? '';
    expect(shape, 'the Visit interface should be findable').not.toBe('');
    const fields = [...shape.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(fields).toEqual(['screen', 'id', 'at']);
  });

  it('has no word for a title or a body anywhere in the record', () => {
    const body = src('lib/trail.ts').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    expect(body).not.toMatch(/\b(title|body|text|query|content|name)\b/i);
  });
});

/*
 * And master spec 176's line, which nothing in either module's logic enforces.
 *
 * `lib/since.ts` is what changed; this is where you went. Both are lists with
 * a screen in them, which is exactly why they are one careless import away
 * from becoming one list with two meanings — the fault `lib/onehome.test.ts`
 * exists for, arrived at from a new direction.
 */
describe('history and activity stay two things', () => {
  it('keeps the trail from knowing what changed', () => {
    expect(src('lib/trail.ts')).not.toMatch(/from '\.\/since'/);
    expect(src('lib/trail.hook.ts')).not.toMatch(/from '\.\/since'/);
  });

  it('keeps what changed from knowing where you went', () => {
    expect(src('lib/since.ts')).not.toMatch(/from '\.\/trail/);
  });

  it('leaves since.ts saying the half that binds it', () => {
    // If this sentence goes, the reason the two are separate goes with it.
    expect(src('lib/since.ts')).toContain('It does not list what *you* did');
  });
});
