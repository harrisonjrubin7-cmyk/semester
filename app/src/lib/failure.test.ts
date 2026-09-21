import { describe, expect, it } from 'vitest';
import { classify, FAILURES, reference, say, type Code } from './failure';

/**
 * The error taxonomy — platform §337.
 *
 * The assertion that matters is not "a 403 is PERMISSION_DENIED". It is that
 * the code survives the message being rewritten, because that is the whole
 * difference between this and the regexes it was built beside.
 */

describe('classifying', () => {
  it('reads PostgREST and PostgreSQL codes', () => {
    expect(classify({ code: '42501' })).toBe<Code>('PERMISSION_DENIED');
    expect(classify({ code: '23505' })).toBe<Code>('CONFLICT');
    expect(classify({ code: 'PGRST301' })).toBe<Code>('AUTH_REQUIRED');
    expect(classify({ code: 'PGRST116' })).toBe<Code>('NOT_FOUND');
  });

  it('reads HTTP status', () => {
    expect(classify({ status: 401 })).toBe<Code>('AUTH_REQUIRED');
    expect(classify({ status: 429 })).toBe<Code>('RATE_LIMITED');
    expect(classify({ status: 503 })).toBe<Code>('INTEGRATION_UNAVAILABLE');
    expect(classify({ statusCode: 409 })).toBe<Code>('CONFLICT');
  });

  /*
   * The control this module exists for.
   *
   * `explainSyncError` decides `PERMISSION_DENIED` by matching
   * `/row-level security/`. Reword the sentence — a PostgREST upgrade, a
   * proxy, a database that is not answering in English — and the regex stops
   * matching while the SQLSTATE stays `42501`. If this ever starts depending
   * on the words again, this is the test that says so.
   */
  it('is unmoved when the message is rewritten, which the regexes are not', () => {
    const worded = { code: '42501', message: 'new row violates row-level security policy' };
    const reworded = { code: '42501', message: 'ligne refusée par la politique de sécurité' };
    const wordless = { code: '42501', message: '' };
    for (const e of [worded, reworded, wordless]) {
      expect(classify(e), JSON.stringify(e)).toBe<Code>('PERMISSION_DENIED');
    }
  });

  /*
   * The second control, and the direction that matters. A `classify` that
   * simply returned `INTERNAL_ERROR` would pass nothing above, but one that
   * fell back to prose *too eagerly* would quietly undo the point: a
   * structured code must beat the words even when the words disagree.
   */
  it('prefers the code over the prose when they disagree', () => {
    expect(classify({ code: '23505', message: 'JWT expired' })).toBe<Code>('CONFLICT');
    expect(classify({ status: 429, message: 'permission denied' })).toBe<Code>('RATE_LIMITED');
  });

  it('still falls back to prose when there is no code at all', () => {
    expect(classify(new Error('JWT expired'))).toBe<Code>('AUTH_REQUIRED');
    expect(classify(new Error('duplicate key value'))).toBe<Code>('CONFLICT');
  });

  /*
   * Unknown must not become a guess. Every code but this one makes a claim
   * about the cause, and a wrong claim sends somebody to the wrong remedy.
   */
  it('falls to INTERNAL_ERROR rather than guessing', () => {
    expect(classify(new Error('something nobody has seen'))).toBe<Code>('INTERNAL_ERROR');
    expect(classify(undefined)).toBe<Code>('INTERNAL_ERROR');
    expect(classify({ code: 'NOT_A_REAL_CODE' })).toBe<Code>('INTERNAL_ERROR');
  });
});

describe('what each failure says', () => {
  it('never leaves what was preserved blank, which is the line that gets dropped', () => {
    for (const [code, f] of Object.entries(FAILURES)) {
      expect(f.kept.trim(), `${code} does not say what survived`).not.toBe('');
      expect(f.said.trim(), code).not.toBe('');
      expect(f.next.trim(), code).not.toBe('');
    }
  });

  /*
   * Platform §337: do not leak sensitive server details. Validation is the one
   * exception and the reason `verbatim` is a field rather than a rule — the
   * server naming the field you just typed into is the most useful line on the
   * screen.
   */
  it('shows the server its own words only where that is safe', () => {
    const leak = 'relation "public.state" does not exist at character 15';
    expect(say('INTERNAL_ERROR', { detail: leak })).not.toContain(leak);
    expect(say('PERMISSION_DENIED', { detail: leak })).not.toContain(leak);
    expect(say('VALIDATION_ERROR', { detail: 'Start time is required.' })).toContain(
      'Start time is required.',
    );
  });

  it('says what happened, what survived and what to do, in that order', () => {
    const out = say('CONFLICT');
    const f = FAILURES.CONFLICT;
    expect(out.indexOf(f.said)).toBeLessThan(out.indexOf(f.kept));
    expect(out.indexOf(f.kept)).toBeLessThan(out.indexOf(f.next));
  });

  /*
   * The one that must not reassure. An internal error is exactly the case
   * where the write may or may not have landed, and platform §1210 forbids
   * claiming either way.
   */
  it('does not claim the last write was safe when it cannot know', () => {
    expect(FAILURES.INTERNAL_ERROR.kept).toMatch(/not certain/i);
    expect(FAILURES.INTERNAL_ERROR.kept).not.toMatch(/nothing was changed/i);
  });

  it('marks retry only where repeating the same request could work', () => {
    expect(FAILURES.RATE_LIMITED.retry).toBe(true);
    expect(FAILURES.PERMISSION_DENIED.retry, 'retrying a refusal just refuses again').toBe(false);
    expect(FAILURES.AUTH_REQUIRED.retry).toBe(false);
  });
});

describe('the reference', () => {
  it('is short enough to read down a phone', () => {
    expect(reference(() => 0.5)).toMatch(/^SEM-[0-9A-F]{4}$/);
    expect(reference(() => 0)).toBe('SEM-0000');
    expect(reference(() => 0.999999)).toMatch(/^SEM-FFF[EF]$/);
  });

  it('appears in the message when one is given, and not when it is not', () => {
    expect(say('NOT_FOUND', { ref: 'SEM-0042' })).toContain('Reference: SEM-0042');
    expect(say('NOT_FOUND')).not.toContain('Reference:');
  });
});
