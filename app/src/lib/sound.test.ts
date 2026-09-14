// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sounding, survives, through, type Sound } from './sound';
import { justGo, type AppTab } from './browser';

/**
 * Who owns a sound, and when it ends.
 *
 * The whole feature rests on one claim — that a tab you are not looking at
 * can still be making a noise — and on the two ways that stops being true.
 * Both are the browser's, and neither is "you switched tabs", which is the
 * case this exists to allow.
 */

const tab = (id: string, screen: 'study' | 'calendar' | 'home', extra: Partial<AppTab> = {}): AppTab => ({
  id,
  screen,
  title: screen,
  place: justGo(screen),
  ...extra,
});

const lesson = (on = 't1'): Sound => ({
  tab: on,
  place: justGo('study'),
  src: '/audio/unit-1.mp3',
  title: 'Unit 1',
  course: 'ECON 1020',
});

describe('who owns a sound', () => {
  it('plays on while you are looking at another tab — the point of all this', () => {
    const tabs = [tab('t0', 'home'), tab('t1', 'study'), tab('t2', 'calendar')];
    // The strip is on t2. The sound is t1's. Nothing about `survives` asks
    // which tab is on, and that absence is the feature.
    expect(survives(lesson(), tabs)).toEqual(lesson());
  });

  it('stops when its tab is closed', () => {
    expect(survives(lesson(), [tab('t0', 'home'), tab('t2', 'calendar')])).toBeNull();
  });

  it('stops when its tab navigates somewhere else — leaving the page', () => {
    const moved = [tab('t0', 'home'), tab('t1', 'calendar')];
    expect(survives(lesson(), moved)).toBeNull();
  });

  it('survives the tab being renamed, reordered, pinned, grouped or muted', () => {
    // None of these are leaving the page, so none of them are a reason to go
    // quiet. Muting least of all: a muted lesson is still playing.
    const dressed = [
      tab('t1', 'study', { title: 'Unit 1 — supply', pinned: true, group: 'g1', muted: true }),
      tab('t0', 'home'),
    ];
    expect(survives(lesson(), dressed)).toEqual(lesson());
  });

  it('is the same object back when nothing is wrong, so the strip does not re-render', () => {
    const one = lesson();
    expect(survives(one, [tab('t1', 'study')])).toBe(one);
  });

  it('is silence in, silence out', () => {
    expect(survives(null, [tab('t1', 'study')])).toBeNull();
  });

  it('tells two places on the same screen apart', () => {
    // Two lessons in two courses are both `study`. Leaving one for the other
    // has to stop the first, which a screen comparison would miss — this is
    // why the sound keeps the place rather than the screen name.
    const other: AppTab = {
      id: 't1',
      screen: 'study',
      title: 'Unit 4',
      place: [{ type: 'openGuide', id: 'psci-1104' } as never],
    };
    expect(survives(lesson(), [other])).toBeNull();
  });
});

describe('which tab is making the noise', () => {
  it('is the one that started it, and no other', () => {
    expect(sounding(lesson(), 't1')).toBe(true);
    expect(sounding(lesson(), 't0')).toBe(false);
  });

  it('is nobody when nothing is playing', () => {
    expect(sounding(null, 't1')).toBe(false);
  });
});

describe('how far through', () => {
  it('is a fraction, and zero before the metadata has arrived', () => {
    expect(through(30, 120)).toBe(0.25);
    expect(through(30, 0)).toBe(0);
    // A streamed file reports Infinity for its duration until it does not.
    expect(through(30, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('never leaves the rail, whatever the element reports', () => {
    expect(through(-5, 120)).toBe(0);
    expect(through(500, 120)).toBe(1);
  });
});
