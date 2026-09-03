/**
 * Print what is on the screen.
 *
 * Printing is not a nostalgic feature in a university. Notes go into a folder,
 * a cram sheet goes on a wall, a problem set gets worked in pen, and an exam
 * hall does not allow a phone. The app already produced things worth printing
 * and offered no way to do it except the browser menu, which on a phone is
 * three taps into a share sheet.
 *
 * It prints the current screen rather than building a separate document,
 * because a second rendering path is a second thing to keep correct and it
 * always drifts. The print stylesheet does the work: it drops the navigation,
 * the buttons and the inputs, turns the interface light, and stops a card
 * being split across two pages.
 */
export function PrintButton({
  label = 'Print this',
  style,
}: {
  label?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-block no-print"
      onClick={() => window.print()}
      style={{ height: 42, ...style }}
    >
      {label}
    </button>
  );
}
