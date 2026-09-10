/**
 * A deck you can come back to.
 *
 * Until now a deck was built, exported and gone: `screens/Deck.tsx` held it in
 * component state, wrote a .pptx, and forgot it the moment somebody navigated
 * away. That is fine for the export and wrong for everything else — a
 * presentation is a thing you make on Sunday, fix on Tuesday and give on
 * Wednesday, and the app could only do the first of those.
 *
 * So a deck is stored like a document or a sheet: in the account, as a list,
 * merged as a union, exported with everything else. The slides are text and a
 * deck is a page of it, so it belongs on the small side of the line
 * `lib/files.ts` draws — no images live in one, which is what would have put it
 * in IndexedDB instead.
 */

import { newId } from './idb';
import type { Deck, Slide } from './pptx';
import type { CourseId } from './types';

/** A deck, plus what the app needs to file it and find it again. */
export interface StoredDeck extends Deck {
  id: string;
  courseId: CourseId | null;
  created: number;
  updated: number;
  /**
   * Slides taken out of the running order without being thrown away.
   *
   * By index into `slides`, because a hidden slide is still a slide — it keeps
   * its place, it comes back where it was, and it is skipped when presenting
   * and when exporting. A separate list of "deleted" slides would be the same
   * thing with no way back.
   */
  hidden?: number[];
}

export function blankDeck(title: string, courseId: CourseId | null = null): Omit<StoredDeck, 'id'> {
  const now = Date.now();
  return {
    title: title.trim() || 'Untitled deck',
    subtitle: '',
    slides: [{ title: title.trim() || 'Untitled deck', bullets: [], opening: true }],
    courseId,
    created: now,
    updated: now,
    hidden: [],
  };
}

/** A blank slide of a given shape. The layouts a class presentation actually uses. */
export type Layout = 'title' | 'bullets' | 'table' | 'equation' | 'section' | 'blank';

export const LAYOUTS: { id: Layout; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'section', label: 'Section' },
  { id: 'bullets', label: 'Title and points' },
  { id: 'table', label: 'Table' },
  { id: 'equation', label: 'Equation' },
  { id: 'blank', label: 'Blank' },
];

export function blankSlide(layout: Layout): Slide {
  if (layout === 'title') return { title: '', bullets: [], opening: true };
  if (layout === 'section') return { title: '', bullets: [], opening: true, note: '' };
  if (layout === 'table') {
    return { title: '', bullets: [], table: [['', ''], ['', '']] };
  }
  if (layout === 'equation') return { title: '', bullets: [], equation: '' };
  if (layout === 'blank') return { title: '', bullets: [] };
  return { title: '', bullets: [''] };
}

/** Whether a slide is in the running order. */
export function shown(deck: StoredDeck, at: number): boolean {
  return !(deck.hidden ?? []).includes(at);
}

/** The slides that will actually be presented and exported, in order. */
export function running(deck: StoredDeck): { slide: Slide; at: number }[] {
  return deck.slides
    .map((slide, at) => ({ slide, at }))
    .filter(({ at }) => shown(deck, at));
}

/**
 * The deck as it goes into the file: hidden slides left out.
 *
 * Exporting what is on the rail rather than what is in the running order would
 * mean hiding a slide did nothing to the .pptx, which is the one place it
 * matters most — the file is what gets handed in.
 */
export function forExport(deck: StoredDeck): Deck {
  return { title: deck.title, subtitle: deck.subtitle, slides: running(deck).map((r) => r.slide) };
}

/**
 * Move a slide, and carry the hidden marks with it.
 *
 * The marks are indices, so a reorder that moved the slides and left the
 * indices alone would hide whichever slide happened to land in that position —
 * a slide vanishing from a deck for no reason anybody could see. This maps
 * every mark through the same move.
 */
export function reorder(deck: StoredDeck, from: number, to: number): StoredDeck {
  if (from === to || from < 0 || to < 0 || from >= deck.slides.length || to >= deck.slides.length) {
    return deck;
  }
  const slides = [...deck.slides];
  const [moved] = slides.splice(from, 1);
  slides.splice(to, 0, moved);

  const after = (at: number): number => {
    if (at === from) return to;
    if (from < to) return at > from && at <= to ? at - 1 : at;
    return at >= to && at < from ? at + 1 : at;
  };
  return { ...deck, slides, hidden: (deck.hidden ?? []).map(after).sort((a, b) => a - b) };
}

/** Duplicate a slide, immediately after itself. Hidden marks shift the same way. */
export function duplicate(deck: StoredDeck, at: number): StoredDeck {
  if (at < 0 || at >= deck.slides.length) return deck;
  const slides = [...deck.slides];
  slides.splice(at + 1, 0, { ...deck.slides[at] });
  const hidden = (deck.hidden ?? []).map((h) => (h > at ? h + 1 : h));
  return { ...deck, slides, hidden };
}

/** Remove a slide. A deck never goes to nothing — the last one leaves a blank. */
export function remove(deck: StoredDeck, at: number): StoredDeck {
  if (at < 0 || at >= deck.slides.length) return deck;
  const slides = deck.slides.filter((_, i) => i !== at);
  const hidden = (deck.hidden ?? [])
    .filter((h) => h !== at)
    .map((h) => (h > at ? h - 1 : h));
  if (slides.length === 0) return { ...deck, slides: [blankSlide('title')], hidden: [] };
  return { ...deck, slides, hidden };
}

export function toggleHidden(deck: StoredDeck, at: number): StoredDeck {
  const hidden = deck.hidden ?? [];
  return {
    ...deck,
    hidden: hidden.includes(at) ? hidden.filter((h) => h !== at) : [...hidden, at].sort((a, b) => a - b),
  };
}

/** Replace one slide. */
export function setSlide(deck: StoredDeck, at: number, slide: Slide): StoredDeck {
  return { ...deck, slides: deck.slides.map((s, i) => (i === at ? slide : s)) };
}

/**
 * How long a deck is likely to take, in minutes.
 *
 * A minute a slide, plus the speaker notes read at a speaking pace — which is
 * slower than a reading pace, so 130 words a minute rather than 220. An
 * estimate, labelled as one wherever it is shown: what it is for is "this is a
 * twenty-minute talk and you have twelve", not a promise about a Tuesday.
 */
export const WORDS_A_MINUTE_SPOKEN = 130;

export function minutes(deck: StoredDeck): number {
  const rows = running(deck);
  const spoken = rows.reduce(
    (n, { slide }) => n + (slide.notes ?? '').split(/\s+/).filter(Boolean).length,
    0,
  );
  return Math.max(1, Math.round(rows.length + spoken / WORDS_A_MINUTE_SPOKEN));
}

/** A deck built elsewhere — from a unit, a table, a brief — as one to keep. */
export function keepable(
  deck: Deck,
  courseId: CourseId | null = null,
): Omit<StoredDeck, 'id' | 'created' | 'updated'> {
  return { ...deck, courseId, hidden: [] };
}

/** A file name for the deck, matching what `pptx.ts` would call it. */
export function deckId(): string {
  return newId();
}
