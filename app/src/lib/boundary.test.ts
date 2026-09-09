import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { faultOf } from './fault';

/**
 * A screen that falls over does not take the app with it.
 *
 * The app had no error boundary anywhere. React unmounts the whole tree when
 * a render throws and nothing catches it — not the screen, the tree — so one
 * bad render meant `#root` with zero children: a white page, no message, no
 * navigation, no way back but clearing the site's data. Somebody whose
 * semester is in here would reasonably conclude they had lost it.
 *
 * It was found by the failure most likely to cause it. Every screen but Today
 * is fetched when opened, every deploy renames those files, and Pages stops
 * serving the old ones — so an installed app open since before a deploy asks
 * for a chunk that is gone. Measured in a browser: `#root` empty, zero
 * characters. Four deploys went out in one afternoon while that was true.
 *
 * Measuring it again needs a browser, so this holds the parts that can be
 * read: that the boundary exists, that it is wired into *both* layouts, and
 * that it still knows a stale chunk from a real fault — which is what decides
 * whether somebody is told to reload or told something broke.
 */
const boundary = readFileSync('src/components/Boundary.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

describe('the screen boundary', () => {
  it('is a real boundary', () => {
    expect(boundary).toContain('getDerivedStateFromError');
    expect(boundary).toContain('componentDidCatch');
  });

  it('wraps the screen in both layouts, not just one', () => {
    // The phone and the wide layout are two separate return statements in
    // `App.tsx`. Wrapping one and not the other would leave a phone — where
    // this app is mostly used — taking the whole app down on a bad screen.
    const wraps = app.match(/<ScreenTrouble\b/g) ?? [];
    expect(wraps.length, 'both the phone and the wide layout need one').toBe(2);
  });

  it('resets when you move on, so one failure does not follow you', () => {
    expect(app).toMatch(/<ScreenTrouble key=\{state\.screen\}/);
  });

  it('sits inside the chrome, so there is a way out of a broken screen', () => {
    // Wrapping the whole app would catch the same errors and leave a
    // full-page apology with no navigation — only marginally better than the
    // white page it replaced.
    for (const m of app.matchAll(/<ScreenTrouble[\s\S]{0,240}?<\/ScreenTrouble>/g)) {
      expect(m[0], 'the boundary should wrap the screen body').toContain('<CurrentScreen />');
      expect(m[0], 'it must not swallow the tab bar or the header').not.toContain('<TabBar');
    }
  });

  it('knows an app that was updated from an app that is broken', () => {
    // The reading itself moved to `lib/fault.ts`, where it is tested against
    // each engine's wording directly rather than by pulling a regular
    // expression back out of this file's source. What is left to check here
    // is that the boundary asks it, and asks it with the connection — which
    // is what separates "the app was updated" from "there is no signal and
    // this was never downloaded".
    expect(boundary).toContain('faultOf(error, !offline())');
    expect(faultOf(new Error('Failed to fetch dynamically imported module'), true)).toBe('stale');
    expect(faultOf(new Error("Cannot read properties of undefined (reading 'code')"), true)).toBe(
      'broken',
    );
  });

  it('says the right one of three, and offers what works first', () => {
    // A missing file with no connection was told as the update story: "a new
    // version was published… a reload is the whole fix", when nothing had
    // been published and the reload came back to the same message.
    expect(faultOf(new Error('Failed to fetch dynamically imported module'), false)).toBe('absent');
    expect(boundary).toContain('No connection');
    expect(boundary).toContain('This screen has not been downloaded.');
    // Offline the reload cannot fetch what was never fetched, so leaving is
    // the press that works and it goes first.
    expect(boundary).toMatch(/fault === 'absent' \? \['leave', 'reload'\] : \['reload', 'leave'\]/);
  });

  it('offers both a reload and a way off the screen', () => {
    expect(boundary).toContain('window.location.reload()');
    expect(boundary).toContain('onLeave');
  });

  it('records the failure where the diagnostics screen already looks', () => {
    expect(boundary).toContain('LOG_KEY');
    // A logger that throws inside an error handler turns one visible problem
    // into two invisible ones.
    expect(boundary).toMatch(/try \{[\s\S]*?LOG_KEY[\s\S]*?\} catch/);
  });
});
