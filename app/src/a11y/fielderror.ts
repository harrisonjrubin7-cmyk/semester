import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The field-error rule: a form says a field is wrong one way, through
 * `components/FieldMessage.tsx`.
 *
 * Every validating form in the app used to draw its own complaint — a warning
 * coloured `<div>` under the boxes, held in a `const [bad, setBad]` — and not
 * one of them tied the sentence to the box, marked the box invalid, or moved
 * focus to it. The shared component does all three. What brings the old shape
 * back is not a bug anyone would notice by eye: the sentence still shows, it
 * just stops existing for a screen reader. So this reads the source for the
 * two marks the ad-hoc version leaves.
 *
 * 1. **`aria-invalid` written by hand.** The shared `fieldProps` is the one
 *    place it is set, because setting it without `aria-describedby` to the
 *    message is how the proxy field in Settings came to say "invalid entry"
 *    and never why. A file that genuinely needs it elsewhere goes in `ALLOWED`
 *    with its reason.
 * 2. **A hand-rolled validation state beside a form control** — a string
 *    state called `bad`, `invalid`, `fieldError` and the like, in a file that
 *    draws an `<input>`, `<textarea>` or `<select>`. That is the shape all five
 *    ad-hoc forms had. Deliberately a name list and not "any string state":
 *    `problem` in `screens/Solve.tsx` is the maths problem, and `refused` in
 *    the tab chooser is about a tap, not a field.
 *
 * Source-reading, like `labels.ts` and `rootunmount.test.ts`: it cannot see a
 * field error spelt some third way, and it is not meant to. It catches the
 * two shapes that actually happened.
 */

export const ALLOWED: Record<string, string> = {
  // A spreadsheet cell, not a form field. A cell that breaks its column's rule
  // carries the reason in its own name ("Cell B3 — must be a number"), which a
  // reader hears on every arrow key; a describedby message under a grid of
  // hundreds of cells has nowhere to be drawn.
  'screens/Sheet.tsx': 'grid cell; reason is in the accessible name',
};

/** The component that owns the pattern. */
export const OWNER = 'components/FieldMessage.tsx';

const STATE_NAMES = ['bad', 'invalid', 'fieldError', 'fieldErrors', 'inputError', 'formError', 'validation'];

export interface Finding {
  file: string;
  line: number;
  found: string;
  says: string;
}

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const at = join(dir, entry);
    if (statSync(at).isDirectory()) sources(at, found);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) found.push(at);
  }
  return found;
}

/** Comments out, so a note that *mentions* `aria-invalid` is not a use of it. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length));
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

export function adHocFieldErrors(src: string): Finding[] {
  const out: Finding[] = [];
  for (const path of sources(src)) {
    const file = relative(src, path).split('\\').join('/');
    if (file === OWNER || ALLOWED[file]) continue;
    const text = code(readFileSync(path, 'utf8'));

    for (const m of text.matchAll(/aria-invalid\s*=|['"]aria-invalid['"]\s*:/g)) {
      out.push({
        file,
        line: lineOf(text, m.index ?? 0),
        found: 'aria-invalid',
        says: `set aria-invalid through fieldProps() or useFieldErrors().control() from ${OWNER}, so the box is tied to its message`,
      });
    }

    if (!/<(input|textarea|select)\b/.test(text)) continue;
    const names = STATE_NAMES.join('|');
    // A *string* state: the message itself. `const [bad, setBad] = useState(false)`
    // on the support screen is a bad-weather checkbox, not an error.
    const state = new RegExp(`const \\[(${names}), set\\w+\\] = useState(?:<string[^>]*>\\(|\\(['"\`])`, 'g');
    for (const m of text.matchAll(state)) {
      out.push({
        file,
        line: lineOf(text, m.index ?? 0),
        found: `const [${m[1]}, …] = useState`,
        says: `a form field's error goes through useFieldErrors() and <FieldMessage> from ${OWNER}`,
      });
    }
  }
  return out;
}
