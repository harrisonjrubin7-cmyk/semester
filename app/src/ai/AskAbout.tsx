import { useCallback, useEffect, useRef, useState } from 'react';
import { useAI } from './store';
import type { ScreenContext } from './shape';

/**
 * Asking about one thing rather than the whole screen.
 *
 * The screen provider answers "what is on this page". These answer "this
 * one" — the row you are holding, the sentence you have selected. Both are
 * the same mechanism underneath: register a context while it matters,
 * unregister when it stops, open the sheet with a question already started.
 *
 * ## Why a long press and not a button on every row
 *
 * A visible affordance on every deadline, every grade line and every card
 * would be a hundred small buttons the eye has to skip past on every screen,
 * to serve a thing people do occasionally. A press-and-hold is invisible
 * until wanted and is what people already try. The rows that *are* worth an
 * always-visible one — an insight, which is an assertion somebody may want
 * to interrogate — get it explicitly.
 */

/** How long a press has to last to mean "about this". */
const HOLD = 450;

/** How far a finger may drift before it is a scroll rather than a press. */
const DRIFT = 10;

export interface About {
  /** What to register while the sheet is open about this thing. */
  context: ScreenContext;
  /** What to put in the box. Left empty when there is nothing obvious. */
  seed?: string;
}

/**
 * Props to spread onto any row, making a long press ask about it.
 *
 * Deliberately not a wrapper component: rows in this app are buttons, divs,
 * `Blueprint`s and table cells, and a wrapper would change the layout of
 * every one of them. Spreading handlers changes nothing that is drawn.
 */
export function useAskAbout(id: string, about: () => About) {
  const ai = useAI();
  const timer = useRef(0);
  const from = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = 0;
    from.current = null;
  }, []);

  const open = useCallback(() => {
    const it = about();
    /*
     * Registered before the sheet opens, not after.
     *
     * `look()` runs when the sheet renders, so a context registered on the
     * next tick would miss the first assembly and the header would say the
     * screen's summary while the question was about a row. Ordering, not a
     * race — but the kind that is invisible until somebody reads the header.
     */
    // Whatever the last hold was about is not what this one is about.
    ai.forgetAbout();
    ai.register(`about:${id}`, it.context);
    ai.show(it.seed ?? '');
  }, [ai, id, about]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      from.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        open();
      }, HOLD);
    },
    onPointerMove: (e: React.PointerEvent) => {
      // A finger that has travelled is scrolling. Ten pixels is the usual
      // slop for a hold that is meant to be one.
      const start = from.current;
      if (!start) return;
      if (Math.abs(e.clientX - start.x) > DRIFT || Math.abs(e.clientY - start.y) > DRIFT) cancel();
    },
    onPointerUp: (e: React.PointerEvent) => {
      // A press that became a question must not also be the row's own tap:
      // holding a deadline to ask about it should not tick it off.
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
      }
      cancel();
    },
    onPointerLeave: cancel,
    // The desktop equivalent, and the accessible one: a right-click reaches
    // the same thing a hold does, and a keyboard user gets the menu key.
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      open();
    },
  };
}

/**
 * Ask about the text you have selected.
 *
 * Mounted once by the assistant. A selection anywhere in the app raises one
 * small button beside it; releasing the selection takes it away again. The
 * selected text goes in as the question's subject rather than as its own
 * context, because a sentence out of a page is not a record — it is a quote,
 * and quoting it back is the honest thing to do with it.
 */
export function AskSelection() {
  const ai = useAI();
  const [at, setAt] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const read = () => {
      if (ai.open) {
        setAt(null);
        return;
      }
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      // Short enough to be a stray tap, or long enough to be the whole page:
      // neither is somebody asking about a phrase.
      if (!sel || sel.isCollapsed || text.length < 12 || text.length > 2000) {
        setAt(null);
        return;
      }
      const box = sel.getRangeAt(0).getBoundingClientRect();
      if (box.width === 0 && box.height === 0) {
        setAt(null);
        return;
      }
      setAt({ x: Math.min(box.left, window.innerWidth - 150), y: Math.max(8, box.top - 44), text });
    };
    document.addEventListener('selectionchange', read);
    return () => document.removeEventListener('selectionchange', read);
  }, [ai.open]);

  if (!at) return null;

  return (
    <button
      type="button"
      onClick={() => {
        ai.forgetAbout();
        ai.register('about:selection', {
          summary: `A passage the student selected on the ${ai.screen} screen, ${at.text.length} characters.`,
          focus: { selected: at.text },
          visible: [],
          actions: ['open_screen'],
          suggestions: ['What does this mean?', 'Say this more simply.'],
        });
        ai.show('About this: ');
        window.getSelection()?.removeAllRanges();
      }}
      style={{
        position: 'fixed',
        left: at.x,
        top: at.y,
        zIndex: 65,
        height: 34,
        padding: '0 12px',
        borderRadius: 'var(--r-md)',
        border: '1px solid rgba(255,255,255,.4)',
        background: 'var(--chrome)',
        color: 'var(--chrome-ink)',
        fontFamily: 'var(--font-heading)',
        fontSize: 'calc(12px * var(--text-scale, 1))',
        letterSpacing: '0.06em',
        boxShadow: 'var(--glow)',
        cursor: 'pointer',
      }}
    >
      Ask about this
    </button>
  );
}
