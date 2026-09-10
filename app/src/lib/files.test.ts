import { describe, expect, it } from 'vitest';
import { search, settled, TRASH_DAYS, type FileMeta, type Settled } from './files';

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
