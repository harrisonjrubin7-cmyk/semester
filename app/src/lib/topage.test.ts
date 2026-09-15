import { describe, expect, it } from 'vitest';
import { alreadyHeld, bytesOf, pdfFrom, sourceFor, type Cited, type Held } from './topage';

/**
 * The jump from a quote to the page it is on.
 *
 * Two things are being guarded here and they fail in opposite directions.
 * The first is that the jump works at all — the app kept the PDF, the
 * citation named it, and pressing the page finds it. The second is that it
 * **refuses** rather than guesses: a page number in a course whose syllabus
 * nobody kept, or whose citation named a document the drive does not have, is
 * printed as text exactly as it was before any of this.
 *
 * The second is the one worth tests. Opening the wrong document at page 12
 * and presenting it as the evidence for a deadline is worse than the inert
 * string this replaces, because it looks right — and every plausible
 * shortcut, "use the only PDF", "use the newest one", "use the course's
 * source whatever the citation said", produces exactly that.
 */

const PDF = 'application/pdf';

function held(over: Partial<Held> = {}): Held {
  return {
    id: 'f1',
    name: 'Econ1020_Fall.pdf',
    type: PDF,
    size: 4096,
    added: 1000,
    courseId: 'econ',
    trashedAt: null,
    ...over,
  };
}

function cited(over: Partial<Cited['checked']> = {}, c = 'econ'): Cited {
  return { c, checked: { page: 12, doc: 'Econ1020_Fall.pdf', ...over } };
}

/** The base64 of "%PDF-1.4\n", which is what a PDF actually starts with. */
const HEAD = 'JVBERi0xLjQK';

describe('reading the bytes back', () => {
  it('round-trips what the extractor encoded', () => {
    expect(new TextDecoder().decode(bytesOf(HEAD))).toBe('%PDF-1.4\n');
  });

  it('carries a byte no text encoding would survive', () => {
    // A PDF is binary. `btoa`/`atob` are the only step in this path that
    // could quietly go through a string codec, and a xref table full of NULs
    // is where that would show.
    const raw = new Uint8Array([0x00, 0xff, 0x80, 0x0a, 0x1b]);
    const base64 = btoa(String.fromCharCode(...raw));
    expect([...bytesOf(base64)]).toEqual([...raw]);
  });

  it('does not overflow on a syllabus-sized document', () => {
    // The loop exists instead of `String.fromCharCode(...bytes)`, which
    // throws on an array this long. Half a megabyte is far short of the
    // twelve the importer allows and comfortably past where the spread form
    // gives out.
    const big = new Uint8Array(512 * 1024).fill(0x41);
    const base64 = btoa(Array.from(big, (b) => String.fromCharCode(b)).join(''));
    expect(bytesOf(base64).length).toBe(big.length);
  });
});

describe('the file worth keeping', () => {
  it('is the PDF the import carried whole', async () => {
    const file = pdfFrom({ name: 'Econ1020_Fall.pdf', pdf: HEAD });
    expect(file?.name).toBe('Econ1020_Fall.pdf');
    expect(file?.type).toBe(PDF);
    expect(await file?.text()).toBe('%PDF-1.4\n');
  });

  it('is nothing for a source that never had bytes', () => {
    // Pasted text, a Word file, a slide deck, and a PDF over the send limit.
    // None of them can produce a page number either, so there is nothing to
    // keep them for.
    expect(pdfFrom({ name: 'pasted' })).toBeNull();
    expect(pdfFrom({ name: 'notes.docx', pdf: '' })).toBeNull();
  });

  it('is nothing, rather than a throw, for a string that will not decode', () => {
    // The import must go through. A syllabus whose base64 was truncated
    // leaves its page numbers inert, which is where they were.
    expect(pdfFrom({ name: 'broken.pdf', pdf: 'not base64 at all !!!' })).toBeNull();
  });
});

describe('a copy that is already there', () => {
  const drive = [held()];
  const same = () => new File(['x'.repeat(4096)], 'Econ1020_Fall.pdf', { type: PDF });

  it('stops a re-import leaving two of the same syllabus', () => {
    expect(alreadyHeld(drive, 'econ', same())).toBe(true);
  });

  it('does not count a copy filed against another course', () => {
    expect(alreadyHeld(drive, 'psci', same())).toBe(false);
  });

  it('does not count a reissued syllabus as the one it replaces', () => {
    // Same name, different bytes. Both are kept: the deadlines already ticked
    // were read from the old one.
    expect(alreadyHeld(drive, 'econ', new File(['y'.repeat(9000)], 'Econ1020_Fall.pdf', { type: PDF }))).toBe(
      false,
    );
  });

  it('does not count a copy in the bin', () => {
    // Somebody threw it away. Re-importing should bring it back, not decide
    // there is nothing to do.
    expect(alreadyHeld([held({ trashedAt: 500 })], 'econ', same())).toBe(false);
  });

  it('reads two spellings of one name as one name', () => {
    expect(alreadyHeld(drive, 'econ', new File(['x'.repeat(4096)], ' econ1020_FALL.pdf '))).toBe(true);
  });
});

describe('which document a page is a page of', () => {
  it('is the one the citation named', () => {
    expect(sourceFor([held()], cited(), 'Econ1020_Fall.pdf')?.id).toBe('f1');
  });

  it('is nothing when the deadline has no page', () => {
    expect(sourceFor([held()], { c: 'econ' }, 'Econ1020_Fall.pdf')).toBeNull();
    expect(sourceFor([held()], { c: 'econ', checked: { doc: 'Econ1020_Fall.pdf' } }, '')).toBeNull();
  });

  it('is nothing for a page number no document has', () => {
    // `#page=0` is a page no viewer can show, and a negative one is a bug
    // upstream rather than a request.
    expect(sourceFor([held()], cited({ page: 0 }), 'x')).toBeNull();
    expect(sourceFor([held()], cited({ page: -3 }), 'x')).toBeNull();
  });

  /**
   * The refusal this module exists for.
   *
   * Readings, past papers and lecture notes are all filed against a course,
   * so "the only PDF here" is a guess with the student's own material in the
   * answer set. A wrong document opened at page 12 under the words "straight
   * from the syllabus" is a stronger false claim than the app has ever made.
   */
  it('is nothing when the named document is not in the drive, however few others there are', () => {
    const onlyOne = [held({ id: 'reading', name: 'Week 3 reading.pdf' })];
    expect(sourceFor(onlyOne, cited(), 'Econ1020_Fall.pdf')).toBeNull();
  });

  it('falls back to the course’s own source only when the citation named nothing', () => {
    const drive = [held()];
    expect(sourceFor(drive, cited({ doc: undefined }), 'Econ1020_Fall.pdf')?.id).toBe('f1');
    // And the citation wins when it has an opinion: two documents went up,
    // and the course names the first of them.
    const both = [held(), held({ id: 'sched', name: 'Schedule.pdf' })];
    expect(sourceFor(both, cited({ doc: 'Schedule.pdf' }), 'Econ1020_Fall.pdf')?.id).toBe('sched');
  });

  it('will not reach into another course', () => {
    expect(sourceFor([held({ courseId: 'psci' })], cited(), 'Econ1020_Fall.pdf')).toBeNull();
    expect(sourceFor([held({ courseId: null })], cited(), 'Econ1020_Fall.pdf')).toBeNull();
  });

  it('will not open something out of the bin', () => {
    expect(sourceFor([held({ trashedAt: 9 })], cited(), 'Econ1020_Fall.pdf')).toBeNull();
  });

  it('will not offer a page of something that is not a PDF', () => {
    // A note saved as `Econ1020_Fall.pdf.txt` would not match anyway; one
    // saved under exactly the syllabus's name would, and has no pages.
    const notes = [held({ type: 'text/plain', name: 'Econ1020_Fall.pdf' })];
    expect(sourceFor(notes, cited(), 'Econ1020_Fall.pdf')).toBeNull();
  });

  it('takes a PDF the browser could not name a type for', () => {
    // Unpacked from a zip, which is how a week of readings arrives. `addFile`
    // stores those as `application/octet-stream`; the name is all there is.
    expect(sourceFor([held({ type: 'application/octet-stream' })], cited(), 'Econ1020_Fall.pdf')?.id).toBe(
      'f1',
    );
    expect(sourceFor([held({ type: '' })], cited(), 'Econ1020_Fall.pdf')?.id).toBe('f1');
  });

  it('takes the most recent of two printings under one name', () => {
    const drive = [held({ id: 'old', added: 1 }), held({ id: 'new', added: 2 })];
    expect(sourceFor(drive, cited(), 'Econ1020_Fall.pdf')?.id).toBe('new');
    // And the same answer whichever order the drive hands them over.
    expect(sourceFor([...drive].reverse(), cited(), 'Econ1020_Fall.pdf')?.id).toBe('new');
  });
});

