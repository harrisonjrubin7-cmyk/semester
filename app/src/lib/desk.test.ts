import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FAVOURITES,
  MAX_FAVOURITES,
  allApps,
  categories,
  centreHidden,
  findApps,
  isFavourite,
  narrowApps,
  readFavourites,
  scoreApp,
  toggleFavourite,
  writeFavourites,
} from './desk';
import { DESTINATIONS, offered } from './nav';
import type { Capabilities } from './school';
import type { Screen } from './types';

/** A school that has everything, so the gate is not what is being tested. */
const ALL: Capabilities = {
  mealPlan: 'both',
  housing: true,
  campusMap: true,
  registrarUrl: 'https://example.invalid',
  orgPortalUrl: 'https://example.invalid',
};

/** And one with none of the optional services. */
const BARE: Capabilities = { mealPlan: 'none', housing: false, campusMap: false };

describe('the shortcuts', () => {
  it('opens on five somebody would actually use', () => {
    const on = readFavourites('', ALL).map((d) => d.screen);
    expect(on).toEqual(DEFAULT_FAVOURITES);
  });

  it('never offers a screen this school does not have', () => {
    /*
     * The whole reason a saved list goes back through the registry. A meal
     * plan pinned at one university and synced to an account at another is
     * the exact leak the capability model exists to close — a tile that opens
     * a screen about swipes nobody has.
     */
    const saved = writeFavourites(['meals', 'housing', 'courses'] as Screen[]);
    const on = readFavourites(saved, BARE).map((d) => d.screen);
    expect(on).toEqual(['courses']);
    expect(offered(BARE).some((d) => d.screen === 'meals')).toBe(false);
  });

  it('drops a name that is no longer a screen rather than trusting it', () => {
    const on = readFavourites('courses,cloud,study', ALL).map((d) => d.screen);
    expect(on).toEqual(['courses', 'study']);
  });

  it('holds six and no more', () => {
    const many = DESTINATIONS.slice(0, 10).map((d) => d.screen);
    expect(readFavourites(writeFavourites(many), ALL)).toHaveLength(MAX_FAVOURITES);
  });

  it('keeps the defaults when the first change is made against them', () => {
    /*
     * Pinning a sixth screen must not unpin the five that were showing. The
     * bug this is here for is the obvious implementation — read the raw
     * string, append, write — which turns an empty preference into a list of
     * one and empties the row somebody was looking at.
     */
    const next = toggleFavourite('', 'ask' as Screen, ALL);
    const on = readFavourites(next, ALL).map((d) => d.screen);
    expect(on.slice(0, DEFAULT_FAVOURITES.length)).toEqual(DEFAULT_FAVOURITES);
    expect(on).toContain('ask');
  });

  it('unpins what is pinned, and says which is which', () => {
    expect(isFavourite('', 'courses' as Screen, ALL)).toBe(true);
    const without = toggleFavourite('', 'courses' as Screen, ALL);
    expect(isFavourite(without, 'courses' as Screen, ALL)).toBe(false);
    // And back again, which is the property a toggle has and a setter does not.
    expect(isFavourite(toggleFavourite(without, 'courses' as Screen, ALL), 'courses' as Screen, ALL)).toBe(
      true,
    );
  });
});

describe('searching the apps', () => {
  const STUDY = DESTINATIONS.find((d) => d.screen === 'study')!;

  it('puts the screen you named first', () => {
    expect(findApps('calendar', ALL)[0].screen).toBe('calendar');
    expect(findApps('courses', ALL)[0].screen).toBe('courses');
  });

  it('finds a screen by a word that is nowhere in its name', () => {
    // The keywords are the whole point of the registry carrying them: nobody
    // types "Deck" when what they want is a PowerPoint.
    expect(findApps('powerpoint', ALL).map((d) => d.screen)).toContain('deck');
    expect(findApps('gmail', ALL).map((d) => d.screen)).toContain('mail');
  });

  it('does not answer with a word it found in the middle of another', () => {
    // "map" inside "compare" is not a hit anybody meant, and a search that
    // answers with it reads as broken.
    for (const d of DESTINATIONS) {
      const score = scoreApp(d, 'ap', ALL);
      if (score === 40) {
        const words = `${d.blurb} ${d.keywords} ${d.group}`.toLowerCase();
        expect(new RegExp('(^|[^a-z])ap').test(words), `${d.screen} matched mid-word`).toBe(true);
      }
    }
  });

  it('answers a phrase whose words sit apart in the registry', () => {
    /*
     * The bar said "No app matches that" to `study guide`, which is the
     * thing this app is best at. Study's label says *study* and its keywords
     * say *guide*, never adjacently, and the four ranking tiers all ask
     * about the query as one unbroken run — so no screen scored above zero.
     */
    expect(scoreApp(STUDY, 'study guide', ALL)).toBeGreaterThan(0);
    expect(findApps('study guide', ALL).map((d) => d.screen)).toContain('study');
  });

  it('reads a phrase in either order, the way people type it', () => {
    /*
     * `nav.ts`'s `taskMatch` states the rule this tier borrows: the two
     * words somebody remembers, in whichever order they arrive.
     *
     * Asserted on the tier and not just on membership, because the first
     * draft of this test passed against the unfixed matcher. `guide study`
     * scored 40 there — Study's keywords end in *guide* and its shelf is
     * *Study*, so the space joining the two fields spelled the phrase out at
     * the seam. The test was reading an accident. The seam is a newline now
     * (see `scoreApp`), so both orders reach the same tier for the same
     * reason, and neither can be answered by a run nobody wrote.
     */
    expect(scoreApp(STUDY, 'study guide', ALL)).toBe(20);
    expect(scoreApp(STUDY, 'guide study', ALL)).toBe(20);
    expect(findApps('guide study', ALL).map((d) => d.screen)).toContain('study');
  });

  it('does not score a phrase that only exists where two fields were joined', () => {
    // The control that caught the test above. Every field pair, every
    // registry row: the last word of one and the first of the next are not
    // a phrase, and must not out-rank the screens that hold both properly.
    for (const d of DESTINATIONS) {
      const fields = [d.blurb, d.keywords, d.group].map((f) => f.toLowerCase().trim());
      for (let i = 0; i < fields.length - 1; i++) {
        const left = fields[i].split(/[^a-z]+/).filter(Boolean).at(-1);
        const right = fields[i + 1].split(/[^a-z]+/).filter(Boolean)[0];
        if (!left || !right) continue;
        expect(scoreApp(d, `${left} ${right}`, ALL), `${d.screen} scored the seam "${left} ${right}"`).not.toBe(40);
      }
    }
  });

  it('still ranks a name above a phrase scattered across a blurb', () => {
    // The tier is below the four, not among them: `calendar` is a label and
    // must keep beating every screen whose sentence happens to hold it.
    expect(findApps('calendar', ALL)[0].screen).toBe('calendar');
    expect(scoreApp(STUDY, 'study guide', ALL)).toBeLessThan(scoreApp(STUDY, 'study', ALL));
  });

  it('leaves every one-word query scoring exactly what it scored before', () => {
    /*
     * The control on the change. A word starting anywhere in a label is
     * already caught by `includes` at 60, so the new tier is unreachable
     * with one word — asserted across the whole registry rather than argued,
     * because "it cannot happen" is what the four tiers said about phrases.
     */
    const words = new Set(
      DESTINATIONS.flatMap((d) => `${d.label} ${d.short ?? ''} ${d.keywords}`.toLowerCase().split(/[^a-z]+/)).filter(Boolean),
    );
    for (const w of words) {
      for (const d of DESTINATIONS) {
        expect(scoreApp(d, w, ALL), `${d.screen} scored the phrase tier on the single word "${w}"`).not.toBe(20);
      }
    }
  });

  it('does not answer a phrase with a screen that is missing one of its words', () => {
    for (const d of findApps('study guide', ALL)) {
      const hay = `${d.label} ${d.short ?? ''} ${d.blurb} ${d.keywords} ${d.group}`.toLowerCase();
      expect(hay, `${d.screen} answered without one of the words`).toMatch(/(^|[^a-z])study/);
      expect(hay, `${d.screen} answered without one of the words`).toMatch(/(^|[^a-z])guide/);
    }
  });

  it('finds nothing for nothing', () => {
    expect(findApps('', ALL)).toEqual([]);
    expect(findApps('   ', ALL)).toEqual([]);
  });

  it('never offers a screen the school gate has closed', () => {
    expect(findApps('meal', BARE).map((d) => d.screen)).not.toContain('meals');
  });
});

describe('the directory', () => {
  it('lists every app this person can open and no others', () => {
    expect(allApps(ALL)).toEqual(offered(ALL));
    expect(allApps(BARE).length).toBeLessThan(allApps(ALL).length);
  });

  it('offers only the categories that have something in them', () => {
    const chips = categories(BARE);
    for (const group of chips) {
      expect(allApps(BARE).some((d) => d.group === group), `${group} is an empty chip`).toBe(true);
    }
  });

  it('narrows by the category, the query, or both', () => {
    const apps = allApps(ALL);
    const study = narrowApps(apps, 'Study', '', ALL);
    expect(study.length).toBeGreaterThan(0);
    for (const d of study) expect(d.group).toBe('Study');
    // A query inside a category can only ever narrow it further.
    const both = narrowApps(apps, 'Study', 'quiz', ALL);
    expect(both.length).toBeLessThanOrEqual(study.length);
    for (const d of both) expect(d.group).toBe('Study');
  });

  it('gives everything back when nothing is asked', () => {
    expect(narrowApps(allApps(ALL), '', '', ALL)).toEqual(allApps(ALL));
  });
});

describe('what hides the centre of the search home', () => {
  const nothing = {
    suggesting: false,
    apps: false,
    customize: false,
    finder: false,
    quickAdd: false,
  };

  it('leaves it alone when nothing is open', () => {
    expect(centreHidden(nothing)).toBe(false);
  });

  /*
   * Every one of the five, named individually. The guide is explicit that the
   * centre must not cover results or intercept clicks, and the failure mode
   * is one overlay forgotten — which a single "any of these" assertion would
   * not catch, because it would pass on the other four.
   */
  it('hides it for every overlay there is', () => {
    for (const key of ['suggesting', 'apps', 'customize', 'finder', 'quickAdd'] as const) {
      expect(centreHidden({ ...nothing, [key]: true }), key).toBe(true);
    }
  });
});
