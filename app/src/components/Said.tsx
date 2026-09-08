import { useEffect } from 'react';
import { useStore } from '../state/store';
import { useSoft } from './shell/useShell';
import { halves, leftOf, showing } from '../lib/strip';
import { destination } from '../lib/nav';

/**
 * The app's one live region, and the strip that shows the same sentence.
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
 *
 * ## The change strip
 *
 * The handoff asks for a strip at the top naming what moved, auto-dismissing,
 * tappable to the record — and says plainly not to build a second mechanism
 * for it. So it is not one. It is this component growing a visible half: the
 * same `said`, the same `saidAt`, one dispatch. "Fires once on a data change
 * and announces once" is then true by construction rather than by two clocks
 * agreeing, and a caller that adds an announcement gets the strip for free.
 *
 * The sighted half is soft-shell only. Not because the strip is decorative —
 * it is the most useful thing in this file for somebody who can see — but
 * because the restructure's third rule is that `plain` stays pixel-identical,
 * and it is the rollback the other five rules depend on. The announcement,
 * which is the part somebody actually depends on, is in every shell.
 */
export function Said() {
  const { state, dispatch } = useStore();
  const soft = useSoft();

  /*
   * Retired by a timeout, the way the undo toast is, and for the same
   * reasons: the store's own tick is far too slow to clear a five-second
   * strip, and an interval running all term for something on screen for five
   * seconds of it is a wake-up a minute for nothing.
   *
   * Dispatched rather than held locally, also the way the toast does it. What
   * is on the screen then stays a fact about the state — readable, testable,
   * and the same in the two places that render from it — instead of a boolean
   * shut inside a component. It is why nothing here reads the clock during a
   * render.
   */
  useEffect(() => {
    if (!state.said) return;
    const change = { said: state.said, at: state.saidAt };
    if (!showing(change, Date.now())) {
      dispatch({ type: 'forgetSaid' });
      return;
    }
    const id = setTimeout(() => dispatch({ type: 'forgetSaid' }), leftOf(change, Date.now()));
    return () => clearTimeout(id);
  }, [state.said, state.saidAt, dispatch]);

  const { lead, detail } = halves(state.said);
  const named = state.saidTo ? destination(state.saidTo) : null;

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        <span key={state.saidAt}>{state.said}</span>
      </div>

      {soft && state.said !== '' && (
        <div className="soft-strip" key={state.saidAt}>
          {/*
            `aria-hidden`, because the live region above has already said this.
            Without it a screen reader meets the same sentence twice — once
            announced, once again on the way down the page — which is exactly
            the "announces once" the acceptance list asks for, failed by being
            too helpful.
          */}
          <div className="soft-strip-body" aria-hidden="true">
            {lead ? <span className="soft-strip-lead">{lead}</span> : null}
            <span className="soft-strip-detail">{detail}</span>
          </div>
          {named && (
            <button
              type="button"
              className="bare soft-strip-to"
              onClick={() => {
                dispatch({ type: 'forgetSaid' });
                dispatch({ type: 'go', screen: named.screen });
              }}
            >
              {named.short ?? named.label}
            </button>
          )}
        </div>
      )}
    </>
  );
}
