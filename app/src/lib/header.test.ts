import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DESTINATIONS } from './nav';
import { SETTINGS, pageTitle, settingsTitle } from './settings';

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
   * Two halves, and neither is visible in a screenshot of the screen it is
   * wrong on. It must be on every navigation: it began as the feed layout's
   * own button, going to Progress because there was no profile to go to, and
   * putting it back behind `state.nav === 'feed'` would hide the app's own
   * profile from three of its four navigations. And it must stay behind
   * `atRoot`: a walked-into screen spends that corner on Back, and the title
   * is what pays for a fifth icon — four already cost it 44px, and at a root
   * the title is a tab name, which is short by construction.
   */
  it('puts the avatar at every navigation’s root, and only at a root', () => {
    const at = src().indexOf('<Avatar name={state.myName}');
    expect(at, 'the header avatar has moved; point this test at it').toBeGreaterThan(-1);
    // The last condition opened before it, which is the one it is drawn under.
    const guards = [...src().slice(0, at).matchAll(/\{([^{}\n]*?)&& \(/g)];
    const last = guards[guards.length - 1]?.[1].trim();
    expect(last, 'the avatar should be gated on atRoot alone').toBe('atRoot');
  });

  it('sends the avatar to the profile, not to the progress report', () => {
    // It went to `me` for as long as there was no screen about the person.
    const at = src().indexOf('<Avatar name={state.myName}');
    const opening = src().slice(0, at).split('<button').pop() ?? '';
    expect(opening).toContain("screen: 'profile'");
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
