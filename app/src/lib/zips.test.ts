import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MOST_PACKED, tooPacked, tooPackedSaid } from './zips';
import { unzip } from './bundle';
import { fromXlsx } from './xlsxin';
import { extractText, fromPptx } from './extract';

/**
 * One limit, at every place the app unpacks a zip.
 *
 * `unzipSync` decompresses a whole archive into memory with no way to stop
 * partway, so the size of the file has to be checked before it is called.
 * Four places call it — a .docx syllabus, a .pptx deck, a .xlsx gradebook and
 * a dropped folder — and until this, one of them did.
 */

const SRC = join(process.cwd(), 'src');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

describe('the limit itself', () => {
  it('passes an ordinary file and stops an absurd one', () => {
    expect(tooPacked({ size: 40 * 1024 })).toBe(false);
    expect(tooPacked({ size: MOST_PACKED })).toBe(false);
    expect(tooPacked({ size: MOST_PACKED + 1 })).toBe(true);
  });

  it('says which file, how large is too large, and what to do instead', () => {
    // The message reaches somebody who has just picked a file and needs to
    // know it was their file rather than the app that was the problem.
    const said = tooPackedSaid('lectures.pptx', 'Export the deck as a PDF.');
    expect(said).toContain('lectures.pptx');
    expect(said).toContain('64MB');
    expect(said).toContain('Export the deck as a PDF.');
  });
});

describe('every caller checks before it unpacks', () => {
  /*
   * Read off the source rather than remembered, for the reason the whole fix
   * exists: `xlsxin.ts` had the guard and the other three did not, and nothing
   * anywhere said they should. A fifth caller added later is caught here.
   */
  it('so a new one cannot unpack an unbounded file', () => {
    const missing: string[] = [];
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes('unzipSync')) continue;
      // The module that defines the limit does not call the unzipper.
      if (file.endsWith(join('lib', 'zips.ts'))) continue;
      if (!text.includes('tooPacked')) missing.push(file.slice(SRC.length + 1));
    }
    expect(missing).toEqual([]);
  });

  it('and there is more than one of them, so the sweep is worth having', () => {
    // Guards against the check above passing because it found nothing at all.
    const callers = sources(SRC).filter((f) => readFileSync(f, 'utf8').includes('unzipSync'));
    expect(callers.length).toBeGreaterThanOrEqual(3);
  });
});

describe('each entry point actually refuses one', () => {
  /*
   * The source sweep above catches a caller that never heard of the limit. It
   * cannot catch one whose guard has been disabled — the name is still in the
   * file — and a mutation proved exactly that. So each door is knocked on.
   *
   * The file is a stub with its size overridden rather than sixty-four real
   * megabytes: the guard reads `size` and nothing past it runs, which is the
   * whole property under test.
   */
  const huge = (name: string): File => {
    const file = new File([new Uint8Array(8)], name);
    Object.defineProperty(file, 'size', { value: MOST_PACKED + 1 });
    return file;
  };

  it('a dropped folder', async () => {
    await expect(unzip(huge('everything.zip'))).rejects.toThrow(/too large/i);
  });

  it('a Word syllabus, through the door the app actually uses', async () => {
    // `fromDocx` is internal; `extractText` is what a screen calls, and it
    // dispatches on the extension.
    await expect(extractText(huge('syllabus.docx'))).rejects.toThrow(/too large/i);
  });

  it('a slide deck', async () => {
    await expect(fromPptx(huge('lectures.pptx'))).rejects.toThrow(/too large/i);
  });

  it('a workbook', async () => {
    // This one throws rather than reporting through `notes`: a file too large
    // to unpack has no partial reading to report, so there is nothing to put
    // in a note beside.
    await expect(fromXlsx(huge('grades.xlsx'))).rejects.toThrow(/too large/i);
  });
});
