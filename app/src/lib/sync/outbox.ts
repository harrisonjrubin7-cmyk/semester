import { newId, store } from '../idb';

/**
 * Sends that wait for the student's own go-ahead, and never go by themselves.
 *
 * ## What this changes, and what it does not
 *
 * D-055 refused sharing and sending offline, and refused to queue them: "a
 * queued share that fires hours later, after the student has changed their
 * mind, is exactly the surprise this avoids." That reasoning is right, and
 * this keeps it. What it adds is a way to *keep* the request without sending
 * it. Offline, the student can save a share or a course plan to send later. It
 * is held on the device, visible, dated, and cancellable; when the connection
 * is back it is **not** sent. It shows as ready, and the student sends it with
 * one tap, seeing what it is and where it goes. A held request expires after
 * `HOLD_MS`, and an expired one is never sent — it has to be made again.
 *
 * ## Only two kinds, and never an official or financial write
 *
 * `share` (a meeting agenda to an advisor) and `contribute` (a course plan to
 * the student's school). Both are the student's own choice about their own
 * material, and both can be undone from the screens they belong to. Every
 * other action that needs a connection stays refused: publishing to
 * students, deleting an account, opening an official site, and everything
 * that would write to an official or financial record. `classes.ts` holds the
 * list, and a test reads the code to keep it complete.
 *
 * ## Once, or flagged — never twice by accident
 *
 * The server calls do not take an idempotency key, so a request that is cut
 * off mid-flight may or may not have been applied. The entry is written as
 * `sending` **before** the call, so a crash or a closed tab mid-request is
 * found on the next open and read as `unknown` rather than as waiting. An
 * `unknown` share is not retried by itself and is not offered as one tap: the
 * student is told it may have gone and is shown where to check; sending it
 * again is a separate choice. A course plan replaces itself at the school, so
 * sending it twice is the same as sending it once, and it may be retried.
 *
 * ## Where it lives
 *
 * IndexedDB (`semester-outbox`), one entry per request, so it outlives a
 * closed tab. Where IndexedDB is unavailable the entries are kept in memory
 * and `durable` is false: the panel says they will not survive closing the
 * app. Entries belong to the account that made them and are never shown to,
 * or sent by, another. Erase device clears it (`lib/erase.ts`).
 */

export const KINDS = {
  share: { label: 'Share with your advisor', idempotent: false },
  contribute: { label: 'Send your course plan to your school', idempotent: true },
} as const;
export type Kind = keyof typeof KINDS;

/** How long a held request waits for the student. Three days. */
export const HOLD_MS = 3 * 24 * 60 * 60 * 1000;
/** How long a sent one stays on the list, so the student can see it went. */
export const SENT_MS = 24 * 60 * 60 * 1000;

export type State = 'waiting' | 'sending' | 'sent' | 'unknown' | 'failed';

export interface Entry {
  /** Also the idempotency key: one request, one id, however many taps. */
  id: string;
  kind: Kind;
  accountId: string;
  /** What the student sees: what it is and where it goes. Written when it was made. */
  summary: string;
  payload: unknown;
  createdAt: number;
  expiresAt: number;
  state: State;
  attempts: number;
  /** A sentence for the student, when the last try did not end cleanly. */
  said?: string;
  settledAt?: number;
}

export function newEntry(input: { kind: Kind; accountId: string; summary: string; payload: unknown; now: number }): Entry {
  return {
    id: newId('ob-'),
    kind: input.kind,
    accountId: input.accountId,
    summary: input.summary,
    payload: input.payload,
    createdAt: input.now,
    expiresAt: input.now + HOLD_MS,
    state: 'waiting',
    attempts: 0,
  };
}

/** What it is right now, which is `expired` for a held request that has waited too long. */
export type Shown = State | 'expired';
export function shown(e: Entry, now: number): Shown {
  const held = e.state === 'waiting' || e.state === 'failed' || e.state === 'unknown';
  return held && now >= e.expiresAt ? 'expired' : e.state;
}

export type Can = { ok: true } | { ok: false; why: string };

/** Whether a tap on Send should go, and if not, the sentence that says why. */
export function canSend(e: Entry, now: number, o: { online: boolean; accountId: string | null; confirmed?: boolean }): Can {
  const s = shown(e, now);
  if (s === 'sent') return { ok: false, why: 'This was already sent.' };
  if (s === 'sending') return { ok: false, why: 'This is being sent now.' };
  if (s === 'expired') return { ok: false, why: 'This waited too long and was not sent. Make it again to send it.' };
  if (o.accountId === null || e.accountId !== o.accountId) return { ok: false, why: 'This was made on a different account.' };
  if (!o.online) return { ok: false, why: 'You are offline. It will be ready to send when you are back.' };
  if (s === 'unknown' && !KINDS[e.kind].idempotent && !o.confirmed) {
    return { ok: false, why: 'It may already have been sent. Check first, then send it again only if it did not arrive.' };
  }
  return { ok: true };
}

// ── Storage ───────────────────────────────────────────────────────────────

export interface Port {
  /** False when entries live only in memory and will not survive closing the app. */
  readonly durable: boolean;
  all(): Promise<Entry[]>;
  put(e: Entry): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export const DB = 'semester-outbox';
export const STORE = 'entries';

export function memoryPort(): Port {
  const held = new Map<string, Entry>();
  return {
    durable: false,
    all: async () => [...held.values()].map((e) => structuredClone(e)),
    put: async (e) => void held.set(e.id, structuredClone(e)),
    remove: async (id) => void held.delete(id),
    clear: async () => held.clear(),
  };
}

export function idbPort(): Port {
  const s = store(DB, STORE);
  return {
    durable: true,
    all: () => s.tx('readonly', (o) => o.getAll() as IDBRequest<Entry[]>),
    put: (e) => s.tx('readwrite', (o) => o.put(e)).then(() => undefined),
    remove: (id) => s.tx('readwrite', (o) => o.delete(id)).then(() => undefined),
    clear: () => s.tx('readwrite', (o) => o.clear()).then(() => undefined),
  };
}

/** IndexedDB if it works, memory if it does not, and honest about which. */
export async function openPort(): Promise<Port> {
  try {
    const port = idbPort();
    await port.all(); // opens it: a browser that refuses says so here
    return port;
  } catch {
    return memoryPort();
  }
}

/** Empties the outbox. Called by Erase device, which must reach every database. */
export async function clearOutbox(): Promise<void> {
  try {
    await idbPort().clear();
  } catch {
    // Nothing was ever stored where it could not be opened.
  }
}

// ── The list ──────────────────────────────────────────────────────────────

/**
 * What is on disk, made safe to show: a request found `sending` was cut off
 * (the app closed, or the tab died) and may or may not have gone, so it reads
 * as `unknown`. Sent ones past `SENT_MS` are dropped, and so is anything that
 * belongs to another account. With no account resolved yet it shows nothing
 * and removes nothing.
 */
export async function load(port: Port, accountId: string | null, now: number): Promise<Entry[]> {
  // The account is null for a moment at every start, before the session
  // resolves. That is not signing out: show nothing and delete nothing, or a
  // request waiting since yesterday is lost to a restart.
  if (accountId === null) return [];
  const all = await port.all();
  const keep: Entry[] = [];
  for (const e of all) {
    if (e.accountId !== accountId) {
      // Somebody else's: not shown, not sent, and not kept.
      await port.remove(e.id);
      continue;
    }
    if (e.state === 'sent' && e.settledAt !== undefined && now - e.settledAt > SENT_MS) {
      await port.remove(e.id);
      continue;
    }
    if (e.state === 'sending') {
      const cut: Entry = { ...e, state: 'unknown', said: 'This was being sent when the app closed, so it may have gone.' };
      await port.put(cut);
      keep.push(cut);
      continue;
    }
    keep.push(e);
  }
  return keep.sort((a, b) => a.createdAt - b.createdAt);
}

// ── Sending ───────────────────────────────────────────────────────────────

export interface Senders {
  share(payload: never): Promise<unknown>;
  contribute(payload: never): Promise<unknown>;
}

/**
 * The server's own refusals, which mean it was looked at and not applied. Any
 * other failure — a dropped connection, a timeout, a bad gateway — leaves the
 * request possibly delivered, so it is `unknown`, never a quiet `failed`.
 */
const REFUSED = /no advisor|school on your profile|enter your advisor|too long|add an agenda|not signed in|permission|not allowed/i;

const inFlight = new Map<string, Promise<Entry>>();

/**
 * Send one held request. The entry is `sending` on disk before the call, is
 * settled after it, and a second tap while it is out gets the same answer
 * rather than a second request.
 */
export function send(port: Port, entry: Entry, senders: Senders, now: () => number = Date.now): Promise<Entry> {
  const running = inFlight.get(entry.id);
  if (running) return running;
  const run = (async () => {
    const going: Entry = { ...entry, state: 'sending', attempts: entry.attempts + 1, said: undefined };
    await port.put(going);
    try {
      await (senders[entry.kind] as (p: unknown) => Promise<unknown>)(entry.payload);
      const done: Entry = { ...going, state: 'sent', settledAt: now() };
      await port.put(done);
      return done;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const refused = REFUSED.test(message);
      const back: Entry = refused
        ? { ...going, state: 'failed', said: message }
        : {
            ...going,
            state: 'unknown',
            said: KINDS[entry.kind].idempotent
              ? 'The connection dropped, so this may not have arrived. It is safe to send again.'
              : 'The connection dropped, so this may or may not have arrived. Check before sending it again.',
          };
      await port.put(back);
      return back;
    } finally {
      inFlight.delete(entry.id);
    }
  })();
  inFlight.set(entry.id, run);
  return run;
}

export async function discard(port: Port, id: string): Promise<void> {
  await port.remove(id);
}
