/**
 * The overlays every screen can open, without every screen owning them.
 *
 * The Source & details drawer and the Capture launcher are the same thing on
 * every screen, so they are mounted once — `components/unity/UnityLayer.tsx`,
 * beside `QuickAdd` in each of the three layouts — and opened from anywhere
 * through this module. A screen says "show the source of this" and hands over
 * what it knows; it does not render a drawer of its own, which is how a
 * drawer gets built nine slightly different ways.
 *
 * Not in the store. These are transient, per-window, and carry props with
 * functions in them (a report action, an open-official-source action), none
 * of which belongs in a reducer that is persisted and synced. A tiny external
 * store is the React-shaped answer: `useSyncExternalStore` reads it and
 * nothing is serialised.
 */

import { useSyncExternalStore } from 'react';
import type { StatusKey } from './status';
import type { Screen } from './types';

/** Everything the Source & details drawer can say about one thing. */
export interface SourceDetail {
  /** What this is about — "Midterm 2", "Statistics requirement". */
  title: string;
  /** The shared object type — course, action, file, person, source, and so on. */
  kind?: string;
  /** Course, term, project, or institution this object sits inside. */
  context?: string;
  /** Plain-language state in addition to the provenance chip. */
  status?: string;
  /** Where it came from, in the one vocabulary. */
  origin: StatusKey;
  /** The source by name — "Degree audit", "ECON 1020 syllabus". */
  sourceName?: string;
  /** When the source was last checked, as the words to show. */
  freshness?: string;
  /** Verbatim supporting text already verified by the caller. */
  excerpt?: string;
  /** Exact source location when recorded, such as a page or section. */
  location?: string;
  /** Recorded owner; omit rather than infer one. */
  owner?: string;
  /** Other places in the app that use this. */
  usedIn?: string[];
  /** Objects this one is visibly connected to across Semester. */
  relationships?: string[];
  /** Recent student-visible events for this object. */
  history?: { at: string; label: string }[];
  /** For AI-assisted or derived material: what it was made from. */
  sourcesUsed?: string[];
  /** What this cannot be relied on for. Shown whenever it is given. */
  limitations?: string;
  /** Who can see it. Defaults to "Only you" because that is the app's default. */
  visibility?: string;
  /** Open the source itself, when there is one to open. */
  openSource?: { label: string; run: () => void };
  /** Report something wrong with it. */
  report?: () => void;
  /** Safe object actions; no action is implied merely by opening details. */
  actions?: { label: string; run: () => void }[];
}

export type Overlay =
  | { kind: 'none' }
  | { kind: 'source'; detail: SourceDetail }
  | { kind: 'capture'; context?: string; as?: string; text?: string }
  | { kind: 'explain'; screen: Screen };

/** The minutes a study or focus session started from the shared layer runs for. */
export const SESSION_MINUTES = 25;

let current: Overlay = { kind: 'none' };
const listeners = new Set<() => void>();

function set(next: Overlay) {
  current = next;
  for (const l of listeners) l();
}

export function showSource(detail: SourceDetail): void {
  set({ kind: 'source', detail });
}

/** Open the capture launcher, attached to what the student is looking at. */
export function showCapture(context?: string, carry: { as?: string; text?: string } = {}): void {
  set({ kind: 'capture', context, ...carry });
}

/**
 * "About this screen" as a sheet — for the three screens that fill their box
 * (a chat, a mailbox), where opening the answers in place would push the
 * pinned composer off the bottom. See `components/unity/ScreenGuide.tsx`.
 */
export function showExplain(screen: Screen): void {
  set({ kind: 'explain', screen });
}

export function closeOverlay(): void {
  set({ kind: 'none' });
}

export function readOverlay(): Overlay {
  return current;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useOverlay(): Overlay {
  return useSyncExternalStore(subscribe, readOverlay, readOverlay);
}
