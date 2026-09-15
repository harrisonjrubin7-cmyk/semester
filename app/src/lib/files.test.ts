import { describe, expect, it } from 'vitest';
import { atPage, isPdf, search, settled, TRASH_DAYS, type FileMeta, type Settled } from './files';

const meta = (over: Partial<FileMeta> = {}): FileMeta => ({
  id: 'f1',
  name: 'notes.pdf',
  type: 'application/pdf',
  size: 100,
  added: 0,
  courseId: null,
  ...over,
});

const file = (over: Partial<Settled> = {}): Settled => ({ ...settled(meta()), ...over });

describe('a record written before folders existed', () => {
  /*
   * The whole reason every field added after the store is optional: an
   * IndexedDB migration that rewrites every record is a migration that can
   * fail halfway through somebody's coursework.
   */
  it('reads as a live file at the top of the drive', () => {
    const old = settled(meta());
    expect(old.folderId).toBeNull();
    expect(old.starred).toBe(false);
    expect(old.trashedAt).toBeNull();
    expect(old.openedAt).toBeNull();
  });

  it('keeps everything it did have', () => {
    const old = settled(meta({ name: 'syllabus.pdf', courseId: 'econ', size: 4096, added: 99 }));
    expect(old).toMatchObject({ name: 'syllabus.pdf', courseId: 'econ', size: 4096, added: 99 });
  });

  it('does not lose a value that was set', () => {
    expect(settled(meta({ starred: true, folderId: 'a', trashedAt: 5 }))).toMatchObject({
      starred: true,
      folderId: 'a',
      trashedAt: 5,
    });
  });
});

describe('searching', () => {
  const files = [
    file({ id: '1', name: 'ECON midterm review.pdf' }),
    file({ id: '2', name: 'lecture 4.pdf', text: 'the econ midterm covers chapters one to six' }),
    file({ id: '3', name: 'psci reading.pdf', text: 'nothing relevant here' }),
    file({ id: '4', name: 'budget.xlsx' }),
  ];

  it('wants every word, in any order', () => {
    expect(search(files, 'econ midterm').map((r) => r.file.id)).toEqual(['1', '2']);
    expect(search(files, 'midterm econ').map((r) => r.file.id)).toEqual(['1', '2']);
    expect(search(files, 'econ nonsense')).toEqual([]);
  });

  it('looks inside the text as well as at the name', () => {
    const hits = search(files, 'chapters');
    expect(hits.map((r) => r.file.id)).toEqual(['2']);
    expect(hits[0].inText).toBe(true);
  });

  it('puts a hit in the name before one only in the text', () => {
    const hits = search(files, 'econ midterm');
    expect(hits[0].file.id).toBe('1');
    expect(hits[0].inText).toBe(false);
    expect(hits[1].inText).toBe(true);
  });

  it('ignores case and stray spaces', () => {
    expect(search(files, '  ECON   MIDTERM ').map((r) => r.file.id)).toEqual(['1', '2']);
  });

  it('gives everything back for an empty query', () => {
    expect(search(files, '   ').length).toBe(files.length);
  });

  it('finds a file with no text at all by its name', () => {
    expect(search(files, 'budget').map((r) => r.file.id)).toEqual(['4']);
  });
});

describe('the bin', () => {
  it('holds things for a month before anything sweeps them', () => {
    expect(TRASH_DAYS).toBe(30);
  });
});

/**
 * Opening a stored document at a page.
 *
 * `#page=N` is a PDF open parameter and the app cannot find out whether the
 * viewer honoured it — Chrome's and Firefox's do, others do not, and there is
 * no callback either way. So the only thing worth guarding is that the
 * fragment is never *wrong*: never on a file that has no pages, never a page
 * no document has, and never at the cost of the address itself, which is a
 * blob handle that has to survive being revoked.
 */
describe('the address a page is asked for at', () => {
  const blob = 'blob:http://localhost/9f3c-4d';

  it('asks for the page on a PDF', () => {
    expect(atPage(blob, 'application/pdf', 'syllabus.pdf', 12)).toBe(`${blob}#page=12`);
  });

  it('asks on a PDF the browser could not type, by its name', () => {
    expect(atPage(blob, 'application/octet-stream', 'syllabus.pdf', 3)).toBe(`${blob}#page=3`);
  });

  it('says nothing about pages for a file that has none', () => {
    // A fragment on a Word file is noise at best; at worst the handler takes
    // it as part of a name.
    expect(atPage(blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'notes.docx', 4)).toBe(blob);
    expect(atPage(blob, 'text/plain', 'syllabus.pdf', 4)).toBe(blob);
  });

  it('leaves the address alone when no page was asked for', () => {
    expect(atPage(blob, 'application/pdf', 'syllabus.pdf')).toBe(blob);
  });

  it('refuses a page number no document has', () => {
    // Zero and below are not pages. A fraction is a bug upstream, and
    // `#page=2.5` is a request every viewer answers differently.
    for (const page of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(atPage(blob, 'application/pdf', 'syllabus.pdf', page), String(page)).toBe(blob);
    }
  });

  it('leaves the handle itself untouched, because it has to be revoked', () => {
    // `openFile` revokes everything before the '#'. If this function rewrote
    // the address rather than appending to it, the blob would leak for the
    // life of the tab.
    const out = atPage(blob, 'application/pdf', 'syllabus.pdf', 7);
    expect(out.split('#')[0]).toBe(blob);
  });
});

describe('what the app treats as a PDF', () => {
  it('believes a declared type over a name', () => {
    // A note somebody called `syllabus.pdf` is still a note. The type is the
    // browser's answer and the name is the student's.
    expect(isPdf('application/pdf', 'no-extension')).toBe(true);
    expect(isPdf('text/plain', 'syllabus.pdf')).toBe(false);
  });

  it('falls back to the name only where the browser had nothing to say', () => {
    // Which is how everything unpacked from a zip arrives.
    expect(isPdf('application/octet-stream', 'syllabus.pdf')).toBe(true);
    expect(isPdf('', 'SYLLABUS.PDF')).toBe(true);
    expect(isPdf('application/octet-stream', 'syllabus.docx')).toBe(false);
    expect(isPdf('', 'pdf-notes.txt')).toBe(false);
  });
});
