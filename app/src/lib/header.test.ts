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
