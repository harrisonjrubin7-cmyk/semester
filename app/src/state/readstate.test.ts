import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sources } from '../styles/rules';

/**
 * Every field of the state is a field something reads.
 *
 * `SIMPLIFY-AUDIT.md` F1 and F2. Four fields were written and never read —
 * `calTab`, `meGroup`, `loadStep` and `mailSeed` — and the fourth was not
 * tidying. `writeMail` stored the purpose, course, recipient and deadline for
 * an email into `mailSeed`, and the mailbox opens its composer from a
 * `MailDraft`, so the four buttons that dispatched it arrived with no composer
 * at all. The feature's own comment said what was lost: *re-picking it from a
 * list of thirty-eight is the step at which people gave up.*
 *
 * ## Why every other check missed it
 *
 * The reducer was correct. The action was typed. The value was stored, and
 * `tsc` is satisfied by a field that is assigned — being read is not part of
 * what a type says. Nothing threw, no pixel moved, and the whole suite passed
 * on the broken version, because every test asserted what the action *did*
 * rather than what anything did with the result.
 *
 * So the question this asks is the one nobody was asking: **is there a reader
 * at the other end?**
 *
 * ## Reads and writes, told apart
 *
 * A write is a key in an object literal — `{ ...state, calTab: action.tab }`,
 * or the declaration, or the default. A read is a member access —
 * `state.calTab` — or a name pulled out of `= state`. That distinction is the
 * whole rule, and it is exact rather than a heuristic: the colon is what makes
 * a key a key.
 *
 * The destructure half catches nothing today, and that is stated rather than
 * implied. `screens/Calendar.tsx` pulls `calYear`, `calMonth` and `calSource`
 * out of `state`, but all three are member-accessed elsewhere too, so the rule
 * passes without it — checked by deleting that half and watching the test stay
 * green. It is kept because the field that is destructured and nothing else is
 * the false positive this rule cannot afford: a census that calls a live field
 * dead is one people stop believing, and then delete.
 *
 * ## What it cannot see
 *
 * A field read only through a computed key — `state[name]` — is invisible
 * here and would be reported as dead. Nothing in the app does that today. If
 * something ever does, the answer is a line in `COMPUTED` below saying where,
 * not a looser rule: the loose version of this census is the one that missed
 * seventeen dead CSS rules in E3b.
 */

/** Fields reached by a computed key, with where. Empty, and that is checked. */
const COMPUTED = new Map<string, string>();

const SRC = join(process.cwd(), 'src');

/** The files this rule reads. `styles/rules.ts` walks; this names. */
const walk = (dir: string): string[] => sources(dir, { ext: ['.ts', '.tsx'] }).map((s) => s.path);

/** The declared field names of one interface in `shape.ts`. */
function fieldsOf(shape: string, name: string): string[] {
  const from = shape.indexOf(`export interface ${name}`);
  expect(from, `${name} is still an interface in shape.ts`).toBeGreaterThan(-1);
  const to = shape.indexOf('\n}', from);
  return [...shape.slice(from, to).matchAll(/^ {2}([a-zA-Z][\w]*)\??:/gm)].map((m) => m[1]);
}

describe('the state', () => {
  const shape = readFileSync(join(SRC, 'state', 'shape.ts'), 'utf8');
  const source = walk(SRC)
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n');

  /** Names pulled out of `= state`, in any of the shapes the app writes it. */
  const destructured = new Set(
    [...source.matchAll(/\{([^{}]*)\}\s*=\s*state\b/g)]
      .flatMap((m) => m[1].split(','))
      .map((s) => s.split(':')[0].trim())
      .filter(Boolean),
  );

  const isRead = (field: string) =>
    new RegExp(`\\.${field}\\b(?!\\s*:)`).test(source) ||
    destructured.has(field) ||
    COMPUTED.has(field);

  it('has no field that is written and never read', () => {
    const fields = [...new Set([...fieldsOf(shape, 'Persisted'), ...fieldsOf(shape, 'Ephemeral')])];
    // A sanity floor: if the interfaces stop parsing, an empty list would pass
    // this silently, which is the failure mode of every census in this file.
    expect(fields.length, 'the interfaces still parse').toBeGreaterThan(100);
    expect(fields.filter((f) => !isRead(f))).toEqual([]);
  });

  it('can see a destructured field at all', () => {
    /*
     * Not that the rule needs it today — see the note above; no field is
     * destructured and nothing else. This holds that the parsing still works,
     * because a silently broken half would only be discovered by a false
     * accusation against a live field, which is the expensive way to find out.
     */
    expect(destructured.size).toBeGreaterThan(0);
    expect(destructured.has('calYear'), 'Calendar pulls this one out of state').toBe(true);
  });

  it('needs no exceptions, and says so', () => {
    // Kept as an assertion rather than a comment: the moment somebody adds a
    // computed read they have to come here, and the diff says what they did.
    expect([...COMPUTED.keys()]).toEqual([]);
  });
});
