/**
 * The two marks between finishing a piece of work and getting it back.
 *
 * Under the Mark done row, because that is the row it is arguing with. *Mark
 * done* is one tick for three different facts — the essay is written, the essay
 * is uploaded, the essay has been marked — and the one the app most needs to
 * know is the middle one. See `lib/stage.ts` for the seven statuses §91 asks
 * for and which five were already in the store.
 *
 * ## It draws the warning it is here for
 *
 * A paper finished on Thursday and never uploaded reads, on the deadline list,
 * exactly like a paper nobody opened: both are overdue and unticked. This panel
 * is the only place the app can tell them apart, so when it can, it says so in
 * warning colour and says what to do about it. Everything else here is one
 * quiet line.
 *
 * ## What it deliberately does not draw
 *
 * The mark itself, the regrade window, and the countdown for raising it, all of
 * which belong to `components/CameBack.tsx` a few rows above — `state.returned`
 * is where a grade lives and there is no second record of it here. Once a mark
 * is back, this panel is one word.
 */

import { useStore } from '../state/store';
import { progressFrom, statusLabel, statusOf } from '../lib/stage';
import type { DatedItem } from '../lib/types';

/** The moment, as the rest of this screen writes a date. */
function on(at: number | undefined): string {
  return at ? new Date(at).toDateString().slice(4) : '';
}

export function WhereItStands({ item }: { item: DatedItem }) {
  const { state, dispatch } = useStore();
  const p = progressFrom(state);
  const status = statusOf(item, p);
  const ready = state.ready[item.id];
  const submitted = state.submitted[item.id];

  // Nothing useful to offer once the mark is back: the panel above holds the
  // grade, the window and the clock, and a second "not handed in after all"
  // here would be a button that contradicts it.
  if (status === 'GRADED') {
    return (
      <div className="kicker" style={{ marginTop: 'calc(14px * var(--density, 1))' }}>
        Graded
      </div>
    );
  }

  // The one case worth a colour. Finished, nothing says it went anywhere, and
  // the day has gone.
  const stranded = status === 'MISSED' && Boolean(ready);

  return (
    <div
      style={{
        marginTop: 'calc(16px * var(--density, 1))',
        paddingBlock: 'calc(11px * var(--density, 1))',
        paddingInline: 'calc(13px * var(--density, 1))',
        border: `1px solid ${stranded ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
        background: stranded ? 'var(--app-warn-wash)' : 'transparent',
        borderRadius: 'var(--r-md)',
      }}
    >
      <div className="kicker">{statusLabel(item, p)}</div>
      {stranded && (
        <div
          style={{
            fontSize: 'var(--type-base)',
            marginTop: 'calc(5px * var(--density, 1))',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          You marked this finished on {on(ready)} and nothing here says it was handed in. The date
          has gone.
        </div>
      )}
      {submitted && !stranded && (
        <div
          style={{
            fontSize: 'var(--type-sm-plus)',
            color: 'var(--app-dim)',
            marginTop: 'calc(5px * var(--density, 1))',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          Handed in on {on(submitted)}. Nothing has come back yet — the button above marks it when
          it does.
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'calc(16px * var(--density, 1))',
          marginTop: 'calc(6px * var(--density, 1))',
        }}
      >
        {/* Only while there is a gap to describe. A paper already handed in is
            past the question, and a ticked one has answered it another way. */}
        {!submitted && !state.done[item.id] && (
          <button
            type="button"
            className="bare tappable"
            aria-pressed={Boolean(ready)}
            onClick={() => dispatch({ type: 'markStage', id: item.id, stage: 'ready' })}
            style={{
              width: 'auto',
              minHeight: 44,
              paddingInline: '0',
              fontSize: 'var(--type-sm)',
              color: 'var(--app-dim)',
              textAlign: 'left',
            }}
          >
            {ready ? 'Not ready after all' : 'It is ready to hand in'}
          </button>
        )}
        <button
          type="button"
          className="bare tappable"
          aria-pressed={Boolean(submitted)}
          onClick={() => dispatch({ type: 'markStage', id: item.id, stage: 'submitted' })}
          style={{
            width: 'auto',
            minHeight: 44,
            paddingInline: '0',
            fontSize: 'var(--type-sm)',
            color: 'var(--app-dim)',
            textAlign: 'left',
          }}
        >
          {submitted ? 'Not handed in after all' : 'I handed this in'}
        </button>
      </div>
    </div>
  );
}
