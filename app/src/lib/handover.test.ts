// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { handOver } from './draft.hook';
import { DRAFTS_KEY, draftKey, readDrafts, restoredLine } from './draft';

/**
 * One screen filling another's field before sending somebody to it.
 *
 * The hand-off is invisible when it fails: the receiving screen opens empty,
 * which looks exactly like a screen somebody opened on purpose. So what is
 * asserted is that the text lands under the key `useDraft` will look for —
 * which is the only part that can be got wrong silently.
 */
describe('handing text to another screen', () => {
  beforeEach(() => localStorage.clear());

  it('writes it under the key that screen reads', () => {
    handOver('analyse', 'text', 'a,b\n1,2\n');
    const saved = readDrafts(localStorage.getItem(DRAFTS_KEY));
    expect(saved[draftKey('analyse', 'text')]?.text).toBe('a,b\n1,2\n');
  });

  it('stamps it, so the receiving screen can say where it came from', () => {
    const before = Date.now();
    handOver('analyse', 'text', 'x');
    const at = readDrafts(localStorage.getItem(DRAFTS_KEY))[draftKey('analyse', 'text')]?.at ?? 0;
    expect(at).toBeGreaterThanOrEqual(before);
  });

  it('replaces what was there rather than appending to it', () => {
    handOver('analyse', 'text', 'first');
    handOver('analyse', 'text', 'second');
    expect(readDrafts(localStorage.getItem(DRAFTS_KEY))[draftKey('analyse', 'text')]?.text).toBe(
      'second',
    );
  });

  it('leaves other screens’ drafts alone', () => {
    handOver('essay', 'draft', 'my essay');
    handOver('analyse', 'text', 'my table');
    const saved = readDrafts(localStorage.getItem(DRAFTS_KEY));
    expect(saved[draftKey('essay', 'draft')]?.text).toBe('my essay');
    expect(saved[draftKey('analyse', 'text')]?.text).toBe('my table');
  });

  /*
   * "Picked up where you left off" is the wrong sentence for text that was
   * sent here a second ago, and the whole reason a line is shown at all is
   * that text appearing in a field nobody typed into needs explaining.
   */
  it('carries the sentence that explains where it came from', () => {
    handOver('analyse', 'text', 'a,b', { from: 'From Term marks, A1:C5.' });
    const saved = readDrafts(localStorage.getItem(DRAFTS_KEY))[draftKey('analyse', 'text')];
    expect(saved?.from).toBe('From Term marks, A1:C5.');
    expect(restoredLine(saved?.at ?? 0, new Date(), saved?.from)).toBe('From Term marks, A1:C5.');
  });

  it('falls back to the ordinary line for a draft somebody typed', () => {
    expect(restoredLine(Date.now(), new Date())).toMatch(/picked up where you left off/i);
  });

  /*
   * A hand-off that will not fit is a screen that opens empty, not a screen
   * that throws on the way out of the one somebody was using.
   */
  it('is silent when storage refuses', () => {
    const was = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => handOver('analyse', 'text', 'x')).not.toThrow();
    Storage.prototype.setItem = was;
  });
});
