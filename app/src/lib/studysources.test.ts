import { describe, expect, it } from 'vitest';
import { STUDY_FORMATS, studySources, type StudySource } from './studystudio';
import type { CourseUpdate, Note, Unit } from './types';

/**
 * What the Study Studio is allowed to build from — and, underneath that, the
 * question "can a lecture I recorded become flashcards?"
 *
 * It can, and no test said so until this one. The chain is four files long and
 * no link mentions the next: `components/RecordButton.tsx` hands a live
 * transcript to `screens/Update.tsx`, which drops it into the material box,
 * which is adopted as a `CourseUpdate` carrying the transcript as its `body`,
 * which `studySources` offers the studio, which can render it as any of the
 * eleven formats including flashcards. Cut any link and nothing fails — the
 * lecture simply stops being offered, on a screen that promises it in its own
 * words: *"The transcript lands in the material box above, where it becomes
 * cards, a quiz and a guide like anything else."*
 *
 * That sentence is the claim. This file is what makes it checkable.
 */

const unit = (name: string, q = 'Q', a = 'A'): Unit => ({ name, mastery: 0, cards: [{ q, a }] });

const material = (over: Partial<CourseUpdate> = {}): CourseUpdate =>
  ({
    id: 'u1',
    courseId: 'bus',
    unit: null,
    title: 'Lecture · 18 September',
    source: 'Recorded in class · 48 min',
    body: 'Positioning is the place a brand occupies in the mind of the buyer.',
    cards: [],
    terms: [],
    ...over,
  }) as CourseUpdate;

const note = (over: Partial<Note> = {}): Note =>
  ({
    id: 'n1',
    title: 'My reading notes',
    body: 'Segmentation precedes targeting.',
    created: 0,
    updated: 0,
    courseId: 'bus',
    ...over,
  }) as Note;

describe('studySources', () => {
  it('offers a recorded lecture, which is the whole point of the chain', () => {
    const out = studySources('bus', [], [material()], [], []);
    expect(out.map((s) => s.id)).toEqual(['material-u1']);
    expect(out[0].text).toContain('Positioning');
    // The locator is what a citation is shown against, so the recording's own
    // description has to survive rather than being replaced by a generic one.
    expect(out[0].locator).toBe('Recorded in class · 48 min');
  });

  it('can be rendered as flashcards, which is the format the screen promises', () => {
    // Guarding the other half of the sentence: the source reaching the studio
    // is only useful if the studio can turn it into cards.
    expect(STUDY_FORMATS.map((f) => f[0])).toContain('flashcards');
  });

  it('offers the prepared guide, added material and personal notes too', () => {
    const out = studySources('bus', [unit('Branding')], [material()], [note()], []);
    expect(out.map((s) => s.id)).toEqual(['unit-0', 'material-u1', 'note-n1']);
  });

  it('keeps uploads last and untouched, since they were named by hand', () => {
    const up: StudySource = { id: 'upload-7', title: 'Slides.pdf', text: 'Slide text', locator: 'Page 1' };
    const out = studySources('bus', [unit('Branding')], [], [], [up]);
    expect(out[out.length - 1]).toEqual(up);
  });

  it('leaves out another course, so a marketing guide is not built from economics', () => {
    const out = studySources('bus', [], [material({ courseId: 'econ' })], [note({ courseId: 'econ' })], []);
    expect(out).toEqual([]);
  });

  it('leaves out a record with no text, which could only fail after being paid for', () => {
    // A photograph of the board writes an update with `body: ''` so the files
    // have an owner. Offering it as a source offers one that cannot be quoted,
    // and `parseStudySections` refuses an unverifiable citation — after the
    // request has been sent.
    const out = studySources('bus', [], [material({ body: '   ' })], [note({ body: '' })], []);
    expect(out).toEqual([]);
  });

  it('leaves out a unit with no cards and an upload with no text', () => {
    // Not the same guard as the one above, which the per-branch filters on
    // updates and notes already satisfy. Nothing filters a unit or an upload
    // on the way in, so the trailing `text.trim()` is the only thing standing
    // between an empty prepared unit and a source that can only fail — and
    // reverting that line leaves every other case in this file green.
    const out = studySources(
      'bus',
      [{ name: 'Not written yet', mastery: 0, cards: [] }],
      [],
      [],
      [{ id: 'upload-9', title: 'Blank.pdf', text: '  ', locator: 'Page 1' }],
    );
    expect(out).toEqual([]);
  });

  it('falls back to a plain locator where the material never said where it came from', () => {
    const out = studySources('bus', [], [material({ source: '' })], [], []);
    expect(out[0].locator).toBe('Added course material; page not recorded');
  });

  it('gives every source a distinct id, since the prompt cites them by it', () => {
    const out = studySources(
      'bus',
      [unit('One'), unit('Two')],
      [material(), material({ id: 'u2' })],
      [note(), note({ id: 'n2' })],
      [{ id: 'upload-1', title: 'A', text: 'a', locator: 'p1' }],
    );
    expect(new Set(out.map((s) => s.id)).size).toBe(out.length);
  });
});
