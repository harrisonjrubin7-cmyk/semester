// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_RECENTS,
  MAX_SUGGESTIONS,
  SEARCHES_KEY,
  forget,
  readSearches,
  remember,
  suggestions,
  writeSearches,
} from './typeahead';

/**
 * What the box offers, and what it must never offer.
 *
 * Two of these are the whole point of the file. A suggestion that leads
 * nowhere teaches people to stop reading the list, so every completion comes
 * from the names of things that matched and nothing else. And a row that is
 * exactly what is already typed does nothing when pressed, which is worse
 * than one row fewer.
 */

const texts = (list: { text: string }[]) => list.map((s) => s.text);
const kinds = (list: { kind: string }[]) => list.map((s) => s.kind);

beforeEach(() => {
  localStorage.clear();
});

describe('what you searched before', () => {
  it('puts the newest first', () => {
    expect(remember(remember([], 'econ'), 'calculus')).toEqual(['calculus', 'econ']);
  });

  it('moves a repeat to the front rather than keeping two of it', () => {
    expect(remember(['calculus', 'econ'], 'econ')).toEqual(['econ', 'calculus']);
  });

  it('treats a difference of case as the same search, and keeps the new spelling', () => {
    expect(remember(['econ 101'], 'Econ 101')).toEqual(['Econ 101']);
  });

  it('keeps nothing for an empty box', () => {
    expect(remember(['econ'], '   ')).toEqual(['econ']);
  });

  it('stops at a list rather than a log', () => {
    let list: string[] = [];
    for (let i = 0; i < MAX_RECENTS + 5; i += 1) list = remember(list, `query ${i}`);
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0]).toBe(`query ${MAX_RECENTS + 4}`);
  });

  it('forgets one, whatever case it was typed in', () => {
    expect(forget(['Econ 101', 'calculus'], 'econ 101')).toEqual(['calculus']);
  });
});

describe('what the box puts up', () => {
  it('offers history and somewhere to start when nothing is typed', () => {
    const rows = suggestions('', ['econ 101'], [], ['Microeconomics', 'Calendar']);
    expect(texts(rows)).toEqual(['econ 101', 'Microeconomics', 'Calendar']);
    expect(kinds(rows)).toEqual(['recent', 'explore', 'explore']);
  });

  it('leaves room beside a long history for somewhere to start', () => {
    const past = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const rows = suggestions('', past, [], ['Microeconomics']);
    expect(texts(rows).filter((t) => past.includes(t))).toHaveLength(5);
    expect(texts(rows)).toContain('Microeconomics');
  });

  it('completes from what can actually be found', () => {
    const rows = suggestions('mono', [], ['Monopoly and market power', 'Fiscal policy']);
    expect(texts(rows)).toEqual(['Monopoly and market power']);
    expect(kinds(rows)).toEqual(['complete']);
  });

  it('puts a match at the start of a name above one in the middle', () => {
    const rows = suggestions('state', [], ['The welfare state', 'State capacity']);
    expect(texts(rows)[0]).toBe('State capacity');
  });

  it('counts a match at the start of a word as a match at the start', () => {
    // "policy" against "Fiscal policy" is a middle match to a substring search
    // and the beginning of a word to everybody else. Against "Macropolicy" it
    // is a middle match to both.
    const rows = suggestions('policy', [], ['Macropolicy notes', 'Fiscal policy']);
    expect(texts(rows)[0]).toBe('Fiscal policy');
  });

  it('never offers back exactly what is in the box', () => {
    const rows = suggestions('econ 101', ['econ 101'], ['Econ 101']);
    expect(texts(rows)).toEqual([]);
  });

  it('says a thing once, however many places it came from', () => {
    const rows = suggestions('econ', ['econ 101'], ['Econ 101', 'Econ 101']);
    expect(texts(rows)).toEqual(['econ 101']);
  });

  it('stops before it becomes a wall', () => {
    const corpus = Array.from({ length: 40 }, (_, i) => `Monopoly ${i}`);
    expect(suggestions('mono', [], corpus)).toHaveLength(MAX_SUGGESTIONS);
  });

  it('offers no ideas once something is typed', () => {
    // Ideas are for an empty box. Beside a query they are noise that outranks
    // nothing and pushes the completions down.
    const rows = suggestions('mono', [], ['Monopoly'], ['Microeconomics']);
    expect(texts(rows)).toEqual(['Monopoly']);
  });
});

describe('what survives being put away', () => {
  it('comes back as it was left', () => {
    writeSearches(['econ 101', 'calculus']);
    expect(readSearches()).toEqual(['econ 101', 'calculus']);
  });

  it('answers with nothing rather than throwing on nonsense', () => {
    localStorage.setItem(SEARCHES_KEY, 'not json{');
    expect(readSearches()).toEqual([]);
    localStorage.setItem(SEARCHES_KEY, JSON.stringify({ not: 'a list' }));
    expect(readSearches()).toEqual([]);
    localStorage.setItem(SEARCHES_KEY, JSON.stringify(['econ', 7, '', 'calculus']));
    expect(readSearches()).toEqual(['econ', 'calculus']);
  });
});
