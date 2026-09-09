import { describe, expect, it } from 'vitest';
import {
  MOST,
  foldKey,
  isFolded,
  nextForAll,
  readFolds,
  setFold,
  setFolds,
  writeFolds,
  type Folds,
} from './folds';

describe('naming a section', () => {
  it('is the screen and what the heading says, not where it sits', () => {
    expect(foldKey('home', 'What’s coming')).toBe('home·what’s coming');
  });

  it('ignores the things that are not the name', () => {
    expect(foldKey('home', '  Today’s   SCHEDULE ')).toBe(foldKey('home', 'Today’s schedule'));
  });

  it('keeps two screens apart', () => {
    expect(foldKey('home', 'This week')).not.toBe(foldKey('courses', 'This week'));
  });

  it('tells apart two sections on one screen that say the same words', () => {
    expect(foldKey('home', 'Notes', 0)).not.toBe(foldKey('home', 'Notes', 1));
  });

  it('still names a heading with no words in it', () => {
    expect(foldKey('home', '')).toBeTruthy();
  });
});

describe('what the device remembers', () => {
  it('is nothing, on a device that has never been asked', () => {
    expect(readFolds(null)).toEqual({});
  });

  it('survives somebody else’s value', () => {
    for (const junk of ['', 'null', '{}', '["ok",7,null]', 'not json at all']) {
      expect(() => readFolds(junk)).not.toThrow();
    }
    expect(readFolds('["ok",7,null]')).toEqual({ ok: true });
  });

  it('round-trips', () => {
    const set = setFolds({}, ['a', 'b'], true);
    expect(readFolds(writeFolds(set))).toEqual(set);
  });

  it('holds no more than it said it would', () => {
    const many = Array.from({ length: MOST + 40 }, (_, i) => `k${i}`);
    const set = setFolds({}, many, true);
    expect(Object.keys(set).length).toBe(MOST);
    expect(Object.keys(readFolds(writeFolds(set))).length).toBe(MOST);
  });
});

describe('folding and unfolding', () => {
  it('stores only what was shut, so an untouched screen costs nothing', () => {
    const one = setFold({}, 'home·notes', true);
    expect(writeFolds(one)).toBe('["home·notes"]');
    expect(writeFolds(setFold(one, 'home·notes', false))).toBe('[]');
  });

  it('hands back the same set when nothing changed', () => {
    const set: Folds = setFold({}, 'a', true);
    expect(setFold(set, 'a', true)).toBe(set);
    expect(setFold(set, 'b', false)).toBe(set);
  });

  it('says nothing is folded until something is', () => {
    expect(isFolded({}, 'a')).toBe(false);
    expect(isFolded(setFold({}, 'a', true), 'a')).toBe(true);
  });
});

describe('the one control above them all', () => {
  const keys = ['a', 'b', 'c'];

  it('collapses while anything is open', () => {
    expect(nextForAll({}, keys)).toEqual({ shut: true, said: 'Collapse all' });
    expect(nextForAll(setFold({}, 'a', true), keys).shut).toBe(true);
  });

  it('is the way back once everything is shut', () => {
    expect(nextForAll(setFolds({}, keys, true), keys)).toEqual({ shut: false, said: 'Expand all' });
  });

  it('answers for the sections on screen, not for every one ever folded', () => {
    const elsewhere = setFolds({}, ['x', 'y'], true);
    expect(nextForAll(elsewhere, keys).shut).toBe(true);
  });
});
