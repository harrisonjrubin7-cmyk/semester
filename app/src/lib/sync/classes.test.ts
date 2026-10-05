import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STRATEGY } from '../merge';
import { HELD_KINDS, OFFICIAL_PREFIXES, WRITES } from './classes';
import { KINDS } from './outbox';
import { HIGH_RISK } from '../offline-mode';

const SRC = join(import.meta.dirname, '../..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : walk(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });

describe('every write that needs a connection is in a class', () => {
  it('has a row for every requireOnline call in the source, and no row without one', () => {
    const found = new Set<string>();
    for (const file of walk(SRC)) {
      if (file.endsWith('offline-mode.ts')) continue; // where it is defined
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/requireOnline\('(\w+)'\)/g)) found.add(`${relative(SRC, file)}:${m[1]}`);
    }
    const table = new Set(WRITES.map((w) => `${w.file}:${w.kind}`));
    expect([...found].sort()).toEqual([...table].sort());
  });

  it('uses only kinds the offline module knows, and says why for each', () => {
    for (const w of WRITES) {
      expect(Object.keys(HIGH_RISK), `${w.file}`).toContain(w.kind);
      expect(w.why.length, `${w.file}:${w.kind} says why`).toBeGreaterThan(30);
    }
  });

  it('holds exactly the two kinds the outbox holds, and refuses the rest', () => {
    expect([...HELD_KINDS].sort()).toEqual(Object.keys(KINDS).sort());
    const held = WRITES.filter((w) => w.class === 'held-send').map((w) => w.kind).sort();
    expect(held).toEqual(['send', 'share']); // share → share, send → contribute
  });

  it('never holds publish, delete or handoff', () => {
    for (const kind of ['publish', 'delete', 'handoff'] as const) {
      const rows = WRITES.filter((w) => w.kind === kind);
      expect(rows.length, kind).toBeGreaterThan(0);
      for (const r of rows) expect(r.class, `${r.file}:${r.kind}`).toBe('never-queued');
    }
  });
});

describe('a held send can never reach an official or financial record', () => {
  const heldFiles = WRITES.filter((w) => w.class === 'held-send').map((w) => w.file);

  it('calls no function named for an official write, in either file it goes through', () => {
    for (const file of heldFiles) {
      const text = readFileSync(join(SRC, file), 'utf8');
      const called = [...text.matchAll(/\.(?:rpc|from)\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
      expect(called.length, `${file} calls the account`).toBeGreaterThan(0);
      for (const name of called) {
        for (const prefix of OFFICIAL_PREFIXES) expect(name.startsWith(prefix), `${file} calls ${name}`).toBe(false);
      }
    }
  });

  it('is wired to those two functions and nothing else', () => {
    const hook = readFileSync(join(SRC, 'lib/sync/senders.ts'), 'utf8');
    expect([...hook.matchAll(/import\('\.\.\/([a-z-]+)'\)/g)].map((m) => m[1]).sort()).toEqual(['advisor-shares', 'course-demand-remote']);
  });

  it('would notice one if it were written (control)', () => {
    const text = "await client.rpc('registration_enroll', {})";
    const called = [...text.matchAll(/\.(?:rpc|from)\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
    expect(called.some((n) => OFFICIAL_PREFIXES.some((p) => n.startsWith(p)))).toBe(true);
  });
});

describe('synced state is classified by the merge table', () => {
  it('puts this device’s own settings in device-only, and the rest in synced', () => {
    const deviceOnly = Object.entries(STRATEGY).filter(([, s]) => s === 'mine').map(([f]) => f);
    expect(deviceOnly).toEqual(expect.arrayContaining(['shell', 'textSize', 'timers', 'alarms', 'schemaVersion']));
    // A setting that says it is this device's is never overridden by an incoming copy, which is
    // what makes it device-only even though it is stored beside the rest.
    for (const f of deviceOnly) expect(STRATEGY[f]).toBe('mine');
  });
});
