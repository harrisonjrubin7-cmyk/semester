import { sources } from '../styles/rules.ts';

/**
 * WCAG 1.3.5 (Identify Input Purpose), as code: a field that takes an address,
 * a password or a phone number says what it is for, or says it is not for you.
 *
 * `autoComplete` has two honest answers. A field about the person typing —
 * "Your name" — names its token (`name`, `nickname`, `email`, `tel`, ...), so a
 * browser or an assistive tool can fill and announce it. A field about
 * somebody else — the recipient of an email, a family member's address, an API
 * key typed into a password box — says `off`, because the wrong help is worse
 * than none: autofill puts the student's *own* address in the "To" box, and a
 * password manager offers to save an API key as a login.
 *
 * What the rule cannot be is silent. Every `type="email"`, `"password"` and
 * `"tel"` input states one or the other, and so does any input whose own label
 * says it is about "your name", "your email" or "your phone". Most inputs in
 * the app are none of these (an amount, a course, a note), and are left alone;
 * this is not "autocomplete on every box".
 *
 * Source-reading, like `labels.ts` and `fielderror.ts`: it reads the tag, so a
 * control built by a wrapper component that sets the attribute inside is out of
 * its sight, and that wrapper is where the rule applies instead.
 */

export interface Finding {
  file: string;
  line: number;
  why: string;
}

/** Each `<input …>` tag in a source text, read to its real end (an arrow function's `>` is not the end). */
export function inputTags(text: string): { at: number; tag: string }[] {
  const out: { at: number; tag: string }[] = [];
  const open = /<input\b/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(text))) {
    let depth = 0;
    let quote: string | null = null;
    let i = m.index + m[0].length;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ at: m.index, tag: text.slice(m.index, i + 1) });
  }
  return out;
}

const TYPES = /\btype=["'](email|password|tel)["']/;
const ABOUT_YOU = /aria-label=["'][^"']*\byour (name|e-?mail|phone)\b[^"']*["']/i;

export function unstatedAutocomplete(dir: string): Finding[] {
  const root = dir.replace(/\/?$/, '/');
  const found: Finding[] = [];
  for (const { path, text } of sources(dir, { tests: false })) {
    for (const { at, tag } of inputTags(text)) {
      if (/\bautoComplete=/.test(tag)) continue;
      const why = TYPES.test(tag) ? `type="${TYPES.exec(tag)![1]}"` : ABOUT_YOU.test(tag) ? 'labelled as about the person typing' : null;
      if (why) found.push({ file: path.replace(root, ''), line: text.slice(0, at).split('\n').length, why });
    }
  }
  return found;
}
