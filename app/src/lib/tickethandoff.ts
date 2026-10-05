import type { Entry as Logged } from './diagnose';
import { screenShape } from './supporttickets';

/**
 * The context a support ticket carries, composed here and shown before it is
 * sent.
 *
 * A ticket that says "it broke" costs a round trip to ask where, and a ticket
 * that attaches everything costs the student their privacy. The brief's list
 * is the middle: the route, the action attempted, a safe correlation id, the
 * browser and device, the error state, whether work was saved, and the state
 * of any connected source. Never notes, files, grades, AI history or a
 * student record — `NEVER_ATTACHED` is the list, and `handoff()` cannot be
 * given any of them because it is not given the state that holds them.
 *
 * The database holds a closed list of context keys
 * (`private.support_context_ok`), so these lines travel in the body the
 * student writes, appended under a heading, after they have read them. That
 * keeps the review step honest: what is shown is what is sent.
 */

export const NEVER_ATTACHED = ['your notes', 'your files', 'your grades', 'your conversations with the assistant', 'anything from your student record'] as const;

export interface HandoffInput {
  /** `window.location.hash` or the like. */
  hash: string;
  /** What the student was trying to do, in their words or the last action's name; may be empty. */
  action: string;
  /** The last logged failure on this device, if any. */
  lastError: Logged | null;
  /** A `SEM-XXXX` reference from `lib/failure.ts`, if one was shown. */
  reference: string | null;
  /** The browser's user-agent string; reduced to a family, never sent whole. */
  userAgent: string;
  width: number;
  /** The sync words' standing: "On this device only", "Synced", "Changes waiting" … */
  saved: string;
  /** Connected sources and when each last synced, or empty. */
  sources: readonly { name: string; state: string }[];
  now: number;
}

export interface Handoff {
  route: string;
  action: string;
  reference: string;
  device: string;
  error: string;
  saved: string;
  sources: string;
}

/** A browser family and a device class, and nothing more from the user agent. */
export function device(userAgent: string, width: number): string {
  const ua = userAgent;
  const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const cls = width < 640 ? 'phone' : width < 1024 ? 'tablet' : 'desktop';
  return `${browser}, ${cls}`;
}

const MINUTE = 60_000;

/** "2 minutes ago", "an hour ago", "yesterday" — coarse on purpose. */
function ago(at: number, now: number): string {
  const m = Math.max(0, Math.round((now - at) / MINUTE));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function handoff(i: HandoffInput): Handoff {
  return {
    route: screenShape(i.hash) || 'unknown',
    action: i.action.trim() || 'not said',
    reference: i.reference ?? 'none shown',
    device: device(i.userAgent, i.width),
    error: i.lastError ? `${i.lastError.kind === 'error' ? 'Error' : 'Note'} on ${i.lastError.screen}, ${ago(i.lastError.at, i.now)}: ${i.lastError.message}` : 'none logged on this device',
    saved: i.saved || 'unknown',
    sources: i.sources.length === 0 ? 'none connected' : i.sources.map((s) => `${s.name}: ${s.state}`).join('; '),
  };
}

export const LABELS: Record<keyof Handoff, string> = {
  route: 'Where I was',
  action: 'What I was trying to do',
  reference: 'Error reference',
  device: 'Browser and device',
  error: 'Last error on this device',
  saved: 'Whether my work is saved',
  sources: 'Connected sources',
};

/** The lines, labelled, in the order the brief lists them. */
export function lines(h: Handoff): string[] {
  return (Object.keys(LABELS) as (keyof Handoff)[]).map((k) => `${LABELS[k]}: ${h[k]}`);
}

export const HEADING = '— App details, as shown to me before sending —';

/**
 * Where the student was, and what they were doing, when they asked for help.
 *
 * By the time Help renders, the hash is `#/help` and the failure's screen is
 * gone from the address bar. The screen that sends someone to Help notes
 * where they were and what they were trying to do first, and Help reads it
 * once. Module state, on purpose: it is one hop, it must not survive a
 * reload, and it is not the student's data.
 */
export interface Origin {
  hash: string;
  action: string;
  reference: string | null;
}

let origin: Origin | null = null;

export function noteOrigin(o: Origin): void {
  origin = o;
}

/** The noted origin, and it is forgotten on reading. */
export function takeOrigin(): Origin | null {
  const o = origin;
  origin = null;
  return o;
}

/** The student's words, then the details under a heading; or the words alone. */
export function withHandoff(body: string, h: Handoff | null): string {
  const text = body.trim();
  if (!h) return text;
  return `${text}\n\n${HEADING}\n${lines(h).join('\n')}`;
}
