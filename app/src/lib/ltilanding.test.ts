import { describe, expect, it } from 'vitest';
import { readHandoff, saidAbout, stripped, type Adopted } from './ltilanding';

/**
 * Reading the handoff, and getting it back out of the address bar.
 *
 * The parsing is the testable half of landing from a launch. The part worth
 * being strict about is `stripped()`: a one-use token that stays in the
 * address bar stays in history and in whatever the student pastes into a group
 * chat, and the moment it matters is the one where consuming it *failed* — so
 * the cleaning has to be right independently of anything going well.
 */

describe('reading the handoff', () => {
  it('reads a token, an address and a ticket', () => {
    const got = readHandoff('?lti_token=abc&lti_email=lti-1@lti.invalid&lti_ticket=tkt');
    expect(got).toEqual({ token: 'abc', email: 'lti-1@lti.invalid', ticket: 'tkt' });
  });

  it('works with or without the leading question mark', () => {
    expect(readHandoff('lti_token=abc&lti_email=e@x')).toEqual({
      token: 'abc',
      email: 'e@x',
      ticket: null,
    });
  });

  /*
   * A returning student gets no ticket, because their identity is already
   * bound. Null rather than an empty string so nothing downstream can offer
   * the "connect my account" path against nothing.
   */
  it('reports no ticket as null, not as an empty string', () => {
    expect(readHandoff('?lti_token=abc&lti_email=e@x')?.ticket).toBeNull();
    expect(readHandoff('?lti_token=abc&lti_email=e@x&lti_ticket=')?.ticket).toBeNull();
  });

  it('treats a half-handoff as no handoff', () => {
    expect(readHandoff('?lti_token=abc')).toBeNull();
    expect(readHandoff('?lti_email=e@x')).toBeNull();
  });

  it('and an ordinary arrival as no handoff', () => {
    expect(readHandoff('')).toBeNull();
    expect(readHandoff('?utm_source=poster')).toBeNull();
  });
});

describe('cleaning the address bar', () => {
  it('removes every handoff parameter', () => {
    expect(stripped('https://app.test/s/?lti_token=a&lti_email=b&lti_ticket=c')).toBe(
      'https://app.test/s/',
    );
  });

  it('keeps the fragment, which is where this app keeps its routes', () => {
    expect(stripped('https://app.test/s/?lti_token=a&lti_email=b#/courses?lti=econ')).toBe(
      'https://app.test/s/#/courses?lti=econ',
    );
  });

  it('keeps parameters that are not ours', () => {
    expect(stripped('https://app.test/s/?ref=poster&lti_token=a&lti_email=b')).toBe(
      'https://app.test/s/?ref=poster',
    );
  });

  it('leaves no bare question mark behind', () => {
    expect(stripped('https://app.test/s/?lti_token=a&lti_email=b')).not.toContain('?');
    expect(stripped('https://app.test/s/?lti_token=a&lti_email=b#/today')).toBe(
      'https://app.test/s/#/today',
    );
  });

  it('changes nothing about an address that carries no handoff', () => {
    const plain = 'https://app.test/s/#/today';
    expect(stripped(plain)).toBe(plain);
  });
});

describe('what a person is told', () => {
  const words: Adopted[] = ['ok', 'signed-out', 'stale', 'same-account', 'in-use', 'failed'];

  it('has a sentence for every word the database can return', () => {
    for (const w of words) {
      expect(saidAbout(w), `no sentence for ${w}`).toBeTruthy();
      expect(saidAbout(w).length, `${w} reads as a code, not a sentence`).toBeGreaterThan(20);
    }
  });

  it('says something different for each one', () => {
    expect(new Set(words.map(saidAbout)).size).toBe(words.length);
  });

  /*
   * The one refusal a student cannot resolve by trying again. It has to point
   * at a person rather than imply effort would help.
   */
  it('sends the merge case to a human instead of suggesting they retry', () => {
    const said = saidAbout('in-use');
    expect(said).toMatch(/get in touch|by hand/i);
    expect(said).not.toMatch(/try again/i);
  });
});
