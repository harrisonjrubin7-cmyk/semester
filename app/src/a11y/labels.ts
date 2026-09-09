import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every control a screen reader can name, as code rather than as a habit.
 *
 * A `<select>` with the answer written above it in a `<SectionLabel>` looks
 * labelled and is not: `SectionLabel` renders a heading, not a `<label>`, so
 * nothing in the markup ties the two together. Sighted people read the pairing
 * off the layout; VoiceOver reads "pop-up button" and stops. Twelve controls in
 * this app were in that state — the unit picker on Deck, the column pickers on
 * Analyse, the whole body of an email on Mail — and each was one attribute away
 * from being fine.
 *
 * They are fixed. This is what keeps them fixed, for the same reason the style
 * rule next door exists: the fastest way to write a control is to copy the one
 * above it, and by November the one above it is whatever was written last.
 *
 * ## What counts as a name
 *
 * `aria-label`, `aria-labelledby`, or an `id` a `<label htmlFor>` can point at.
 *
 * A `placeholder` also counts, grudgingly — it is the last resort in the
 * accessible-name computation, so the browser does produce a name from it and
 * axe does not flag it. It is a poor label: it disappears the moment somebody
 * types, so the one control they are filling in is the one with no name left.
 * This rule accepts it because rejecting it would mean relabelling seventy
 * fields that are currently *usable*, which is a different piece of work from
 * the one this rule is here to prevent — a control with no name at all.
 *
 * ## What it does not look at
 *
 * `type="hidden"`, and the file, checkbox and radio inputs that are drawn
 * inside a `<label>` or triggered by a button beside them. Those are named by
 * their surroundings in ways this rule cannot see from the text, and guessing
 * at them would produce exactly the false positives that get a linter deleted.
 */

/** Attributes that give a control a name, or put it out of this rule's reach. */
const NAMED = [
  'aria-label',
  'aria-labelledby',
  ' id=',
  'placeholder',
  'type="hidden"',
  'type="file"',
  'type="checkbox"',
  'type="radio"',
];

const TAGS = ['input', 'select', 'textarea'];

export interface Unnamed {
  file: string;
  line: number;
  tag: string;
  /** The opening tag as written, on one line, for the message. */
  found: string;
}

/**
 * The end of an opening tag, counting braces.
 *
 * `>` inside a JSX expression — an arrow function in `onChange`, a comparison
 * in a ternary — is not the end of the tag, and a scan that stops at the first
 * one reads half an attribute list and misses the `aria-label` in the other
 * half. Returns -1 for an unterminated tag, which cannot happen in a file that
 * compiles but is not worth crashing over.
 */
function endOfTag(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return -1;
}

/** Comments blanked, line count preserved — see the note in `styles/rules.ts`. */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/**
 * Every `.tsx` under a directory, source and path.
 *
 * Its own six lines rather than the identical walker in `styles/rules.ts`:
 * `scripts/labels.mjs` hands this module to bare Node, which resolves an
 * extensionless relative import of a `.ts` file the way the bundler does not.
 * A shared helper would have to be reachable from both, and a `lib/` module
 * that exists only so two linters can agree on `readdirSync` is not one.
 */
function sources(dir: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.tsx')) out.push({ path, text: readFileSync(path, 'utf8') });
    }
  };
  walk(dir);
  return out;
}

/** Every form control in the app that a screen reader cannot name. */
export function unnamed(dir: string): Unnamed[] {
  const out: Unnamed[] = [];

  for (const f of sources(dir)) {
    if (f.path.includes('.test.')) continue;
    const rel = f.path.slice(f.path.indexOf('/src/') + 5);
    const code = withoutComments(f.text);

    for (const tag of TAGS) {
      const open = new RegExp(`<${tag}\\b`, 'g');
      for (let m = open.exec(code); m; m = open.exec(code)) {
        const end = endOfTag(code, m.index);
        if (end === -1) continue;
        const written = code.slice(m.index, end + 1);
        if (NAMED.some((k) => written.includes(k))) continue;
        out.push({
          file: rel,
          line: code.slice(0, m.index).split('\n').length,
          tag,
          found: written.split(/\s+/).join(' ').slice(0, 90),
        });
      }
    }
  }

  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/** What to do about one, in the words somebody fixing it needs. */
export function says(p: Unnamed): string {
  return (
    `This <${p.tag}> has no accessible name, so a screen reader announces it ` +
    `as a bare control.\n    Add aria-label with the same words as the ` +
    `<SectionLabel> above it.`
  );
}
