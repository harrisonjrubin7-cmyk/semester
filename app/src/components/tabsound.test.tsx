// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TabFind } from './TabFind';
import { StoreProvider } from '../state/store';
import { forgetStrip, muteTab, openTab, record, strip } from '../lib/browser.hook';
import { forgetSound, playHere } from '../lib/sound.hook';
import { justGo } from '../lib/browser';

/**
 * What the tab list says about sound.
 *
 * The strip draws a speaker only on the tab that is playing, because the
 * strip is short of room. This list has room and says more: a tab that is
 * **muted and silent** is the state the tab menu creates before anything has
 * played, and without a glyph here it is a setting with no way to see it —
 * you would get to that tab, press Play, hear nothing, and have no idea why.
 *
 * Rendered rather than asserted on the source, because the fault this guards
 * is *which glyph is drawn in which of four states*, and three of those four
 * look identical to a type checker.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/*
 * Inside the store, because the list tints each row with its group's colour
 * and the twelve tones are derived from the reader's own accent.
 */
const show = () =>
  act(() => {
    root.render(
      <StoreProvider>
        <TabFind onPick={() => {}} onClose={() => {}} onBack={() => {}} />
      </StoreProvider>,
    );
  });

/** Open the list. It is a popover behind the caret at the end of the strip. */
const open = () => {
  show();
  const caret = host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
  if (!caret) throw new Error('no caret — the list did not draw at all');
  act(() => caret.click());
};

/** Every sound control in the list, by what it offers to do. */
const speakers = () =>
  [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Mute "], button[aria-label^="Unmute "]')]
    .map((b) => b.getAttribute('aria-label') ?? '');

/** A strip of four, which is `ENOUGH` for the list to draw at all. */
const fourTabs = () => {
  record('home', 'Today', justGo('home'));
  for (const [screen, name] of [['study', 'Lesson'], ['calendar', 'Calendar'], ['mine', 'Mine']] as const) {
    openTab();
    record(screen, name, justGo(screen));
  }
};

/** The id of the tab named this. */
const idOf = (title: string) => {
  const tab = strip().tabs.find((t) => t.title === title);
  if (!tab) throw new Error(`no tab named ${title}`);
  return tab.id;
};

beforeEach(() => {
  localStorage.clear();
  forgetStrip();
  forgetSound();
  if (root) act(() => root.unmount());
  host?.remove();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

describe('the tab list, on sound', () => {
  it('says nothing at all when nothing is playing and nothing is muted', () => {
    fourTabs();
    open();
    // Four rows and not one glyph: a column of "no" is a column nobody reads.
    expect(speakers()).toEqual([]);
  });

  it('marks the tab that is playing, while you are looking at another one', () => {
    fourTabs();
    // `playHere` claims the player for the tab that is on — here, Mine.
    playHere({ src: '/audio/lessons/econ/unit-0.mp3', title: 'Unit 1', course: 'ECON 1020' });
    // Then go somewhere else, which is the case the indicator is for: the
    // tab making the noise is not the tab in front of you.
    openTab();
    record('courses', 'Courses', justGo('courses'));
    expect(strip().tabs[strip().at].title).toBe('Courses');
    open();
    expect(speakers()).toEqual(['Mute Mine']);
  });

  it('marks a tab that is muted and silent — which the strip never shows', () => {
    fourTabs();
    muteTab(idOf('Calendar'), true);
    open();
    // Nothing is playing anywhere. The glyph is here because the *setting* is,
    // and this list is the only place it can be seen or undone.
    expect(speakers()).toEqual(['Unmute Calendar']);
  });

  it('offers to unmute a tab that is playing while muted', () => {
    fourTabs();
    playHere({ src: '/audio/lessons/econ/unit-0.mp3', title: 'Unit 1', course: 'ECON 1020' });
    const playing = strip().tabs[strip().at];
    muteTab(playing.id, true);
    open();
    expect(speakers()).toEqual([`Unmute ${playing.title}`]);
  });

  it('presses through to the strip, so the list and the strip agree', () => {
    fourTabs();
    muteTab(idOf('Calendar'), true);
    open();
    const button = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.getAttribute('aria-label') === 'Unmute Calendar');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    act(() => button?.click());
    expect(strip().tabs.find((t) => t.title === 'Calendar')?.muted).toBeUndefined();
  });

  it('keeps the control out of the option, where a screen reader cannot reach it', () => {
    // The row is a `role="option"` in a `role="listbox"`. A button nested
    // inside an option is announced as part of the option's label and cannot
    // be operated — the close cross is a sibling for the same reason.
    fourTabs();
    muteTab(idOf('Calendar'), true);
    open();
    const inside = host.querySelectorAll('[role="option"] button[aria-label^="Unmute "]');
    expect(inside).toHaveLength(0);
    expect(speakers()).toHaveLength(1);
  });
});
