import { describe, expect, it } from 'vitest';
import {
  blankDeck,
  blankSlide,
  duplicate,
  forExport,
  minutes,
  remove,
  reorder,
  running,
  setSlide,
  shown,
  toggleHidden,
  type StoredDeck,
} from './decks';

const deck = (n: number, hidden: number[] = []): StoredDeck => ({
  id: 'd',
  title: 'A talk',
  subtitle: '',
  courseId: null,
  created: 0,
  updated: 0,
  hidden,
  slides: Array.from({ length: n }, (_, i) => ({ title: `S${i}`, bullets: [] })),
});

const titles = (d: StoredDeck) => d.slides.map((s) => s.title);

describe('hiding a slide', () => {
  it('takes it out of the running order without throwing it away', () => {
    const d = toggleHidden(deck(3), 1);
    expect(titles(d)).toEqual(['S0', 'S1', 'S2']);
    expect(running(d).map((r) => r.slide.title)).toEqual(['S0', 'S2']);
    expect(shown(d, 1)).toBe(false);
  });

  it('leaves it out of the file, which is the place it matters most', () => {
    expect(forExport(toggleHidden(deck(3), 1)).slides.map((s) => s.title)).toEqual(['S0', 'S2']);
  });

  it('comes back where it was', () => {
    const d = toggleHidden(toggleHidden(deck(3), 1), 1);
    expect(running(d).map((r) => r.slide.title)).toEqual(['S0', 'S1', 'S2']);
  });
});

describe('reordering', () => {
  it('moves a slide forwards and backwards', () => {
    expect(titles(reorder(deck(4), 0, 2))).toEqual(['S1', 'S2', 'S0', 'S3']);
    expect(titles(reorder(deck(4), 3, 1))).toEqual(['S0', 'S3', 'S1', 'S2']);
  });

  /*
   * The bug this guards. Hidden slides are indices, so a reorder that moved
   * the slides and left the indices alone would hide whichever slide landed
   * in that position — a slide vanishing for no reason anybody could see.
   */
  it('carries the hidden marks with the slides', () => {
    const d = reorder(deck(4, [1]), 1, 3);
    expect(titles(d)).toEqual(['S0', 'S2', 'S3', 'S1']);
    expect(running(d).map((r) => r.slide.title)).toEqual(['S0', 'S2', 'S3']);
  });

  it('keeps the marks right when the move passes over them', () => {
    const d = reorder(deck(4, [2]), 0, 3);
    expect(titles(d)).toEqual(['S1', 'S2', 'S3', 'S0']);
    // S2 was hidden and is still the hidden one.
    expect(running(d).map((r) => r.slide.title)).toEqual(['S1', 'S3', 'S0']);
  });

  it('does nothing for a move that is not one', () => {
    const d = deck(3);
    expect(reorder(d, 1, 1)).toBe(d);
    expect(reorder(d, -1, 0)).toBe(d);
    expect(reorder(d, 0, 9)).toBe(d);
  });
});

describe('duplicating', () => {
  it('puts the copy straight after the original', () => {
    expect(titles(duplicate(deck(3), 1))).toEqual(['S0', 'S1', 'S1', 'S2']);
  });

  it('does not make the copy a shared object', () => {
    const d = setSlide(duplicate(deck(2), 0), 1, { title: 'changed', bullets: [] });
    expect(titles(d)).toEqual(['S0', 'changed', 'S1']);
  });

  it('shifts the hidden marks after it', () => {
    const d = duplicate(deck(3, [2]), 0);
    expect(running(d).map((r) => r.slide.title)).toEqual(['S0', 'S0', 'S1']);
  });
});

describe('removing', () => {
  it('takes the slide out and shifts the marks down', () => {
    const d = remove(deck(4, [3]), 1);
    expect(titles(d)).toEqual(['S0', 'S2', 'S3']);
    expect(running(d).map((r) => r.slide.title)).toEqual(['S0', 'S2']);
  });

  it('drops the mark on the slide that went', () => {
    expect(remove(deck(3, [1]), 1).hidden).toEqual([]);
  });

  it('never leaves a deck with nothing in it', () => {
    const d = remove(deck(1), 0);
    expect(d.slides).toHaveLength(1);
    expect(d.hidden).toEqual([]);
  });
});

describe('a new deck', () => {
  it('opens on a title slide named after itself', () => {
    const d = blankDeck('Sanctions');
    expect(d.title).toBe('Sanctions');
    expect(d.slides[0]).toMatchObject({ title: 'Sanctions', opening: true });
  });

  it('falls back rather than being called nothing', () => {
    expect(blankDeck('   ').title).toBe('Untitled deck');
  });

  it('gives each layout the shape it promises', () => {
    expect(blankSlide('title').opening).toBe(true);
    expect(blankSlide('bullets').bullets).toEqual(['']);
    expect(blankSlide('table').table).toEqual([['', ''], ['', '']]);
    expect(blankSlide('equation').equation).toBe('');
    expect(blankSlide('blank')).toEqual({ title: '', bullets: [] });
  });
});

describe('how long it will take', () => {
  it('is about a minute a slide', () => {
    expect(minutes(deck(8))).toBe(8);
  });

  it('counts the speaker notes at a speaking pace', () => {
    const d = deck(2);
    d.slides[0].notes = Array.from({ length: 260 }, () => 'word').join(' ');
    // Two slides plus 260 words at 130 a minute.
    expect(minutes(d)).toBe(4);
  });

  it('ignores the slides that are hidden', () => {
    expect(minutes(deck(8, [0, 1, 2]))).toBe(5);
  });

  it('never says less than a minute', () => {
    expect(minutes(deck(1, [0]))).toBe(1);
  });
});

describe('exporting a deck with everything hidden', () => {
  it('does not put the title back on a slide', () => {
    // `pptx.parts` invents a title slide for an empty deck, which is right for
    // a deck nobody has written and wrong here: hiding every slide is
    // deliberate, and answering it with the deck's title hands somebody a file
    // holding content they had just taken out.
    const all = deck(2, [0, 1]);
    const out = forExport(all);
    expect(out.slides).toHaveLength(1);
    expect(out.slides[0].title).toBe('');
    expect(out.slides[0].bullets).toEqual([]);
  });

  it('still exports the visible ones normally', () => {
    expect(forExport(deck(3, [1])).slides.map((s) => s.title)).toEqual(['S0', 'S2']);
  });
});

describe('the table layout', () => {
  it('starts as a grid the editor can fill in', () => {
    const slide = blankSlide('table');
    expect(slide.table).toEqual([['', ''], ['', '']]);
  });

  it('carries what was typed into it through to the export', () => {
    const d = setSlide(deck(1), 0, {
      title: 'Results',
      bullets: [],
      table: [['Year', 'Rate'], ['2026', '3.1']],
    });
    expect(forExport(d).slides[0].table).toEqual([['Year', 'Rate'], ['2026', '3.1']]);
  });
});
