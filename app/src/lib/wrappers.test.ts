// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asset } from './asset';
import { formatBytes, newId } from './files';
import { blobOf, numbered, zipOf } from './deliver';
import { clockOf, explainMicError, micSupported, recordingName } from './mic';
import { MAX_SHOTS, ShotError, weigh } from './shots';
import { chime } from './chime';
import { DESKTOP } from './media';

/**
 * The thin layer between the app and the browser.
 *
 * Most of what these files do is call an API that either exists or does not,
 * and asserting that a stub was called proves nothing. What is worth pinning
 * down is the part that is genuinely the app's own: the path arithmetic that
 * decides whether a deployed audio file loads at all, the strings a person
 * reads when a permission is refused, and — in every one of them — that a
 * browser lacking the capability degrades rather than throws.
 *
 * The IndexedDB and canvas paths are not covered. Faking either well enough to
 * mean anything is a larger fixture than the code it tests, and the failure
 * they guard against is a browser refusing storage, which no fake reproduces.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('asset', () => {
  /*
   * The whole deployment rests on this.
   *
   * In development the app is served from the root and `/audio/lessons/econ/
   * unit-0.mp3` is a real address. On GitHub Pages it is a subpath, and every
   * absolute path in the data becomes a 404 with nothing shown: a player that
   * loads silence, a document link that goes nowhere.
   */
  it('puts the base in front of a path from the site root', () => {
    vi.stubEnv('BASE_URL', '/semester/');
    expect(asset('/audio/lessons/econ/unit-0.mp3')).toBe('/semester/audio/lessons/econ/unit-0.mp3');
    expect(asset('audio/x.mp3')).toBe('/semester/audio/x.mp3');
  });

  it('never doubles the slash between the two halves', () => {
    vi.stubEnv('BASE_URL', '/semester/');
    expect(asset('/x')).not.toContain('//');
    vi.stubEnv('BASE_URL', '/semester');
    expect(asset('/x')).toBe('/semester/x');
  });

  it('leaves an address that is already absolute alone', () => {
    // An https URL, a blob: from a recording, a data: from a figure.
    vi.stubEnv('BASE_URL', '/semester/');
    for (const url of [
      'https://example.test/a.mp3',
      'blob:https://example.test/abc',
      'data:audio/mp3;base64,AAAA',
      'mailto:someone@x.edu',
    ]) {
      expect(asset(url)).toBe(url);
    }
  });

  it('serves from the root when there is no base', () => {
    vi.stubEnv('BASE_URL', '');
    expect(asset('/x.mp3')).toBe('/x.mp3');
  });

  it('hands back an empty path rather than a bare slash', () => {
    // A course with no audio has an empty string here, and "/" would be a
    // request for the app's own index page as if it were a media file.
    expect(asset('')).toBe('');
  });
});

describe('formatBytes', () => {
  it('names a size in the unit somebody would use', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('changes unit at the boundary rather than saying "1024 KB"', () => {
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024 - 1)).toContain('KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });
});

describe('newId', () => {
  it('does not hand two files the same name', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
  });
});

describe('numbered', () => {
  it('numbers a clash before the extension, not after it', () => {
    // "notes-2.md" opens; "notes.md-2" is a file the operating system has no
    // idea what to do with.
    expect(numbered('notes.md', 2)).toBe('notes-2.md');
    expect(numbered('ECON 1020 guide.pdf', 3)).toBe('ECON 1020 guide-3.pdf');
  });

  it('numbers a name with no extension at the end', () => {
    expect(numbered('notes', 2)).toBe('notes-2');
  });

  it('treats a leading dot as part of the name, not an extension', () => {
    expect(numbered('.gitignore', 2)).toBe('.gitignore-2');
  });

  it('numbers on the last dot, so a version number survives', () => {
    expect(numbered('guide.v2.pdf', 3)).toBe('guide.v2-3.pdf');
  });
});

describe('blobOf and zipOf', () => {
  it('gives text a charset, so an accented name is not mangled on open', () => {
    const blob = blobOf({ name: 'a.md', body: '# Héloïse', mime: 'text/markdown' });
    expect(blob.type).toBe('text/markdown;charset=utf-8');
  });

  it('passes a blob through as it is', () => {
    const original = new Blob(['x'], { type: 'application/pdf' });
    expect(blobOf({ name: 'a.pdf', body: original, mime: 'application/pdf' })).toBe(original);
  });

  it('builds a real archive of the pieces', async () => {
    // Read back with the same unzipper the import path uses, so this is a
    // round trip rather than an assertion about a length.
    const zip = await zipOf([
      { name: 'notes/one.md', body: '# One', mime: 'text/markdown' },
      { name: 'notes/two.md', body: '# Two', mime: 'text/markdown' },
    ]);
    const { unzipSync, strFromU8 } = await import('fflate');
    const out = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(out).sort()).toEqual(['notes/one.md', 'notes/two.md']);
    expect(strFromU8(out['notes/one.md'])).toBe('# One');
  });

  it('makes an empty archive rather than failing on nothing', async () => {
    expect((await zipOf([])).type).toBe('application/zip');
  });
});

describe('clockOf', () => {
  it('reads a memo in minutes and an hour of lecture in hours', () => {
    expect(clockOf(0)).toBe('0:00');
    expect(clockOf(9)).toBe('0:09');
    expect(clockOf(271)).toBe('4:31');
    expect(clockOf(3862)).toBe('1:04:22');
  });

  it('pads the minutes only once there is an hour to pad them against', () => {
    expect(clockOf(65)).toBe('1:05');
    expect(clockOf(3600)).toBe('1:00:00');
  });
});

describe('recordingName', () => {
  const at = new Date(2026, 8, 4);

  it('dates the file, since these sit in a list beside uploaded PDFs', () => {
    expect(recordingName('ECON lecture', at)).toBe('ECON-lecture-2026-09-04');
  });

  it('takes out what a filename cannot carry, without leaving a gap behind it', () => {
    // The punctuation goes and the space it left collapses with its
    // neighbour, so a stripped character does not become a double hyphen.
    expect(recordingName('ECON 1020: week 6 / notes?', at)).toBe('ECON-1020-week-6-notes-2026-09-04');
    expect(recordingName('a  //  b', at)).toBe('a-b-2026-09-04');
  });

  it('names an unlabelled recording rather than producing a bare date', () => {
    expect(recordingName('', at)).toBe('recording-2026-09-04');
    expect(recordingName('   ', at)).toBe('recording-2026-09-04');
    expect(recordingName('???', at)).toBe('recording-2026-09-04');
  });

  it('keeps a long label from becoming an unusable filename', () => {
    expect(recordingName('x'.repeat(200), at).length).toBeLessThan(60);
  });

  it('pads a single-figure month and day', () => {
    expect(recordingName('a', new Date(2026, 0, 5))).toBe('a-2026-01-05');
  });
});

describe('explainMicError', () => {
  it('says a refusal cannot be asked about again, and where to undo it', () => {
    // A browser will not re-prompt once refused, so "try again" alone would
    // send somebody round a loop that cannot end.
    const said = explainMicError(new DOMException('x', 'NotAllowedError'));
    expect(said).toMatch(/browser’s settings/i);
  });

  it('tells apart no microphone from one already in use', () => {
    expect(explainMicError(new DOMException('x', 'NotFoundError'))).toMatch(/No microphone/i);
    expect(explainMicError(new DOMException('x', 'NotReadableError'))).toMatch(/Something else/i);
  });

  it('passes anything else through rather than guessing', () => {
    expect(explainMicError(new Error('Some other failure'))).toBe('Some other failure');
    expect(explainMicError('a bare string')).toBe('a bare string');
  });
});

describe('capability checks', () => {
  it('says no microphone when the browser has no recorder at all', () => {
    vi.stubGlobal('MediaRecorder', undefined);
    expect(micSupported()).toBe(false);
  });

  it('says no microphone when there is a recorder but no way to reach a device', () => {
    // Every browser over plain http. The screen offers the file picker.
    vi.stubGlobal('MediaRecorder', class {});
    vi.stubGlobal('navigator', {});
    expect(micSupported()).toBe(false);
  });
});

describe('shots', () => {
  it('adds up a batch in kilobytes, which is what the screen shows', () => {
    expect(weigh([{ kb: 120 }, { kb: 80 }] as Parameters<typeof weigh>[0])).toBe(200);
    expect(weigh([])).toBe(0);
  });

  it('caps a batch at what one request can usefully carry', () => {
    expect(MAX_SHOTS).toBeGreaterThan(0);
    expect(MAX_SHOTS).toBeLessThanOrEqual(100);
  });

  it('has an error type of its own, so a bad photo is told apart from a crash', () => {
    const e = new ShotError('That one is a HEIC.');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('That one is a HEIC.');
  });
});

describe('chime', () => {
  it('makes four notes and closes the context after them', () => {
    vi.useFakeTimers();
    const started: number[] = [];
    const close = vi.fn();
    const node = () => ({
      connect: (n: unknown) => n,
      start: (t: number) => started.push(t),
      stop: () => {},
      type: '',
      frequency: { value: 0 },
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    });
    vi.stubGlobal(
      'AudioContext',
      class {
        currentTime = 0;
        destination = {};
        createOscillator = node;
        createGain = node;
        close = close;
      },
    );
    chime();
    expect(started).toHaveLength(4);
    // Spaced rather than stacked, or it is one chord and not a bell.
    expect(new Set(started).size).toBe(4);
    vi.advanceTimersByTime(2000);
    expect(close).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('stays silent rather than throwing when the page has had no gesture', () => {
    /*
     * A browser refuses to make a sound until the page has been interacted
     * with. That is the rule that stops pages shouting at people, not a bug to
     * work around — so this swallows it, and the on-screen overlay is the
     * alarm.
     */
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new DOMException('not allowed', 'NotAllowedError');
        }
      },
    );
    expect(() => chime()).not.toThrow();
  });

  it('stays silent in a browser with no audio at all', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    expect(() => chime()).not.toThrow();
  });
});

describe('DESKTOP', () => {
  it('lets an iPad in portrait have the rail', () => {
    // The 11-inch is 834pt wide, the 10.9-inch 820, the 9.7-inch 768. Below
    // that — an iPad mini upright at 744, and every phone — the app is the
    // phone it was drawn as.
    const px = Number(/(\d+)/.exec(DESKTOP)?.[1]);
    expect(px).toBeLessThanOrEqual(768);
    expect(px).toBeGreaterThan(744);
  });
});
