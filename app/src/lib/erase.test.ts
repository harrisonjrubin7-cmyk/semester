// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PREFIX, keysIn } from './erase';

/**
 * Erase from this device.
 *
 * The app promises this in `lib/privacy.ts` and again in `lib/cloud.ts`, and
 * for a long time no screen offered it. What these check is the half that
 * cannot be checked by opening the screen: that the sweep reaches every key
 * the app writes, and that it stops at ours.
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

describe('every key the app writes is under the prefix', () => {
  /*
   * The claim the sweep rests on, checked against the code rather than
   * remembered.
   *
   * `eraseDevice` removes by prefix instead of by a list of names, because a
   * list of nineteen is eighteen long the week somebody adds the twentieth —
   * and a key missed by an erase is a promise broken silently. That trade is
   * only sound while every key really does begin `semester.`, so this reads
   * every `localStorage.setItem` and `sessionStorage.setItem` in the app and
   * fails on one that does not.
   */
  it('so a sweep by prefix cannot miss one', () => {
    const stray: string[] = [];
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8');
      // What is actually written, rather than everything that looks like a
      // key: each `setItem` call, with an identifier resolved to the constant
      // declared beside it in the same file. A constant nothing writes is not
      // a key and is none of this test's business.
      const consts = new Map<string, string>();
      for (const m of text.matchAll(/const (\w+) = '([^']+)'/g)) consts.set(m[1], m[2]);
      for (const m of text.matchAll(/(?:local|session)Storage\.setItem\(\s*(?:'([^']+)'|(\w+))/g)) {
        const key = m[1] ?? consts.get(m[2] ?? '');
        // A key built at runtime — `${KEY}.${id}` — is checked by its prefix
        // constant, which is in `consts` and caught on its own `setItem`.
        if (key && !key.startsWith(PREFIX)) stray.push(`${file.slice(SRC.length + 1)}: ${key}`);
      }
    }
    expect(stray).toEqual([]);
  });
});

describe('what the sweep collects', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('takes every key of ours, whatever wrote it', () => {
    localStorage.setItem('semester.v1', '{}');
    localStorage.setItem('semester.threads.v1', '[]');
    localStorage.setItem('semester.claude.v1', '{}');
    expect(keysIn(localStorage).sort()).toEqual([
      'semester.claude.v1',
      'semester.threads.v1',
      'semester.v1',
    ]);
  });

  it('leaves another app on the same origin alone', () => {
    // The dev server and the built app share an origin with whatever else is
    // served from it, and an erase that emptied the whole of `localStorage`
    // would be taking somebody else's data with ours.
    localStorage.setItem('semester.v1', '{}');
    localStorage.setItem('other-app.state', 'theirs');
    localStorage.setItem('semesterish', 'not ours either');
    expect(keysIn(localStorage)).toEqual(['semester.v1']);
  });

  it('reads the whole list before removing any of it', () => {
    /*
     * The bug this shape exists to avoid. `Storage.key(i)` re-indexes on every
     * removal, so removing inside the loop skips every other key — an erase
     * that leaves half of it behind, which is the worst outcome available
     * here because the screen would still say it was done.
     */
    for (let i = 0; i < 6; i += 1) localStorage.setItem(`semester.k${i}`, String(i));
    const keys = keysIn(localStorage);
    expect(keys).toHaveLength(6);
    for (const key of keys) localStorage.removeItem(key);
    expect(keysIn(localStorage)).toEqual([]);
  });

  it('says nothing rather than throwing when storage is switched off', () => {
    // A private window can refuse the read outright. An erase that throws
    // here would stop before the databases, which are the larger half.
    const boom = vi.spyOn(Storage.prototype, 'length', 'get').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(keysIn(localStorage)).toEqual([]);
    boom.mockRestore();
  });
});
