import { useSyncExternalStore } from 'react';
import type { Turn } from '../lib/claude';
import type { Local } from '../lib/localask';
import type { Mode } from '../lib/mode';
import type { Lists, Proposal } from '../lib/tools';
import { load as loadThreads, save as saveThreads, titleFor, blank, type Thread } from '../lib/threads';
import { read as readSpend } from '../lib/spend';

/**
 * The conversation, in one place, for every surface at once.
 *
 * ## The bug this exists to fix
 *
 * `useConversation` used to hold all of this in `useState`, and every file
 * that called it said in its header that the sheet and the full chat were
 * "two views of one conversation". They were not. A hook's state belongs to
 * the component that called it, so the sheet had a conversation and the chat
 * had a different one, each seeded from the saved log at the moment it
 * mounted and never again.
 *
 * What that looked like: ask something on `/chat`, go to Grades, open the
 * sheet — and the sheet is empty. It had read the log when the app started,
 * which was before the question existed. Worse in the other direction: send
 * from the sheet, expand to the full page while it is still answering, and
 * the page shows the transcript as it was, with no answer arriving and no
 * indication one is on its way. The answer lands in the sheet's copy.
 *
 * Persisting to `chatlog` did not save it and could not: that is a write on
 * change, not a subscription, so a copy that has already mounted never hears
 * about it.
 *
 * ## Why a module and not a context
 *
 * A provider would work and would be the usual answer. This is not one
 * because the request outlives the surfaces: pressing Stop on the chat has to
 * abort a request the sheet started, and a `useRef` in a hook is per-caller
 * for exactly the same reason the state was. The controller has to live
 * somewhere that is neither component, and once it does, keeping the state it
 * belongs to in the same place is the smaller thing to explain.
 *
 * There is one conversation in this app by design — the assistant is mounted
 * once in the shell — so a second instance is not a thing to support. If that
 * ever changes, this becomes a context and the change is mechanical.
 *
 * Nothing here is sent anywhere. `lib/context.ts` still decides that, alone.
 */

export interface Live {
  turns: Turn[];
  /** Every conversation, newest last touched first. See `lib/threads.ts`. */
  threads: Thread[];
  /** Which one `turns` belongs to. */
  openId: string;
  /** The answer as it arrives, before it becomes a turn. */
  streaming: string;
  busy: boolean;
  mode: Mode | null;
  /** Which parts of the context were drawn on, for the "what it read" row. */
  used: string[];
  /** What the app could answer about itself, with nothing sent. */
  locally: Local | null;
  proposals: Proposal[];
  applied: { p: Proposal; before: Lists }[];
  /** The month's spend, re-read whenever a request reports usage. */
  spend: ReturnType<typeof readSpend>;
}

function empty(): Live {
  // Read once, at import, rather than once per mount — which is the
  // difference between one conversation and several.
  const kept = loadThreads();
  const open = kept.threads.find((t) => t.id === kept.openId) ?? kept.threads[0];
  return {
    turns: open.turns,
    threads: kept.threads,
    openId: open.id,
    streaming: '',
    busy: false,
    mode: null,
    used: [],
    locally: null,
    proposals: [],
    applied: [],
    spend: readSpend(),
  };
}

let live: Live = empty();
const watchers = new Set<() => void>();

/**
 * The request in flight, wherever it was started from.
 *
 * Module-level for the reason in the header: Stop is a button on both
 * surfaces and there is only ever one request to stop.
 */
export const flight: { abort: AbortController | null } = { abort: null };

/** The current `send`, for a retry to reach after a failure. */
export const sender: { run: (text: string) => Promise<void> } = { run: async () => {} };

/**
 * The two halves of React's store contract, exported rather than hidden.
 *
 * `useSyncExternalStore` wants exactly these, and a test wants exactly these
 * too — reading the conversation the way the app reads it, rather than
 * through a rendered component that would prove less and take more.
 */
export function watchLive(fn: () => void): () => void {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

/** The conversation as it stands. One object, shared by everything. */
export function liveNow(): Live {
  return live;
}

/** Read the conversation, and re-render when any part of it changes. */
export function useLive(): Live {
  return useSyncExternalStore(watchLive, liveNow, liveNow);
}

/**
 * Change one field, with `useState`'s signature.
 *
 * Deliberately the same shape as the setters it replaced, so the body of
 * `send` — which is the part with the care in it — did not have to be
 * rewritten to fix where the state lives.
 */
export function setLive<K extends keyof Live>(
  key: K,
  next: Live[K] | ((was: Live[K]) => Live[K]),
): void {
  const value = typeof next === 'function' ? (next as (was: Live[K]) => Live[K])(live[key]) : next;
  if (Object.is(value, live[key])) return;
  live = { ...live, [key]: value };
  for (const fn of watchers) fn();
}

/** Back to nothing. For tests, and for wiping every thread. */
export function resetLive(): void {
  flight.abort = null;
  live = empty();
  for (const fn of watchers) fn();
}

/*
 * ── Threads ───────────────────────────────────────────────────────────────
 *
 * The four things you can do to the set of conversations. All of them go
 * through here rather than through `setLive`, because each has to keep three
 * things in step that would otherwise drift: `turns` (what is on screen),
 * `threads` (the list), and the store. A component that set `openId` and
 * forgot `turns` would show one conversation's title over another's text.
 */

/**
 * Write the open thread's turns back into the list, and persist.
 *
 * Called on every change to the transcript. `turns` is the working copy —
 * it is what `send` appends to and what the surfaces render — and this is the
 * point where it becomes part of the record.
 */
export function keepTurns(turns: Turn[]): void {
  const at = Date.now();
  const threads = live.threads.map((t) =>
    t.id === live.openId ? { ...t, turns, at, title: titleFor(turns) } : t,
  );
  live = { ...live, turns, threads };
  saveThreads({ threads, openId: live.openId });
  for (const fn of watchers) fn();
}

/**
 * Start a fresh conversation, keeping the one you were in.
 *
 * This is what "new chat" used to do by deleting everything. The old thread
 * stays in the list, which is the entire point of the change: a revision plan
 * worked out on Sunday survives an unrelated question on Tuesday.
 *
 * An empty thread is reused rather than stacked. Pressing new twice should
 * not leave two blank rows, and `lib/threads.ts` drops unopened empties on
 * save anyway — doing it here as well means the list looks right immediately
 * rather than after a reload.
 */
export function newThread(): void {
  const spare = live.threads.find((t) => t.turns.length === 0);
  const thread = spare ?? blank();
  const threads = spare ? live.threads : [thread, ...live.threads];
  live = { ...live, ...cleared(), turns: [], threads, openId: thread.id };
  saveThreads({ threads, openId: thread.id });
  for (const fn of watchers) fn();
}

/** Switch to one already in the list. */
export function openThread(id: string): void {
  const thread = live.threads.find((t) => t.id === id);
  if (!thread || id === live.openId) return;
  live = { ...live, ...cleared(), turns: thread.turns, openId: id };
  saveThreads({ threads: live.threads, openId: id });
  for (const fn of watchers) fn();
}

/**
 * Delete one, and land somewhere sensible.
 *
 * Deleting the open thread has to leave a thread open — the surfaces render
 * `turns` unconditionally and there is no "no conversation" state to fall
 * into. Deleting the last one leaves a fresh empty one rather than nothing.
 */
export function dropThread(id: string): void {
  const rest = live.threads.filter((t) => t.id !== id);
  if (id !== live.openId) {
    live = { ...live, threads: rest };
    saveThreads({ threads: rest, openId: live.openId });
    for (const fn of watchers) fn();
    return;
  }
  const next = [...rest].sort((a, b) => b.at - a.at)[0] ?? blank();
  const threads = rest.length > 0 ? rest : [next];
  live = { ...live, ...cleared(), turns: next.turns, threads, openId: next.id };
  saveThreads({ threads, openId: next.id });
  for (const fn of watchers) fn();
}

/**
 * What does not travel between threads.
 *
 * A proposal is an offer about a specific answer, and an "undo" belongs to
 * the exchange that produced it. Carrying either into a different
 * conversation would put a button under an answer that never asked for it —
 * and, in the case of `applied`, a working Undo for a change made in a
 * thread the student is no longer looking at.
 *
 * `spend` is not here: it is the month's total across everything, not a
 * property of one conversation.
 */
function cleared(): Pick<Live, 'streaming' | 'busy' | 'mode' | 'used' | 'locally' | 'proposals' | 'applied'> {
  return {
    streaming: '',
    busy: false,
    mode: null,
    used: [],
    locally: null,
    proposals: [],
    applied: [],
  };
}
