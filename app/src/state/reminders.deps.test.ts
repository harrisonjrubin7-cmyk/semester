import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The reminder loop, and the slices of state it is allowed to forget.
 *
 * `useEffect` schedules an interval that closes over `state`. React does not
 * re-run the effect when state the closure reads changes unless that state is
 * in the dependency array, so a slice read inside the interval and missing
 * from the array is frozen at whatever it held when the effect last ran — and
 * the interval goes on answering with it, once a minute, until something else
 * in the array happens to change.
 *
 * Five were missing, and one of them mattered a great deal. `state.quiet` is
 * the quiet-hours window, and it gates whether anything fires at all: a
 * student who set quiet hours at eleven at night was still notified through
 * the night, because the running interval was holding the window as it stood
 * before they set it. The setting looked like it had done nothing, which for
 * that whole night it had. `state.term` and the four the bill reads —
 * charges, aid, payments, plans — were the same failure one screen over: pay
 * an instalment and the nudge about it kept arriving.
 *
 * The comment already in the file says exactly this about `state.done`, which
 * is how the other five came to be the exception rather than the rule. So the
 * rule is checked here instead of restated: every `state.<slice>` the effect
 * reads has to be in its dependency array. That check only works while the
 * effect names the slices it wants — `nextPayment` used to take the whole
 * store, which hid four of them from any scan and from the linter alike, and
 * now takes the four lists by name.
 *
 * Read off the source rather than by driving the clock, because what is being
 * asserted is a fact about the dependency array — and a rendered test of a
 * once-a-minute interval would pass for the wrong reason the moment the
 * effect stopped running at all.
 */

const SOURCE = readFileSync(new URL('./store.tsx', import.meta.url), 'utf8');

/** The effect, from the line that fires reminders back to its dependencies. */
function reminderEffect(): { body: string; deps: string[] } {
  const anchor = SOURCE.indexOf('dueReminders(');
  expect(anchor, 'the reminder effect has moved or been renamed').toBeGreaterThan(-1);
  const opens = SOURCE.lastIndexOf('useEffect(() => {', anchor);
  const closes = SOURCE.indexOf('}, [', anchor);
  const end = SOURCE.indexOf(']);', closes);
  return {
    body: SOURCE.slice(opens, closes),
    deps: SOURCE.slice(closes + 4, end)
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean),
  };
}

describe('the reminder interval', () => {
  it('depends on every slice of state it reads', () => {
    const { body, deps } = reminderEffect();
    const read = [...new Set(body.match(/\bstate\.[A-Za-z][A-Za-z0-9]*/g) ?? [])];
    expect(read.length, 'the effect stopped reading state at all').toBeGreaterThan(3);
    expect(read.filter((slice) => !deps.includes(slice))).toEqual([]);
  });

  it('holds the quiet window, which decides whether anything fires', () => {
    // Singled out because it is the one whose staleness is silent: the others
    // send a wrong reminder, this one sends a reminder that was switched off.
    expect(reminderEffect().deps).toContain('state.quiet');
  });
});
