import { useNow, useStore } from '../state/store';
import { ChipRow } from './ui';
import { readTerm, termsAround } from '../lib/term';

/**
 * Which semester you are in, asked once, on a first run.
 *
 * Not the same control as {@link TermSwitch}, which offers the terms you
 * already have courses in and hides itself until there are two. On a first
 * run there are none, and that is exactly when the answer matters most:
 * `screens/Import.tsx` stamps every course it adds with `state.term`, and
 * `yearFor` resolves a bare month against that term's start month — so a term
 * got wrong here is every deadline in the semester filed against the wrong
 * year, and the switcher that would fix it is not on screen yet.
 *
 * The guess from the calendar is preselected rather than assumed, because the
 * two cases a first run actually meets are the ones the calendar gets wrong:
 * setting up in December for a term starting in January, and a summer session
 * the calendar has already called Fall. See `termsAround`.
 */
export function TermChoice() {
  const { state, dispatch } = useStore();
  const now = useNow();
  const options = termsAround(now);
  // The saved term may sit outside the window — somebody reopening onboarding
  // months later, or a term typed in before. It belongs on the row rather than
  // silently unselected, which would read as no answer having been given.
  const all = options.some((t) => t.id === state.term)
    ? options
    : [readTerm(state.term), ...options];

  return (
    <div>
      <div className="kicker" style={{ marginBottom: 'var(--sp-4)' }}>
        Which semester
      </div>
      <ChipRow
        options={all.map((t) => t.id)}
        value={state.term}
        onChange={(id) => dispatch({ type: 'setTerm', term: id })}
        labels={Object.fromEntries(all.map((t) => [t.id, t.label]))}
      />
    </div>
  );
}
