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
  SCATTERED,
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
    /*
     * Pinned to the tier's *shape* rather than to one number. #432 wrote this
     * as `toBe(20)` when the tier was flat; it is graded now — the mean of
     * what each word scores, scaled into the band below the whole-query tiers
     * — so the literal moved to 27 while the property it was written to hold
     * did not. Both orders still score identically, for the same reason, and
     * neither can be answered by a run nobody wrote.
     */
    const forward = scoreApp(STUDY, 'study guide', ALL);
    const back = scoreApp(STUDY, 'guide study', ALL);
    expect(forward).toBe(back);
    expect(forward).toBeGreaterThan(0);
    expect(forward).toBeLessThanOrEqual(SCATTERED);
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

describe('a query of more than one word', () => {
  const screens = (q: string) => findApps(q, ALL).map((d) => d.screen);

  it('finds the screen the audit could not', () => {
    /*
     * "study guide" answered "No app matches that" while Study — whose
     * keywords have said `guide` since they were written, and whose own button
     * reads Create study guide — sat one row down the registry. Nothing was
     * missing from the registry. The matcher only ever looked for the whole
     * query as one unbroken run of characters, so two words that each land
     * squarely on a screen landed nowhere together.
     */
    expect(screens('study guide')[0]).toBe('study');
    expect(screens('create study guide')[0]).toBe('study');
  });

  it('knows the names of the formats the screen it belongs to makes', () => {
    /*
     * The other half of the same failure, and the half a matcher cannot fix:
     * Study builds flashcards and a read-aloud guide, and the registry had no
     * word for either. Only the formats that cost nothing to name are here —
     * "outline", "summary", "formula", "notes", "concept map" and "key terms"
     * were measured and put back, because each one is a common prefix that
     * starts answering other queries with Study: "out" reaches "outline",
     * "form" reaches "formula", "term" reaches "terms", and bare "map" reached
     * Study ahead of Getting there. A screen that answers to everything is the
     * same fault as one that answers to nothing.
     */
    expect(screens('flash cards')).toContain('study');
    expect(screens('read aloud')).toContain('study');
  });

  it('finds a screen by its own name minus an article', () => {
    // The worst of the class: a screen labelled "Add a reading", unfindable by
    // "add reading". Whatever else a search does, it has to do this.
    expect(screens('add reading')).toContain('update');
  });

  it('handles the words people put in between', () => {
    // The same queries `lib/find.ts` learned to answer. The bar sat above the
    // palette and disagreed with it about the same registry.
    expect(screens('pay my bill')).toContain('costs');
    expect(screens('where are my grades')).toContain('courses');
    expect(screens('delete my account')).toContain('privacy');
  });

  it('needs every word, not any of them', () => {
    // Otherwise the commonest word carries the query and somebody who typed
    // two words is worse off than somebody who typed one.
    expect(screens('study parsnip')).toEqual([]);
    expect(screens('parsnip velocity brigade')).toEqual([]);
  });

  it('finds nothing for words nobody searches by', () => {
    expect(screens('the a my')).toEqual([]);
  });

  it('does not answer a phrase that exists only where two fields were joined', () => {
    /*
     * Found in #432, which reached this function from the other side, and
     * carried here with its fix. The three matched fields were joined with a
     * space, so the last word of one and the first of the next spelled out a
     * phrase nobody wrote — and that run scored the *whole-query* tier, above
     * every screen holding both words properly. 60 of them across the
     * registry, one per screen: `agenda semester`, `average courses`,
     * `analyze study`. This branch added a 61st by giving Study the keyword
     * `read aloud`, whose last word sits against the shelf name: `aloud
     * study`.
     *
     * The seams are newlines now. Every field pair on every row, asserted
     * rather than argued, because "it cannot happen" is what the four tiers
     * said about phrases.
     */
    for (const d of DESTINATIONS) {
      const fields = [d.blurb, d.keywords, d.group].map((f) => f.toLowerCase().trim());
      for (let i = 0; i < fields.length - 1; i += 1) {
        const left = fields[i].split(/[^a-z]+/).filter(Boolean).at(-1);
        const right = fields[i + 1].split(/[^a-z]+/).filter(Boolean)[0];
        if (!left || !right) continue;
        expect(
          scoreApp(d, `${left} ${right}`, ALL),
          `${d.screen} scored the seam "${left} ${right}" as a whole query`,
        ).not.toBe(40);
      }
    }
  });

  it('weighs a word that lands on a name above one that lands in a blurb', () => {
    // "practice exam" has to reach Practice paper before the other screens on
    // the Study shelf whose keywords merely mention practice.
    expect(screens('practice exam')[0]).toBe('exam');
  });

  it('never outranks a whole-query match', () => {
    /*
     * The property the whole tier is built around, and the reason this change
     * could be made under the existing search tests rather than beside them: a
     * screen carrying the exact phrase typed stays ahead of one that merely
     * carries both words, so scattered words can only ever append rows to a
     * result list and never reorder the rows already in it.
     *
     * Asserted as the invariant rather than as one example: every score is
     * either one of the four whole-query tiers or inside the band below them.
     */
    const WHOLE = [40, 60, 80, 100];
    for (const d of DESTINATIONS) {
      for (const q of [
        'study guide', 'pay my bill', 'add reading', 'office hours', 'meal plan',
        'where are my grades', 'practice exam', 'email professor', 'make a deck',
      ]) {
        const score = scoreApp(d, q, ALL);
        if (score === 0 || WHOLE.includes(score)) continue;
        expect(score, `${d.screen} scored ${score} for "${q}"`).toBeLessThanOrEqual(SCATTERED);
      }
    }
    expect(SCATTERED).toBeLessThan(Math.min(...WHOLE));
  });

  it('leaves a one-word query to the four tiers above it', () => {
    // A single word has already been tried against the label, the name and the
    // keywords; running it again here would only duplicate the row it made.
    for (const d of DESTINATIONS) {
      for (const q of ['study', 'calendar', 'powerpoint', 'gmail', 'meal']) {
        const score = scoreApp(d, q, ALL);
        expect([0, 40, 60, 80, 100], `${d.screen} scored ${score} for "${q}"`).toContain(score);
      }
    }
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
