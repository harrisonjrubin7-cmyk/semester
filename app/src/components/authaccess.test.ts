import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Accessible authentication (WCAG 2.2 SC 3.3.8): signing in must not depend on
 * remembering or transcribing anything a password manager could supply. The
 * sign-in and account forms therefore carry the standard autocomplete tokens,
 * and nothing on them blocks paste. This reads the source because the rule is
 * about what is written on the element.
 */

const here = import.meta.dirname;
const read = (f: string) => readFileSync(join(here, f), 'utf8');

const FORMS = ['Credentials.tsx', 'AccountSecurity.tsx'];

/** Every <input …> element's attribute text, whatever its length. */
function inputs(src: string): string[] {
  return [...src.matchAll(/<input\b[\s\S]*?\/>/g)].map((m) => m[0]);
}

describe('accessible authentication', () => {
  it('gives every password field a real autocomplete token', () => {
    for (const f of FORMS) {
      const pw = inputs(read(f)).filter((i) => /type="password"/.test(i));
      expect(pw.length, f).toBeGreaterThan(0);
      for (const i of pw) {
        expect(i, `${f}: ${i.slice(0, 80)}`).toMatch(/autoComplete=(\{[^}]*(current|new)-password[^}]*\}|"(current|new)-password")/);
        expect(i).not.toMatch(/autoComplete="off"/);
      }
    }
  });

  it('gives the email field the email token', () => {
    for (const f of FORMS) {
      const em = inputs(read(f)).filter((i) => /type="email"/.test(i));
      for (const i of em) expect(i, f).toMatch(/autoComplete="(email|username)"/);
    }
  });

  it('blocks neither paste nor drop on any of these forms', () => {
    for (const f of FORMS) expect(read(f), f).not.toMatch(/onPaste|onDrop|onCopy/);
  });

  it('asks for no puzzle, transcription or memory test to sign in', () => {
    for (const f of FORMS) expect(read(f), f).not.toMatch(/captcha|recaptcha|hcaptcha|turnstile/i);
  });
});
