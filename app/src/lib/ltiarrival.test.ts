// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { withoutComments } from '../styles/rules';
import { TICKET_KEY, forgetTicket, heldTicket, readHandoff, stripped } from './ltiarrival';

/**
 * The arrival question, and the leaf that answers it without dragging
 * anything in behind it.
 *
 * Two things are being pinned here and the second is the reason this file is
 * separate from `ltilanding.test.ts`.
 *
 * **The parsing**, and in particular `stripped()`: a one-use token that stays
 * in the address bar stays in history and in whatever the student pastes into
 * a group chat. The moment it matters is the one where consuming it *failed*,
 * so the cleaning has to be right independently of anything going well.
 *
 * **The absence of imports.** This module exists so that `main.tsx` can ask
 * "is this a launch?" without loading `lib/cloud.ts`, and that property is
 * invisible to every other test: the code works perfectly either way, it is
 * just slower for everybody on every cold start. `lib/redirected.ts` was
 * extracted for exactly this and `ENGINEERING-AUDIT.md` §1 records what the
 * earlier version cost. A test is the only thing that can notice it coming
 * back.
 */

afterEach(() => forgetTicket());

describe('the module stays a leaf', () => {
  const source = () => readFileSync(join(__dirname, 'ltiarrival.ts'), 'utf8');

  /*
   * Comments are blanked before any of this looks for an import, because the
   * header above talks *about* `import()` at length — and the first version of
   * this test failed on its own prose. `withoutComments` is the same stripper
   * `styles/rules.ts` uses on stylesheets, and using it rather than a cleverer
   * regex keeps the question honest: what does the code do, not what does the
   * file say.
   */
  const code = () => withoutComments(source());

  it('imports nothing at all', () => {
    const imports = [...code().matchAll(/^\s*import\s.+$/gm)].map((m) => m[0].trim());
    expect(
      imports,
      'ltiarrival.ts must import nothing — main.tsx loads it on every cold start, and ' +
        'anything it pulls in is paid for by every student on every launch of the app. ' +
        'Put the dependency in ltilanding.ts, which main.tsx reaches through import().',
    ).toEqual([]);
  });

  it('and does not reach for one dynamically either', () => {
    // The obvious way round the rule above, and it costs the same on the load
    // that takes it. `require` is checked too: this is bundled, not Node.
    expect(code()).not.toMatch(/\bimport\s*\(/);
    expect(code()).not.toMatch(/\brequire\s*\(/);
  });

  /*
   * The control. Both assertions above pass against a file that could not be
   * read at all, which is also what a wrong path returns.
   */
  it('and the file being read is really the module', () => {
    expect(source()).toContain('export function readHandoff');
    // And that blanking comments did not blank the code with them.
    expect(code()).toContain('export function readHandoff');
  });
});

describe('reading the handoff', () => {
  it('reads a token, an address and a ticket', () => {
    expect(readHandoff('?lti_token=abc&lti_email=lti-1@lti.invalid&lti_ticket=tkt')).toEqual({
      token: 'abc',
      email: 'lti-1@lti.invalid',
      ticket: 'tkt',
    });
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
   * bound. Null rather than an empty string, so nothing downstream can offer
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

describe('the ticket left for the Connect screen', () => {
  it('is nothing until one is put there', () => {
    expect(heldTicket()).toBeNull();
  });

  it('comes back, and can be forgotten', () => {
    sessionStorage.setItem(TICKET_KEY, 'tkt-1');
    expect(heldTicket()).toBe('tkt-1');
    forgetTicket();
    expect(heldTicket()).toBeNull();
  });

  it('reads an empty string as nothing', () => {
    sessionStorage.setItem(TICKET_KEY, '');
    expect(heldTicket()).toBeNull();
  });
});
