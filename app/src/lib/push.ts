/**
 * A reminder that arrives when the app is shut.
 *
 * `lib/notify.ts` works out what is worth saying and calls `new Notification`,
 * which only fires while the page is open. So the app could remind you of a
 * deadline exactly when you were already looking at the app — the one moment
 * you did not need reminding. This is the other half.
 *
 * ## The server does no arithmetic
 *
 * A push server that worked out what was due would need its own copy of the
 * date rules, the term rules, the registrar landmarks and the tick state, and
 * that copy would drift from `lib/notify.ts` within a term. The drift would
 * surface as a notification about a deadline that had moved — which is worse
 * than no notification, because it teaches you to ignore them.
 *
 * So the client decides and the server delivers. `planAhead` produces the
 * reminders the next week will generate, each with the moment it should fire,
 * and those are queued as rows: a time and two strings. The function that
 * sends them knows nothing about semesters.
 *
 * ## What leaves the device
 *
 * The queue rows are the notification text itself — "Problem Set 4 is due
 * tonight" — which is coursework, and it now sits on a server in a readable
 * form so that it can be delivered later. That is a real trade and it is why
 * this is off until switched on, why the queue holds a week rather than a
 * term, and why rows are deleted once sent.
 */

import { planAhead } from './notify';
import type { NotifKey } from '../data/misc';

/** A queued notification: when, and what it will say. */
export interface Queued {
  id: string;
  at: number;
  title: string;
  body: string;
}

/** How far ahead to queue. A week is enough to survive a phone left in a bag. */
const HORIZON_DAYS = 7;

/** Whether this browser can receive a push at all. */
export function canPush(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof PushManager !== 'undefined' &&
      typeof Notification !== 'undefined'
    );
  } catch {
    return false;
  }
}

/**
 * The VAPID public key, as the browser wants it.
 *
 * Base64url with no padding, turned into bytes. The browser rejects the string
 * form outright, and the error it gives says nothing useful about why.
 */
export function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  // Backed by a plain ArrayBuffer rather than the default: `subscribe` will
  // not take a view over a SharedArrayBuffer, and the type error it gives
  // says nothing about why.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** What a subscription looks like once it is ready to store. */
export interface Enrolment {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** A PushSubscription, flattened to the three things a sender needs. */
export function enrolmentOf(sub: PushSubscription): Enrolment | null {
  try {
    const json = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> };
    const endpoint = json.endpoint ?? sub.endpoint;
    const p256dh = json.keys?.p256dh ?? '';
    const auth = json.keys?.auth ?? '';
    if (!endpoint || !p256dh || !auth) return null;
    return { endpoint, p256dh, auth };
  } catch {
    return null;
  }
}

/**
 * Ask for permission and subscribe.
 *
 * Returns null on every kind of no — unsupported, refused, no key configured,
 * a worker that never took control. The caller shows the same thing in each
 * case, because from the student's side they are the same thing: reminders
 * will not arrive and nothing is broken.
 */
export async function enrol(vapidPublicKey: string): Promise<Enrolment | null> {
  if (!canPush() || !vapidPublicKey) return null;
  try {
    if ((await Notification.requestPermission()) !== 'granted') return null;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        // Required by every browser: a push that shows nothing is not allowed,
        // which is the right rule.
        userVisibleOnly: true,
        applicationServerKey: keyBytes(vapidPublicKey),
      }));
    return enrolmentOf(sub);
  } catch {
    return null;
  }
}

/** Stop. The subscription is dropped here; the caller deletes the stored rows. */
export async function leave(): Promise<string> {
  if (!canPush()) return '';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return '';
    const { endpoint } = sub;
    await sub.unsubscribe();
    return endpoint;
  } catch {
    return '';
  }
}

/** Whether this device is already subscribed, without asking for anything. */
export async function enrolled(): Promise<boolean> {
  if (!canPush()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) !== null;
  } catch {
    return false;
  }
}

/**
 * The week's reminders, ready to be stored for delivery.
 *
 * Anything already in the past is dropped rather than queued: a server that
 * sends a reminder about this morning at lunchtime is a server nobody trusts
 * twice.
 */
export function queueFor(
  now: Date,
  on: Record<NotifKey, boolean>,
  forDay: Parameters<typeof planAhead>[3],
): Queued[] {
  return planAhead(now, HORIZON_DAYS, on, forDay).filter((r) => r.at > now.getTime());
}

/**
 * What the switch says about itself.
 *
 * Names the trade rather than burying it, because the honest version of this
 * feature is one where the student knows their deadline titles are sitting on
 * a server waiting to be sent.
 */
export const PUSH_NOTE =
  'Reminders are worked out on this device and queued for the next week, so they can arrive when the app is closed. That means the text of each one — a deadline title and its course — is stored on the server until it is sent, and deleted afterwards. Switching this off deletes the queue.';
