import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { headerRow } from './header';
import { chromeFor } from './chrome';
import { withoutComments } from '../styles/rules';
import { MATCH_DEVICE, MATCH_DEVICE_LABEL, ground, groundName, resolveGround } from './look';

/**
 * No two controls in one frame do the same job.
 *
 * `lib/chrome.ts` holds the invariant one level up — never two *navigations*
 * on screen together — and says in its own words that the header is not its
 * business, because the header belongs to the screen you are on. That was
 * true and it left a gap. The workspace draws three pieces of chrome at once,
 * a bar across the top, a column down the side and the header inside the
 * pane, and nothing ever compared their contents.
 *
 * They overlapped on five controls. Three had been noticed and dropped behind
 * a flag; the flag was a list written against the bar's *tools cluster* and
 * never checked against the rest of the layout, so the header went on drawing
 * a magnifier one row under the bar's search field and a `+` a few inches from
 * the sidebar's New button. On Alerts — a screen you cannot add to and would
 * not search from — that was the entire header.
 *
 * A route census cannot see this. It counts pathways over time: you can reach
 * Settings from here and also from there, which costs nothing while you are
 * not using either. Two buttons visible at once cost a decision every time you
 * look at the screen. So this is the census of what is *co-present*, and it is
 * a test rather than a paragraph because the fault it holds is invisible in a
 * type check, in a screenshot at one width, and in every other test here.
 */

const read = (f: string) => readFileSync(f, 'utf8');

/** The workspace's three pieces of chrome, as source. */
const BAR = () => read('src/components/desk/TopBar.tsx');
const SIDE = () => read('src/components/desk/Sidebar.tsx');

/**
 * What each jobs looks like in source.
 *
 * Matched on the dispatch rather than on the label, because a label is what
 * drifts and the dispatch is what the button actually does — two rows can be
 * called different things and still land you in the same place, which is the
 * half of this fault that a reading of the screenshots would miss.
 */
const JOBS: Record<string, RegExp> = {
  'the capture box': /type: 'quickAdd', open: true/,
  'the palette': /type: 'finder', open: true/,
  'the search home': /screen: 'search'/,
  'Settings': /screen: 'settings'/,
  'Alerts': /screen: 'notifs'/,
  'your profile': /screen: 'profile'/,
  'the launcher': /type: 'apps', open/,
};

describe('the workspace draws each job once', () => {
  for (const [job, mark] of Object.entries(JOBS)) {
    it(`does not put ${job} in both the bar and the sidebar`, () => {
      const inBoth = mark.test(BAR()) && mark.test(SIDE());
      expect(inBoth, `${job} is drawn twice, in one frame`).toBe(false);
    });
  }

  /*
   * And the third piece, which is the one that was wrong. The header's five
   * are decided by `headerRow`, so this asks the rule rather than the markup
   * — the markup asking the rule is `header.test.ts`'s business.
   */
  const AT_ROOT = { atRoot: true, phone: false, counting: false };

  it('leaves the header nothing the bar already carries', () => {
    const row = headerRow({ ...AT_ROOT, desk: true, sidebar: false });
    // The bar draws its field at every width, and its four tools beside it.
    expect(row.search, 'the bar has a search field').toBe(false);
    expect(row.apps, 'the bar has the nine dots').toBe(false);
    expect(row.alerts, 'the bar has the bell').toBe(false);
    expect(row.avatar, 'the bar has the avatar').toBe(false);
  });

  it('leaves the header nothing the sidebar already carries', () => {
    expect(headerRow({ ...AT_ROOT, desk: true, sidebar: true }).add, 'the sidebar has New').toBe(
      false,
    );
  });

  /*
   * Nothing becomes unreachable, which is the other half of every cut above.
   *
   * The sidebar is `desk && wide`, so the narrow workspace has no column —
   * and there the header's `+` is the only pointing route to the capture box
   * and has to stay. This is the case a rule written as `!desk` would have
   * got wrong, and the reason `headerRow` takes both facts.
   */
  it('keeps the one control the narrow workspace has nowhere else', () => {
    const narrow = chromeFor('workspace', 'notifs', false);
    expect(narrow.sidebar, 'a narrow workspace draws no sidebar').toBe(false);
    expect(headerRow({ ...AT_ROOT, desk: true, sidebar: narrow.sidebar }).add).toBe(true);
    expect(SIDE(), 'and the column it is standing in for is where New lives').toMatch(
      /type: 'quickAdd', open: true/,
    );
  });
});

/**
 * The assistant, whose two surfaces are not the duplicate — its buttons were.
 *
 * `ai/Assistant.tsx` and the Ask tab are one conversation behind two doors,
 * and that is deliberate and argued at length in that file: the panel carries
 * the screen you are standing on, the tab is the room where every thread
 * lives, and both draw the *same* components so one conversation cannot start
 * reading as two products. They are also named apart — the floating button
 * says "Ask about <screen>", the tab's controls say "AI Tutor" — so they are
 * not the fault the census above is about. Left alone on purpose.
 *
 * What was the fault: the workspace's bar draws an AI Tutor button on every
 * screen, and the search home drew a second one, same words and same glyph,
 * one row below the first. Two identical controls in one frame, on the screen
 * the workspace opens on.
 */
describe('the assistant is offered once per frame', () => {
  const HOME = () => read('src/screens/Search.tsx');

  it('leaves the AI Tutor button to the bar that draws it on every screen', () => {
    expect(BAR(), 'the bar is the survivor').toContain("screen: 'ask'");
    expect(withoutComments(HOME()), 'the search home must not draw a second').not.toContain(
      "screen: 'ask'",
    );
  });

  it('keeps the panel and the tab named apart', () => {
    const panel = read('src/ai/Assistant.tsx');
    // The floating button says where it will ask about; the bar says what it
    // opens. Two doors to one conversation is fine — two doors wearing one
    // name is the fault, and `App.tsx`'s launcher/directory pair was it.
    expect(panel).toContain('aria-label={`Ask about ${here}`}');
    expect(BAR()).toContain('AI Tutor');
    expect(panel, 'the panel does not call itself the tab').not.toContain('AI Tutor');
  });

  /*
   * And the handoff stays, because it is a handoff and not a second door: the
   * panel's ALL CHATS is reached only from inside the open panel, which is the
   * one place the tab's history is missing and wanted.
   */
  it('keeps the panel’s way through to the tab', () => {
    expect(read('src/ai/Assistant.tsx')).toContain("screen: 'ask'");
  });
});

/**
 * One name, one place.
 *
 * Distinct from the census above, and the reason it is separate: these two
 * controls are *not* duplicates — the bar's nine dots open the launcher and
 * the sidebar's row opens the directory screen — but for a while they were
 * both called "All apps", in one frame, going to two different places. A
 * screen reader read them out identically. That is worse than a duplicate,
 * because pressing one is the only way to find out which you had.
 */
describe('two controls in one frame never share a name', () => {
  it('keeps the launcher and the directory separately named', () => {
    expect(BAR(), 'the nine dots are the launcher').toContain('aria-label="All apps"');
    expect(SIDE(), 'so the row that opens the directory must not be').not.toContain("'All apps'");
    expect(SIDE()).toContain("'App directory'");
  });
});
/**
 * And the same fault outside the workspace: one glyph, two meanings.
 *
 * The feed's floating button drew a `Plus` that opened the syllabus importer
 * while the header above it drew a `Plus` that opened the capture box — two
 * of the same mark on one screen doing different things. The header's own
 * note had already made the argument, about an earlier version of exactly
 * this: a `+` whose meaning depends on the screen is "the one control whose
 * meaning you can rely on" turned into one you have to check.
 */
describe('the + means one thing', () => {
  it('leaves no second Plus on the screen the header draws one on', () => {
    const app = read('src/App.tsx');
    const pluses = [...app.matchAll(/<Plus size=\{\d+\} \/>/g)];
    expect(pluses.length, 'one + in the chrome, and it is the capture box').toBe(1);
    const at = app.indexOf('<Plus size=');
    const opening = app.slice(0, at).split('<button').pop() ?? '';
    expect(opening, 'and it opens the capture box').toContain("type: 'quickAdd'");
  });
});

/**
 * One place each preference is written — and the reason it is in this file.
 *
 * The census above is about two controls in one frame. This is the same fault
 * one layer down: two controls over one *key*, which do not have to share a
 * frame to disagree, because the disagreement is stored.
 *
 * The sixth pass reported a null result on this axis and it was not null.
 * Three settings had two writers. Two are keeps — `feedOrder` and `boardOrder`
 * are written by dragging the thing itself and by an arrowed list in Settings,
 * which is the object and the index of the object, through one resolver, and
 * cannot disagree. The third was real.
 *
 * ## What `ground`'s second writer actually did
 *
 * The workspace's Customize panel drew a Dark/Light pair. It read the current
 * ground through `resolveGround`, which exists to turn the `device`
 * instruction into a palette — so somebody whose setting was **Match my
 * device** was shown Dark, lit, as a choice they had made. Pressing Light
 * counted as a move and wrote a fixed `paper` over the instruction: silently,
 * one way, and not even the ground Match my device resolves light to.
 *
 * A second control that could not express the key it wrote. The pair is gone;
 * the row below it opens the page where all eleven states live, and reports
 * which one you are on through `groundName`, the function that does not erase
 * `device`. These hold both halves.
 */
describe('one writer per preference', () => {
  /*
   * The surfaces that are not Settings, and could grow a copy of one of its
   * controls. `components/Appearance.tsx` is deliberately absent: it holds the
   * layout and navigation pickers *for* `screens/settings/Nav.tsx`, which is
   * its only caller, so it is that page rather than a second surface — the
   * check below holds it to that.
   */
  const FILES = [
    'src/components/desk/Customize.tsx',
    'src/components/desk/AppsPanel.tsx',
    'src/components/desk/Sidebar.tsx',
    'src/components/desk/TopBar.tsx',
    'src/screens/Directory.tsx',
    'src/screens/Springboard.tsx',
  ];

  it('keeps the pickers in components/Appearance.tsx a settings page’s own', () => {
    const callers = [
      'src/screens/settings/Nav.tsx',
      ...FILES,
      'src/App.tsx',
      'src/screens/Search.tsx',
    ].filter((f) => /from '.*components\/Appearance'/.test(read(f)));
    expect(callers, 'Appearance is Settings’ picker, not a shared control').toEqual([
      'src/screens/settings/Nav.tsx',
    ]);
  });

  /*
   * The look fields that are appearance preferences, as against the ones that
   * are the arrangement of a thing you can drag — `favourites`, `boardOrder`,
   * `groupOrder` and `directory` are written where the thing is, on purpose.
   */
  const OWNED = ['ground', 'accent', 'hue', 'courseColours', 'shell', 'labels', 'badges'];

  for (const field of OWNED) {
    it(`writes ${field} only under screens/settings/`, () => {
      const wrote = FILES.filter((f) => new RegExp(`\\b${field}:`).test(read(f)));
      expect(wrote, `${field} is written outside Settings`).toEqual([]);
    });
  }

  /*
   * And the one exemption, stated rather than left as a gap in the list above.
   *
   * `Customize`'s "Open the original layout" writes `nav`, which
   * `screens/settings/Nav.tsx` also writes. It is not a second picker: it can
   * only ever write one value, it never reads the current one, and it says
   * where it goes. That is an exit, not a control over the setting — and a
   * design that can only be entered is one people refuse to try. A *picker*
   * appearing here, which would have to read `state.nav` to draw itself, is
   * what this catches.
   */
  it('leaves the panel an exit out of the workspace, not a navigation picker', () => {
    const src = read('src/components/desk/Customize.tsx');
    expect(src, 'the one-way exit stays').toContain("type: 'setNav', nav: 'tabs'");
    expect([...src.matchAll(/type: 'setNav'/g)].length, 'and it is the only one').toBe(1);
    expect(src, 'an exit does not read the setting it writes').not.toContain('state.nav');
  });

  it('names a ground without erasing Match my device', () => {
    // `resolveGround` answers "which palette do I paint" and must resolve it;
    // `groundName` answers "what did this person choose" and must not. The
    // pair was built on the first while doing the second's job.
    expect(resolveGround(MATCH_DEVICE, true)).toBe('ink');
    expect(groundName(MATCH_DEVICE)).toBe(MATCH_DEVICE_LABEL);
    expect(groundName('ink')).toBe('Ink');
    expect(groundName(undefined)).toBe(ground(undefined).label);
  });

  it('reports the ground in the panel rather than offering to set it', () => {
    const src = read('src/components/desk/Customize.tsx');
    expect(src, 'the panel names the setting').toContain('groundName(look.ground)');
    expect(src, 'and opens the page that owns it').toContain("screen: 'setLook'");
    // Comments blanked: this file's own note *names* `resolveGround`, because
    // explaining what the pair got wrong requires naming what it read. The
    // code must not call it.
    expect(
      withoutComments(src),
      'a reporter must not resolve the instruction away',
    ).not.toContain('resolveGround');
  });
});
