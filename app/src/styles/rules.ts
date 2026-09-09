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
export function withoutComments(text: string): string {
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
 * 11.5 and 12.5 are half a pixel from a step and there are hundreds of them;
 * 14 is the commonest spacing value and is not a step. Folding those in
 * changes how every screen looks, which is a decision to take on purpose.
 * Until somebody does, this stops there being more of them.
 *
 * ## Why it is counted per file
 *
 * It used to be four numbers for the whole app, and the rule was that
 * `counts()` had to equal them exactly — no slack, because a budget with
 * slack in it permits the next few.
 *
 * Exactness was right and the four numbers were the problem. Every branch
 * that removed a hand-written size had to lower the same four lines, so every
 * branch conflicted with every other branch there, whatever else it touched:
 * one file, four lines, and the whole repository writing to them. On a day
 * with a dozen branches in flight that is a conflict per pair, none of which
 * is a disagreement about anything — both sides removed values, both are
 * right, and the answer is not the sum of the two, because two branches can
 * remove the same value and it only counts once. That last part is why the
 * conflicts could not be resolved by arithmetic and had to be re-measured
 * every time.
 *
 * So the ledger is per file, in `budget.ts`, and it is generated rather than
 * written: `npm run lint:styles -- --fix` measures the tree and rewrites it.
 * A branch that tidies `screens/Today.tsx` now edits the `screens/Today.tsx`
 * line and nothing else, so two branches meet here only when they have both
 * changed the same screen — which is a conflict they were going to have in
 * that screen anyway.
 *
 * It is also stricter than the four numbers were, which is the part worth
 * keeping. Under one global figure, five values added to Calendar were paid
 * for by five removed from Study and the total never moved. Per file, each of
 * those is its own answer: the removal is recorded where it happened, and the
 * addition fails where it happened.
 *
 * A file with no entry may have none at all. That is the rule for new code,
 * and it is why the generated list is a list of debts rather than of
 * allowances — nothing is owed by a file that is not on it.
 */

/** The four things counted. Ordered, because the reports read in this order. */
export const AXES = ['type', 'leading', 'space', 'shorthand'] as const;

export type Axis = (typeof AXES)[number];

/** What one file is owed, with the axes it owes nothing on left out. */
export type Counted = Partial<Record<Axis, number>>;

/** The ledger: path under `src/` to what that file is owed. */
export type Budget = Record<string, Counted>;

/** Why each axis is on the list, for the report and for anybody reading it. */
export const AXIS_SAYS: Record<Axis, string> = {
  type: 'font sizes off the six steps — 11.5, 12.5, 13.5 and a display tail',
  leading: 'line heights off the three — 1.55, 1.4, 1.35 and below',
  space: 'spacing numbers off the seven steps — 14, 7, 9, 18 and a tail',
  shorthand: "`padding: '11px 0'` and the like: two axes in one string",
};

/*
 * ## The years of the four numbers, kept
 *
 * Everything below this line is the log of the single global budget, in the
 * form `type/leading/space/shorthand`, from when there was one. Those four
 * numbers no longer exist — `budget.ts` holds a count per file — so none of
 * these figures can be looked up in the code any more.
 *
 * They are kept anyway, because each entry is the reason a screen looks the
 * way it does: what was deleted, what was merged into what, and which of the
 * removals were real rather than reformatting. That is the part a per-file
 * ledger cannot say, since a generated file has no room for a sentence. The
 * numbers are stale; the accounts of the changes are not.
 *
 * The last of them is where this ends. The Tools tab became a home screen —
 * thirteen cards drawn by hand in `screens/Study.tsx`, each with its own
 * padding, its own 13.5px blurb and its own 1.35 leading, became one
 * `<AppGrid>` whose sizes live in `app.css` on the scales — and that change
 * merged five times in twenty minutes, conflicting on these four numbers
 * every single time. Which is what the per-file ledger above was written for.
 *
 * 674/218/515/498 → 673/218/515/498 when Study's Revise tab was rebuilt and
 * the Tools grid grew the two or three cards that say which tile to press
 * tonight. One down, none up. The Revise tab's hand-set 11.5px captions, a
 * 1.25 line height and an 11px padding went with the rows that carried them;
 * the new cards above the grid set their padding from `--sp-*` and their
 * headings take `SectionLabel`'s own margin rather than overriding it, so
 * neither the spacing nor the shorthand count moved. Measured on the merged
 * tree, like the note below and for the same reason.
 *
 * 680/219/521/509 → 680/219/520/505 when the assistant's panel became the
 * chat. Two numbers down and none up, and neither by reformatting: the
 * panel's transcript, opening, header and footer are now the same components
 * and the same measure the Ask tab uses, so the hand-set gap and the four
 * `'12px 16px'`-shaped paddings it drew for itself went with the layout they
 * belonged to. See `ai/Assistant.tsx`.
 *
 * It also took out two loose 1.4 line heights, which do not show above: the
 * row pass landed `leading` on 219 from the other side, and these counts are
 * of what is left in the tree rather than of what each branch removed. Two
 * changes can take the same number to the same place.
 *
 * 682/222/524/544 → 680/221/523/544 when Personal lost its Places tab. Three
 * down and none up: the tab was a second copy of what the map already is, and
 * the one thing only it could do — standing somewhere and naming it — moved to
 * `screens/Maps.tsx` as it was rather than being redrawn, so the panel's own
 * off-scale values went with it and the tab's list rows did not come back.
 *
 * 682/222/524/544 → 679/222/522/542 when the Claude key stopped being on two
 * screens. Three down, none up, and none by reformatting: Connect accounts'
 * copy of the key form drew its own model list by hand, and Settings already
 * had one built from `CustomRow`.
 *
 * 679/222/522/542 → 677/222/520/538 when the second chip idiom got a name.
 * Five sites were drawing an outlined pick chip by hand with the padding
 * drifting between 7px and 9px and the radius between two tokens; `PickChips`
 * draws one on the spacing scale, so the drift is gone rather than moved.
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
 * `shorthand` went 519 → 509 when the courses got their own colours. The Look
 * settings page wrote the same section-label margin twelve times — one string,
 * twelve copies, eleven chances to be a pixel out — and it is one `CAP`
 * constant now. The thirteenth section, the course palette, uses it too rather
 * than adding the thirteenth copy, which is the whole reason to have counted.
 *
 * Set to what is there, not to what a grep said.
 *
 * The first numbers here were a few higher, because they came from a grep over
 * the raw files and this counts code with the comments blanked — so a value
 * quoted in a note explaining why the value exists was being counted as one of
 * them. A budget with slack in it is a budget that permits the next few, which
 * is the opposite of the point.
 */

/** What one file's text is off the scales by, zero axes omitted. */
function countIn(text: string): Counted {
  const code = withoutComments(text);
  const out: Counted = {};
  const add = (axis: Axis, n: number) => {
    if (n) out[axis] = (out[axis] ?? 0) + n;
  };

  let type = 0;
  for (const m of code.matchAll(/calc\((\d+(?:\.\d+)?)px \* var\(--text-scale, 1\)\)/g))
    if (!TYPE[m[1]]) type += 1;
  add('type', type);

  let leading = 0;
  for (const m of code.matchAll(/lineHeight: (\d+(?:\.\d+)?)(?![0-9.])/g)) if (!LEADING[m[1]]) leading += 1;
  add('leading', leading);

  const SPACING =
    /\b(?:gap|rowGap|columnGap|margin(?:Top|Bottom|Left|Right)|padding(?:Top|Bottom|Left|Right)?): (\d+)(?![0-9.])/g;
  // `0` is not a spacing choice, it is the absence of one, and there is no
  // step for it. Counting it as drift meant the budget crept up every time
  // somebody wrote `padding: 0` to cancel a default, which is the opposite
  // of what this watches for.
  let space = 0;
  for (const m of code.matchAll(SPACING)) if (m[1] !== '0' && !SPACE[m[1]]) space += 1;
  add('space', space);

  add('shorthand', [...code.matchAll(/\b(?:margin|padding): '[^']*px[^']*'/g)].length);

  return out;
}

/** The path a report and the ledger both name a file by: relative to `src/`. */
function relative(path: string): string {
  return path.slice(path.indexOf('/src/') + 5);
}

/**
 * The tree measured, one entry per file that owes anything.
 *
 * Files owing nothing are left out rather than written as four zeroes: the
 * ledger is a list of debts, and a file that is clean should leave it when it
 * becomes clean rather than sit on it forever as a row of noughts.
 */
export function countsByFile(dir: string): Budget {
  const out: Budget = {};
  for (const f of sources(dir)) {
    const n = countIn(f.text);
    if (Object.keys(n).length) out[relative(f.path)] = n;
  }
  return out;
}

/**
 * The four totals, for the one line the linter prints when it passes.
 *
 * Derived from the per-file ledger rather than counted separately, so the
 * summary and the rule can never disagree about what is in the tree.
 */
export function counts(dir: string): Record<Axis, number> {
  const total: Record<Axis, number> = { type: 0, leading: 0, space: 0, shorthand: 0 };
  for (const owed of Object.values(countsByFile(dir))) {
    for (const axis of AXES) total[axis] += owed[axis] ?? 0;
  }
  return total;
}

/** Add up one side of the ledger, for a report that wants a single number. */
export function owed(budget: Budget): Record<Axis, number> {
  const total: Record<Axis, number> = { type: 0, leading: 0, space: 0, shorthand: 0 };
  for (const entry of Object.values(budget)) {
    for (const axis of AXES) total[axis] += entry[axis] ?? 0;
  }
  return total;
}

/**
 * Where the tree and the ledger disagree, as problems that name the file.
 *
 * Three kinds, and the distinction is the whole value of this: **grew** is the
 * failure the rule exists for and the only one a person has to think about;
 * **shrank** and **stale** are bookkeeping, and each says the command that
 * fixes it. Keeping them apart means the message for adding drift is not the
 * same message as the one for removing it, which under the old single-number
 * rule it was — both read "the budget is N", and the second was the far
 * commoner, so the first stopped being read.
 */
export function overBudget(dir: string, budget: Budget): Problem[] {
  const now = countsByFile(dir);
  const out: Problem[] = [];
  const paths = [...new Set([...Object.keys(now), ...Object.keys(budget)])].sort();

  for (const file of paths) {
    const has = now[file];
    const may = budget[file];

    if (!has) {
      out.push({
        file: 'styles/budget.ts',
        line: 0,
        found: file,
        says:
          `${file} is on the ledger and owes nothing — it was tidied, renamed or deleted.\n` +
          '    Run `npm run lint:styles -- --fix` to drop the entry.',
      });
      continue;
    }

    for (const axis of AXES) {
      const n = has[axis] ?? 0;
      const cap = may?.[axis] ?? 0;
      if (n === cap) continue;
      if (n > cap) {
        out.push({
          file,
          line: 0,
          found: `${axis} ${n}, and ${cap} allowed`,
          says:
            `${n - cap} more than this file is allowed — ${AXIS_SAYS[axis]}.\n` +
            '    Use a token, or a `calc(Npx * var(--text-scale, 1))` for a size that is\n' +
            '    genuinely not on the scale. If the value has to stay, raise this file\n' +
            '    with `npm run lint:styles -- --fix` and say why in the same diff.',
        });
      } else {
        out.push({
          file,
          line: 0,
          found: `${axis} ${n}, and ${cap} allowed`,
          says:
            `${cap - n} fewer than the ledger says, which is the good direction.\n` +
            '    Run `npm run lint:styles -- --fix` so the ledger cannot be spent again.',
        });
      }
    }
  }

  return out;
}

/**
 * The ledger as the source of `budget.ts`, ready to write.
 *
 * Generated rather than hand-kept, and sorted by path so the file a branch
 * touches is the line a branch changes — which is the property the whole
 * per-file arrangement exists for.
 */
export function render(budget: Budget): string {
  const rows = Object.keys(budget)
    .sort()
    .map((file) => {
      const owed = AXES.filter((a) => budget[file][a])
        .map((a) => `${a}: ${budget[file][a]}`)
        .join(', ');
      return `  '${file}': { ${owed} },`;
    });

  return `${HEADER}\nexport const BUDGET: Budget = {\n${rows.join('\n')}\n};\n`;
}

const HEADER = `import type { Budget } from './rules';

/**
 * What each file is still owed, off the three scales. Generated — do not edit.
 *
 *     npm run lint:styles -- --fix
 *
 * measures the tree and rewrites this. It is a list of debts: a file that is
 * not here may have none at all, which is the rule new code is held to.
 *
 * Why it is a file per line rather than four numbers for the app, and why
 * that is stricter rather than looser, is written where the rule is —
 * \`rules.ts\`, under "Why it is counted per file". The short version is that
 * four shared numbers meant every branch in the repository wrote to the same
 * four lines, so every pair of branches conflicted here over a disagreement
 * neither of them had.
 */
`;
