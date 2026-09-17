import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { explainProvider, explainSignUp, refusedByInvite } from './invite';

/**
 * The explanation, and the thing it must never quietly become.
 *
 * Every test here is about one of two properties:
 *
 *   **It explains the gate's refusal**, in each of the shapes that refusal
 *   actually arrives in — which is two, because email sign-up and an OAuth
 *   redirect fail at different layers and GoTrue flattens one of them.
 *
 *   **It is not the gate.** A module that decided who may sign up would be a
 *   client-side allow-list, which is worthless against anybody holding the
 *   publishable key — and the whole reason the real gate is a database
 *   trigger. So the last block reads this module's own source and asserts it
 *   contains no decision: no call into the database, no boolean anybody could
 *   mistake for permission.
 */

describe('recognising the gate', () => {
  it('knows the sentence an email sign-up comes back with', () => {
    expect(refusedByInvite('Database error saving new user')).toBe(true);
  });

  it('and the one the trigger itself raises', () => {
    expect(refusedByInvite('semester: not on the invite list')).toBe(true);
  });

  it('and the shape an OAuth redirect carries', () => {
    expect(refusedByInvite('unexpected_failure: Database error saving new user')).toBe(true);
  });

  it('and is not fooled by an unrelated failure', () => {
    for (const other of [
      'Invalid login credentials',
      'Email rate limit exceeded',
      'Failed to fetch',
      'User already registered',
      '',
    ]) {
      expect(refusedByInvite(other), `"${other}" was read as the invite gate`).toBe(false);
    }
  });
});

describe('what a refused person is told', () => {
  it('says it is invite-only and names their address', () => {
    const said = explainSignUp('Database error saving new user', 'ada@example.edu');
    expect(said).toMatch(/invite-only/i);
    expect(said).toContain('ada@example.edu');
  });

  it('says nothing was created, because the obvious worry is a half-made account', () => {
    expect(explainSignUp('Database error saving new user')).toMatch(/nothing was created/i);
  });

  it('works without an address, rather than printing "undefined"', () => {
    const said = explainSignUp('Database error saving new user');
    expect(said).not.toContain('undefined');
    expect(said).toMatch(/this address/i);
  });

  it('tells a provider sign-in something it can act on', () => {
    const said = explainProvider('Database error saving new user', 'Google');
    expect(said).toContain('Google');
    expect(said).toMatch(/different account/i);
  });

  it('passes an unrelated failure straight through, both ways', () => {
    /*
     * The important one. Rewriting every sign-up failure into "you are not
     * invited" would hide a real outage behind a plausible sentence, and the
     * people who would have noticed are exactly the ones being told to go
     * away.
     */
    expect(explainSignUp('Failed to fetch')).toBe('Failed to fetch');
    expect(explainProvider('Failed to fetch', 'Google')).toBe('Failed to fetch');
  });
});

describe('it is an explanation and not the gate', () => {
  const raw = readFileSync(join(__dirname, 'invite.ts'), 'utf8');

  /**
   * The source with its comments taken out.
   *
   * The first version of this scanned the raw file and went red on the word
   * `supabase` — in the sentence naming the migration that holds the real
   * gate. A probe that convicts a file for *documenting* what it does not do
   * is a probe that would have convicted whatever the code was, so the
   * comments come out first and the control below asserts that they do.
   */
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('and the probe does not read the comments it is documented in', () => {
    // The control: `supabase` is in this file, and only in a comment.
    expect(raw, 'the comment naming the migration has gone').toContain('supabase/migrations');
    expect(source, 'comments are still being scanned').not.toContain('supabase/migrations');
    // And the probe still sees real code.
    expect(source).toContain('export function explainSignUp');
  });

  it('never asks the database anything', () => {
    /*
     * A client-side allow-list is worthless — anybody with the publishable key
     * skips the page entirely — so this module must not grow one. A fetch, a
     * Supabase call or a list of addresses here would all be that.
     */
    for (const forbidden of ['cloud(', 'fetch(', 'supabase', 'from(']) {
      expect(source, `invite.ts reaches for ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('carries no list of addresses', () => {
    expect(source, 'invite.ts contains an email address, which would be a list').not.toMatch(
      /['"`][\w.]+@[\w.]+['"`]/,
    );
  });

  it('and every export returns a sentence rather than a verdict', () => {
    // `refusedByInvite` is the one boolean, and it answers "was this the
    // gate?" — never "may this person in?". The distinction is the point, so
    // it is asserted from the outside: a refusal it does not recognise still
    // produces the original message rather than an allow.
    expect(typeof explainSignUp('anything at all')).toBe('string');
    expect(explainSignUp('anything at all')).toBe('anything at all');
  });
});
