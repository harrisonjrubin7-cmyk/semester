import { useEffect, useState } from 'react';
import { useSoft } from '../shell/useShell';

/**
 * The hero, on the one shell that has one.
 *
 * `App.tsx` renders this in all three shells and always has — the component
 * asked which shell was on and drew nothing when the answer was not Soft.
 * That is the right shape for the call site and was the wrong shape for the
 * cost: the guard was inside the module, so `components/soft/SoftTopBody.tsx`,
 * `lib/softtop.ts` and the ten modules behind it were fetched and parsed
 * before the first render on every shell. 3,887 lines, measured on the eager
 * import graph, to decide not to draw anything.
 *
 * And it was not only bytes. The body's `useTop()` is a hook, so it ran
 * *above* the early return: every render on every shell built a spec — which
 * walks the term's deadlines — and then discarded it. Gating at the mount
 * rather than inside it is what stops that, and this file is that gate.
 *
 * ## Fetched when the answer is Soft, not before and not on idle
 *
 * The other splits in this app prefetch when the browser goes quiet, because
 * what is behind them is opened later by a tap. This is not: a Soft-shell
 * reader needs the hero in the first paint, and everybody else never needs it
 * at all. So the fetch is the answer to the question rather than a guess ahead
 * of it — `soft` is known on the first render, because the shell comes out of
 * the state that was primed before anything mounted.
 *
 * What it costs is one round trip on a Soft reader's first load, during which
 * the hero is absent and the screen below it is drawn where it will stay. The
 * hero occupies its own block at the top of the scroller, so what happens is
 * that it appears — not that the page moves under a thumb.
 *
 * A fetch that fails leaves no hero and nothing else: the shell, the
 * navigation and the screen are all somewhere else. There is nothing here
 * worth an error card, and `components/Boundary.tsx` still catches a throw
 * from inside the body once it is mounted. See `ENGINEERING-AUDIT.md` §1, P1d.
 */

type Body = (typeof import('./SoftTopBody'))['SoftTopBody'];

/** Module-level, so three call sites and two shells share one request. */
let loading: Promise<Body> | null = null;
const loadBody = (): Promise<Body> =>
  (loading ??= import('./SoftTopBody').then((m) => m.SoftTopBody));

export function SoftTop() {
  const soft = useSoft();
  const [Body, setBody] = useState<Body | null>(null);

  useEffect(() => {
    if (!soft) return;
    let alive = true;
    loadBody().then(
      // The updater form: `setBody(fn)` would call a component instead of
      // storing it.
      (body) => {
        if (alive) setBody(() => body);
      },
      () => {
        // Cleared, so switching shells and back is a real second attempt
        // rather than the same rejection returned instantly.
        loading = null;
      },
    );
    return () => {
      alive = false;
    };
  }, [soft]);

  if (!soft || !Body) return null;
  return <Body />;
}
