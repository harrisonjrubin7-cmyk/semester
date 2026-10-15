/**
 * What the app may use on this device, and how to take it back.
 *
 * Four things a browser guards behind a prompt: the camera, the microphone,
 * the position, and the right to notify. The app uses each for exactly one
 * kind of job, only when the student starts that job, and works without it.
 * This file is the one place that says so, and the one place that reads what
 * the browser currently thinks.
 *
 * ## Revoking is the browser's, not ours
 *
 * A page cannot withdraw a camera, microphone or location grant it was given;
 * only the browser's site settings can. So for those three the revoke path is
 * the instruction for finding that setting, and the screen says so rather than
 * drawing a switch that would do nothing. Notifications are the exception: the
 * app owns the push subscription (`lib/push.ts`), so it can end it, and the
 * Alerts page already has the switch. That is a link here, not a second one.
 *
 * ## Asking is not this file's job
 *
 * Nothing here calls `getUserMedia`, `getCurrentPosition` or
 * `Notification.requestPermission`. A screen that asked for all four on arrival
 * is the screen that gets all four refused. Each feature asks when it is used;
 * this reads the answer.
 *
 * ## What "unknown" means
 *
 * Safari and Firefox do not report the camera or microphone through
 * `navigator.permissions` until they have been asked. That is `unknown`, and the
 * screen says "this browser reports it only once asked" instead of pretending
 * it is `ask`. Anything else that goes wrong reading is thrown, so the screen
 * can offer to try again and not show a state it made up.
 */

export type CapabilityId = 'camera' | 'microphone' | 'location' | 'notifications';

/** What the browser says, in the four answers a student can act on, plus the two it may not give. */
export type Grant = 'granted' | 'denied' | 'ask' | 'unknown' | 'unsupported';

export interface Capability {
  id: CapabilityId;
  label: string;
  /** What it is used for, in the student's terms. */
  purpose: string;
  /** What still works if the answer is no. */
  fallback: string;
  /** The `navigator.permissions` name, where there is one. */
  query: 'camera' | 'microphone' | 'geolocation' | 'notifications';
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'camera',
    label: 'Camera',
    purpose: 'Scanning a textbook barcode, and video in a study call. Used only while one of those is open.',
    fallback: 'Type the ISBN instead of scanning it. Join a call with the camera off.',
    query: 'camera',
  },
  {
    id: 'microphone',
    label: 'Microphone',
    purpose: 'Recording a lecture, dictating a note, and talking in a call. Used only while you are recording or in a call.',
    fallback: 'Type the note. Join a call to listen and use the chat.',
    query: 'microphone',
  },
  {
    id: 'location',
    label: 'Location',
    purpose: 'Telling which of your saved places you are at, such as the library or a lecture hall. Read once when you ask, never in the background.',
    fallback: 'Choose the place from your saved list by hand.',
    query: 'geolocation',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    purpose: 'Reminders that arrive while the app is closed. Off until you switch them on.',
    fallback: 'Reminders still show inside the app whenever you open it.',
    query: 'notifications',
  },
] as const;

/** The word, the glyph that survives forced colours, and the tone that reinforces them. */
export const GRANT_WORDS: Record<Grant, { word: string; glyph: string; tone: 'success' | 'neutral' | 'attention' | 'danger' }> = {
  granted: { word: 'Allowed', glyph: '✓', tone: 'success' },
  ask: { word: 'Not asked yet', glyph: '·', tone: 'neutral' },
  denied: { word: 'Blocked', glyph: '×', tone: 'danger' },
  unknown: { word: 'Not reported', glyph: '?', tone: 'attention' },
  unsupported: { word: 'Not available here', glyph: '–', tone: 'neutral' },
};

/** Whether this browser has the thing at all, before asking what it thinks of it. */
export function available(id: CapabilityId): boolean {
  if (typeof navigator === 'undefined') return false;
  switch (id) {
    case 'camera':
    case 'microphone':
      return typeof navigator.mediaDevices?.getUserMedia === 'function';
    case 'location':
      return typeof navigator.geolocation?.getCurrentPosition === 'function';
    case 'notifications':
      return typeof Notification !== 'undefined';
  }
}

const GRANTS = new Set<PermissionState>(['granted', 'denied', 'prompt']);

function fromState(state: PermissionState | NotificationPermission): Grant {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  return 'ask';
}

/** The answer a permission status holds right now. It is live: the browser updates it in place. */
export function grantOf(status: PermissionStatus): Grant {
  return GRANTS.has(status.state) ? fromState(status.state) : 'unknown';
}

export interface Reading {
  grant: Grant;
  /** Present when the browser can tell us about a change later. */
  status?: PermissionStatus;
}

/**
 * Read one capability's grant.
 *
 * Rejects only for a failure it does not understand. The two it does are not
 * failures: no support at all, and a browser that will not report this one.
 */
export async function readGrant(id: CapabilityId): Promise<Reading> {
  if (!available(id)) return { grant: 'unsupported' };
  const cap = CAPABILITIES.find((c) => c.id === id)!;
  if (!navigator.permissions?.query) {
    // Notifications have a synchronous answer when the Permissions API is absent.
    return id === 'notifications' ? { grant: fromState(Notification.permission) } : { grant: 'unknown' };
  }
  try {
    const status = await navigator.permissions.query({ name: cap.query as PermissionName });
    return { grant: grantOf(status), status };
  } catch (e) {
    // An unrecognised permission name is a TypeError in Safari and Firefox. It
    // means "this browser will not say", not "something broke".
    if (e instanceof TypeError) {
      return id === 'notifications' ? { grant: fromState(Notification.permission) } : { grant: 'unknown' };
    }
    throw e;
  }
}

/** Where to go to take a grant back. The browser holds it, so these are directions. */
export function revokeSteps(id: CapabilityId): string {
  const site = id === 'notifications' ? 'Notifications' : CAPABILITIES.find((c) => c.id === id)!.label;
  return `In your browser, open the site settings for this address (the icon at the left of the address bar), find ${site}, and choose Block or Ask. On a phone, it is under the browser's or the system's app permissions.`;
}

/** How to allow it again when it was blocked: the same place, the other choice. */
export function allowAgainSteps(id: CapabilityId): string {
  const site = id === 'notifications' ? 'Notifications' : CAPABILITIES.find((c) => c.id === id)!.label;
  return `A blocked ${site.toLowerCase()} cannot be asked for again from here. Open this address's site settings in your browser, set ${site} to Ask or Allow, then come back and it will update on its own.`;
}

/** How many of the four are currently allowed. */
export function allowedCount(grants: Partial<Record<CapabilityId, Grant>>): number {
  return CAPABILITIES.filter((c) => grants[c.id] === 'granted').length;
}
