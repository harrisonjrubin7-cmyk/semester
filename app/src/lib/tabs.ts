/**
 * Two tabs of the same app, told about each other.
 *
 * Open Semester in two tabs, tick something in one, and the other is silently
 * stale until it reloads — showing a deadline as outstanding that you finished
 * a minute ago in the next tab. The sync merge already handles two *devices*
 * properly; two tabs on one device got nothing, and they are the commoner
 * case, because a laptop tab left open for a week is how most people use this.
 *
 * ## The message is a nudge, not the data
 *
 * Nothing is sent but the fact that something changed. The receiving tab
 * re-reads localStorage, which is the single copy both tabs already agree is
 * authoritative — so there is no second serialisation format to keep correct,
 * no ordering problem between a broadcast and a write, and no way for the two
 * tabs to end up holding different objects. Sending the state itself would
 * introduce all three.
 *
 * ## It only ever moves forward
 *
 * A tab that receives a nudge takes what is on disk. It never pushes back,
 * never merges, and never argues: the last write to localStorage wins, which
 * is what already happened before this existed — the difference is that the
 * other tab now finds out immediately instead of on its next reload.
 */

const CHANNEL = 'semester';

/** What a tab says when it has written something. */
interface Nudge {
  /** Which tab sent it, so a tab ignores its own echo. */
  from: string;
  at: number;
}

/**
 * This tab's identity, for the life of the page.
 *
 * `BroadcastChannel` does not deliver a message to the tab that posted it, so
 * this is belt and braces — but a page that reloads while another holds the
 * channel open is cheap to get wrong, and a tab reacting to itself would loop.
 */
const ME = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function open(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}

/**
 * Listen for another tab's writes.
 *
 * Returns a function that stops listening. Absent `BroadcastChannel` — Safari
 * before 15.4, and some embedded browsers — this does nothing at all, and the
 * app behaves exactly as it did: correct, and stale until reloaded.
 */
export function onOtherTab(handle: () => void): () => void {
  const channel = open();
  if (!channel) return () => {};

  const listener = (e: MessageEvent<Nudge>) => {
    if (e.data?.from === ME) return;
    handle();
  };
  channel.addEventListener('message', listener);

  return () => {
    channel.removeEventListener('message', listener);
    try {
      channel.close();
    } catch {
      /* already closed */
    }
  };
}

/**
 * Tell the other tabs that this one wrote something.
 *
 * Opened and closed per call rather than held. A long-lived channel is one
 * more thing to tear down correctly on unmount, and this is called at most
 * once per dispatch — the cost of opening it is not worth the bookkeeping.
 */
export function tellOtherTabs(): void {
  const channel = open();
  if (!channel) return;
  try {
    channel.postMessage({ from: ME, at: Date.now() } satisfies Nudge);
  } catch {
    /* nothing listening */
  } finally {
    try {
      channel.close();
    } catch {
      /* already closed */
    }
  }
}
