import { useStore } from '../state/store';

/**
 * A standing note that these deadlines are not real.
 *
 * The sample semester is the best thing about a first run — four whole courses
 * with real readings, real dates and 278 cards, so the app can be judged full
 * rather than empty. It is also four courses of dates that belong to somebody
 * else, and the only thing that said so was a toggle three taps down in
 * Settings.
 *
 * That is a genuinely dangerous gap. A student who imports one real syllabus
 * alongside the sample now has a Today screen mixing their Thursday paper with
 * a demonstration one, and nothing on the screen distinguishes them. Somebody
 * will eventually trust the wrong row.
 *
 * So while the sample is on, every screen says so, and the way out is on the
 * same line as the words rather than three taps away.
 *
 * ## Not dismissible
 *
 * Deliberately. A banner you can close is a banner people close, and then the
 * app is back to looking like their real semester. This is not a notice about
 * a feature; it is a statement about whether the data is true, and it stops
 * when the data does.
 *
 * It is small, quiet and out of the way — one line under the header — because
 * it has to be tolerable for as long as somebody wants to keep the sample.
 */
export function SampleMark() {
  const { state, dispatch, say } = useStore();
  if (!state.sample) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '5px 16px',
        background: 'var(--app-hero)',
        borderBottom: '1px solid var(--app-line)',
        fontFamily: 'var(--font-heading)',
        fontSize: 'calc(10.5px * var(--text-scale, 1))',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      <span aria-hidden="true" style={{ width: 5, height: 5, flex: 'none', background: 'var(--app-accent)' }} />
      <span style={{ flex: 1, minWidth: 0, opacity: 0.8 }}>
        Sample semester · not your courses
      </span>
      <button
        type="button"
        className="bare"
        onClick={() => {
          dispatch({ type: 'setSample', on: false });
          say('Sample semester switched off. Your own courses are what is left.');
        }}
        style={{
          flex: 'none',
          width: 'auto',
          padding: '2px 4px',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          letterSpacing: 'inherit',
          textTransform: 'inherit',
          textDecoration: 'underline',
          opacity: 0.75,
        }}
      >
        Switch it off
      </button>
    </div>
  );
}
