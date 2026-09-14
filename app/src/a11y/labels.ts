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
 * ── The label CSS takes away ────────────────────────────────────────────────
 *
 * The rule above reads tags. This one reads the stylesheet, because the way
 * a named control loses its name here is not visible in its own markup.
 *
 * `.desktop-ai` is the case it was written for. The AI Tutor button in the
 * workspace top bar is a glyph and a `<span>AI Tutor</span>`, which is a
 * perfectly good name — until `app.css` says
 *
 *     @media (max-width: 759px) { .desktop-ai span { display: none } }
 *
 * and below 760px the only text in the button is not rendered. `display:
 * none` removes an element from the accessibility tree as well as from the
 * page, so the accessible name is computed from nothing: VoiceOver on a phone
 * announced "button" and stopped, on the one control in that bar that opens
 * the assistant. Every viewport this app is designed for is under 760px.
 *
 * Nothing caught it. The tag rule does not look at buttons, the button really
 * did have text, and the suite renders in jsdom, which parses the stylesheet
 * but applies no media query — so the span was present in every test that
 * asked. It took reading the rendered page at 420px to see it.
 *
 * The fix in the component is the one the tab bar already uses: the glyph
 * carries the picture, `aria-label` carries the name, and the button reads the
 * same at every width. This is what keeps it that way — and it generalises,
 * because the trap is not that button. It is that hiding a label in CSS is
 * invisible from the JSX, so the next person to write a responsive control
 * cannot see what they took away.
 */

/** A class whose inner label the stylesheet hides, and the rule that hides it. */
export interface HiddenName {
  /** The class on the element, without the dot. */
  cls: string;
  /** The selector as written, for the message. */
  selector: string;
  /** Where the element is used without a name of its own. */
  file: string;
  line: number;
  found: string;
}

/**
 * Selectors of the shape `.something <element> { … display: none … }`.
 *
 * Deliberately narrow. A rule hiding a *class* — `.desktop-ai .label` — is
 * usually hiding a decoration, and a rule hiding a bare descendant element is
 * the one that eats text: `span`, `em`, `b`, `small`. Widening this to every
 * `display: none` in the file would report the dozens of legitimate ones and
 * teach the reader to skip the output, which is how `styles.mjs` next door
 * describes its own tuning.
 */
function hidesText(css: string): { cls: string; selector: string }[] {
  const out: { cls: string; selector: string }[] = [];
  for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const body = m[2];
    if (!/display:\s*none/.test(body)) continue;
    // The last line of the captured run is the selector; everything before it
    // is the tail of the previous rule or the media query it sits in.
    const selector = (m[1].split('\n').pop() ?? '').trim();
    const hit = /^\.([A-Za-z0-9_-]+)\s+(span|em|b|small|strong|label)$/.exec(selector);
    if (hit) out.push({ cls: hit[1], selector });
  }
  return out;
}

/**
 * Every element that wears such a class and has no name without its text.
 *
 * `aria-label` and `aria-labelledby` only: a `title` is not announced
 * reliably and the text inside is the thing being taken away, so neither can
 * stand in for one here.
 */
export function hiddenNames(dir: string, css: string): HiddenName[] {
  const out: HiddenName[] = [];
  const risky = hidesText(css);
  if (risky.length === 0) return out;

  for (const f of sources(dir)) {
    if (f.path.includes('.test.')) continue;
    const rel = f.path.slice(f.path.indexOf('/src/') + 5);
    const code = withoutComments(f.text);

    for (const { cls, selector } of risky) {
      // `className="bare desktop-ai"` and `className={'… desktop-ai'}` alike:
      // the class name as a whole word anywhere in a className attribute.
      const use = new RegExp(`className=[{"'\`][^>]*?\\b${cls}\\b`, 'g');
      for (let m = use.exec(code); m; m = use.exec(code)) {
        const open = code.lastIndexOf('<', m.index);
        if (open === -1) continue;
        const end = endOfTag(code, open);
        if (end === -1) continue;
        const written = code.slice(open, end + 1);
        if (written.includes('aria-label') || written.includes('aria-labelledby')) continue;
        out.push({
          cls,
          selector,
          file: rel,
          line: code.slice(0, open).split('\n').length,
          found: written.split(/\s+/).join(' ').slice(0, 90),
        });
      }
    }
  }

  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/** What to do about one, in the words somebody fixing it needs. */
export function saysHidden(p: HiddenName): string {
  return (
    `app.css hides this element's text with \`${p.selector} { display: none }\`, ` +
    `so at that width the control has no accessible name at all — display:none ` +
    `takes an element out of the accessibility tree, not just off the page.\n` +
    `    Add aria-label with the words the hidden text says, the way the tab ` +
    `bar does when its labels are off. Keep the text as well, for the widths ` +
    `that draw it.`
  );
}
