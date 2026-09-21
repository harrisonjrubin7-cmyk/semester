/**
 * Why a reminder cannot reach this phone, when the answer is fixable.
 *
 * `lib/push.ts` asks one question — can this browser receive a push — and
 * `canPush` answers it correctly. The switch that reads it then does the one
 * thing that cannot be right: on `false` it renders nothing at all.
 *
 * On a laptop that is fine. There is one browser that cannot do push and does
 * not intend to, and a settings screen quietly one row shorter is the honest
 * outcome.
 *
 * On an iPhone it is the whole feature falling silently over. Safari has
 * delivered web push since iOS 16.4, and it delivers it to exactly one kind
 * of page: one the student has added to their home screen themselves. A page
 * open in a Safari tab has no `PushManager` at all, so `canPush` is false, so
 * the switch is not drawn, so the student is never told that the thing they
 * want is one gesture away. And Safari will not offer that gesture: there is
 * no install prompt on iOS — no `beforeinstallprompt`, no banner, nothing.
 * Share → Add to Home Screen is the only route and the page has to say so or
 * nobody will ever find it.
 *
 * That matters here more than it would in most apps. The pitch is a planner
 * that actually reminds you; D2L's Pulse — the companion app for Brightspace,
 * which is the LMS this app's own university runs — is reviewed almost
 * entirely on its notifications not arriving. An app whose reminders silently
 * cannot reach the device they were written for is that app.
 *
 * ## Read from the browser, decided by a pure function
 *
 * The reading and the deciding are separate on purpose. {@link reachFrom}
 * takes three booleans and is the part with the rule in it; {@link reach}
 * gathers those three from whatever browser this is. A test can then state
 * every combination, including the iPhone nobody has in the room, and the
 * gathering is the only part that has to be trusted.
 *
 * ## It never says "install the app"
 *
 * There is no app. Saying so would be the second-most common lie in this
 * category after a notification that does not arrive: what Add to Home Screen
 * produces is this same page with its own icon and its own window, which is
 * what {@link INSTALL_FIRST} describes rather than names.
 */

/** Why push is or is not available here. */
export type Reach =
  /** Push works. Draw the switch. */
  | 'ready'
  /** Push would work, once this page is on the home screen. Say how. */
  | 'install-first'
  /** This browser will not do push whatever anybody adds to anything. */
  | 'never';

/**
 * The rule, over the three facts it needs.
 *
 * `pushable` is `canPush()` — whether the API is here at all. The other two
 * exist only to tell apart the two ways it can be absent, and the order is
 * load-bearing: an iPhone that *already has* push is a page that is already
 * installed, and telling somebody to install a page they are running from
 * their home screen is the kind of advice that makes a person stop reading
 * the app's advice.
 */
export function reachFrom(pushable: boolean, ios: boolean, installed: boolean): Reach {
  if (pushable) return 'ready';
  if (ios && !installed) return 'install-first';
  return 'never';
}

/**
 * Whether this is an iPhone or an iPad.
 *
 * The user agent is the wrong tool for almost everything and the only tool
 * for this: there is no feature to detect, because the missing feature *is*
 * the thing being explained.
 *
 * iPadOS is the part that catches people out. Since 13 it reports itself as a
 * Macintosh, deliberately, and the only thing separating it from a real Mac
 * in the browser is that it has touch points — a Mac reports 0 even with a
 * trackpad, and a touchscreen Mac does not exist. So a Mac with a stylus
 * would be read as an iPad here, and a Mac with a stylus does not exist
 * either.
 */
export function iosFrom(ua: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

/**
 * Whether this page is running as its own app rather than in a browser tab.
 *
 * Two readings because the platforms answer differently and each is authoritative
 * on its own: the media query is the standard and is what Android and desktop
 * answer; `navigator.standalone` is Safari's, predates the standard, and is
 * the one an older iOS answers. Either being true is enough.
 */
export function installedFrom(
  standalone: boolean | undefined,
  displayMode: boolean,
): boolean {
  return displayMode || standalone === true;
}

/** The same three facts, read off whatever browser this actually is. */
export function reach(pushable: boolean): Reach {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return pushable ? 'ready' : 'never';
  }
  let displayMode = false;
  try {
    displayMode = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  } catch {
    /* no matchMedia; `navigator.standalone` below is the other half */
  }
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return reachFrom(
    pushable,
    iosFrom(navigator.userAgent ?? '', navigator.maxTouchPoints ?? 0),
    installedFrom(standalone, displayMode),
  );
}

/**
 * What to do about it, in the words the gesture actually uses.
 *
 * "Add to Home Screen" is capitalised the way Safari capitalises it, and the
 * Share button is named by what it looks like as well as what it is called,
 * because on an iPhone it is an icon with no label on it.
 */
export const INSTALL_FIRST =
  'On an iPhone or iPad, reminders can only reach you once this is on your home screen — ' +
  'Safari will not deliver them to a page in a tab, and it never offers to set that up on its ' +
  'own. In Safari, press Share — the square with the arrow out of the top — then Add to Home ' +
  'Screen, and open it from there. It is this same page with its own icon; nothing is ' +
  'downloaded and no account is involved.';

/** What to say where push is simply not on offer. */
export const NO_PUSH_HERE =
  'This browser will not deliver a reminder while the app is shut. Reminders still appear ' +
  'while it is open in a tab.';
