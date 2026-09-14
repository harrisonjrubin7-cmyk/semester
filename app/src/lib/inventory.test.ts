// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { elsewhere } from './inventory';
import { DRAFTS_KEY } from './draft';
import { STORAGE_KEY } from '../state/shape';

/**
 * The screen you open when the phone says it is out of space has to be able to
 * see everything the app wrote, not only the store. The assistant\u2019s
 * conversations, the open tabs and the bookmarks are each their own key, and
 * none of them was counted anywhere before this.
 */
describe('everything else the app has written', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('counts a key this app wrote', () => {
    localStorage.setItem('semester.threads', 'x'.repeat(50));
    const out = elsewhere();
    expect(out.keys).toBe(1);
    // Key and value both, because on a small value the key is most of it.
    expect(out.bytes).toBe(('semester.threads'.length + 50) * 2);
  });

  it('leaves alone what is not this app\u2019s', () => {
    localStorage.setItem('someone-else.cache', 'x'.repeat(1000));
    expect(elsewhere()).toEqual({ bytes: 0, keys: 0 });
  });

  it('does not count twice what the screen measures on its own', () => {
    localStorage.setItem(STORAGE_KEY, 'x'.repeat(1000));
    localStorage.setItem(DRAFTS_KEY, 'x'.repeat(1000));
    localStorage.setItem('semester.usage', '{}');
    const out = elsewhere([STORAGE_KEY, DRAFTS_KEY]);
    expect(out.keys).toBe(1);
  });

  it('finds a key nobody has added a row for', () => {
    // The point of measuring by prefix: a feature that starts writing to the
    // browser next term is counted the day it does, with no edit here.
    localStorage.setItem('semester.something-invented-later', 'x'.repeat(10));
    expect(elsewhere().keys).toBe(1);
  });
});
