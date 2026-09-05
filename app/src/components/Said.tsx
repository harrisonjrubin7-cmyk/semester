import { useStore } from '../state/store';

/**
 * The app's one live region.
 *
 * Two existed before this — the undo toast and one status line — which covers
 * two of the fifty screens. Everywhere else, an outcome was communicated by
 * something on the page changing: a card advancing, a tick appearing, a sync
 * time updating. A screen reader is told about none of that, so the answer to
 * "did that work" was to go and look, which is the thing a screen reader user
 * cannot do.
 *
 * ## Polite, and only for outcomes
 *
 * `aria-live="polite"` waits for a gap rather than interrupting, which is
 * right for every case here: nothing announced through this is urgent enough
 * to cut across somebody mid-sentence.
 *
 * And only outcomes. A grade field that saves on every keystroke has no
 * outcome to announce, only typing — routing that through here would produce a
 * reader that talks over itself for the length of a number. What goes through
 * it is the short list of things that happened *because* somebody acted and
 * are otherwise invisible.
 *
 * ## Why the timestamp is in the key
 *
 * A live region announces its text when the text changes. Marking two cards
 * wrong in a row produces the same sentence twice, and the second one would be
 * silent — the reader sees no change. Keying on `saidAt` replaces the node, so
 * the second is announced as well.
 */
export function Said() {
  const { state } = useStore();
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      <span key={state.saidAt}>{state.said}</span>
    </div>
  );
}
