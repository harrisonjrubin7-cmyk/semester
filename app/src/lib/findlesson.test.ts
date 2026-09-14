import { describe, expect, it } from 'vitest';
import { findEverything } from './find';
import { actionsFor, landingOf } from './openhit';
import { buildCatalog } from '../data/catalog';
import ECON from '../data/courses/econ';
import type { Hit } from './find';

/**
 * The narrated lessons, found.
 *
 * They were the one substantial thing in this app you could not search for.
 * Thirty of them, several minutes each, and the only route in was: open the
 * course, open the guide, find the unit, press Lesson. Meanwhile the cards of
 * that same unit were one query away.
 *
 * It also unblocked something else. The search overlay marks a result you
 * already have open (`tabAt`), and a lesson is the only kind of result that
 * lands on a place which can be *playing* — so the speaker on that row, which
 * had nowhere to appear, has somewhere now.
 */

const cat = buildCatalog([ECON]);
const lessons = (q: string): Extract<Hit, { kind: 'lesson' }>[] =>
  findEverything(cat, new Date(), q, [], [])
    .flatMap((g) => g.hits)
    .filter((h): h is Extract<Hit, { kind: 'lesson' }> => h.kind === 'lesson');

describe('finding a lesson', () => {
  it('finds one by its title', () => {
    expect(lessons('elasticity').map((h) => h.title)).toContain('Surplus & elasticity');
  });

  it('finds one by what the narration actually says', () => {
    // The cues are the transcript, so a lesson is findable by the thing it
    // explains rather than only by the words somebody put in its title.
    const said = lessons('opportunity cost');
    expect(said.length).toBeGreaterThan(0);
  });

  it('says which course, and how long it runs', () => {
    const [one] = lessons('elasticity');
    expect(one.tag).toBe('ECON 1020');
    expect(one.sub).toMatch(/^Unit \d+ · \d+:\d\d of narration$/);
  });

  it('is told apart from the study unit of the same name', () => {
    // "Surplus & elasticity" is a unit *and* a lesson. They are two results
    // because they are two places: one opens the cards, the other the audio.
    const all = findEverything(cat, new Date(), 'elasticity', [], []).flatMap((g) => g.hits);
    expect(all.some((h) => h.kind === 'unit')).toBe(true);
    expect(all.some((h) => h.kind === 'lesson')).toBe(true);
  });

  it('offers only lessons that were actually recorded', () => {
    // A result landing on "this unit has not been recorded" is a press
    // wasted. Every lesson hit names a unit the catalogue has audio for.
    for (const hit of lessons('the')) {
      expect(cat.lessons[hit.courseId]?.[hit.unit]).toBeTruthy();
    }
  });

  it('finds nothing for words that are in no lesson', () => {
    expect(lessons('parsnip velocity brigade')).toEqual([]);
  });
});

describe('where a lesson result goes', () => {
  it('lands on the lesson screen', () => {
    expect(landingOf(lessons('elasticity')[0])).toBe('lesson');
  });

  it('opens the guide, names the unit, then goes — in that order', () => {
    const [one] = lessons('elasticity');
    expect(actionsFor(one)).toEqual([
      { type: 'openGuide', id: one.courseId },
      { type: 'openLesson', unit: one.unit },
      { type: 'go', screen: 'lesson' },
    ]);
  });

  it('carries no mode, so it is the same place however you reached it', () => {
    // `placeFor` leaves the guide's mode and scroll off a lesson tab for the
    // same reason. `browser.test.ts` holds that the two agree exactly; this
    // holds the half that lives here.
    const [one] = lessons('elasticity');
    expect(actionsFor(one)[0]).not.toHaveProperty('mode');
    expect(actionsFor(one)[0]).not.toHaveProperty('unit');
  });
});
