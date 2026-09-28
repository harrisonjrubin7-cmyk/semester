// With the extension, because `scripts/terms.mjs` loads this file through a
// plain `await import()` and Node ESM resolves no extensions of its own.
import { sources, withoutComments } from '../styles/rules.ts';

/**
 * The vocabulary rule: retired words, counted per file, allowed to shrink and
 * never to grow.
 *
 * `docs/design/SEMESTER-CONTENT-STANDARDS.md` says which word the app uses for
 * each shared idea. A table in a document is a habit, and the fastest way to
 * write a label is to copy the one above it — so this is the table as code,
 * the same arrangement as the style rule and its ledger (`styles/rules.ts`,
 * `styles/budget.ts`).
 *
 * ## Why a ledger and not a rename
 *
 * The retired words are already on screen: "your own tasks" in Today, the
 * reports and Export; "Something went wrong" in two places. Renaming them is a
 * change a person should see screenshots of, one screen at a time, and it is
 * tracked in `docs/design/DESIGN-DEBT.md`. What this does now is stop the count
 * rising while that happens. `npm run lint:terms -- --fix` rewrites the ledger
 * from the tree, so a raised number is a line in the diff with a reviewer
 * looking at it, and a lowered one is the migration being recorded.
 *
 * ## Where it looks
 *
 * `.tsx` and `.ts` alike: "Task deleted", the Mine tab's name and the month
 * grid's "1 task of your own" were all labels in `lib/`, not in a component,
 * and a `.tsx`-only rule could not see one of them. Two folders are left out.
 * `data/` is course material — a syllabus, a reading, a lecture transcript —
 * and "the assignment of tasks by sex" is the author's sentence, not the
 * app's. `content/` is this rule, whose own table is made of retired words.
 *
 * ## What counts as user-facing
 *
 * Two kinds of text in a `.tsx` or `.ts` file, with comments blanked first:
 *
 * - JSX text: whatever sits between `>` and `<` with no `{` in it.
 * - String literals with a space in them — prose, not keys. `'task'` is a
 *   discriminant in a union and `'task-bar'` is a class name; neither is a
 *   word anybody reads. A literal given to `className` is skipped outright,
 *   because `"bare tappable task-clear"` has spaces and is still not prose.
 *
 * That is a heuristic, and it errs toward counting: a false positive is one
 * more number in the ledger, while a false negative is a retired word that
 * ships. Proper nouns that contain a retired word — Google Tasks — are listed
 * in `PROPER` and never counted.
 */

export interface Retired {
  /** The key the ledger uses. */
  id: string;
  /** Matched case-insensitively against user-facing text. */
  match: RegExp;
  /** The word to use instead, as the content standard says it. */
  use: string;
}

/**
 * The retired words, in the order the content standard lists them.
 *
 * Deliberately short. Every row here is a word that has one canonical
 * replacement in every student-facing context; a word whose meaning depends on
 * context ("class" as one meeting of a course, "session" as a study session,
 * "submit" as what Canvas calls handing in, "cutoff" on a grading scale, "to
 * do" as a verb) is written down in the standard
 * rather than counted here, because a rule that is wrong half the time gets
 * deleted rather than obeyed.
 */
export const RETIRED: readonly Retired[] = [
  { id: 'to-do', match: /\bto-?dos?\b|\bto do lists?\b/i, use: 'action' },
  { id: 'task', match: /\btasks?\b/i, use: 'action' },
  { id: 'homework', match: /\bhomework\b/i, use: 'assignment' },
  { id: 'deliverable', match: /\bdeliverables?\b/i, use: 'assignment' },
  { id: 'roadmap', match: /\broadmaps?\b/i, use: 'plan' },
  { id: 'unverified', match: /\bunverified\b/i, use: 'needs confirmation' },
  { id: 'smart', match: /\bsmart\b/i, use: 'AI-assisted (say what it did)' },
  {
    id: 'something went wrong',
    match: /\bsomething went wrong\b/i,
    use: 'what failed, what still works, and what to do next',
  },
  { id: 'click here', match: /\bclick here\b/i, use: 'a verb and an object: "Open official registration"' },
];

/** Names of other products. Removed from the text before it is matched. */
export const PROPER: readonly RegExp[] = [/\bGoogle Tasks\b/g, /\bMicrosoft To ?Do\b/gi, /\bSmart ?Board\b/gi];

export interface Hit {
  file: string;
  line: number;
  id: string;
  /** The text the word was found in, trimmed to one line. */
  found: string;
}

/** `{ 'screens/Today.tsx': { task: 4 } }` — what each file still owes. */
export type Ledger = Record<string, Record<string, number>>;

const lineOf = (text: string, at: number) => text.slice(0, at).split('\n').length;

/**
 * The user-facing text in one file, with where each piece starts.
 *
 * Exported for the test, which needs to show the heuristic's edges on
 * snippets rather than on the whole app.
 */
export function prose(text: string): { at: number; text: string }[] {
  const code = withoutComments(text);
  const out: { at: number; text: string }[] = [];

  // JSX text. `>` then anything that is not a tag or an expression, then `<`.
  // A `=>` in an arrow function would open a false match, so the `>` must not
  // follow `=`, and the run must contain a letter to be worth reading.
  for (const m of code.matchAll(/(?<![=-])>([^<>{}]*[A-Za-z][^<>{}]*)</g)) {
    out.push({ at: m.index + 1, text: m[1] });
  }

  // String literals: single, double, and the static parts of a template.
  for (const m of code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const body = m[2];
    if (!body.includes(' ')) continue;
    const before = code.slice(Math.max(0, m.index - 24), m.index);
    if (/className=\{?\s*$|className:\s*$|\bimport\b[^;]*$|\bfrom\s*$/.test(before)) continue;
    // A template's `${…}` holes are code, not prose.
    out.push({ at: m.index + 1, text: m[1] === '`' ? body.replace(/\$\{[^}]*\}/g, ' ') : body });
  }
  return out;
}

/** Folders under `src/` whose text is not the app's own. See "Where it looks". */
const SKIP = ['data/', 'content/'];

/** Every retired word in user-facing text under `dir`. */
export function find(dir: string): Hit[] {
  const out: Hit[] = [];
  for (const f of sources(dir, { ext: ['.tsx', '.ts'], tests: false })) {
    const rel = f.path.slice(f.path.lastIndexOf('/src/') + 5);
    if (SKIP.some((d) => rel.startsWith(d))) continue;
    for (const p of prose(f.text)) {
      let text = p.text;
      for (const name of PROPER) text = text.replace(name, ' ');
      for (const r of RETIRED) {
        if (r.match.test(text)) {
          out.push({
            file: rel,
            line: lineOf(f.text, p.at),
            id: r.id,
            found: p.text.replace(/\s+/g, ' ').trim().slice(0, 90),
          });
        }
      }
    }
  }
  return out;
}

export function countsByFile(dir: string): Ledger {
  return countHits(find(dir));
}

/** The hits as a ledger: per file, per retired word, how many. */
export function countHits(hits: readonly Hit[]): Ledger {
  const out: Ledger = {};
  for (const h of hits) {
    const row = (out[h.file] ??= {});
    row[h.id] = (row[h.id] ?? 0) + 1;
  }
  return out;
}

export function total(ledger: Ledger): number {
  return Object.values(ledger).reduce((n, row) => n + Object.values(row).reduce((a, b) => a + b, 0), 0);
}

export interface Problem {
  file: string;
  line: number;
  found: string;
  says: string;
}

/**
 * Every file carrying more of a retired word than the ledger allows it.
 *
 * Reports each hit in the offending file, not only the count, because the new
 * one is somewhere among them and a count alone sends the next person to grep.
 */
export function overLedger(dir: string, ledger: Ledger): Problem[] {
  // One walk of the tree. This read it twice — `find` here and again inside
  // `countsByFile` — and on a thousand files that was 4.5 s alone and past the
  // 5 s test timeout under a loaded full run, about one run in two.
  const hits = find(dir);
  const now = countHits(hits);
  const out: Problem[] = [];
  for (const [file, row] of Object.entries(now)) {
    for (const [id, n] of Object.entries(row)) {
      const allowed = ledger[file]?.[id] ?? 0;
      if (n <= allowed) continue;
      const use = RETIRED.find((r) => r.id === id)?.use ?? '';
      for (const h of hits.filter((h) => h.file === file && h.id === id)) {
        out.push({
          file,
          line: h.line,
          found: h.found,
          says:
            `"${id}" is retired in user-facing text — use ${use}. ` +
            `This file has ${n}, the ledger allows ${allowed}. ` +
            'See docs/design/SEMESTER-CONTENT-STANDARDS.md.',
        });
      }
    }
  }
  return out;
}

/** The ledger file, as `--fix` writes it. Sorted, so the diff is only what moved. */
export function render(ledger: Ledger): string {
  const rows = Object.keys(ledger)
    .sort()
    .map((file) => {
      const row = ledger[file];
      const cells = Object.keys(row)
        .sort()
        .map((id) => `${/^[a-z]+$/.test(id) ? id : `'${id}'`}: ${row[id]}`)
        .join(', ');
      return `  '${file}': { ${cells} },`;
    });
  return `import type { Ledger } from './terms';

/**
 * Retired words still on screen, per file. Generated — do not edit.
 *
 *     npm run lint:terms -- --fix
 *
 * measures the tree and rewrites this. A file that is not here has none, which
 * is the rule new code is held to. Why this is a ledger rather than a rename is
 * written in \`terms.ts\`; the migration itself is DD-001 and DD-002 in
 * \`docs/design/DESIGN-DEBT.md\`.
 */

export const LEDGER: Ledger = {
${rows.join('\n')}
};
`;
}
