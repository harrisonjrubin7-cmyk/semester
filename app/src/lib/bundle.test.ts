import { describe, expect, it } from 'vitest';
import { baseName, gather, isZip, readable, tally, typeOf, whySkipped } from './bundle';

const fileOf = (name: string, bytes = 10, type = ''): File =>
  new File([new Uint8Array(bytes)], name, { type });

describe('isZip', () => {
  it('recognises one by name or by type', () => {
    expect(isZip(fileOf('readings.zip'))).toBe(true);
    expect(isZip(fileOf('readings', 10, 'application/zip'))).toBe(true);
    expect(isZip(fileOf('syllabus.pdf'))).toBe(false);
  });
});

describe('readable', () => {
  it('accepts what the rest of the app can actually read', () => {
    for (const name of ['a.pdf', 'a.docx', 'a.txt', 'a.md', 'a.png', 'a.JPEG', 'a.csv']) {
      expect(readable(name)).toBe(true);
    }
  });

  it('rejects what it cannot', () => {
    for (const name of ['a.mp4', 'a.mp3', 'a.pptx', 'a.exe', 'a']) {
      expect(readable(name)).toBe(false);
    }
  });

  it('rejects a zip’s own bookkeeping even when the extension looks fine', () => {
    expect(readable('__MACOSX/._chapter.pdf')).toBe(false);
    expect(readable('folder/.DS_Store')).toBe(false);
  });
});

describe('baseName', () => {
  it('drops the folders a zip carries', () => {
    expect(baseName('readings/week 4/chapter-3.pdf')).toBe('chapter-3.pdf');
    expect(baseName('flat.pdf')).toBe('flat.pdf');
  });
});

describe('typeOf', () => {
  it('gives a zip entry the type it has no room to carry', () => {
    expect(typeOf('a.pdf')).toBe('application/pdf');
    expect(typeOf('a.JPG')).toBe('image/jpeg');
    expect(typeOf('a.md')).toBe('text/markdown');
  });

  it('falls back rather than guessing wrong', () => {
    expect(typeOf('a.qqq')).toBe('application/octet-stream');
  });
});

describe('whySkipped', () => {
  it('is silent about a file that is fine', () => {
    expect(whySkipped('chapter.pdf', 1000)).toBeNull();
  });

  it('says what to do instead, rather than just refusing', () => {
    // "Unsupported file type" makes somebody upload it again hoping for a
    // different outcome.
    expect(whySkipped('lecture.mp4', 10)).toContain('neither audio nor video');
    expect(whySkipped('lecture.mp3', 10)).toContain('record a lecture in the app');
    expect(whySkipped('deck.pptx', 10)).toContain('export them as a PDF');
  });

  it('names the size when that is the problem', () => {
    expect(whySkipped('huge.pdf', 60 * 1024 * 1024)).toContain('MB');
  });

  it('recognises bookkeeping as bookkeeping', () => {
    expect(whySkipped('__MACOSX/._a.pdf', 10)).toContain('bookkeeping');
  });
});

describe('gather', () => {
  it('passes ordinary files straight through', async () => {
    const got = await gather([fileOf('syllabus.pdf'), fileOf('board.jpg')]);
    expect(got.files.map((f) => f.name)).toEqual(['syllabus.pdf', 'board.jpg']);
    expect(got.skipped).toEqual([]);
  });

  it('reports what it left out instead of dropping it quietly', async () => {
    // A folder that silently loses half its contents is how somebody studies
    // from three of five readings without knowing.
    const got = await gather([fileOf('a.pdf'), fileOf('lecture.mp4')]);
    expect(got.files).toHaveLength(1);
    expect(got.skipped).toHaveLength(1);
    expect(got.skipped[0].name).toBe('lecture.mp4');
  });

  it('says a zip would not open rather than throwing away the whole pick', async () => {
    const got = await gather([fileOf('broken.zip', 20), fileOf('good.pdf')]);
    expect(got.files.map((f) => f.name)).toEqual(['good.pdf']);
    expect(got.skipped[0].name).toBe('broken.zip');
  });

  it('unpacks a real zip and keeps only what it can read', async () => {
    const { zipSync } = await import('fflate');
    const bytes = zipSync({
      'readings/chapter-3.pdf': new Uint8Array([1, 2, 3]),
      'readings/notes.txt': new TextEncoder().encode('hello'),
      'readings/lecture.mp4': new Uint8Array([9]),
      '__MACOSX/._chapter-3.pdf': new Uint8Array([0]),
      'readings/': new Uint8Array(0),
    });
    const zip = new File([bytes as unknown as BlobPart], 'week4.zip', { type: 'application/zip' });

    const got = await gather([zip]);
    expect(got.files.map((f) => f.name).sort()).toEqual(['chapter-3.pdf', 'notes.txt']);
    // The video is reported; the macOS bookkeeping is not, because nobody
    // meant to send it and listing it would be noise.
    expect(got.skipped.map((s) => s.name)).toEqual(['lecture.mp4']);
  });

  it('gives an unpacked entry a usable type and its contents', async () => {
    const { zipSync } = await import('fflate');
    const bytes = zipSync({ 'notes.txt': new TextEncoder().encode('the reading') });
    const zip = new File([bytes as unknown as BlobPart], 'x.zip');
    const got = await gather([zip]);
    expect(got.files[0].file.type).toBe('text/plain');
    expect(await got.files[0].file.text()).toBe('the reading');
  });

  it('copes with an empty pick', async () => {
    const got = await gather([]);
    expect(got.files).toEqual([]);
    expect(got.skipped).toEqual([]);
  });
});

describe('tally', () => {
  it('counts what came in and what did not', () => {
    expect(tally({ files: [], skipped: [] })).toBe('Nothing usable');
    expect(tally({ files: [{ name: 'a', file: fileOf('a') }], skipped: [] })).toBe('1 file');
    expect(
      tally({
        files: [
          { name: 'a', file: fileOf('a') },
          { name: 'b', file: fileOf('b') },
        ],
        skipped: [{ name: 'c', why: 'x' }],
      }),
    ).toBe('2 files · 1 left out');
  });
});
