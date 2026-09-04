import { describe, expect, it } from 'vitest';
import { troubleOf } from './trouble';

describe('what a thrown thing says', () => {
  it('carries an Error message through unchanged', () => {
    // The app's error messages are the API's own wording, or the parser's,
    // and those are more use than anything this could put in their place.
    expect(troubleOf(new Error('rate_limit_error: too many requests'))).toBe(
      'rate_limit_error: too many requests',
    );
  });

  it('says nothing about a cancellation', () => {
    // Pressing Stop throws like a failure does. Reporting it back as a fault
    // tells the student their own decision was an error.
    const stopped = new DOMException('signal is aborted without reason', 'AbortError');
    expect(troubleOf(stopped)).toBeNull();
  });

  it('still reports a DOMException that is not an abort', () => {
    expect(troubleOf(new DOMException('quota exceeded', 'QuotaExceededError'))).toBe(
      'quota exceeded',
    );
  });

  it('takes a thrown string as it is', () => {
    expect(troubleOf('The reply stopped mid-sentence.')).toBe('The reply stopped mid-sentence.');
  });

  it('does not show a thrown object as [object Object]', () => {
    expect(troubleOf({ status: 500 })).toBe('Something went wrong.');
  });

  it('does not show an empty message', () => {
    // `new Error()` has an empty message, and an alert box with nothing in it
    // is worse than a vague sentence.
    expect(troubleOf(new Error())).toBe('Error');
  });
});
