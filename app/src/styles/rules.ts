import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The style rule, as code rather than as a habit.
 *
 * Three scales are defined in `app.css` and the app had drifted off all three:
 * 830 font sizes, 523 line heights and 1,233 spacing values were the tokens
 * spelled out longhand. Those are fixed. Without something that fails, they
 * come back — not through anybody's carelessness but because the fastest way
 * to write a style is to copy the one above it, and by November the one above
 * it is whatever was written last.
 *
 * So this is what "consistent" means here, in a form that can be run:
 *
 *   1. **Every font size answers to the Text size setting.** The rule that
 *      matters most, and the one with no exceptions: a size written as a bare
 *      number or a raw `14px` is a piece of the app `--text-scale` cannot
 *      reach. It looks right on the machine it was written on and stays small
 *      for anybody who needs larger type. The app has zero of these today,
 *      which is worth keeping true rather than finding out later.
 *
 *   2. **No value written longhand that a token already names.** Not a matter
 *      of taste: it is the same number written two ways, and the second way is
 *      invisible to anybody changing the scale.
 *
 *   3. **The multipliers stay on the tokens.** A `--sp-*` step that lost
 *      `var(--density)` or a `--type-*` step that lost `var(--text-scale)`
 *      would look identical at the default setting and quietly switch the
 *      setting off everywhere it is used.
 *
 * And three budgets, for the values that are genuinely off the scales and
 * whose folding-in is a decision about how the app looks rather than a
 * cleanup. Those may shrink and may not grow. Raising a number here is meant
 * to be a visible line in a diff with a sentence next to it.
 */

/** `fontSize: 'var(--type-xs)'` and friends — the six named steps. */
export const TYPE: Record<string, string> = {
  '11': 'xs',
  '12': 'sm',
  '13': 'base',
  '14': 'md',
  '15': 'lg',
  '26': 'xl',
};

export const LEADING: Record<string, string> = {
  '1.3': 'tight',
  '1.45': 'normal',
  '1.5': 'relaxed',
};

export const SPACE: Record<string, string> = {
  '2': '1',
  '4': '2',
  '6': '3',
  '8': '4',
  '10': '5',
  '12': '6',
  '16': '7',
};

/**
 * Exceptions, with the reason beside each.
 *
 * Empty, and that is the point: the rule below is written so that the cases
 * which would have needed an exception pass on their own merits. `inherit` and
 * `0.92em` are not absolute sizes — they are the most scale-respecting things
 * a style can say — and a rule that had to exempt them was a rule aimed at the
 * wrong thing.
 *
 * Two kinds of font size sit outside this by construction rather than by
 * exemption. An SVG's `fontSize={9}` on a `<text>` element is a length in that
 * drawing's own coordinate space, not page type, and is a JSX attribute rather
 * than a style property — the rule does not look at it. And a size computed at
 * runtime from a measurement is not a literal for this to read.
 *
 * When something does need an entry: name the file, match the exact text, and
 * write why. An exception whose justification has to be spelled out is one
 * somebody thought about, and one that has stopped being true is visible here
 * rather than buried in the file it exempts.
 */
export const ALLOWED: { file: string; match: RegExp; why: string }[] = [];

export interface Problem {
  file: string;
  line: number;
  found: string;
  says: string;
}

/** Every `.tsx` under a directory, with comments and imports stripped. */
export function sources(dir: string): { path: string; text: string }[] {
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
 * Comments blanked, line count preserved.
 *
 * The note in `App.tsx` explaining why the text-size setting exists contains
 * the words `fontSize: 14`, and a rule that failed on its own documentation
 * would be a rule people delete rather than satisfy. Replaced with spaces
 * rather than removed so a reported line number is still the right one.
 */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

const lineOf = (text: string, at: number) => text.slice(0, at).split('\n').length;

/** Everything wrong, with the file and line, ready to print. */
export function check(dir: string): Problem[] {
  const files = sources(dir);
  const out: Problem[] = [];

  for (const f of files) {
    const rel = f.path.slice(f.path.indexOf('/src/') + 5);
    const code = withoutComments(f.text);
    const allowed = ALLOWED.filter((a) => rel === a.file);
    const exempt = (found: string) => allowed.some((a) => a.match.test(found));

    // 1 — a font size that the Text size setting cannot reach.
    for (const m of code.matchAll(/fontSize: (?:(\d+(?:\.\d+)?)|'([^']*)')/g)) {
      const found = m[0];
      if (exempt(found)) continue;
      const value = m[1] ?? m[2];
      /*
       * The test is "absolute", not "on the list".
       *
       * A bare number is px, and a string carrying `px` is px unless it is
       * multiplied by `--text-scale` — those are the two shapes the setting
       * cannot reach. Everything else is fine on its own terms: a token, a
       * calc against the scale, `inherit`, `em`, `%`. Writing the rule the
       * other way round — an allowlist of accepted forms — needed exemptions
       * for `inherit`, which is the most scale-respecting thing a style can
       * say, and an exemption like that is the sign of a rule pointed at the
       * wrong thing.
       */
      const bare = m[1] !== undefined;
      const absolute = /\d\s*px/.test(value) && !/var\(--text-scale/.test(value);
      if (!bare && !absolute) continue;
      out.push({
        file: rel,
        line: lineOf(code, m.index),
        found,
        says:
          'A font size has to answer to the Text size setting — a `var(--type-*)` ' +
          'step, or `calc(Npx * var(--text-scale, 1))`. A bare number or a raw ' +
          '`px` is a piece of the app that setting cannot reach: it looks right ' +
          'on the machine it was written on and stays small for anybody who needs ' +
          'larger type.',
      });
    }

    // 2 — longhand where a token already names the value.
    for (const m of code.matchAll(/fontSize: 'calc\((\d+(?:\.\d+)?)px \* var\(--text-scale, 1\)\)'/g)) {
      const name = TYPE[m[1]];
      if (!name) continue;
      out.push({
        file: rel,
        line: lineOf(code, m.index),
        found: m[0],
        says: `${m[1]}px is \`var(--type-${name})\`. The same number written two ways is invisible to anybody changing the scale.`,
      });
    }
    for (const m of code.matchAll(/lineHeight: (\d+(?:\.\d+)?)(?![0-9.])/g)) {
      const name = LEADING[m[1]];
      if (!name) continue;
      out.push({
        file: rel,
        line: lineOf(code, m.index),
        found: m[0],
        says: `${m[1]} is \`var(--leading-${name})\`.`,
      });
    }
    const SPACING =
      /\b(gap|rowGap|columnGap|margin(?:Top|Bottom|Left|Right)|padding(?:Top|Bottom|Left|Right)?): (\d+)(?![0-9.])/g;
    for (const m of code.matchAll(SPACING)) {
      const step = SPACE[m[2]];
      if (!step) continue;
      out.push({
        file: rel,
        line: lineOf(code, m.index),
        found: m[0],
        says: `${m[2]}px is \`var(--sp-${step})\`, which also carries the density multiplier this does not.`,
      });
    }
  }

  return out;
}

/** The multipliers, read straight out of the stylesheet. */
export function multipliers(css: string): Problem[] {
  const out: Problem[] = [];
  for (const [px, name] of Object.entries(TYPE)) {
    const want = `--type-${name}: calc(${px}px * var(--text-scale, 1))`;
    if (!css.includes(want))
      out.push({ file: 'styles/app.css', line: 0, found: `--type-${name}`, says: `should be \`${want}\`` });
  }
  for (const [px, step] of Object.entries(SPACE)) {
    const want = `--sp-${step}: calc(${px}px * var(--density, 1))`;
    if (!css.includes(want))
      out.push({
        file: 'styles/app.css',
        line: 0,
        found: `--sp-${step}`,
        says: `should be \`${want}\` — a step that loses the multiplier switches the Density setting off wherever it is used`,
      });
  }
  for (const [n, name] of Object.entries(LEADING)) {
    if (!css.includes(`--leading-${name}: ${n};`))
      out.push({ file: 'styles/app.css', line: 0, found: `--leading-${name}`, says: `should be ${n}` });
  }
  return out;
}

/**
 * What is genuinely off the scales, and may not grow.
 *
 * 11.5 and 12.5 are half a pixel from a step and there are 436 of them; 14 is
 * the commonest spacing value and is not a step. Folding those in changes how
 * every screen looks, which is a decision to take on purpose. Until somebody
 * does, this stops there being more of them.
 */
export const BUDGET = {
  /** Font sizes off the six steps — 11.5, 12.5, 13.5 and a display tail. */
  type: 680,
  /** Line heights off the three — 1.55, 1.4, 1.35 and below. */
  leading: 222,
  /** Spacing numbers off the seven steps — 14, 7, 9, 18 and a tail. */
  space: 524,
  /** `padding: '11px 0'` and the like: two axes in one string. */
  shorthand: 544,
};

/*
 * 682/222/524/544 → 680/222/524/544 when the code with no caller was cut. Two
 * sizes down, none up, and neither by reformatting: they were inside two of
 * the row components nothing rendered.
 *
 * 682/222/524/545 → 682/222/524/544 when the in-screen filters were deleted.
 * One down, none up, and only one because the filter field lived in `<Page>`
 * rather than in the fifteen screens that used it: what went with it here was
 * that field's own `padding: '0 2px'` on the clear button. The screens lost an
 * adapter each, which is prose, not spacing.
 *
 * 688/224/534/549 → 682/222/524/545 when Files & mail was deleted. All four
 * down and none up: the screen listed Drive files and inbox messages in rows
 * it drew by hand, and Connect accounts already lists the same files. What it
 * did that nothing else does — pushing deadlines out to Google or Microsoft —
 * went with it rather than being moved, so nothing was reformatted here.
 *
 * 689/537/551 → 688/534/549 when the Ask tab became the conversation: the
 * screen that was a key form is a settings page built from `Group` and
 * `CustomRow`, which carry the scale, and the sizes and gaps it used to set by
 * hand went with it.
 *
 * 697/224/537/558 → 689/224/537/551 when the three reports became one screen
 * at three grains. Two down, none up, and neither by reformatting: the three
 * screens each drew their own list rows by hand — two of them with an
 * identical twenty-line `row()` helper — and the merged version uses `ItemRow`
 * and `Group`, which carry the scale themselves. See `screens/Reports.tsx`.
 *
 * 698/225/541/561 → 697/224/537/558 with the two-navigations release. Four
 * numbers down and none up, which is the direction this is here to enforce:
 * a duplicated appearance control was deleted rather than reformatted, the
 * layout picker's three thumbnails were drawn on the spacing scale rather
 * than in loose pixels, and the settings pages that were merged brought no
 * new off-scale values with them.
 *
 * `space` went 552 → 546 while the chat surface was being built, which is the
 * budget doing its job in the useful direction: the count now skips `0`, and
 * the six it stops counting were `padding: 0` cancelling a default rather than
 * six spacing decisions anybody made. The two the chat added — a 3px gap
 * between the waiting dots, and the send button's clearance inside the
 * composer — are drawing measurements and are inside the new number.
 *
 * Set to what is there, not to what a grep said.
 *
 * The first numbers here were a few higher, because they came from a grep over
 * the raw files and this counts code with the comments blanked — so a value
 * quoted in a note explaining why the value exists was being counted as one of
 * them. A budget with slack in it is a budget that permits the next few, which
 * is the opposite of the point.
 */

export function counts(dir: string): typeof BUDGET {
  const files = sources(dir);
  let type = 0,
    leading = 0,
    space = 0,
    shorthand = 0;
  for (const f of files) {
    const code = withoutComments(f.text);
    for (const m of code.matchAll(/calc\((\d+(?:\.\d+)?)px \* var\(--text-scale, 1\)\)/g))
      if (!TYPE[m[1]]) type += 1;
    for (const m of code.matchAll(/lineHeight: (\d+(?:\.\d+)?)(?![0-9.])/g)) if (!LEADING[m[1]]) leading += 1;
    const SPACING =
      /\b(?:gap|rowGap|columnGap|margin(?:Top|Bottom|Left|Right)|padding(?:Top|Bottom|Left|Right)?): (\d+)(?![0-9.])/g;
    // `0` is not a spacing choice, it is the absence of one, and there is no
    // step for it. Counting it as drift meant the budget crept up every time
    // somebody wrote `padding: 0` to cancel a default, which is the opposite
    // of what this watches for.
    for (const m of code.matchAll(SPACING)) if (m[1] !== '0' && !SPACE[m[1]]) space += 1;
    shorthand += [...code.matchAll(/\b(?:margin|padding): '[^']*px[^']*'/g)].length;
  }
  return { type, leading, space, shorthand };
}
