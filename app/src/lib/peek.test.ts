import { describe, expect, it } from 'vitest';
import { peekAt, peekSaid } from './peek';
import { justGo, NEW_TAB, type AppTab, type TabGroup } from './browser';

/**
 * What the hover card says, checked without drawing it.
 *
 * The card exists because the strip withholds things: a name is cut at 190
 * pixels and a pinned tab has no name on it at all. So what it says is the
 * feature, and most of the ways it can be wrong are ways of saying too much —
 * a line repeating the line above it, a group on a tab that is in none.
 */

const tab = (over: Partial<AppTab> = {}): AppTab => ({
  id: 't1',
  screen: 'calendar',
  title: 'Calendar',
  place: justGo('calendar'),
  ...over,
});

const group = (name: string): TabGroup => ({ id: 'g1', name, tone: 3, collapsed: false });

describe('what a tab says about itself', () => {
  it('leads with the name in full, which is the thing the strip may have cut', () => {
    const long = 'PSCI 1104 · Understanding Political Controversy';
    expect(peekAt(tab({ title: long }), null).title).toBe(long);
  });

  it('does not repeat itself', () => {
    // A tab called Calendar on the calendar screen. Two lines reading
    // "Calendar" over "Calendar" is the shape of a bug, not of a card.
    expect(peekAt(tab(), null).kind).toBeUndefined();
  });

  it('does not repeat the word the name already ends with', () => {
    // Found on the card rather than in the head: the lesson screen names its
    // own tab "ECON 1020 · Lesson", so the kind line read "Lesson" three
    // lines under the word Lesson.
    expect(peekAt(tab({ screen: 'lesson', title: 'ECON 1020 · Lesson' }), null).kind).toBeUndefined();
    // But a name that merely contains the word is not the same claim: this
    // one is about a lesson, and saying so is the point of the line.
    expect(peekAt(tab({ screen: 'course', title: 'Lesson planning' }), null).kind).toBe('Course');
  });

  it('says what kind of place it is when that is not the name', () => {
    // A course tab is named after the course — "ECON 1020" — so the screen it
    // sits on is genuinely a second fact.
    expect(peekAt(tab({ screen: 'course', title: 'ECON 1020' }), null).kind).toBe('Course');
  });

  it('names the work it belongs to, and says nothing when it belongs to none', () => {
    expect(peekAt(tab(), group('Midterm')).group).toBe('Midterm');
    expect(peekAt(tab(), null).group).toBeUndefined();
  });

  it('calls an unnamed group a group rather than an empty string', () => {
    // Three tabs grouped in one gesture and never named is how most groups
    // start; the card must not render a blank line for it.
    expect(peekAt(tab(), group('')).group).toBe('Group');
  });

  it('says it is the one making the noise, and whether it has been silenced', () => {
    expect(peekAt(tab(), null, { talking: true }).sound).toBe('playing');
    expect(peekAt(tab({ muted: true }), null, { talking: true }).sound).toBe('muted');
    // Muted but silent is not a sound. The tab list says that; this is about
    // what is happening, not what is set.
    expect(peekAt(tab({ muted: true }), null).sound).toBeUndefined();
  });

  it('carries what the tab last searched for', () => {
    expect(peekAt(tab({ query: 'midterm 2' }), null).query).toBe('midterm 2');
    expect(peekAt(tab(), null).query).toBeUndefined();
  });

  it('gives a new tab its name rather than nothing', () => {
    expect(peekAt(tab({ screen: null, title: '' }), null).title).toBe(NEW_TAB);
  });
});

describe('the line that is not about the tab', () => {
  it('offers the keys once there is somewhere to move to', () => {
    expect(peekAt(tab(), null, { talking: false }, 3).moves).toBe(true);
  });

  it('says nothing on a strip of one, where the keys would be a lie', () => {
    expect(peekAt(tab(), null, { talking: false }, 1).moves).toBeUndefined();
    expect(peekAt(tab(), null).moves).toBeUndefined();
  });

  it('stays out of what is read aloud', () => {
    /*
     * The keys are on the tab as `aria-keyshortcuts`, which is the attribute
     * for them. In the description they would be read out on every tab you
     * moved to — and moving along the strip is exactly what somebody using
     * these keys is doing, so the hint would arrive once per press.
     */
    expect(peekSaid(peekAt(tab(), null, { talking: false }, 4))).toBe('Calendar');
  });
});

describe('the same card, said aloud', () => {
  it('is one sentence of the facts that are there', () => {
    const said = peekSaid(
      peekAt(tab({ screen: 'course', title: 'ECON 1020', query: 'midterm' }), group('Midterm'), {
        talking: true,
      }),
    );
    expect(said).toBe('ECON 1020 · Course · in Midterm · playing · searched for midterm');
  });

  it('says a muted tab is still playing, because it is', () => {
    const said = peekSaid(peekAt(tab({ muted: true }), null, { talking: true }));
    expect(said).toBe('Calendar · playing, muted');
  });

  it('is just the name when there is nothing else to say', () => {
    expect(peekSaid(peekAt(tab(), null))).toBe('Calendar');
  });

  it('never leaves a dangling separator', () => {
    for (const t of [tab(), tab({ query: 'x' }), tab({ screen: null, title: '' })]) {
      const said = peekSaid(peekAt(t, null));
      expect(said.startsWith('·')).toBe(false);
      expect(said.endsWith('·')).toBe(false);
      expect(said).not.toContain('··');
    }
  });
});
