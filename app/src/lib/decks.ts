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
import { DEFAULT_PALETTE, type Deck, type Palette, type Slide } from './pptx';
import type { CourseId } from './types';

/** A deck, plus what the app needs to file it and find it again. */
export interface StoredDeck extends Deck {
  id: string;
  courseId: CourseId | null;
  /**
   * The deadline it is for — a presentation is nearly always for one. See
   * `Doc.itemId` in `lib/document.ts` for why it is optional, and read it
   * through `lib/forwork.ts`.
   */
  itemId?: string | null;
  created: number;
  updated: number;
  /**
   * When it was last opened, which is not when it was last changed.
   *
   * What the shelf's default order sorts by, and the reason it can be called
   * "Last opened" honestly. Absent on everything made before this existed, and
   * read as "not since" rather than as the epoch — `lib/shelf.ts` falls back to
   * when it was last written to. The same field, for the same reason, as
   * `opened` on `Sheet` in `lib/sheet.ts`.
   */
  opened?: number;
  /**
   * Slides taken out of the running order without being thrown away.
   *
   * By index into `slides`, because a hidden slide is still a slide — it keeps
   * its place, it comes back where it was, and it is skipped when presenting
   * and when exporting. A separate list of "deleted" slides would be the same
   * thing with no way back.
   */
  hidden?: number[];
  /**
   * Which of {@link THEMES} the deck is drawn in.
   *
   * Stored as the name rather than as the three colours, so a theme that is
   * corrected — a dim that turned out to fail contrast on a projector —
   * corrects every deck that chose it rather than the ones made after the fix.
   * Absent is `ink`, which is what every deck made before this existed was.
   */
  theme?: ThemeId;
}

export type ThemeId = 'ink' | 'paper' | 'slate' | 'sand';

export interface Theme {
  id: ThemeId;
  /** What the button says. */
  label: string;
  /** The line under it: where this one is the right answer. */
  says: string;
  palette: Palette;
}

/**
 * The four a class presentation is actually given in.
 *
 * Not a gallery. A theme picker with thirty entries is thirty decisions
 * somebody makes badly in the ten minutes before a seminar, and the
 * difference between them that matters is one thing: is this going on a
 * projector in a dark room, or is it going on paper and into a reading pack.
 * So: two dark, two light, each with a reason written beside it.
 *
 * Every pairing here is checked against WCAG AA in `decktheme.test.ts` — a
 * theme whose second rank is unreadable at the back of a lecture hall is
 * worse than no choice at all, and "it looked fine on my laptop" is how that
 * happens.
 */
export const THEMES: Theme[] = [
  {
    id: 'ink',
    label: 'Ink',
    says: 'Dark, for a projector',
    palette: DEFAULT_PALETTE,
  },
  {
    id: 'slate',
    label: 'Slate',
    says: 'Dark and cooler',
    palette: { ink: '141A24', paper: 'E6EDF5', dim: '9FB0C4' },
  },
  {
    id: 'paper',
    label: 'Paper',
    says: 'Light, for printing and handouts',
    palette: { ink: 'F6F5F2', paper: '15171C', dim: '585D68' },
  },
  {
    id: 'sand',
    label: 'Sand',
    says: 'Light and warmer',
    palette: { ink: 'F2EDE3', paper: '22201B', dim: '5E5748' },
  },
];

/** The theme a deck is in, whatever it says — an unknown name reads as the default. */
export function themeOf(deck: Pick<StoredDeck, 'theme'>): Theme {
  return THEMES.find((t) => t.id === deck.theme) ?? THEMES[0];
}

export function blankDeck(
  title: string,
  courseId: CourseId | null = null,
  itemId: string | null = null,
): Omit<StoredDeck, 'id'> {
  const now = Date.now();
  return {
    title: title.trim() || 'Untitled deck',
    subtitle: '',
    slides: [{ title: title.trim() || 'Untitled deck', bullets: [], opening: true }],
    courseId,
    itemId,
    created: now,
    updated: now,
    hidden: [],
    theme: 'ink',
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
  /*
   * `note` is the line printed under a section's title, and it starts as an
   * empty string rather than undefined because that is what makes the editor
   * draw the field: `SlideEditor` shows the box when `note !== undefined`, so
   * leaving it off gave a section slide a line of text in the export that
   * nobody could type into or change.
   */
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
  const slides = running(deck).map((r) => r.slide);
  /*
   * A deck with every slide hidden exports as one blank slide, not as the
   * title slide `pptx.parts` invents for an empty deck.
   *
   * That fallback is right for a deck nobody has written yet and wrong here:
   * hiding every slide is a deliberate act, and answering it by putting the
   * deck's title back on a slide hands somebody a file with content they had
   * just taken out.
   */
  const palette = themeOf(deck).palette;
  if (slides.length === 0) {
    return {
      title: deck.title,
      subtitle: deck.subtitle,
      slides: [{ title: '', bullets: [] }],
      palette,
    };
  }
  return { title: deck.title, subtitle: deck.subtitle, slides, palette };
}

/**
 * Which layout a slide is already in.
 *
 * Worked out from what the slide carries rather than stored beside it, and
 * that is deliberate: a stored layout is a second copy of a fact the slide
 * already states, and the two go out of step the first time somebody empties
 * a table. The order matters — a slide can hold an equation *and* a table,
 * and the equation is the one that names it.
 */
export function layoutOf(slide: Slide): Layout {
  if (slide.equation !== undefined) return 'equation';
  if (slide.table) return 'table';
  if (slide.opening) return slide.note !== undefined ? 'section' : 'title';
  return slide.bullets.length ? 'bullets' : 'blank';
}

/**
 * The same slide in another layout.
 *
 * The title always survives, because the title is what the slide is about and
 * losing it to a change of shape is the one thing nobody would accept. So do
 * the speaker notes, which belong to the person rather than to the slide.
 *
 * Everything else is the layout's own: the fields the new layout does not have
 * are dropped, and the ones it has are brought in empty. That is a real loss
 * where somebody moves a filled table to a bullet slide, and the honest one —
 * carrying an invisible table around inside a bullet slide until it reappears
 * later is the version that surprises people. `Edit.tsx` says so before the
 * change where there is anything to lose.
 */
export function relayout(slide: Slide, layout: Layout): Slide {
  const blank = blankSlide(layout);
  return {
    ...blank,
    title: slide.title,
    ...(slide.notes !== undefined ? { notes: slide.notes } : {}),
    // Points come across into any layout with a body, which is the one carry
    // that never surprises anybody — they are what the slide says either way.
    // `blank` and the two opening layouts have no body, and clear them.
    bullets: KEEPS_POINTS.includes(layout) ? slide.bullets : [],
  };
}

/** The layouts with a body to put points in. */
const KEEPS_POINTS: Layout[] = ['bullets', 'table', 'equation'];

/** Whether changing the layout would throw away something somebody typed. */
export function losesSomething(slide: Slide, layout: Layout): string[] {
  const to = blankSlide(layout);
  const gone: string[] = [];
  if (slide.table?.some((row) => row.some((cell) => cell.trim() !== '')) && !to.table) {
    gone.push('the table');
  }
  if (slide.equation?.trim() && to.equation === undefined) gone.push('the equation');
  if (slide.note?.trim() && to.note === undefined) gone.push('the line under the title');
  if (slide.bullets.some((b) => b.trim() !== '') && !KEEPS_POINTS.includes(layout)) {
    gone.push('the points');
  }
  return gone;
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
