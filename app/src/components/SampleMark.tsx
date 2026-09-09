import { useStore } from '../state/store';

/**
 * A standing note about where these four courses came from — and two ways out.
 *
 * The app ships with a whole semester in it: four courses, real readings, real
 * dates, 278 cards. For most people opening it that is a demonstration, and
 * saying so matters — import one real syllabus alongside it and Today mixes
 * your Thursday paper with somebody else's, with nothing distinguishing them.
 *
 * For one person it is not a demonstration at all. It is their actual Fall
 * 2026, which is why those four courses and not four invented ones. Calling it
 * "not your courses" told the person the app was built for that their own
 * semester belonged to somebody else — and worse, a shipped course is compiled
 * in rather than stored, so it cannot be edited, shared, or given office
 * hours. Their real courses were the only ones in the app they could not
 * change.
 *
 * So this asks rather than asserts, and both answers are one tap:
 *
 *   **These are mine** copies them into the account as ordinary courses. They
 *   become editable, shareable and updatable, and nothing is lost in the move
 *   — a course id is a slug of its code, so every tick, review, grade and note
 *   already filed against `econ` stays filed against it.
 *
 *   **Not mine** removes them, which is what somebody who was looking around
 *   wants once they have their own syllabus in.
 *
 * Either answer ends the question for good, which is why neither is a dismiss.
 * A banner you can close is one people close, and then the app is back to
 * looking like a real semester without having said which kind it is.
 */
export function SampleMark() {
  const { state, dispatch, say, adopt } = useStore();
  if (!state.sample) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        /*
         * Twelve, not five, and the number is the buttons' rather than the
         * banner's. `.tap-y` grows each one's hit area to 44px tall, centred
         * on a 20px label — so it needs twelve pixels of room above and below
         * inside this strip. At five it did not have them, and the overlay
         * spilled out of the strip in both directions, where the header above
         * and the fold row below win the hit test. The 44px existed and none
         * of it could be reached.
         */
        paddingBlock: 'var(--sp-6)',
        paddingInline: 'var(--sp-7)',
        background: 'var(--app-hero)',
        borderBottom: '1px solid var(--app-line)',
        fontFamily: 'var(--font-heading)',
        fontSize: 'calc(10.5px * var(--text-scale, 1))',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        flexWrap: 'wrap',
      }}
    >
      <span aria-hidden="true" style={{ width: 5, height: 5, flex: 'none', background: 'var(--app-accent)' }} />
      <span style={{ flex: 1, minWidth: 0, opacity: 0.8 }}>The semester this app ships with</span>
      <button
        type="button"
        className="bare tap-y"
        onClick={() => {
          adopt();
          say('Taken on · They are your courses now, editable like any you import.', 'courses');
        }}
        style={link}
      >
        These are mine
      </button>
      <span aria-hidden="true" style={{ opacity: 0.3, flex: 'none' }}>·</span>
      <button
        type="button"
        className="bare tap-y"
        onClick={() => {
          dispatch({ type: 'setSample', on: false });
          say('Removed. Your own courses are what is left.');
        }}
        style={link}
      >
        Not mine
      </button>
    </div>
  );
}

/*
 * `tap-y` on both, not `tap`: they sit side by side with a separator between
 * them, so an overlay reaching sideways would have each claiming the other's
 * space.
 *
 * Up and down is *not* free, which this said before and was wrong about. The
 * overlay rendered at its full 44px and was unreachable at both ends: above,
 * the sticky header paints over it at `z-index: 3`; below, the fold row does.
 * Neither is tappable there, and that turns out not to matter — hit testing
 * goes to whatever paints on top, not to whatever wants the tap. So the room
 * has to exist inside this strip, which is what its vertical padding is for.
 *
 * Measured 81×20 and 50×20 with the overlay occluded on both sides.
 */
const link = {
  flex: 'none',
  width: 'auto',
  padding: '2px 3px',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit',
  textDecoration: 'underline',
  opacity: 0.75,
} as const;
