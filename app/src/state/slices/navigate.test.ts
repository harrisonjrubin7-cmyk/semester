import { describe, expect, it } from 'vitest';
import { reducer } from '../reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type Action, type State } from '../shape';
import { LIBRARIES, NAMED } from '../../lib/route';

/**
 * Two things the address bar is responsible for, and both were wrong.
 *
 * **Which file is open is part of the address.** It is deliberately not part
 * of `pickPersisted` — what somebody had open is not their term — so if it is
 * not in the address it exists only in memory, and a reload lands on the
 * library with the document saved and no longer open. Which reads, to the
 * person who reloaded, as having lost it.
 *
 * **A panel drawn over the screen must not outlive it.** `finder` and `apps`
 * cover everything and know nothing about navigation, so a search opened on
 * Today stayed open over Courses, and over whatever the browser's Back button
 * landed on. There are three ways to move, and the fix belongs in the one
 * funnel they all pass through rather than in a listener inside each panel.
 */

const start = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral(new Date(2026, 8, 15)) });

const run = (state: State, ...actions: Action[]): State => actions.reduce((s, a) => reducer(s, a), state);

describe('the makers keep their file in the address', () => {
  it('names a field for every library screen', () => {
    // If a screen is in one table and not the other, `landed` reads undefined
    // and the id goes nowhere — silently, which is how this class of bug hides.
    for (const screen of LIBRARIES) expect(NAMED[screen], screen).toBeTruthy();
  });

  it('puts the open file in state when the address carries one', () => {
    const after = run(start(), { type: 'landed', screen: 'write', id: 'doc-1' });
    expect(after.screen).toBe('write');
    expect(after.documentId).toBe('doc-1');
  });

  it('clears it when the address is the library', () => {
    const open = run(start(), { type: 'landed', screen: 'write', id: 'doc-1' });
    expect(run(open, { type: 'landed', screen: 'write' }).documentId).toBeNull();
  });

  it('swaps one file for another on the screen it is already on', () => {
    // The early return for an unchanged screen is right everywhere else and
    // wrong here: it is what left the first document open behind a bookmark
    // pointing at the second.
    const open = run(start(), { type: 'landed', screen: 'write', id: 'doc-1' });
    expect(run(open, { type: 'landed', screen: 'write', id: 'doc-2' }).documentId).toBe('doc-2');
  });

  it('does the same for sheets and decks', () => {
    const sheet = run(start(), { type: 'landed', screen: 'sheet', id: 's-1' });
    expect(sheet.sheetId).toBe('s-1');
    expect(run(sheet, { type: 'landed', screen: 'sheet' }).sheetId).toBeNull();

    const deck = run(start(), { type: 'landed', screen: 'deck', id: 'd-1' });
    expect(deck.deckId).toBe('d-1');
    expect(run(deck, { type: 'landed', screen: 'deck' }).deckId).toBeNull();
  });

  it('leaves a study id alone, because there no id means the course you are in', () => {
    const guide = run(start(), { type: 'landed', screen: 'guide', id: 'econ' });
    expect(run(guide, { type: 'landed', screen: 'guide' }).guideId).toBe('econ');
  });
});

describe('a panel over the screen does not outlive it', () => {
  const searching = () => run(start(), { type: 'finder', open: true });

  it('closes on an in-app navigation', () => {
    expect(run(searching(), { type: 'go', screen: 'courses' }).finder).toBe(false);
  });

  it('closes when the browser moves', () => {
    expect(run(searching(), { type: 'landed', screen: 'courses' }).finder).toBe(false);
  });

  it('closes on back', () => {
    const there = run(searching(), { type: 'go', screen: 'courses' }, { type: 'finder', open: true });
    expect(run(there, { type: 'back' }).finder).toBe(false);
  });

  it('closes even when the navigation lands on the screen already shown', () => {
    // `push` returns early for the screen you are on, and the early return
    // used to carry the open panel straight past the dismissal.
    const here = run(searching(), { type: 'go', screen: 'home' });
    expect(here.finder).toBe(false);
  });

  it('never draws two of the three at once', () => {
    const both = run(start(), { type: 'finder', open: true }, { type: 'apps', open: true });
    expect([both.finder, both.apps]).toEqual([false, true]);

    const back = run(both, { type: 'finder', open: true });
    expect([back.finder, back.apps]).toEqual([true, false]);

    const quick = run(back, { type: 'quickAdd', open: true });
    expect([quick.finder, quick.apps, quick.quickAdd]).toEqual([false, false, true]);
  });

  it('leaves the others alone when one is closed', () => {
    const open = run(start(), { type: 'apps', open: true });
    expect(run(open, { type: 'finder', open: false }).apps).toBe(true);
  });
});

/**
 * Every navigation dismisses the overlays, not just the one that was watching.
 *
 * `dismiss()` in `navigate.ts` closes the search overlay and the apps sheet on
 * the way past, so a landing does not leave one of them over the screen it
 * just opened. It is the reducer's job rather than a panel's — the note there
 * says why: there are three ways to navigate, and a panel listening for one is
 * a panel that survives the other two.
 *
 * This test lived in `components/shell-overlap.test.tsx`, which was otherwise
 * about the browser shell and went with it in the seventh pass (E4). The test
 * is not about that shell at all: it touches no DOM and asserts a reducer
 * rule that holds for every navigation. Moved rather than deleted, because
 * deleting a rule with the file that happened to hold it is how a rule stops
 * being kept.
 */
describe('the overlays close on the way past', () => {
  it('dismisses the search overlay and the apps sheet on go, landed and back', () => {
    const open = {
      ...DEFAULT_PERSISTED,
      ...initialEphemeral(new Date()),
      screen: 'home',
      finder: true,
      apps: true,
    } as State;

    for (const action of [
      { type: 'go', screen: 'home' },
      { type: 'landed', screen: 'home' },
      { type: 'back' },
    ] as const) {
      const next = reducer(open, action as Action);
      expect(next.finder, action.type).toBe(false);
      expect(next.apps, action.type).toBe(false);
    }
  });
});

