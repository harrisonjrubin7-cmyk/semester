import { describe, expect, it } from 'vitest';
import { faultOf, isChunk } from './fault';

const thrown = (message: string, name = 'Error'): Error => {
  const e = new Error(message);
  e.name = name;
  return e;
};

/** How each engine words the same failure. Not one of them carries a code. */
const WORDINGS = [
  'Failed to fetch dynamically imported module: https://example.invalid/assets/Maps-M-ansPtz.js', // Chrome
  'Importing a module script failed.', // Safari
  'error loading dynamically imported module', // Firefox
];

describe('a screen that did not arrive', () => {
  it('is recognised however the engine words it', () => {
    for (const said of WORDINGS) expect(isChunk(thrown(said)), said).toBe(true);
    expect(isChunk(thrown('Loading chunk 42 failed', 'ChunkLoadError'))).toBe(true);
  });

  it('is not confused with a bug in the screen', () => {
    // The cost of getting this wrong runs both ways: a real bug reported as a
    // stale deploy offers a reload that does not help, and a stale deploy
    // reported as a bug tells somebody their app is broken when it is old.
    expect(isChunk(thrown("Cannot read properties of undefined (reading 'code')"))).toBe(false);
    expect(isChunk(thrown('Maximum update depth exceeded'))).toBe(false);
  });
});

describe('which of the three it is', () => {
  it('is the app moving on, when there is a connection', () => {
    for (const said of WORDINGS) expect(faultOf(thrown(said), true)).toBe('stale');
  });

  it('is a file that was never downloaded, when there is not', () => {
    // Measured with the network off: every one of these was reported as "This
    // app was updated — a reload is the whole fix", to somebody for whom a
    // reload could fetch nothing.
    for (const said of WORDINGS) expect(faultOf(thrown(said), false)).toBe('absent');
  });

  it('is a real fault either way, when the screen itself threw', () => {
    // Being offline does not turn a bug into a missing file: the screen was
    // fetched, it ran, and it fell over.
    const bug = thrown("Cannot read properties of undefined (reading 'code')");
    expect(faultOf(bug, true)).toBe('broken');
    expect(faultOf(bug, false)).toBe('broken');
  });
});
