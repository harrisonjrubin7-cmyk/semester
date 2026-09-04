import { useStore } from '../state/store';
import { ChipRow } from './ui';
import { isPast } from '../lib/term';

/**
 * Which semester you are looking at.
 *
 * Absent until there is more than one, which is the state almost everybody is
 * in almost always — a switcher offering one choice is a control that teaches
 * you the app is more complicated than it is.
 *
 * A term that has finished is still here and still says so, because "the ECON
 * guide I built in October" is a thing people want in February and the
 * alternative is hunting for a PDF in a downloads folder.
 */
export function TermSwitch() {
  const { state, dispatch, now, terms } = useStore();
  if (terms.length < 2) return null;

  const current = terms.find((t) => t.id === state.term) ?? terms[0];

  return (
    <div>
      <ChipRow
        options={terms.map((t) => t.id)}
        value={current.id}
        onChange={(id) => dispatch({ type: 'setTerm', term: id })}
        labels={Object.fromEntries(terms.map((t) => [t.id, t.label]))}
      />
      {isPast(current, now) ? (
        <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 6, lineHeight: 1.45 }}>
          A finished term. Its deadlines are out of Today, out of the hour arithmetic and out of
          the weekly report; its guides, cards, notes and papers are all still here, and it is
          still exportable. Nothing was deleted.
        </div>
      ) : null}
    </div>
  );
}
