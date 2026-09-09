import { describe, expect, it } from 'vitest';
import { DESTINATIONS, GROUPS, TASKS, byTask, destinationsFor, destinationsIn, lately, saysFor, shelfOf, type TaskTag } from './nav';
import { NO_SCHOOL, type Capabilities } from './school';
import { BUNDLED } from '../data/schools';

const vanderbilt = BUNDLED.vanderbilt.capabilities;
const nowhere = NO_SCHOOL.capabilities;
const elsewhere: Capabilities = {
  mealPlan: 'dollars',
  cardName: 'Tetra',
  housing: true,
  campusMap: true,
  registrarName: 'ESTHER',
  registrarUrl: 'https://example.edu',
};

/**
 * One university's words are not the app's words.
 *
 * The directory promised everybody "Swipes and Commodore Cash" and labelled
 * the registration screen "YES" — Vanderbilt's name for its registrar — for a
 * student at a university that has never heard of either. That is not a screen
 * that should have been hidden; the gating was right. It is a screen whose
 * *words* belonged to somebody else, which is a failure the capability model
 * is supposed to prevent and did not, because nothing was checking.
 */
describe('the shared directory says nothing school-specific', () => {
  const OURS = [
    'commodore',
    'vanderbilt',
    'anchor link',
    'brightspace',
    'onevu',
    'myvu',
    // "YES" is a registrar's name and also an ordinary word, so it is matched
    // as a whole capitalised token rather than as a substring.
  ];

  it('keeps them out of every label and blurb', () => {
    for (const d of DESTINATIONS) {
      const said = `${d.label} ${d.blurb}`.toLowerCase();
      for (const word of OURS) {
        expect(said, `${d.screen}: ${word}`).not.toContain(word);
      }
    }
  });

  it('keeps a registrar’s name out of the labels', () => {
    for (const d of DESTINATIONS) {
      expect(d.label, d.screen).not.toMatch(/\bYES\b/);
    }
  });

  it('leaves the keywords alone, because they are the way in', () => {
    // Searching "commodore cash" must still find the meal screen for somebody
    // who calls it that. Keywords are a haystack, not a promise on a page.
    const meals = DESTINATIONS.find((d) => d.screen === 'meals');
    expect(meals?.keywords).toContain('commodore');
  });
});

describe('and then says exactly what this school says', () => {
  it('gives Vanderbilt back its own words', () => {
    // The whole point. Generalising must not cost the reference school the
    // thing that made the app good.
    const meals = DESTINATIONS.find((d) => d.screen === 'meals')!;
    expect(saysFor(meals, vanderbilt).blurb).toContain('Commodore Cash');
    expect(saysFor(meals, vanderbilt).blurb).toContain('Meal swipes');
    const yes = DESTINATIONS.find((d) => d.screen === 'yes')!;
    expect(saysFor(yes, vanderbilt).label).toBe('YES');
  });

  it('gives another school its own', () => {
    const meals = DESTINATIONS.find((d) => d.screen === 'meals')!;
    const said = saysFor(meals, elsewhere).blurb;
    expect(said).toContain('Tetra');
    expect(said.toLowerCase()).not.toContain('swipe');
    expect(saysFor(DESTINATIONS.find((d) => d.screen === 'yes')!, elsewhere).label).toBe('ESTHER');
  });

  it('says something true for a school that has named nothing', () => {
    for (const d of DESTINATIONS) {
      const said = saysFor(d, nowhere);
      expect(said.label.trim(), d.screen).not.toBe('');
      expect(said.blurb.trim(), d.screen).not.toBe('');
    }
  });

  it('names the course site rather than one particular one', () => {
    const connect = DESTINATIONS.find((d) => d.screen === 'connect')!;
    expect(saysFor(connect, vanderbilt).blurb).toContain('Brightspace');
    expect(saysFor(connect, nowhere).blurb).toContain('your course site');
  });

  it('leaves every other destination exactly as written', () => {
    for (const d of DESTINATIONS) {
      if (d.screen === 'meals' || d.screen === 'yes' || d.screen === 'connect') continue;
      expect(saysFor(d, vanderbilt)).toEqual({ label: d.label, blurb: d.blurb });
    }
  });
});

describe('the bar stays short whatever a registrar is called', () => {
  it('does not put a school’s own name in a 57px tab', () => {
    // "Student Center" would not fit and truncating it in the bar reads as a
    // bug, so the bar keeps a generic short label and the directory — which
    // has room — is where the school's own word appears.
    const yes = DESTINATIONS.find((d) => d.screen === 'yes')!;
    expect(yes.short).toBeDefined();
    expect((yes.short as string).length).toBeLessThanOrEqual(9);
  });
});

describe('the places you keep going back to', () => {
  const caps = vanderbilt;

  it('lists the most recent first', () => {
    expect(lately(['tonight', 'runway', 'essay'], [], caps).map((d) => d.screen)).toEqual([
      'tonight',
      'runway',
      'essay',
    ]);
  });

  it('leaves out whatever this layout already puts one tap away', () => {
    // The tab bar and the springboard's dock hold different screens, which is
    // why the bar is a parameter rather than a constant.
    expect(lately(['tonight', 'runway'], ['tonight'], caps).map((d) => d.screen)).toEqual(['runway']);
  });

  it('leaves out a screen this school has no equivalent of', () => {
    // Visited before somebody changed school. It must not come back in
    // through this door when the directory has already dropped it.
    expect(lately(['meals', 'tonight'], [], nowhere).map((d) => d.screen)).toEqual(['tonight']);
    expect(lately(['meals', 'tonight'], [], caps).map((d) => d.screen)).toContain('meals');
  });

  it('drops anything that is not a place in the app', () => {
    expect(lately(['tonight', 'nonsense'], [], caps).map((d) => d.screen)).toEqual(['tonight']);
    // Including a screen that was a place until it merged into another: the
    // grade table is the grades grain of Courses now, and `recent` is saved
    // state that can still be carrying the old id.
    expect(lately(['tonight', 'grades'], [], caps).map((d) => d.screen)).toEqual(['tonight']);
  });

  it('never lists the same screen twice', () => {
    expect(lately(['tonight', 'tonight', 'runway'], [], caps)).toHaveLength(2);
  });

  it('stops at four, because a list of twelve is the directory again', () => {
    const many = ['tonight', 'runway', 'essay', 'deck', 'exam', 'costs'];
    expect(lately(many, [], caps)).toHaveLength(4);
  });
});

describe('the shelves the directory is arranged on', () => {
  // The largest shelf is a row of pills on a phone. Eight is what fits when
  // the row is allowed to scroll; more than that and the row stops being a
  // thing you can learn the positions of.
  const MOST_ON_A_SHELF = 8;

  it('files every screen on exactly one shelf', () => {
    const counted = GROUPS.reduce((n, g) => n + destinationsIn(g).length, 0);
    expect(counted).toBe(DESTINATIONS.length);
    for (const d of DESTINATIONS) expect(GROUPS).toContain(d.group);
  });

  it('keeps every shelf drawable as a single row', () => {
    for (const g of GROUPS) {
      expect(destinationsIn(g).length).toBeLessThanOrEqual(MOST_ON_A_SHELF);
      // An empty shelf is a pill that leads nowhere.
      expect(destinationsIn(g).length).toBeGreaterThan(0);
    }
  });

  it('holds the eight shelves in the order they are shown', () => {
    // Order is the thing a student learns by position, so it is asserted
    // rather than left to however the registry happens to be written.
    expect(GROUPS).toEqual([
      'Semester',
      'Courses',
      'Study',
      'Make',
      'Campus',
      'Life',
      'You',
      'Data',
    ]);
  });

  it('names each shelf once', () => {
    expect(new Set(GROUPS).size).toBe(GROUPS.length);
  });

  /*
   * The size rule the shelves were built to, asserted rather than described.
   *
   * `nav.ts` has always said "the largest is eight and the smallest five",
   * and Standing drifted down to three without anything noticing — screens
   * moved off it one release at a time and the shelf stayed, costing a pill
   * in the row and a tile in the grid to hold a third of what its neighbours
   * hold. A shelf that thin should fail here and be folded into another, the
   * way Standing folded into Semester.
   *
   * The floor is what matters and the ceiling comes with it: past eight, a
   * shelf is no longer one row of pills, which is the whole reason shelves
   * exist.
   */
  it('keeps every shelf between five and eight screens', () => {
    for (const group of GROUPS) {
      const n = destinationsIn(group).length;
      expect(n, `${group} holds ${n}`).toBeGreaterThanOrEqual(5);
      expect(n, `${group} holds ${n}`).toBeLessThanOrEqual(8);
    }
  });

  it('put the standing screens where the question is asked', () => {
    // Reports already asked "how is it going" from Semester — it carries the
    // `stand` tag — so the ones about this term sit with it. The grade table
    // is not among them any more: it is the grades grain of Courses, and
    // Courses carries the `stand` tag for it.
    const semester = destinationsIn('Semester').map((d) => d.screen);
    expect(semester).toContain('behind');
    expect(DESTINATIONS.find((d) => d.screen === 'courses')?.taskTags).toContain('stand');
    expect(DESTINATIONS.find((d) => d.screen === 'brief')?.taskTags).toContain('stand');

    // The degree is the one that is not about this term, and Semester is a
    // term. It goes where the things it counts are, under the course list.
    const courses = destinationsIn('Courses').map((d) => d.screen);
    expect(courses).toContain('degree');
    expect(courses.indexOf('degree')).toBe(courses.indexOf('courses') + 1);
    expect(semester).not.toContain('degree');
  });

  it('puts the week ahead next to when you are behind', () => {
    // Two screens answering the same question in opposite directions, split
    // across two shelves until Standing folded. Order on a shelf is array
    // order in the registry, so this is what a reader actually meets.
    const on = destinationsIn('Semester').map((d) => d.screen);
    expect(on.indexOf('behind')).toBe(on.indexOf('ahead') + 1);
  });
});

describe('the two rows reach everything', () => {
  // The soft shell's navigation: row one is the shelves, row two is the
  // screens on the shelf you are standing on. "All 55 reachable" is the
  // acceptance criterion for it, so it is a test rather than a thing somebody
  // clicked through once.
  it('puts every screen on the second row of its own shelf', () => {
    for (const d of DESTINATIONS) {
      const shelf = shelfOf(d.screen);
      const row = destinationsFor(shelf, vanderbilt).map((x) => x.screen);
      expect(row, `${d.label} (${d.screen}) on ${shelf}`).toContain(d.screen);
    }
  });

  it('lands somewhere from every pill on the first row', () => {
    // A shelf pill opens the first screen on that shelf, so an empty shelf
    // would be a pill that does nothing.
    for (const g of GROUPS) expect(destinationsFor(g, vanderbilt).length).toBeGreaterThan(0);
  });

  it('answers with a shelf for a screen the registry does not list', () => {
    // Flashcards and the guide are reached from inside Study rather than being
    // destinations, and the rows still have to say where you are.
    expect(shelfOf('drill' as never)).toBe('Study');
    expect(shelfOf('guide' as never)).toBe('Study');
  });

  it('gives every screen a sentence to show under the rows', () => {
    for (const d of DESTINATIONS) {
      const { blurb } = saysFor(d, vanderbilt);
      expect(blurb.length, d.screen).toBeGreaterThan(10);
    }
  });
});

/*
 * Moved here with `byTask` when `lib/everything.ts` was deleted.
 *
 * The rest of that file's tests went with the functions they covered — the
 * Everything screen was the only caller of seven of its eight exports, so when
 * the screen folded into Progress the functions had nothing left to be right
 * about. These two survive because `byTask` does: it reads `TASKS` and
 * `taskLabel`, both defined here, so these are tests of this file.
 */
describe('by task', () => {
  it('gives every screen at least one thing somebody would be trying to do', () => {
    const orphans = DESTINATIONS.filter((d) => d.taskTags.length === 0).map((d) => d.screen);
    expect(orphans).toEqual([]);
  });

  it('uses no tag without a heading', () => {
    const known = new Set(TASKS.map(([id]) => id as string));
    const loose = DESTINATIONS.flatMap((d) => d.taskTags.filter((t) => !known.has(t)));
    expect([...new Set(loose)]).toEqual([]);
  });

  it('leaves no heading empty', () => {
    // A section with nothing under it reads as a bug rather than as a shelf
    // somebody has not filled.
    const used = new Set(DESTINATIONS.flatMap((d) => d.taskTags));
    const bare = TASKS.map(([id]) => id).filter((id) => !used.has(id as TaskTag));
    expect(bare).toEqual([]);
  });

  it('lets a screen answer more than one question', () => {
    // The point of tags over shelves. If this ever came out at zero the two
    // views would be the same view with different headings.
    expect(DESTINATIONS.filter((d) => d.taskTags.length > 1).length).toBeGreaterThan(10);
  });

  it('keeps the sections in the order the headings are written', () => {
    const order = byTask(DESTINATIONS).map((s) => s.tag);
    expect(order).toEqual(TASKS.map(([id]) => id).filter((id) => order.includes(id as TaskTag)));
  });
});

describe('the promise', () => {
  it('writes down no screen of its own', () => {
    // Acceptance criterion 7, as far as a unit test can carry it: every row in
    // the task view traces back to the registry it was built from.
    const known = new Set<string>(DESTINATIONS.map((d) => d.screen));
    for (const section of byTask(DESTINATIONS)) {
      for (const d of section.rows) expect(known.has(d.screen)).toBe(true);
    }
  });

  it('drops a screen the moment the registry does', () => {
    /*
     * The screen comes from the registry rather than being written here,
     * which is the promise this describe is named for.
     *
     * It used to say `'grades'`. That screen stopped being a destination in
     * #76 while the move of this block was open in #85 — neither red on its
     * own, both red together — and the failure was a test about the registry
     * being the one source of truth keeping a copy of one of its rows. Taking
     * the row from `byTask` itself cannot go stale, and cannot pick a screen
     * with no task tag, which would pass for the wrong reason.
     */
    const [gone] = byTask(DESTINATIONS)[0].rows;
    const short = DESTINATIONS.filter((d) => d.screen !== gone.screen);
    const rows = byTask(short).flatMap((s) => s.rows);
    expect(rows.some((d) => d.screen === gone.screen)).toBe(false);
  });

  it('picks up a screen the moment the registry has one', () => {
    const extra = {
      ...DESTINATIONS[0],
      screen: 'somethingNew' as (typeof DESTINATIONS)[number]['screen'],
      label: 'Something new',
      taskTags: ['study'] as TaskTag[],
    };
    const rows = byTask([...DESTINATIONS, extra]).flatMap((s) => s.rows);
    expect(rows.some((d) => (d.screen as string) === 'somethingNew')).toBe(true);
  });
});
