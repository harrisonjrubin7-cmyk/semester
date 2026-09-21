/**
 * The keyboard listener, and the sheet that says what it knows.
 *
 * Mounted once, at the top of the app, rather than per screen: a shortcut that
 * works on Today and not on the calendar is worse than none, because the
 * student has to remember which. See `lib/keys.ts` for what is bound and what
 * is deliberately left alone.
 *
 * ## Only where there is a keyboard
 *
 * Nothing here renders on a phone. The sheet would be a panel of keys nobody
 * can press, and the listener would be dead weight in the one place where
 * every byte of the bundle is somebody's data allowance.
 */

import { useEffect, useState } from 'react';
import { secondLine } from '../lib/dim';
import { useStore } from '../state/store';
import { SHORTCUTS, keyLabel, shortcutFor } from '../lib/keys';
import { useAI } from '../ai/store';
import { WIDE, useMedia } from '../lib/media';
import { useSitting } from '../lib/sitting.hook';
import { hold, running } from '../lib/session';
import { here } from '../lib/browser.hook';
import { savable } from '../lib/bookmarks';
import { star } from '../lib/bookmarks.hook';
import { useFocusBar } from './desk/barfocus';

export function Keys() {
  const { state, dispatch, say } = useStore();
  const ai = useAI();
  const wide = useMedia(WIDE);
  const [open, setOpen] = useState(false);
  const [sitting, setSitting] = useSitting();
  /*
   * The workspace's search field, or `null` where none is drawn. Read here
   * rather than worked out from `state.nav`, because the provider is mounted
   * by the same branch that draws the bar — so this cannot say "focus it" on a
   * screen that has none. See `components/desk/barfocus.ts`.
   */
  const focusBar = useFocusBar();

  useEffect(() => {
    if (!wide) return;

    const onKey = (e: KeyboardEvent) => {
      const hit = shortcutFor(e);
      if (!hit) return;

      // The sheet swallows the next Escape: pressing it to close a panel and
      // finding yourself two screens back is the sort of thing that makes a
      // person stop pressing keys at all.
      if (open && hit.action === 'back') {
        e.preventDefault();
        setOpen(false);
        return;
      }

      e.preventDefault();
      if (hit.screen) {
        dispatch({ type: 'go', screen: hit.screen });
        return;
      }
      switch (hit.action) {
        case 'search':
          /*
           * One key, one answer — and the answer is "the search this
           * navigation has".
           *
           * It used to ask the *screen* in front of you and open its own
           * filter where it had one, which meant `/` did different things on
           * Grades and on Today, and the app had two searches to explain.
           * That is still the rule this is written against: what the key does
           * must not change as you move between screens.
           *
           * Asking the navigation does not break it. The workspace draws a
           * search field across the top of every one of its screens; the other
           * five draw none on any. So `/` puts the cursor where the search
           * already is, and opens the palette where there is nothing to put it
           * in — one meaning, expressed by whatever is actually on screen,
           * which is how `lib/chrome.ts` treats the navigation itself.
           *
           * And it is the same answer the pointer gives: the search home's
           * centre box focuses this field rather than opening a second search
           * (see `components/desk/barfocus.ts`), so a keyboard that opened the
           * palette instead would be the two-searches problem again, reachable
           * one way and not the other.
           *
           * Nothing is lost in the workspace. The bar answers with apps as you
           * type and its last row — "Browse all results" — opens the palette on
           * what you have typed, so the records are one key further on rather
           * than gone.
           */
          if (focusBar) {
            focusBar();
            break;
          }
          dispatch({ type: 'finder', open: true });
          break;
        case 'assistant':
          // The sheet over the screen you are on, which is the whole point of
          // it. `ai.show()` and not a navigation — see `lib/keys.ts`.
          ai.show();
          break;
        case 'capture':
          dispatch({ type: 'quickAdd', open: true });
          break;
        case 'bookmark': {
          // The tab rather than the screen, because the strip is what knows
          // the difference between "Course" and "ECON 1020". A new tab has no
          // page in it and nothing to keep, and says so rather than doing
          // nothing — a key that is silent is a key people press twice.
          const tab = here();
          if (!savable(tab) || !tab.screen) {
            say('There is nothing to bookmark on a new tab.');
            break;
          }
          const kept = star({ screen: tab.screen, title: tab.title, place: tab.place });
          say(kept ? `${tab.title} is bookmarked.` : `${tab.title} is no longer bookmarked.`);
          break;
        }
        case 'back':
          dispatch({ type: 'back' });
          break;
        case 'help':
          setOpen((was) => !was);
          break;
        case 'timer':
          // Pause only, never start: starting a timer needs to know what it is
          // for, and a keystroke does not.
          if (running(sitting) && sitting) setSitting(hold(sitting, Date.now()));
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, open, dispatch, sitting, setSitting, ai, say, focusBar]);

  // No effect to close it when the window narrows: the guard below already
  // hides it, and resetting the state in an effect would be a second render
  // to achieve what the first one already did. Widening again brings it back,
  // which is what somebody who narrowed the window mid-look would want.
  if (!wide || !open) return null;

  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      aria-modal="false"
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 60,
        width: 300,
        maxWidth: 'calc(100vw - 36px)',
        paddingTop: 'calc(14px * var(--density, 1))', paddingInline: 'calc(16px * var(--density, 1))', paddingBottom: 'calc(12px * var(--density, 1))',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line-top)',
        background: 'var(--app-panel)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-5)' }}>
        <div className="kicker" style={{ flex: 1 }}>
          Keys
        </div>
        <button
          type="button"
          className="bare"
          onClick={() => setOpen(false)}
          aria-label="Close"
          style={{ width: 'auto', color: 'var(--app-dim)', fontSize: 'var(--type-md)' }}
        >
          ×
        </button>
      </div>

      <div style={{ marginTop: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
        {SHORTCUTS.map((s) => (
          <div
            key={s.key}
            style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline', paddingBlock: 'calc(4px * var(--density, 1))', paddingInline: '0' }}
          >
            <kbd
              style={{
                flex: 'none',
                minWidth: 26,
                textAlign: 'center',
                paddingBlock: 'calc(2px * var(--density, 1))', paddingInline: 'calc(5px * var(--density, 1))',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--app-line-top)',
                background: 'var(--app-hero)',
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--type-xs)',
              }}
            >
              {keyLabel(s.key)}
            </kbd>
            <span style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-dim)' }}>{s.does}</span>
          </div>
        ))}
      </div>

      {/* The sheet is the shortcuts; the guide is everything else. `?` opens
          this because that is what people press first, and the way on is one
          tap rather than a second thing to know about. */}
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => {
          setOpen(false);
          dispatch({ type: 'go', screen: 'help' });
        }}
        style={{ height: 38, marginTop: 'var(--sp-6)', fontSize: 'var(--type-sm)' }}
      >
        How the rest of it works
      </button>

      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
        Nothing fires while you are typing, and anything with ⌘ or Ctrl stays the browser's.
        {state.nav === 'feed' ? ' The screens are the same ones the feed filter reaches.' : ''}
      </div>
    </div>
  );
}
