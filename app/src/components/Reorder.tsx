/**
 * The two arrows that move a row up and down a list.
 *
 * Written out three times before this — `TabChooser`, `YourCourses` and the
 * Today sections on the Layout and navigation page — as the same pair of
 * `<button className="bare">↑ ↓</button>`, with the same disabled-at-the-ends
 * rule, the same 0.2 and 0.6 opacities, and the same 24-or-26px width chosen
 * by whoever wrote it last. Three copies of a control is three places to fix
 * the next thing wrong with it, which is exactly what happened here: an audit
 * of every screen at phone width found all three at 26×23, and each would have
 * had to be found and corrected separately.
 *
 * ## The size
 *
 * `tap-y` rather than a bigger button. The arrows sit at the right-hand end of
 * a row in a vertical list, so there is room above and below and none beside —
 * an overlay reaching sideways would put the up arrow's target under the down
 * arrow's. See the tap-target note in `styles/app.css`.
 *
 * The drawn arrow is unchanged: same glyph, same width, same opacities. What
 * changed is the area a thumb has to land in, from 23px tall to 44.
 */

export function Reorder({
  label,
  atStart,
  atEnd,
  onUp,
  onDown,
  /** The width the row was already giving each arrow. 24 or 26 in practice. */
  width = 26,
  /**
   * What "up" is called for a screen reader.
   *
   * The tab bar is drawn as a vertical list and read as a horizontal one — a
   * tab moves *left*, not up — so the words are the caller's and the drawing
   * is not. That was already true before this component existed; it is a
   * parameter now rather than the reason for a third copy of the file.
   */
  ways = ['up', 'down'],
}: {
  label: string;
  atStart: boolean;
  atEnd: boolean;
  onUp: () => void;
  onDown: () => void;
  width?: number;
  ways?: readonly [string, string];
}) {
  return (
    <>
      <button
        type="button"
        className="bare tap-y"
        disabled={atStart}
        onClick={onUp}
        aria-label={`Move ${label} ${ways[0]}`}
        style={{ width, flex: 'none', opacity: atStart ? 0.2 : 0.6, fontSize: 'var(--type-lg)' }}
      >
        ↑
      </button>
      <button
        type="button"
        className="bare tap-y"
        disabled={atEnd}
        onClick={onDown}
        aria-label={`Move ${label} ${ways[1]}`}
        style={{ width, flex: 'none', opacity: atEnd ? 0.2 : 0.6, fontSize: 'var(--type-lg)' }}
      >
        ↓
      </button>
    </>
  );
}
