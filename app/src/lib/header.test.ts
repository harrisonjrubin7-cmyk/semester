import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DESTINATIONS } from './nav';
import { SETTINGS, pageTitle, settingsTitle } from './settings';
import { showsAvatar } from './header';
import { withoutComments } from '../styles/rules';

/**
 * Every screen wears its own name in the header.
 *
 * `useHeader` in `App.tsx` is a switch with a `default`, and a default that
 * always returns something can never be *missing* a case — so four screens
 * quietly wore "Today", with today's date over them, above content that was
 * plainly not today: Everything, How this works, Your data and Privacy.
 * Nothing failed. Nothing could.
 *
 * The fallback reads `DESTINATIONS` now, so a screen in the registry is named
 * for free. This checks the other half: that a screen the switch *does* name
 * has not been left with a stale title after a rename, and that the settings
 * pages take their name from the settings registry rather than a fourth copy.
 */
function headerSource(): string {
  const src = readFileSync('src/App.tsx', 'utf8');
  const fn = /function useHeader\(\)[\s\S]*?\n}\n/.exec(src);
  if (!fn) throw new Error('useHeader has moved; point this test at it.');
  return fn[0];
}

describe('the header', () => {
  it('names every registry screen — by a case of its own or by the fallback', () => {
    const src = headerSource();
    const cased = new Set([...src.matchAll(/case '([A-Za-z]+)':/g)].map((m) => m[1]));
    const usesRegistry = /fallbackHeader\(/.test(src);
    const unnamed = DESTINATIONS.map((d) => d.screen).filter((s) => !cased.has(s));
    // Either every screen has a case, or the fallback reads the registry.
    // What is not allowed is a screen with neither, which is what shipped.
    expect(usesRegistry || unnamed.length === 0, unnamed.join(', ')).toBe(true);
  });

  /*
   * The other registry, and the one the check above cannot see.
   *
   * A settings page is deliberately absent from `DESTINATIONS` — it is a page
   * under Settings, not a destination of its own — so "every registry screen
   * is named" passed while `setAssistant` had no case, was not in the
   * registry the fallback reads, and therefore wore `fallbackHeader`'s last
   * resort: "Today", dated, over the API key and the model picker. Every
   * settings page needs a case; there is no fallback that can name one.
   */
  it('gives every settings page a case of its own', () => {
    const cased = new Set([...headerSource().matchAll(/case '([A-Za-z]+)':/g)].map((m) => m[1]));
    const missing = SETTINGS.flatMap((s) => s.rows)
      .map((r) => r.screen)
      .filter((s) => /^set[A-Z]/.test(s) && !cased.has(s));
    expect(missing, `${missing.join(', ')} would fall through to "Today"`).toEqual([]);
  });

  it('never falls back to Today for a screen the registry knows', () => {
    const src = headerSource();
    // The literal that four screens used to wear. It may appear as the answer
    // for `home` and for an unlisted screen, and nowhere else — so it lives
    // inside `fallbackHeader`, behind the registry lookup.
    const defaults = [...src.matchAll(/default:\s*\n\s*return ([^;]+);/g)].map((m) => m[1].trim());
    for (const d of defaults) {
      expect(d, 'the default must ask the registry, not assume Today').toContain('fallbackHeader');
    }
  });

  /*
   * The page's own heading, too. It was a `title` prop each of the eight
   * pages passed to `SettingsPage`, so a page could — and one did — call
   * itself "Appearance" while the index that opened it said "Colour and
   * type". `SettingsPage` reads the registry now and takes no title at all.
   */
  it('leaves no page writing its own heading', () => {
    for (const row of SETTINGS.flatMap((s) => s.rows)) {
      expect(pageTitle(row.screen), row.screen).toBe(row.label);
    }
    const page = readFileSync('src/screens/settings/Page.tsx', 'utf8');
    expect(page, 'SettingsPage should not take a title prop').not.toMatch(/\btitle: string;/);
  });

  it('takes a settings page’s name from the settings registry', () => {
    for (const row of SETTINGS.flatMap((s) => s.rows)) {
      const name = settingsTitle(row.screen);
      expect(name, row.screen).toBe(row.short ?? row.label);
    }
    /*
     * And no `case 'setSomething':` writes a name out a second time. Checked
     * on the settings arms alone rather than on the whole switch, because two
     * ordinary screens legitimately share a name with a settings page — the
     * Courses screen and the Alerts screen — and forbidding the string
     * everywhere would be a test about coincidence.
     */
    const src = headerSource();
    // `set[A-Z]`, so the settings *index* — `case 'settings'`, which is a
    // screen of its own and rightly calls itself Settings — is not caught.
    const settingsArms = [...src.matchAll(/case 'set[A-Z][A-Za-z]*':\s*(?:\n\s*case 'set[A-Z][A-Za-z]*':\s*)*\n\s*return ([^;]+);/g)];
    expect(settingsArms.length, 'the settings pages should share one arm').toBeGreaterThan(0);
    for (const arm of settingsArms) {
      expect(arm[1], 'a settings page names itself from lib/settings.ts').toContain('settingsTitle');
    }
  });
});

/*
 * The header's icon buttons are the app's most-pressed controls — back, add,
 * search, alerts — and they are on almost every screen. They draw at 36px,
 * which is under the 44px floor, so each carries a `.tap` overlay that grows
 * the hit area without changing what you see.
 *
 * That overlay reaches 4px past the button on each side, so the row's gap
 * decides whether the overlays sit side by side or fight. At the 2px gap this
 * row shipped with, the pitch was 38px and they overlapped: measured on the
 * live bundle at 390x844, a tap 21px right of Search's centre pressed Alerts.
 * Eight puts the pitch at exactly 44.
 *
 * Neither half is visible in a screenshot and neither fails a type check, so
 * both are held here: drop the class or tighten the gap and this says so.
 */
describe('the header buttons a thumb has to hit', () => {
  const src = () => readFileSync('src/App.tsx', 'utf8');

  it('grows every icon button to a 44px hit area', () => {
    const withoutTap = [...src().matchAll(/className="btn btn-ghost btn-icon(?! tap)"/g)];
    expect(withoutTap.map(() => 'btn-icon without .tap')).toEqual([]);
  });

  it('still has icon buttons to check', () => {
    // Guards the assertion above: were the class string to change shape, the
    // negative match would pass on nothing at all.
    expect([...src().matchAll(/className="btn btn-ghost btn-icon tap"/g)].length).toBeGreaterThanOrEqual(4);
  });

  /*
   * The avatar, which is the one header control that is a *place* rather than
   * an action — and the one most easily broken by a well-meant tidy.
   *
   * The markup must ask `lib/header.ts` rather than testing anything itself.
   * Three conditions written inline is the shape that produced the bug: the
   * first version of this was `state.nav === 'feed' && atRoot`, which hid the
   * app's own profile from three of its four navigations *and* left the row
   * overflowing at 320px in the fourth. The rule, its measurement and its
   * argument are in that file; this holds that the markup defers to it.
   */
  it('asks lib/header.ts whether to draw the avatar', () => {
    const at = src().indexOf('<Avatar name={state.myName}');
    expect(at, 'the header avatar has moved; point this test at it').toBeGreaterThan(-1);
    // The condition its own element opens under: the text from the `{` that
    // starts the block to the `<button` that starts the element.
    const block = src().slice(0, at).split('<button').pop() ?? '';
    const opened = (src().slice(0, at - block.length - '<button'.length).match(/\{[^\n]*&& \(\s*$/) ?? [''])[0];
    expect(opened.trim(), 'the avatar is drawn by showsAvatar, not by a condition here').toBe(
      '{showsAvatar({ atRoot, phone, counting }) && (',
    );
  });

  it('sends the avatar to the profile, not to the progress report', () => {
    // It went to `me` for as long as there was no screen about the person.
    const at = src().indexOf('<Avatar name={state.myName}');
    const opening = src().slice(0, at).split('<button').pop() ?? '';
    expect(opening).toContain("screen: 'profile'");
  });

  it('reads whether a timer is counting from the hook the pill reads', () => {
    // Two sources for "is a timer running" is two answers, and the row and the
    // rule about the row would disagree at exactly the width that matters.
    expect(src()).toContain('running(useSitting()[0])');
    const pill = readFileSync('src/components/Running.tsx', 'utf8');
    expect(pill).toContain('useSitting()');
  });

  it('keeps the action row wide enough that those areas do not overlap', () => {
    // 36px button + 8px gap = 44px pitch, which is the overlay's own width.
    // --sp-1 (2px) and --sp-2 (4px) both put the buttons back on top of one
    // another; only --sp-4 and up clear it.
    const row = /<div style=\{\{ display: 'flex', gap: '(var\(--sp-\d\))', flex: 'none', alignItems: 'center' \}\}>/.exec(src());
    expect(row, 'the header action row has moved; point this test at it').not.toBeNull();
    expect(row![1]).toBe('var(--sp-4)');
  });
});

/**
 * The row's own arithmetic, apart from the markup that draws it.
 *
 * The numbers behind it are in `lib/header.ts`: six 36px buttons at a 44px
 * pitch, an 18px gutter each side, and an 83px timer pill do not fit across
 * 320px. Measured in a browser — the row's right edge landed at 331, and the
 * control it clipped was this one.
 */
describe('what the header can carry', () => {
  it('draws the avatar on a phone while nothing is counting', () => {
    expect(showsAvatar({ atRoot: true, phone: true, counting: false })).toBe(true);
  });

  it('gives the room to the timer when both want it on a phone', () => {
    expect(showsAvatar({ atRoot: true, phone: true, counting: true })).toBe(false);
  });

  it('keeps both where there is room for both', () => {
    // A tablet or a window: the rail is drawn and the header is not the
    // narrowest thing in the app any more.
    expect(showsAvatar({ atRoot: true, phone: false, counting: true })).toBe(true);
  });

  it('is never drawn off a root, where Back has the corner', () => {
    for (const phone of [true, false]) {
      for (const counting of [true, false]) {
        expect(showsAvatar({ atRoot: false, phone, counting }), `${phone} ${counting}`).toBe(false);
      }
    }
  });

  /*
   * The rule it replaced, asserted as a rule rather than as an absence.
   *
   * `state.nav === 'feed'` was the first version and it was wrong twice: it
   * hid the profile from three navigations, and the fourth — feed — is where
   * the overflow was already happening before the avatar existed.
   */
  it('does not depend on which navigation is on', () => {
    // Comments blanked: the file's own note names the feed layout, because
    // that is where the overflow was first drawn. The rule must not.
    const code = withoutComments(readFileSync('src/lib/header.ts', 'utf8'));
    expect(code).not.toContain("'feed'");
    expect(readFileSync('src/App.tsx', 'utf8')).not.toContain("state.nav === 'feed' && atRoot");
  });
});
