import { describe, expect, it } from 'vitest';
import { AA_LARGE, AA_TEXT, contrast } from './contrast';
import {
  LAYOUTS,
  THEMES,
  blankDeck,
  blankSlide,
  forExport,
  layoutOf,
  losesSomething,
  relayout,
  themeOf,
  type Layout,
  type StoredDeck,
} from './decks';
import { parts } from './pptx';

const deck = (over: Partial<StoredDeck> = {}): StoredDeck => ({
  ...blankDeck('Talk'),
  id: 'd1',
  ...over,
});

/**
 * The themes, held to the same threshold the app holds its own palettes to.
 *
 * A deck is read from the back of a lecture hall or off a photocopy, which are
 * the two worst viewing conditions anything in this app has. "It looked fine
 * on my laptop" is how a theme with an unreadable second rank ships, so the
 * numbers are checked rather than eyeballed.
 */
describe('the deck themes', () => {
  it('put readable type on every ground they offer', () => {
    for (const theme of THEMES) {
      const ground = `#${theme.palette.ink}`;
      // The title and the points are large type on a slide, but they are the
      // whole of what the room reads — so the full text threshold, not the
      // large-text one.
      expect(contrast(`#${theme.palette.paper}`, ground), `${theme.label}: the type`).toBeGreaterThan(
        AA_TEXT,
      );
      // The second rank — a line under a title, a table's body — is held to
      // the large-text threshold, which is what it is: 13pt and up on a wall.
      expect(contrast(`#${theme.palette.dim}`, ground), `${theme.label}: the second rank`).toBeGreaterThan(
        AA_LARGE,
      );
    }
  });

  it('name each other apart, and each has a reason written beside it', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    for (const theme of THEMES) expect(theme.says.length).toBeGreaterThan(3);
  });

  it('read an unknown or missing name as the default rather than throwing', () => {
    // A deck made before themes existed, and a deck arriving by sync from a
    // build that has a theme this one has never heard of.
    expect(themeOf({ theme: undefined }).id).toBe('ink');
    expect(themeOf({ theme: 'chartreuse' as never }).id).toBe('ink');
  });

  it('go into the exported file, so it opens in the colours it was made in', () => {
    const light = parts(forExport(deck({ theme: 'paper' })));
    const slide = light['ppt/slides/slide1.xml'];
    const chosen = THEMES.find((t) => t.id === 'paper')!.palette;
    expect(slide).toContain(chosen.ink);
    expect(light['ppt/theme/theme1.xml']).toContain(chosen.paper);
    expect(light['ppt/slideMasters/slideMaster1.xml']).toContain(chosen.ink);
  });

  it('leave a deck that chose nothing looking exactly as it did before', () => {
    const before = parts({ title: 'T', subtitle: '', slides: [{ title: 'One', bullets: ['a'] }] });
    const after = parts(forExport(deck({ slides: [{ title: 'One', bullets: ['a'] }] })));
    expect(after['ppt/slides/slide1.xml']).toBe(before['ppt/slides/slide1.xml']);
  });
});

/**
 * Changing a slide's shape.
 *
 * The two things that must be true: the title and the notes always survive,
 * and anything that will not survive is named before it goes.
 */
describe('a slide’s layout', () => {
  it('is read off the slide rather than stored beside it', () => {
    for (const layout of LAYOUTS) {
      expect(layoutOf(blankSlide(layout.id as Layout)), layout.id).toBe(layout.id);
    }
  });

  it('calls a slide with points on it a points slide, whatever it started as', () => {
    // The corollary of reading it off the slide, and the honest answer: a
    // blank slide somebody has typed three points onto is a points slide.
    expect(layoutOf({ title: 'x', bullets: ['one'] })).toBe('bullets');
  });

  it('keeps the title and the speaker notes through every change', () => {
    const was = { title: 'Method', bullets: ['one', 'two'], notes: 'Slow down here' };
    for (const layout of LAYOUTS) {
      const next = relayout(was, layout.id as Layout);
      expect(next.title, layout.id).toBe('Method');
      expect(next.notes, layout.id).toBe('Slow down here');
    }
  });

  it('carries the points into any layout with a body to put them in', () => {
    const was = { title: 'x', bullets: ['one'] };
    expect(relayout(was, 'table').bullets).toEqual(['one']);
    expect(relayout(was, 'equation').bullets).toEqual(['one']);
    expect(relayout(was, 'bullets').bullets).toEqual(['one']);
    // A title slide and a blank one have no body, and say so by being empty
    // rather than by carrying an invisible copy that reappears later.
    expect(relayout(was, 'title').bullets).toEqual([]);
    expect(relayout(was, 'blank').bullets).toEqual([]);
  });

  it('brings the new layout’s own fields in empty', () => {
    const next = relayout({ title: 'x', bullets: [] }, 'table');
    expect(next.table).toEqual([['', ''], ['', '']]);
    expect(relayout({ title: 'x', bullets: [] }, 'equation').equation).toBe('');
    expect(relayout({ title: 'x', bullets: [] }, 'section').note).toBe('');
  });

  it('says what a change would throw away, and says nothing when it would not', () => {
    const full = {
      title: 'x',
      bullets: ['one'],
      table: [['a', 'b'], ['c', 'd']],
    };
    expect(losesSomething(full, 'title')).toEqual(['the table', 'the points']);
    expect(losesSomething(full, 'table')).toEqual([]);
    // An empty table is not something anybody typed, so moving away from it
    // must not raise a question.
    expect(losesSomething({ title: 'x', bullets: [], table: [['', ''], ['', '']] }, 'bullets')).toEqual([]);
  });
});
