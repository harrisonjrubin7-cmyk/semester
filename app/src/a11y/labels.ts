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
 * Or an enclosing `<label>`, which is the oldest way of saying it and the one
 * `Attendance` and `PiecesRow` already used. That took reading the file rather
 * than the tag, which is why the rule missed it at first and leant on the
 * placeholder instead.
 *
 * ## What a `placeholder` is not
 *
 * It counted, once, and the comment here said "grudgingly": the browser does
 * derive a name from it as the last resort of the accessible-name computation,
 * so axe stays quiet, and rejecting it would have meant relabelling sixty-odd
 * fields. That was deferred work, not a judgement that it was fine, and this
 * is it done.
 *
 * A placeholder is a poor label for a reason that has nothing to do with
 * screen readers: **it disappears the moment somebody types.** The one field
 * they are filling in is the one field with no label left, which is why every
 * long form eventually gets somebody scrolling up to check what the third box
 * wanted. Mail asks for five things in a row. Essay asks for five. Filling in
 * the fourth should not require remembering the first.
 *
 * ## What it does not look at
 *
 * `type="hidden"`, and the file, checkbox and radio inputs that are triggered
 * by a button beside them. Those are named by their surroundings in ways this
 * rule cannot see from the text, and guessing at them would produce exactly
 * the false positives that get a linter deleted.
 */

/** Attributes that give a control a name, or put it out of this rule's reach. */
const NAMED = [
  'aria-label',
  'aria-labelledby',
  ' id=',
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

/**
 * Whether a control at this offset is wrapped in a `<label>`.
 *
 * Counted rather than parsed: every `<label` before the control against every
 * `</label>`, and an excess of openings means one is still open around it.
 * That is enough for JSX, which cannot nest a label inside a label and cannot
 * leave one unclosed and still compile.
 *
 * Without this the rule cannot see the oldest and plainest way to name a
 * field — `<label>Absences allowed<input …/></label>` — and would report six
 * controls that are already correct. A linter that cries wolf about correct
 * code is a linter somebody deletes.
 */
function insideLabel(code: string, at: number): boolean {
  const before = code.slice(0, at);
  const opens = (before.match(/<label\b/g) ?? []).length;
  const closes = (before.match(/<\/label>/g) ?? []).length;
  return opens > closes;
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
        if (insideLabel(code, m.index)) continue;
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
    `as a bare control — and a placeholder is not one, since it goes away as ` +
    `soon as somebody types.\n    Add aria-label with the same words as the ` +
    `<SectionLabel> above it, or wrap it in a <label>.`
  );
}

/*
 * ── The second rule: a name that a stylesheet takes away ───────────────────
 *
 * The rule above asks whether a control was given a name. This one asks
 * whether it still has the one it was written with at every width.
 *
 * The case it was written for: the AI Tutor button in the workspace and
 * browser shells is an icon and the words "AI Tutor". Under 760px `app.css`
 * has `.desktop-ai span { display: none }`, and `display: none` does not just
 * hide pixels — it takes the element out of the accessibility tree. The icon
 * beside it is `aria-hidden`, like every icon in `Icons.tsx`. So on a phone,
 * on every screen of the two navigations that draw that bar, the control that
 * opens the assistant announced itself as "button".
 *
 * Nothing could have caught that from one side. The markup has the words in
 * it; the stylesheet has no idea it is looking at the only name a control
 * has. It takes both files at once, which is what this does.
 */

/** Inline elements that are usually a control's visible name. */
const NAMING = ['span', 'b', 'i', 'em', 'strong', 'small'];

export interface Silenced {
  file: string;
  line: number;
  /** The class whose text the stylesheet hides. */
  className: string;
  /** The rule that hides it, for the message. */
  rule: string;
  found: string;
}

/**
 * Every class whose inline text a stylesheet sets to `display: none`.
 *
 * Deliberately blunt about which selectors it reads: the last class in the
 * selector before the inline tag, which is the element the rule is about.
 * `@media` wrappers are not parsed, because the width a rule applies at does
 * not change the answer — a name that is gone at any width is gone.
 */
export function hushed(css: string): { className: string; rule: string }[] {
  const out: { className: string; rule: string }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].replace(/\s+/g, ' ').trim();
    if (!/display\s*:\s*none/.test(m[2])) continue;
    const said = new RegExp(`\\.([A-Za-z0-9_-]+)\\s+(?:${NAMING.join('|')})$`).exec(selector);
    if (said) out.push({ className: said[1], rule: selector });
  }
  return out;
}

/**
 * Controls whose only visible name a stylesheet hides, with nothing else to
 * fall back on.
 *
 * A control wearing one of those classes needs a name of its own — an
 * `aria-label`, or an `aria-labelledby` — because at the width the rule
 * applies it has nothing else.
 */
export function silenced(dir: string, css: string): Silenced[] {
  const rules = hushed(css);
  if (rules.length === 0) return [];
  const out: Silenced[] = [];

  for (const f of sources(dir)) {
    if (f.path.includes('.test.')) continue;
    const rel = f.path.slice(f.path.indexOf('/src/') + 5);
    const code = withoutComments(f.text);

    for (const { className, rule } of rules) {
      // `className="bare desktop-ai"` and `className={\`… desktop-ai\`}` alike:
      // the class as a whole word anywhere in a className value.
      const worn = new RegExp(`className[=:]\\s*[{]?["'\`][^"'\`]*\\b${className}\\b`, 'g');
      for (let m = worn.exec(code); m; m = worn.exec(code)) {
        const open = code.lastIndexOf('<', m.index);
        if (open === -1) continue;
        const end = endOfTag(code, open);
        if (end === -1) continue;
        const written = code.slice(open, end + 1);
        if (/aria-label(ledby)?[=:]/.test(written)) continue;
        out.push({
          file: rel,
          line: code.slice(0, open).split('\n').length,
          className,
          rule,
          found: written.split(/\s+/).join(' ').slice(0, 90),
        });
      }
    }
  }

  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/** What to do about one. */
export function saysSilenced(p: Silenced): string {
  return (
    `\`${p.rule}\` hides this control's own words, and \`display: none\` takes ` +
    `them out of the accessibility tree as well as off the screen — so at that ` +
    `width it has no name at all.\n    Add aria-label with the same words as ` +
    `the text inside it.`
  );
}
