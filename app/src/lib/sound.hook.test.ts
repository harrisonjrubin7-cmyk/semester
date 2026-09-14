// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { forgetStrip, openTab, strip } from './browser.hook';
import { forgetSound, mine, play, playHere, sound, stop } from './sound.hook';

/**
 * The player, and the one structural fact it depends on.
 *
 * The model in `sound.test.ts` holds who owns a sound. This holds the two
 * things that can only be got wrong in the wiring: the store agreeing with
 * the strip, and the element being mounted somewhere it will not be torn
 * down. The second is not a unit-testable property — it is a fact about the
 * shape of `App.tsx` — so it is asserted against the source, in the way
 * `onframe.test.ts` already asserts co-presence.
 */

beforeEach(() => {
  localStorage.clear();
  forgetStrip();
  forgetSound();
});

const listen = () =>
  playHere({ src: '/audio/lessons/econ/unit-0.mp3', title: 'Unit 1', course: 'ECON 1020' });

describe('the player and the strip', () => {
  it('belongs to whatever tab is on, without the screen having to name one', () => {
    listen();
    expect(sound()?.tab).toBe(strip().tabs[strip().at].id);
  });

  it('plays on through a tab switch — the whole reason it is not in a screen', () => {
    listen();
    const was = sound();
    openTab();
    expect(sound()).toBe(was);
  });

  it('claiming the same file for the same tab again does not restart it', () => {
    listen();
    const was = sound();
    listen();
    expect(sound()).toBe(was);
  });

  it('is this tab’s sound only when it is this tab playing it', () => {
    listen();
    expect(mine('/audio/lessons/econ/unit-0.mp3')).toBe(true);
    // Another tab, same file: not this tab's, so this tab's Play says Play.
    openTab();
    expect(mine('/audio/lessons/econ/unit-0.mp3')).toBe(false);
  });

  it('goes quiet when told to', () => {
    listen();
    stop();
    expect(sound()).toBeNull();
  });

  it('goes quiet when its tab is not in the strip at all', () => {
    play({ tab: 'never-existed', place: [], src: '/a.mp3', title: 'A', course: 'X' });
    expect(sound()).toBeNull();
  });
});

/**
 * Where the element is mounted, which is not a detail.
 *
 * Found by measuring rather than by reading: with `<Sound />` mounted inside
 * each of the three layout frames, pressing Play and then opening a tab
 * replaced the element and the lesson began again from zero, paused. The
 * frames are chosen by `chromeFor`, which reads the screen — so opening a tab
 * can move the app from the workspace frame to the wide one, and a component
 * mounted in each of them is unmounted by that move.
 *
 * It survived the tab *switch* it was written for and died on the frame
 * change. So: one mount, outside every frame. This is the only test that can
 * see that, because it is a fact about the shape of a file.
 */
describe('the element is above every frame', () => {
  const app = () => readFileSync('src/App.tsx', 'utf8');

  it('is mounted exactly once', () => {
    expect(app().match(/<Sound \/>/g)).toHaveLength(1);
  });

  it('is a sibling of the chosen frame, not a child of one', () => {
    // Lexical order says nothing here — the frame builder is defined above
    // the return that calls it. What matters is that the element and the
    // frame are rendered side by side, so choosing a different frame does
    // not unmount the element.
    const src = app();
    const at = src.indexOf('<Sound />');
    expect(src.slice(at, at + 60)).toContain('{frame()}');
  });

  it('is not inside any of the three frames', () => {
    const src = app();
    // The frames are the two functions at the end and the `Workspace`
    // component above; the mount has to sit between them, in the return that
    // chooses one.
    expect(src.slice(src.indexOf('function wideFrame'))).not.toContain('<Sound />');
    expect(src.indexOf('<Sound />')).toBeGreaterThan(src.indexOf('const frame ='));
  });
});
