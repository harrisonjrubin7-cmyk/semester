/**
 * The one-line offer that Today draws, and the window both it and the screen read.
 *
 * Its own module rather than a second export of `Gap.tsx`, because Today is the
 * eager screen and `Gap.tsx` is not: importing the offer from there pulled the
 * whole between-classes screen — the speech synthesiser, the wake lock, the
 * full card deck — into the first chunk the browser has to download, and the
 * `lazy()` wrapping it in `App.tsx` then had nothing left to defer. The offer
 * is forty lines; the screen behind it is four hundred, and is fetched on the
 * tap that opens it.
 */
import { useMemo } from 'react';
import { useStore } from '../state/store';
import { nextClass, railFor } from '../lib/select';
import {
  cardsThatFit,
  fitsLine,
  gapNow,
  readPace,
  roomOf,
  termsLine,
  walkLine,
  walkTo,
  type Gap as GapWindow,
} from '../lib/gap';
import { current } from '../lib/housing';

/**
 * The window, worked out once and read by both the screen and the offer.
 *
 * Kept here rather than in `lib/gap.ts` because it is the only part that
 * needs the store; everything it decides is decided by tested functions.
 */
/*
 * Aliased `GapWindow`, not `Window`: `Window` is a DOM global, so a file that
 * uses the alias but forgets to import it compiles clean against the global
 * and fails somewhere else entirely.
 */
export function useWindow(): GapWindow | null {
  const { state, catalog, now } = useStore();

  const rail = useMemo(
    () => railFor(catalog, now, state.appointments, state.commitments),
    [catalog, now, state.appointments, state.commitments],
  );

  return useMemo(() => {
    const next = nextClass(catalog, now);
    if (!next) return null;
    return gapNow(
      {
        title: next.block.title,
        where: roomOf(next.block.meta),
        inMinutes: next.inMinutes,
        isTomorrow: next.isTomorrow,
      },
      // Before your first class the origin is where you live, if the housing
      // portal's room has been filled in. See `lib/housing.ts`.
      walkTo(rail, next.block.at, state.places, current(state.residences, state.term)?.hall ?? ''),
    );
  }, [catalog, now, rail, state.places, state.residences, state.term]);
}

/**
 * The offer on Today. One line, and only in a gap worth using.
 *
 * Silent when the next class is tomorrow, when one has already started, when
 * the window is too short to open anything, and when it is long enough to be
 * a work window instead — ninety free minutes are a thing to sit down for, and
 * spending them on flashcards is the worst available use of them.
 */
export function GapOffer() {
  const { dispatch } = useStore();
  const win = useWindow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pace = useMemo(() => readPace(), []);

  if (!win || win.long) return null;

  const cards = cardsThatFit(win.minutes, pace);

  return (
    <button
      type="button"
      className="bare"
      onClick={() => dispatch({ type: 'go', screen: 'gap' })}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '13px 14px',
        marginBottom: 14,
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
        background: 'var(--app-panel)',
      }}
    >
      <div className="kicker">Between classes</div>
      <div style={{ fontSize: 'calc(16px * var(--text-scale, 1))', lineHeight: 1.35, marginTop: 5, textWrap: 'pretty' }}>
        {fitsLine(win, cards)}
      </div>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>
        {termsLine(win, pace)} One thumb, no typing.
      </div>
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.45, marginTop: 5, lineHeight: 'var(--leading-normal)' }}>
        {walkLine(win)}
      </div>
    </button>
  );
}
