import { describe, expect, it } from 'vitest';
import { PROVIDERS, providerFor } from './index';
import { ROOM, render } from '../shape';
import { buildCatalog } from '../../data/catalog';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../../state/shape';
import { DESTINATIONS } from '../../lib/nav';
import BUS from '../../data/courses/bus';
import ECON from '../../data/courses/econ';
import type { Look } from '../shape';

/**
 * What a screen tells the assistant about what is on it.
 *
 * The properties worth pinning are not the wording. They are: it describes
 * what is *visible* rather than everything; it stays inside its budget; it is
 * pure, so the same state twice gives the same context; and it can only name
 * screens the registry has.
 */

const catalog = buildCatalog([ECON, BUS]);

/**
 * The screens that deliberately hand over nothing, and why.
 *
 * `people` is a rule rather than an omission — see the test below.
 *
 * `chat` is the assistant's own screen. A provider for it would hand the model
 * a description of the conversation it is already holding, which is either
 * nothing it does not know or the same text twice. "Looking at: Chat" is also
 * the one context line that could never help an answer.
 */
const EXPECTED_WITHOUT: string[] = ['chat', 'people'];
const NOW = new Date(2026, 8, 15);

const look = (over: Partial<State> = {}): Look => ({
  state: {
    ...DEFAULT_PERSISTED,
    /*
     * The session half as well as the stored half.
     *
     * Which course is open, which tab, which calendar view — none of it is
     * persisted, and a fixture built from `DEFAULT_PERSISTED` alone leaves
     * `guideId` undefined, so half the providers report "no course is open"
     * against an account with four courses. That is a wrong test, not a
     * wrong provider.
     */
    ...initialEphemeral(NOW),
    courses: [ECON, BUS],
    term: '2026FA',
    grades: { 'econ:0': '91', 'bus:0': '88', 'bus:1': '74' },
    ...over,
  } as State,
  catalog,
  now: NOW,
});

describe('the map itself', () => {
  it('keys only screens the app can actually be on', () => {
    /*
     * The registry is destinations — the places the finder and the tab bar
     * can send you. It is not every screen: `drill` is a study mode you enter
     * from a course rather than navigate to, and `gap` is the between-classes
     * mode, entered from a gap in the day. The assistant can perfectly well be
     * opened on either. So a key may sit outside the registry, but only
     * deliberately, and this is the list of the ones that do.
     */
    const real = new Set<string>(DESTINATIONS.map((d) => d.screen));
    const offRegistry = Object.keys(PROVIDERS).filter((s) => !real.has(s));
    expect(offRegistry.sort()).toEqual(['drill', 'gap']);
  });

  it('says plainly that a screen has no provider, rather than inventing one', () => {
    expect(providerFor('grades')).not.toBeNull();
    // Not in the registry at all, so nothing can be asked from it.
    expect(providerFor('onboarding')).toBeNull();
  });

  it('covers every screen in the registry, or names the ones it does not', () => {
    /*
     * The completeness check the map exists to make possible.
     *
     * It fails with the list rather than a count, so a new screen arriving
     * without context is a decision somebody makes on purpose — either write
     * one, or add it to the list below with the reason.
     */
    const missing = DESTINATIONS.map((d) => d.screen).filter((s) => !providerFor(s));
    expect(missing.sort()).toEqual(EXPECTED_WITHOUT.sort());
  });

  it('will not describe the one screen that is about other people', () => {
    /*
     * `people` holds professors' names and what was said about them.
     * `lib/context.ts` refuses to send anything from it under any
     * circumstance; a provider here would be a second door past the one rule
     * in this app that protects somebody who is not the student.
     */
    expect(providerFor('people')).toBeNull();
    expect(Object.keys(PROVIDERS)).not.toContain('people');
  });
});

describe('grades', () => {
  const ctx = () => providerFor('grades')!(look())!;

  it('carries every component, its weight and whether it is back', () => {
    /*
     * The worked example from the brief: "what do I need on the BUS final"
     * has to answer without the course being named, which is only possible if
     * the weights and the outstanding rows travel.
     */
    const text = render('grades', 'Grades', ctx()).text;
    expect(text).toContain('BUS 1600');
    expect(text).toContain('Final exam');
    expect(text).toContain('not back');
    expect(text).toContain('still to play for');
  });

  it('rounds a weight rather than printing the arithmetic', () => {
    // A syllabus stating "ten points each" normalises to 34.78260869565217%,
    // which reads as a precision the syllabus never had.
    const text = render('grades', 'Grades', ctx()).text;
    expect(text).not.toMatch(/\d\.\d{4}/);
  });

  it('is not filtered by Today’s chip, which is not this screen’s', () => {
    /*
     * `state.filter` is the feed chip — its values are `All`, `Due`,
     * `Classes` and short codes, not course ids. Filtering Grades by it meant
     * that on a fresh account, whose filter is the string `All`, this matched
     * no course and returned nothing at all: the sheet said Grades had
     * nothing to say with four courses of grades on the screen behind it.
     */
    const all = providerFor('grades')!(look({ filter: 'All' }));
    expect(all?.visible).toHaveLength(2);
    expect(providerFor('grades')!(look({ filter: 'ECON' }))?.visible).toHaveLength(2);
  });

  it('suggests a question that could only be asked here', () => {
    expect(ctx().suggestions.join(' ')).toMatch(/final/i);
  });
});

describe('the calendar', () => {
  it('describes the window that is open, not the whole term', () => {
    // "What is my heaviest day this week" is a different question on a month
    // view and a day view, and the screen knows which is open.
    const week = providerFor('calendar')!(look({ calView: 'week' }))!;
    const term = providerFor('calendar')!(look({ calView: 'semester' }))!;
    expect(week.summary).toContain('7 days');
    expect(term.visible.length).toBeGreaterThanOrEqual(week.visible.length);
  });

  it('respects the chip, in the app’s own vocabulary', () => {
    // `ECON`, not `econ` — the chips are the first word of each course code.
    const one = providerFor('calendar')!(look({ filter: 'ECON', calView: 'semester' }))!;
    const both = providerFor('calendar')!(look({ filter: 'All', calView: 'semester' }))!;
    expect(one.visible.length).toBeLessThan(both.visible.length);
    expect(one.summary).toContain('filtered to ECON 1020');
  });
});

describe('what every provider has to hold', () => {
  const each = Object.entries(PROVIDERS);

  it('is pure, so the same state twice gives the same context', () => {
    for (const [screen, provide] of each) {
      const once = JSON.stringify(provide(look()));
      const twice = JSON.stringify(provide(look()));
      expect(once, screen).toBe(twice);
    }
  });

  it('stays inside the budget, and says so when it had to cut', () => {
    for (const [screen, provide] of each) {
      const ctx = provide(look());
      if (!ctx) continue;
      const out = render(screen as never, screen, ctx);
      expect(out.text.length, screen).toBeLessThanOrEqual(ROOM + 200);
      if (out.dropped > 0) expect(out.text).toContain('do not count from this list');
    }
  });

  it('offers something to ask, or nothing at all — never a placeholder', () => {
    for (const [screen, provide] of each) {
      const ctx = provide(look());
      if (!ctx) continue;
      expect(ctx.summary.length, screen).toBeGreaterThan(10);
      for (const s of ctx.suggestions) expect(s.trim().length, screen).toBeGreaterThan(8);
    }
  });

  it('claims no coursework rows on an account with no courses', () => {
    /*
     * Not "no rows at all", which is what this asserted first and was wrong
     * about: Your data lists the state's own fields, and a fresh account has
     * thirty-eight of them with their defaults in. That is exactly what the
     * screen shows, so the provider showing it is right.
     *
     * What no provider may do is claim a course, a deadline or a grade on an
     * account that has none.
     */
    const fresh: Look = { state: DEFAULT_PERSISTED as State, catalog: buildCatalog([]), now: NOW };
    for (const [screen, provide] of each) {
      const ctx = provide(fresh);
      if (!ctx) continue;
      const said = JSON.stringify(ctx.visible);
      for (const code of ['ECON', 'PSCI', 'CORE', 'BUS ']) {
        expect(said, `${screen} invented ${code}`).not.toContain(code);
      }
    }
  });

  it('never writes the word undefined into a payload', () => {
    /*
     * It read `on the "undefined" tab` on Progress, from a tab that has a
     * default in the session state and none in the stored state. The model
     * would have read that as a fact about the screen, and a student reading
     * the answer would have had no way to tell it was a bug.
     */
    for (const [screen, provide] of each) {
      const ctx = provide(look());
      if (!ctx) continue;
      const said = `${ctx.summary} ${JSON.stringify(ctx.visible)} ${JSON.stringify(ctx.focus ?? {})}`;
      expect(said, screen).not.toContain('undefined');
      expect(said, screen).not.toContain('NaN');
    }
  });

  it('does not throw on an account with nothing in it', () => {
    // Every one of these runs on the first screen a new student sees.
    const fresh: Look = { state: DEFAULT_PERSISTED as State, catalog: buildCatalog([]), now: NOW };
    for (const [screen, provide] of each) {
      expect(() => provide(fresh), screen).not.toThrow();
    }
  });
});

describe('what no provider may ever hand over', () => {
  /*
   * The same check `lib/context.ts` has, applied to the other door.
   *
   * A screen provider is a second way for state to reach a payload. If the
   * allowlist refuses note bodies and a provider sends them because they are
   * "what is on screen", the allowlist has stopped being the boundary — so
   * this asserts the rule holds on this side too, with a state carrying every
   * secret the app could hold.
   */
  const loaded = (): Look => {
    const base = look();
    return {
      ...base,
      state: {
        ...base.state,
        notes: [
          {
            id: 'n1',
            title: 'Therapy notes',
            body: 'THE-PRIVATE-NOTE-BODY — everything I said on Tuesday.',
            created: 0,
            updated: 0,
            courseId: null,
            fileIds: [],
          },
        ],
        people: [
          { id: 'p1', name: 'PERSON-NAME-HERE', role: 'Professor', courseId: 'bus', email: 'x@y.z', note: 'SAID-ABOUT-THEM', created: 0 },
        ],
        letters: [{ id: 'l1', personId: 'p1', forWhat: 'LETTER-BODY-HERE', due: '', stage: 'asked', askedOn: '', sentMaterials: false, thanked: false, note: '' }],
        visits: [{ id: 'v1', personId: 'p1', at: 0, what: 'SAID-IN-OFFICE-HOURS', working: '' }],
      } as unknown as State,
    };
  };

  const SECRETS = [
    'THE-PRIVATE-NOTE-BODY',
    'PERSON-NAME-HERE',
    'SAID-ABOUT-THEM',
    'LETTER-BODY-HERE',
    'SAID-IN-OFFICE-HOURS',
    'sk-ant-',
  ];

  it('sends no note body, and nothing about another person, from any screen', () => {
    for (const [screen, provide] of Object.entries(PROVIDERS)) {
      const ctx = provide(loaded());
      if (!ctx) continue;
      const said = render(screen as never, screen, ctx).text;
      for (const secret of SECRETS) {
        expect(said, `${screen} leaked ${secret}`).not.toContain(secret);
      }
    }
  });

  it('describes notes by title and length, which is the whole compromise', () => {
    // "Summarise this note" then has to be declined and explained, and that
    // is the right outcome: the rule is worth more than the feature.
    const it_ = PROVIDERS.mine!({ ...loaded(), state: { ...loaded().state, mineTab: 'notes' } as State })!;
    const said = JSON.stringify(it_.visible);
    expect(said).toContain('Therapy notes');
    expect(said).toContain('characters');
    expect(said).not.toContain('THE-PRIVATE-NOTE-BODY');
  });
});

describe('what a rendered context looks like', () => {
  it('names the screen, then the summary, then the rows', () => {
    const out = render('grades', 'Grades', providerFor('grades')!(look())!);
    const lines = out.text.split('\n');
    expect(lines[0]).toBe('On screen: Grades (grades).');
    expect(lines[1]).toContain('Grades for 2 courses');
  });

  it('warns in the payload itself when a list was cut', () => {
    // An answer that counts the rows it was given has to know they were not
    // all of them.
    const many = { summary: 'A long list.', visible: Array.from({ length: 4000 }, (_, i) => `row ${i} ${'x'.repeat(40)}`), actions: [], suggestions: [] };
    const out = render('mine', 'Personal', many);
    expect(out.dropped).toBeGreaterThan(0);
    expect(out.text).toContain('do not count from this list');
    expect(out.text.length).toBeLessThanOrEqual(ROOM + 200);
  });
});
