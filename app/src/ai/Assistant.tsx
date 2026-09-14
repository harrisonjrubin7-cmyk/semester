import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { useAI } from './store';
import { WIDE, useMedia } from '../lib/media';
import { screenName } from '../lib/nav';
import { AskSelection } from './AskAbout';
import { fills } from '../components/shell/exempt';
import { faultOf } from '../lib/fault';
import { offline } from '../lib/offline';
import { secondLine } from '../lib/dim';

type PanelComponent = (typeof import('./Panel'))['Panel'];

/**
 * The panel, which is the rest of the assistant and most of its weight.
 *
 * Twenty modules and 7,287 lines behind this one import, measured on the eager
 * import graph: the conversation, the turns, the composer, the proposals,
 * `lib/claude.ts` and `lib/tools.ts`. None of it is needed to draw a button,
 * and until this split all of it was parsed before the app's first render.
 * See `ai/Panel.tsx`.
 *
 * ## Why this is not `lazy()` and a `Suspense`
 *
 * Because `lazy()` made opening the panel **twenty times slower**, and the
 * measurement is worth keeping: tap to panel-in-the-DOM went from 14–28ms to
 * a flat 314ms, on the production build, with the chunk already fetched and
 * sitting in memory.
 *
 * The flatness is the clue — that is not work, it is a deliberate delay.
 * `lazy` only calls its factory at the first render that needs it, so even an
 * already-resolved module suspends for a tick; the `Suspense` fallback is
 * committed; and React then throttles *un*-showing a fallback it has just
 * shown, so that a flash of spinner cannot be briefer than the eye can follow.
 * That rule is right, and the way to not pay it is to never suspend.
 *
 * So the module is held in state instead. The effect below fetches it when the
 * browser is idle, long before anybody taps, and the panel then renders in the
 * same commit as any other conditional child — no fallback, no throttle,
 * nothing to reveal. A tap that somehow beats the prefetch waits for the
 * fetch and no longer, rather than for the fetch plus a third of a second.
 *
 * The promise is module-level so the prefetch and the open share one request.
 * It is cleared on failure, which `lazy` will not do: a rejected `lazy` is
 * rejected for the life of the page, and this way walking back into signal and
 * tapping again tries again.
 */
let loading: Promise<PanelComponent> | null = null;
const loadPanel = (): Promise<PanelComponent> =>
  (loading ??= import('./Panel').then((m) => m.Panel));

/**
 * The assistant's button, everywhere — and the door to the rest of it.
 *
 * One button in the corner, mounted once in the shell rather than rendered by
 * a screen, so there is exactly one of it and it can never disagree with
 * itself about where you are. Tapping it opens `ai/Panel.tsx`, which is the
 * conversation and is fetched separately; the reasoning about what the panel
 * is and how it behaves lives over there, beside the code that does it.
 *
 * ## Why the two are separate files
 *
 * They were one component, and `App.tsx` mounts it in all three shells — so
 * the whole conversation stack was parsed before the app's first render:
 * `converse.ts`, `Turns`, `Composer`, `Actions`, `lib/claude.ts`,
 * `lib/tools.ts` and the rest. Twenty modules and 7,287 lines, measured on
 * the eager import graph, to draw a button with a glyph in it.
 *
 * What stays here is everything that has to be true *before* the panel is
 * open: the button and where it rests, Cmd+K, Escape, the selection
 * affordance, and the lift that keeps the button off a primary action. All of
 * it is cheap, and all of it would be wrong to load late — a shortcut that
 * arrives two seconds after the page is a shortcut that does nothing when it
 * is first pressed. See `ENGINEERING-AUDIT.md` §1.
 *
 * ## Where the button sits
 *
 * Above the tab bar, inset from the right, and it must not cover a primary
 * action on any screen. Two screens already put something in that corner —
 * Today's import button when the feed nav is on, and the desktop shortcut
 * sheet — so this steps aside for both rather than stacking on them.
 */


/** How far the button lifts when something it would cover is underneath. */
const LIFT = 58;


/**
 * Whether an element is something a person would tap.
 *
 * The question the button is asking of the point beneath it. Deliberately
 * generous — a card that navigates is as much a primary action as a button
 * labelled Save, and the cost of lifting unnecessarily is a button two
 * centimetres higher than it might have been.
 */
function tappable(el: Element | null, self: Element | null, at: DOMRect | null): boolean {
  if (!el) return false;
  /*
   * The button is not something the button covers.
   *
   * Left out, this oscillates forever and the first version did: unlifted,
   * the point it asks about is the point it is sitting on, so it finds
   * itself, lifts, finds the space it left empty, drops, and flips between
   * two positions for as long as the screen is open.
   */
  if (self && (el === self || self.contains(el))) return false;
  const node = el.closest('button, a, input, textarea, select, [role="button"]');
  if (!node) return false;
  // The tab bar is always under it and is not something it covers: the button
  // sits above the bar by construction, and its own hit area does not reach.
  if (node.closest('.app-tabs')) return false;

  /*
   * Covered is not the same as unusable, and the rule is about the second.
   *
   * The first version treated anything tappable as a collision, which on a
   * dense screen is every position on the page — six screens ran out of room
   * after two lifts because a list has a row under the button at every
   * offset. But a full-width row with its right-hand corner clipped is still
   * a row you can tap; it has lost nothing you needed. A text field or a
   * small icon button that disappears underneath has.
   *
   * So the question is what the overlap costs. A form field always counts —
   * a caret you cannot see is unusable even when most of the box shows. Past
   * that it is proportional: something the button hides half of is hidden.
   */
  const tag = node.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;

  /*
   * And a destructive control, at any overlap at all.
   *
   * The proportional rule below is right for the case it was written for — a
   * full-width row with a clipped corner is still a row you can tap, and
   * treating every overlap as a collision made six screens run out of lifts.
   * It reasons about how much of the control you can still *see*, which is
   * the right question when the cost of a mis-tap is another tap.
   *
   * Delete is the control where it is not. A quarter-covered Delete passes
   * the rule at 26% and puts the assistant on top of the corner somebody aims
   * at — the button that wins the overlap is this one, so the mis-tap opens a
   * chat rather than deleting, which is the safe direction and still a
   * control the student cannot finish reaching. Marked in the markup rather
   * than matched on the label, for the reason `lib/onframe.test.ts` gives
   * about labels: they drift, and a rule that reads them drifts with them.
   */
  if (node.hasAttribute('data-danger')) return true;

  if (!at) return true;
  const r = node.getBoundingClientRect();
  const area = r.width * r.height;
  if (area === 0) return true;
  const over =
    Math.max(0, Math.min(r.right, at.right) - Math.max(r.left, at.left)) *
    Math.max(0, Math.min(r.bottom, at.bottom) - Math.max(r.top, at.top));
  return over / area >= 0.5;
}

/**
 * Where the button can sit without covering something.
 *
 * The brief says it must never cover a primary action on any of fifty
 * screens. Auditing fifty layouts finds today's collisions and none of
 * tomorrow's — the one this found was Costs, where "Add it" is a full-width
 * block button whose right end lands exactly in the corner, and *any* corner
 * button clips *any* full-width button that happens to sit in its band.
 *
 * So it asks instead. `elementsFromPoint` is the browser's own answer to
 * "what is under here", and the button lifts by its own height until nothing
 * tappable is. Two lifts is the cap: past that the screen is dense enough
 * that anywhere is a compromise, and a button wandering up the page is worse
 * than one that overlaps.
 */
/**
 * The points a resting place is asked about: its centre and its four corners.
 *
 * The centre alone was the whole question for a long time, and it answers a
 * different one than it looks like it does. `elementsFromPoint` reports what
 * is under *a point*, so a control that sits entirely inside one corner of
 * the button — a 24px icon, a short Delete — is invisible to it however
 * completely the button covers it. The corners are inset by a pixel so they
 * land inside the button's own box rather than on whatever owns the boundary.
 *
 * Exported for `ai/dock.test.ts`, which is where the shape of this is held:
 * jsdom has no layout and cannot run `elementsFromPoint` at all, so the part
 * a test can check is which points get asked.
 */
export function probes(rest: DOMRect, lifted = 0): [number, number][] {
  const top = rest.top - lifted;
  const bottom = rest.bottom - lifted;
  const inset = 1;
  return [
    [rest.left + rest.width / 2, top + rest.height / 2],
    [rest.left + inset, top + inset],
    [rest.right - inset, top + inset],
    [rest.left + inset, bottom - inset],
    [rest.right - inset, bottom - inset],
  ];
}

function clearOf(rest: DOMRect, self: Element | null, tries = 3): number {
  let lifted = 0;
  for (let i = 0; i < tries; i += 1) {
    // Where the button would actually be, so the overlap below is the real
    // overlap rather than one measured against where it is now.
    const would = new DOMRect(rest.left, rest.top - lifted, rest.width, rest.height);
    const covered = probes(rest, lifted).some(([x, y]) =>
      document.elementsFromPoint(x, y).some((el) => tappable(el, self, would)),
    );
    if (!covered) return lifted;
    lifted += LIFT;
  }
  return lifted;
}

/** Where the button can rest. Dragging it across the middle moves it. */
type Corner = 'right' | 'left';
const CORNER_KEY = 'semester.ai.corner';

function savedCorner(): Corner {
  try {
    return localStorage.getItem(CORNER_KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}


/**
 * The panel could not be fetched, and the app must survive it.
 *
 * `<Assistant />` is mounted in the shell, *outside* the boundary that wraps
 * the screen — so a `lazy()` that rejects here has nothing between it and the
 * root, and React unmounts the whole tree. That is the white page
 * `components/Boundary.tsx` was written about, and code-splitting this panel
 * is exactly what would have reintroduced it: an installed app open across a
 * deploy asks for a file GitHub Pages has stopped serving, and an app with no
 * signal asks for one it never fetched.
 *
 * Small and in place, rather than the full-page apology `ScreenTrouble`
 * draws. Nothing is lost when this fails — the conversation is in
 * `ai/live.ts` and on the device — so the honest thing is a card where the
 * panel would have been, saying which of the two happened, and a way out.
 * `lib/fault.ts` tells them apart; the wording is `Boundary.tsx`'s, shortened.
 */
class PanelTrouble extends Component<{ children: ReactNode; onClose: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <PanelGone error={error} onClose={this.props.onClose} />;
  }
}

/**
 * The card that stands in for the panel, when there is no panel.
 *
 * Two ways to get here and one thing to say. The chunk would not fetch, or it
 * fetched and threw while rendering; `lib/fault.ts` sorts the first into the
 * two cases a student can act on, and the second reads as the second of them.
 *
 * Small and in place, rather than the full-page apology `ScreenTrouble`
 * draws — nothing is lost when this fails, because the conversation lives in
 * `ai/live.ts` and on the device. The wording is `components/Boundary.tsx`'s,
 * shortened to a card.
 */
function PanelGone({ error, onClose }: { error: Error; onClose: () => void }) {
  // Read at render, not when it was caught: somebody who has walked back into
  // signal should not still be told they are offline.
  const absent = faultOf(error, !offline()) === 'absent';
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 60,
        maxWidth: 420,
        marginInline: 'auto',
        padding: 'var(--sp-6)',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--glow)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          // `secondLine()`, not `opacity: 0.5`. The audited rung against
          // whichever ground is on — see `lib/dim.ts`, and the `dim` axis in
          // `styles/rules.ts` that counts the hand-written kind.
          ...secondLine(),
        }}
      >
        {absent ? 'No connection' : 'This app was updated'}
      </div>
      <p style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)' }}>
        {absent
          ? 'The assistant has not been downloaded to this device yet. It will open as soon as there is a connection — everything you have asked it is saved here.'
          : 'A new version was published while this was open, so the assistant could not be fetched. A reload is the whole fix, and nothing is lost.'}
      </p>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
        {!absent && (
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()} style={{ minHeight: 44 }}>
            Reload
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ minHeight: 44 }}>
          Close
        </button>
      </div>
    </div>
  );
}

export function Assistant() {
  const { state } = useStore();
  const ai = useAI();
  const wide = useMedia(WIDE);
  const [corner, setCorner] = useState<Corner>(savedCorner);
  /** The panel's component, once it has been fetched. See `loadPanel`. */
  const [Panel, setPanel] = useState<PanelComponent | null>(null);
  /** Or why it could not be. */
  const [panelTrouble, setPanelTrouble] = useState<Error | null>(null);

  /*
   * `screenName`, not the registry directly. Twenty screens are not
   * destinations — the eight settings pages and the twelve you reach from
   * something else — so `?? ai.screen` was the answer on all twenty, and the
   * button announced itself as "Ask about setNav", "Ask about drill", "Ask
   * about slides". `lib/nav.ts` names them; nothing here has to know which
   * of the three registries a given screen's name is kept in.
   */
  const here = useMemo(() => screenName(ai.screen), [ai.screen]);

  /*
   * The one corner it must not take.
   *
   * Today already puts the import button bottom-right when the feed nav is
   * on. Stacking on it would bury a primary action behind a floating one,
   * which is the failure the brief calls out by name, so the assistant takes
   * the other side there instead of arguing about z-index.
   */
  const taken = state.nav === 'feed' && state.screen === 'home' && !wide;
  const side: Corner = taken && corner === 'right' ? 'left' : corner;

  /*
   * Cmd/Ctrl+K, and Escape while the sheet is up.
   *
   * Not `a`. That is in `lib/keys.ts` with every other single-letter shortcut,
   * because for a while it was in both: this listener opened the sheet while
   * that one navigated to the Ask screen, and pressing `a` did both. A key
   * with two owners has no correct behaviour, and the `?` sheet — which reads
   * that list — could only ever describe one of them.
   *
   * Cmd+K stays here. `lib/keys.ts` ignores anything carrying a modifier on
   * principle, so adding it there would mean weakening the rule that keeps the
   * app out of the browser's shortcuts.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ai.show();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && ai.open) {
        e.preventDefault();
        ai.hide();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ai]);

  const moveCorner = (to: Corner) => {
    setCorner(to);
    try {
      localStorage.setItem(CORNER_KEY, to);
    } catch {
      /* the position is a convenience, not a setting worth failing over */
    }
  };

  /*
   * Lifted, when the screen puts something tappable under it.
   *
   * Measured after the screen has painted, and again if the window resizes.
   * Not on every render: this reads layout, and doing that in a render is how
   * a scroll turns into a stutter.
   */
  const [lift, setLift] = useState(0);
  /**
   * Whether the screen has a row open as its own editor.
   *
   * The button stands down for it, the way it stands down on a screen whose
   * composer is on the bottom edge. Same argument, one scale smaller: while a
   * row is a form, the controls that matter are its Save, its Cancel and its
   * Delete, they are the densest thing on the screen, and at phone width the
   * button cannot get clear of all three — two lifts is the cap and the cap
   * has its reasons. Offering to talk about the page is not worth sitting on
   * the page's only way to finish.
   *
   * Read from the document rather than passed down. A provider threaded from
   * `App` through four components to a row would be the plumbing this file
   * already avoids for the same question — what is under me — and this effect
   * is where that reading already happens.
   */
  const [editing, setEditing] = useState(false);
  const fab = useRef<HTMLButtonElement | null>(null);
  /*
   * Lifted when the screen puts something tappable under it.
   *
   * Tied to scrolling rather than only to the screen changing, for two
   * reasons. The honest one: what is under the button is a property of the
   * scroll position, not of the screen — a list has a row under it at every
   * offset and a form has its Save button under it at exactly one. The
   * practical one: measuring on a timer after a screen change measured the
   * *previous* screen's layout about half the time, which is why the first
   * version lifted on the screens that were already clear and stayed put on
   * Costs, the one screen that needed it.
   */
  useEffect(() => {
    if (ai.open) return;
    let waiting = 0;
    const check = () => {
      // Before the button is asked about: when a row is a form, there is no
      // button to measure and the answer is to stay away.
      const open = !!document.querySelector('[data-editing]');
      setEditing(open);
      if (open) return;
      const node = fab.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      // From the resting place, not the lifted one, or each measurement is of
      // the answer to the last.
      const rest = new DOMRect(box.left, box.top + lift, box.width, box.height);
      setLift(clearOf(rest, node));
    };
    const soon = () => {
      if (waiting) return;
      waiting = window.requestAnimationFrame(() => {
        waiting = 0;
        check();
      });
    };
    /*
     * Checked several times over the first second, not once.
     *
     * A single measurement after a screen change was the bug: every screen is
     * lazy and arrives behind a Suspense boundary, so at 120ms Costs had not
     * painted its "Add it" button yet, the point under the assistant was
     * empty, and it settled at the one position that covers it. Screens also
     * fill in after their first paint — a list that loads, a figure that
     * measures — so there is no single moment that is "after the screen".
     *
     * Four `elementsFromPoint` calls spread over a second cost nothing, and
     * between them they are right whenever the content actually arrives.
     */
    const timers = [120, 350, 700, 1200].map((ms) => window.setTimeout(soon, ms));
    const area = document.querySelector('.scrollarea');
    area?.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    /*
     * And when the screen changes shape under it without anybody scrolling.
     *
     * The two triggers above are "you moved" and "the window did". A third
     * way to end up with something under the button is for the page to grow a
     * control where it is standing: a row in Mine that becomes its own editor
     * on a press, a section that unfolds, a form that adds a field. None of
     * those scroll, none resize the window, and the timers ran on the way
     * into the screen — so the button kept a measurement of a layout that no
     * longer existed.
     *
     * `soon` is already rAF-debounced, so a burst of mutations costs one
     * measurement, and a measurement is five `elementsFromPoint` calls.
     */
    const watch = new MutationObserver(soon);
    if (area) watch.observe(area, { childList: true, subtree: true });
    return () => {
      for (const t of timers) window.clearTimeout(t);
      if (waiting) window.cancelAnimationFrame(waiting);
      area?.removeEventListener('scroll', soon);
      window.removeEventListener('resize', soon);
      watch.disconnect();
    };
  }, [ai.open, state.screen, state.mode, wide, lift, editing]);

  /*
   * Fetch the panel when the browser has nothing better to do — and at once
   * if somebody has already asked for it.
   *
   * Splitting the panel off keeps it out of the first render; it does not have
   * to keep it out of the first tap. Idle time after paint is neither: the
   * page is drawn, the student is reading, and the panel arrives quietly in
   * the background so that opening it is as immediate as it was before the
   * split.
   *
   * `requestIdleCallback` where there is one, a timer where there is not —
   * Safari only gained it recently, and a fixed two seconds is the same idea
   * with worse timing rather than a different one. Either way `loadPanel`
   * hands back the same promise, so a tap during the fetch joins it rather
   * than starting a second one.
   */
  useEffect(() => {
    let alive = true;
    const get = () => {
      loadPanel().then(
        (loaded) => {
          // The updater form: `setPanel(fn)` would call a component instead of
          // storing it.
          if (alive) setPanel(() => loaded);
        },
        (e: unknown) => {
          // Cleared, so the next attempt is a real one. See `loadPanel`.
          loading = null;
          if (alive) setPanelTrouble(e instanceof Error ? e : new Error(String(e)));
        },
      );
    };

    if (ai.open) {
      get();
      return () => {
        alive = false;
      };
    }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(get, { timeout: 4000 });
      return () => {
        alive = false;
        window.cancelIdleCallback?.(id);
      };
    }
    const t = window.setTimeout(get, 2000);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [ai.open]);

  return (
    <>
      {/* Select a sentence anywhere and ask about that instead of the page. */}
      <AskSelection />
      {/*
        Not on a screen whose composer is on the bottom edge.

        The button's whole job is to bring the assistant over what you are
        looking at. On the Ask tab you are looking at the assistant, so it
        offered to open a sheet showing the same conversation on top of the
        same conversation — and the sheet's header would have read "Looking
        at: Ask Claude". It also sat over the composer, which is the one
        control on that screen that matters.

        That second reason is the general one, and it is why this asks
        `fills()` rather than naming the Ask tab. A screen on that list ends
        at the bottom edge with something you type into there — the class
        conversation does too — so the floating button lands on the send
        control of whatever chat is open. See `shell/exempt.ts`.
      */}
      {!ai.open && !fills(state.screen) && !editing && (
        <button
          type="button"
          ref={fab}
          onClick={() => ai.show()}
          /*
           * Named for where you are, so a screen reader hears what it will be
           * asked about rather than "button, ask".
           *
           * From the registry, not from `look()` — that assembles the whole
           * context, and calling it to write a label would rebuild four
           * courses' worth of grading rows on every render of a button.
           */
          aria-label={`Ask about ${here}`}
          aria-keyshortcuts="a"
          onDragEnd={(e) => moveCorner(e.clientX < window.innerWidth / 2 ? 'left' : 'right')}
          draggable
          style={{
            position: 'fixed',
            [side]: 18,
            /*
             * Above the tab bar, measured rather than guessed.
             *
             * The bar has no fixed height — it is a flex child sized by its
             * own content, and it grows with the text-size setting. A
             * hard-coded 64 left a two-pixel gap at the default size and would
             * have sat on top of the bar at the largest one, so the shell
             * measures it and writes `--tabbar-h`.
             */
            /*
             * A wide window has no tab bar — the rail replaces it and the
             * shell removes `--tabbar-h` — so the fallback would strand the
             * button 76px above nothing.
             */
            bottom: wide ? 20 + lift : `calc(var(--tabbar-h, 76px) + ${12 + lift}px)`,
            width: 52,
            height: 52,
            borderRadius: '50%',
            zIndex: 55,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--chrome)',
            color: 'var(--chrome-ink)',
            border: '1px solid rgba(255,255,255,.45)',
            boxShadow: 'var(--glow)',
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(17px * var(--text-scale, 1))',
            cursor: 'pointer',
          }}
        >
          {/* A glyph rather than an icon import: the tab bar's icon set has
              nothing that reads as "ask", and a wrong icon is worse than a
              letter people learn in a day. */}
          <span aria-hidden>✦</span>
        </button>
      )}

      {/*
        The panel, on a chunk of its own.

        `fallback={null}` rather than a spinner, because by the time anybody
        taps, the effect above has usually already fetched it and there is
        nothing to wait for. A skeleton that flashes for one frame on every
        open would be worse than the two frames it covers on the first.

        `key` on the boundary is the open itself, so closing and reopening
        gets a fresh attempt rather than the message the last failure left up.
      */}
      {/*
        The panel, on a chunk of its own, and drawn the moment it is here.

        Nothing is shown while it is still being fetched. By the time anybody
        taps, the effect above has almost always finished, and a skeleton that
        flashed for a frame on every open would cost more than the rare wait
        it covers.

        The boundary is for a panel that throws while rendering; the failure
        to *fetch* it is `panelTrouble`, which the same card reports. Both
        matter here and nowhere else in the app: this is mounted in the shell,
        outside the boundary that wraps the screen, so an uncaught throw takes
        the whole tree with it.
      */}
      {ai.open && panelTrouble && <PanelGone error={panelTrouble} onClose={() => ai.hide()} />}
      {ai.open && !panelTrouble && Panel && (
        <PanelTrouble key="panel" onClose={() => ai.hide()}>
          <Panel side={side} />
        </PanelTrouble>
      )}
    </>
  );
}
