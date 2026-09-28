import { useState } from 'react';
import { TERM_END, TERM_START } from '../lib/termtransition';
import { useStore } from '../state/store';
import { Group as Panel, NavRow } from './shell/Rows';
import { Segmented } from './ui';

/**
 * The start and the end of a term, as two lists that open the right screen.
 *
 * Drawn beside `CloseTerm` on the registrar screen, which is where the term
 * is already opened and closed. Which list shows first is the student's
 * choice rather than the calendar's guess: `lib/termtransition.ts` can pick by
 * date, but a student planning ahead in week ten wants the end list, and one
 * catching up in week two wants the start list, and neither is wrong.
 */
export function TermTransition() {
  const { dispatch } = useStore();
  const [end, setEnd] = useState<'start' | 'end'>('start');
  const steps = end === 'end' ? TERM_END : TERM_START;

  return (
    <section aria-labelledby="term-transition" style={{ marginTop: 'var(--sp-7)' }}>
      <h2
        id="term-transition"
        style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 var(--sp-4)', fontFamily: 'var(--font-heading)' }}
      >
        The term, start to finish
      </h2>
      <Segmented
        options={[
          { id: 'start', label: 'Start of term' },
          { id: 'end', label: 'End of term' },
        ]}
        value={end}
        onChange={setEnd}
        style={{ marginBottom: 'var(--sp-5)' }}
      />
      <Panel>
        {steps.map((s) => (
          <NavRow key={s.id} label={s.label} sub={s.why} onClick={() => dispatch({ type: 'go', screen: s.screen })} />
        ))}
      </Panel>
    </section>
  );
}
