/**
 * The five things the phone can do that the app never asked it for.
 *
 * Every one of these is a capability the browser already affords and the app
 * was not using: keeping the screen awake while you read, confirming a tap you
 * did not look at, putting a lesson on the lock screen, putting the due count
 * on the icon, and asking the browser not to delete your semester.
 *
 * ## All of it is optional, none of it is load-bearing
 *
 * Not one of these exists everywhere. Wake lock is absent on older Safari,
 * vibration on all of iOS, badging outside an installed app, and persistent
 * storage is a request the browser is free to refuse. So every function here
 * is guarded, every failure is silent, and nothing the app does depends on any
 * of them succeeding — they make a good app better and their absence costs a
 * convenience rather than a screen.
 *
 * That is also why they live together. Five separate half-files each with its
 * own `typeof window === 'undefined'` dance is five places to get the guard
 * subtly wrong; one file with one convention is auditable at a glance.
 */

/** Whether an API is there at all, without touching it. */
function has(key: string, on: object | undefined = globalThis.navigator): boolean {
  try {
    return Boolean(on) && key in (on as object);
  } catch {
    return false;
  }
}

// ── Storage ───────────────────────────────────────────────────────────────

/**
 * Ask the browser not to throw the semester away.
 *
 * Everything the app holds is in localStorage and IndexedDB, and both are
 * evictable: under storage pressure a browser may delete the lot without
 * asking. This marks the origin as persistent, which takes it out of that
 * category.
 *
 * It is a request, not a setting. An installed app is usually granted it
 * silently; a browser tab is granted it on engagement or not at all. Either
 * answer is fine — what matters is that the app asked, because not asking
 * guarantees the eviction is allowed.
 */
export async function askToPersist(): Promise<boolean> {
  if (!has('storage') || !has('persist', navigator.storage)) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export interface Room {
  /** Bytes used, or -1 where the browser will not say. */
  used: number;
  /** Bytes available in total, or -1. */
  quota: number;
  /** Whether the data is safe from eviction. */
  safe: boolean;
}

export async function storageRoom(): Promise<Room> {
  const unknown: Room = { used: -1, quota: -1, safe: false };
  if (!has('storage')) return unknown;
  try {
    const safe = has('persisted', navigator.storage) ? await navigator.storage.persisted() : false;
    if (!has('estimate', navigator.storage)) return { ...unknown, safe };
    const e = await navigator.storage.estimate();
    return { used: e.usage ?? -1, quota: e.quota ?? -1, safe };
  } catch {
    return unknown;
  }
}

/** Bytes as a person reads them. */
export function size(bytes: number): string {
  if (bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return mb < 100 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

/**
 * What the storage situation is, in a sentence.
 *
 * The app already says when the store is full — see `state/store.tsx`. This
 * is the half that was missing: how close it is before that happens, and
 * whether the browser is allowed to delete it in the meantime.
 */
export function roomLine(r: Room): string {
  if (r.used < 0 || r.quota <= 0) {
    return r.safe
      ? 'Your semester is marked as persistent, so the browser will not clear it to make room.'
      : 'This browser will not say how much room it has given the app.';
  }
  const pct = Math.round((r.used / r.quota) * 100);
  const where = `${size(r.used)} of ${size(r.quota)} used${pct >= 1 ? `, about ${pct}%` : ''}.`;
  return r.safe
    ? `${where} Marked as persistent, so the browser will not clear it to make room.`
    : `${where} Not marked as persistent: this browser may clear it to make room, without asking.`;
}

// ── Wake lock ─────────────────────────────────────────────────────────────

interface Lock {
  release: () => Promise<void>;
  addEventListener?: (type: string, fn: () => void) => void;
}

/**
 * Keep the screen on while something is being read.
 *
 * A study guide is a long read and a drill has pauses in it while you try to
 * remember. Both look like idling to a phone, so the screen locks mid-thought.
 *
 * Returns a release function every time, including when there is no wake lock
 * to take — a caller that has to check whether it got one is a caller that
 * will forget.
 */
export async function keepAwake(): Promise<() => void> {
  const nothing = () => {};
  if (!has('wakeLock')) return nothing;
  try {
    const lock = (await (
      navigator as unknown as { wakeLock: { request: (t: string) => Promise<Lock> } }
    ).wakeLock.request('screen')) as Lock;
    return () => {
      try {
        void lock.release();
      } catch {
        /* already gone */
      }
    };
  } catch {
    // Denied, or the document is not visible. Neither is an error.
    return nothing;
  }
}

// ── Haptics ───────────────────────────────────────────────────────────────

/** How long each kind of confirmation buzzes for, in milliseconds. */
const BUZZ = { light: 8, firm: 18 } as const;

/**
 * A tap you can feel.
 *
 * For the between-classes mode, which is built for a phone in motion and now
 * reads the card aloud — so the eyes are off the screen and nothing confirms
 * that a big button was actually hit. Firm for "again", light for "got it":
 * the one that means more work is the one that should feel heavier.
 *
 * Absent on all of iOS, so it is a bonus on top of a visible change and never
 * the confirmation itself.
 */
export function buzz(kind: keyof typeof BUZZ = 'light'): void {
  if (!has('vibrate')) return;
  try {
    navigator.vibrate(BUZZ[kind]);
  } catch {
    /* blocked by a user setting */
  }
}

// ── Media session ─────────────────────────────────────────────────────────

export interface NowPlaying {
  title: string;
  /** The course, shown where a media player shows the artist. */
  course: string;
  album?: string;
  artwork?: string;
}

/**
 * Put what is playing on the lock screen.
 *
 * The app has narrated lessons and podcast episodes per course, which are
 * exactly the thing you listen to walking across campus with the phone in a
 * pocket — and pausing one meant taking the phone out and finding the screen.
 * This wires the lock screen, the headphone button and the car stereo.
 */
export function nowPlaying(
  what: NowPlaying | null,
  handlers: Partial<Record<'play' | 'pause' | 'seekbackward' | 'seekforward', () => void>> = {},
): void {
  if (!has('mediaSession')) return;
  const ms = (navigator as unknown as { mediaSession: MediaSession }).mediaSession;
  try {
    if (!what) {
      ms.metadata = null;
      ms.playbackState = 'none';
      return;
    }
    ms.metadata = new MediaMetadata({
      title: what.title,
      artist: what.course,
      album: what.album ?? 'Semester',
      artwork: what.artwork
        ? [{ src: what.artwork, sizes: '512x512', type: 'image/png' }]
        : [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
    for (const [action, fn] of Object.entries(handlers)) {
      // A handler the browser does not know throws rather than no-opping, so
      // each one is set on its own.
      try {
        ms.setActionHandler(action as MediaSessionAction, fn as () => void);
      } catch {
        /* unsupported action */
      }
    }
  } catch {
    /* no session to set */
  }
}

/** Tell the lock screen whether it is playing, so the button shows the right icon. */
export function playbackIs(state: 'playing' | 'paused' | 'none'): void {
  if (!has('mediaSession')) return;
  try {
    (navigator as unknown as { mediaSession: MediaSession }).mediaSession.playbackState = state;
  } catch {
    /* nothing to set */
  }
}

// ── Badge ─────────────────────────────────────────────────────────────────

/**
 * The number on the installed icon.
 *
 * Things due today and not ticked — never a count of notifications. A badge
 * that counts something you cannot act on is one people learn to clear
 * without looking, and then it counts nothing.
 *
 * Zero clears it rather than showing a nought.
 */
let shownBadge = -1;

export function badge(count: number): void {
  if (!has('setAppBadge')) return;
  const n = Math.max(0, Math.floor(count));
  // The count is recomputed whenever the catalogue, the clock or a tick
  // changes, which is often and usually to the same number. Setting a badge
  // to what it already shows is a platform call for nothing.
  if (n === shownBadge) return;
  shownBadge = n;
  try {
    const nav = navigator as unknown as {
      setAppBadge: (n?: number) => Promise<void>;
      clearAppBadge: () => Promise<void>;
    };
    if (n === 0) void nav.clearAppBadge();
    else void nav.setAppBadge(n);
  } catch {
    /* not installed */
  }
}
