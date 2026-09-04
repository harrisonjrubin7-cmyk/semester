/**
 * Going where the notification said.
 *
 * The service worker already knew how to focus an already-open tab and post it
 * a destination. Nothing in the app was listening. So tapping "Two days:
 * Problem Set 4" on a phone with the tab open brought the app forward and left
 * you exactly where you were — the reminder told you about a thing and then
 * made you go and find it, which is the work it existed to save.
 *
 * Mounted once, like `Ringing` and `Undone`, and draws nothing.
 *
 * ## The cold start is handled here too
 *
 * A tap on a phone with the app closed opens `?screen=…&item=…`. `store.tsx`
 * reads the screen at boot because the very first render needs it, but an item
 * cannot be checked against the catalogue that early — the catalogue is built
 * from state that does not exist yet. So it is done on the first effect, where
 * the deadline can be confirmed to still exist.
 *
 * ## A deadline that has gone is not followed
 *
 * A reminder can sit in a queue for a week. By the time it is tapped, the
 * deadline may have been ticked off, the course removed, the syllabus
 * re-imported with different ids. Opening the detail screen for something that
 * is not there any more is worse than opening the app: it looks broken, and it
 * happens at the exact moment the student is trusting the reminder. So the id
 * is checked, and an unknown one lands on home.
 */

import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { landingFrom, worthGoing } from '../lib/land';

export function Tapped() {
  const { catalog, dispatch } = useStore();
  // The cold-start URL is read once. Without this a re-render after the first
  // navigation would send you back to the notification's target every time.
  const cold = useRef(false);

  const knows = (id: string) => catalog.items.some((i) => i.id === id);

  const goTo = (data: unknown) => {
    const to = landingFrom(data);
    if (!worthGoing(to)) return;
    if (to.item) {
      if (!knows(to.item)) return;
      dispatch({ type: 'openItem', id: to.item });
      return;
    }
    dispatch({ type: 'go', screen: to.screen });
  };

  // A tap while the app is open, relayed by the worker.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'go') return;
      goTo(e.data);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  });

  // A tap that started the app. Waits for the catalogue, which is why this is
  // not in `store.tsx` with the screen.
  useEffect(() => {
    if (cold.current || catalog.empty) return;
    let asked: string | null = null;
    try {
      asked = new URLSearchParams(window.location.search).get('item');
    } catch {
      return;
    }
    cold.current = true;
    if (!asked || !knows(asked)) return;
    dispatch({ type: 'openItem', id: asked });
    // Taken out of the address bar, so a refresh — or a shared link — does not
    // reopen a deadline the student has already dealt with.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('item');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // A browser that will not rewrite its own address bar still navigated,
      // which is the part that mattered.
    }
  });

  return null;
}
