import { describe, expect, it } from 'vitest';
import { fakeIndexedDB } from '../sync/fakeidb';
import { DATA_CLASSES, OFFLINE_RULES, mayKeep, minimise, type DataClass } from './classes';
import { Clock, MAX_DRIFT_MS, compare, decode, encode } from './hlc';
import { idbStorage } from './idb';
import { VaultError, memoryStorage, openVault, type Identity, type VaultStorage } from './vault';

const ME: Identity = { tenantId: 'vanderbilt', personId: 'p-1', deviceId: 'd-1' };
const NOW = 1_800_000_000_000;
const stamp = (n = 0) => encode({ wall: NOW + n, counter: 0, node: 'd-1' });

/** Everything the storage holds, as one searchable string — the probe for "is the plaintext on disk". */
async function dump(s: VaultStorage): Promise<string> {
  const rows: string[] = [];
  for (const k of await s.keys()) {
    const v = await s.get(k);
    rows.push(k, JSON.stringify(v, (_k, x) => (x instanceof Uint8Array ? Array.from(x) : typeof CryptoKey !== 'undefined' && x instanceof CryptoKey ? '[key]' : x)));
  }
  return rows.join('\n');
}

describe('what may be kept on a device', () => {
  it('has a rule for every class, and refuses every official one', () => {
    expect(Object.keys(OFFLINE_RULES).sort()).toEqual([...DATA_CLASSES].sort());
    for (const c of ['official_record', 'financial', 'protected_case', 'source_raw', 'guardian_control', 'credential'] as const) {
      const v = mayKeep(c);
      expect(v.ok, c).toBe(false);
      expect(!v.ok && v.reason, c).toBe('denied_class');
    }
    for (const c of ['personal_plan', 'student_draft', 'assignment_meta'] as const) expect(mayKeep(c).ok, c).toBe(true);
  });

  it('refuses a class that is not in the vocabulary rather than guessing', () => {
    const v = mayKeep('grades');
    expect(!v.ok && v.reason).toBe('unknown_class');
  });

  it('drops fields outside the assignment allowlist and leaves other classes whole', () => {
    expect(minimise('assignment_meta', { title: 'Essay 2', dueAt: 5, grade: 'A-', instructorNotes: 'x' })).toEqual({ title: 'Essay 2', dueAt: 5 });
    expect(minimise('personal_plan', { title: 't', anything: 1 })).toEqual({ title: 't', anything: 1 });
  });
});

describe('the hybrid logical clock', () => {
  it('issues strictly increasing stamps even when the wall clock stands still or goes back', () => {
    let t = NOW;
    const c = new Clock('a', () => t);
    const s1 = c.tick(), s2 = c.tick();
    t -= 5000;
    const s3 = c.tick();
    expect(compare(s1, s2)).toBeLessThan(0);
    expect(compare(s2, s3)).toBeLessThan(0);
  });

  it('catches a device that is behind up to one that is ahead', () => {
    const ahead = new Clock('b', () => NOW + 60_000).tick();
    const behind = new Clock('a', () => NOW);
    const got = behind.receive(ahead);
    expect(got && compare(got, ahead)).toBeGreaterThan(0);
    expect(compare(behind.tick(), ahead)).toBeGreaterThan(0);
  });

  it('refuses a stamp from too far in the future, and a malformed one, and changes nothing', () => {
    const c = new Clock('a', () => NOW);
    const before = c.tick();
    expect(c.receive(encode({ wall: NOW + MAX_DRIFT_MS + 1, counter: 0, node: 'x' }))).toBeNull();
    expect(c.receive('not a stamp')).toBeNull();
    expect(compare(c.tick(), before)).toBeGreaterThan(0);
    // Control: a stamp just inside the limit is taken, so the refusal above is the limit and not a broken parser.
    expect(c.receive(encode({ wall: NOW + MAX_DRIFT_MS, counter: 0, node: 'x' }))).not.toBeNull();
  });

  it('round-trips, and sorts as text the way it sorts as time', () => {
    const h = { wall: NOW, counter: 255, node: 'd-1' };
    expect(decode(encode(h))).toEqual(h);
    const a = encode({ wall: 9, counter: 0, node: 'z' }), b = encode({ wall: 10, counter: 0, node: 'a' });
    expect(compare(a, b)).toBeLessThan(0);
  });
});

describe('the encrypted store', () => {
  it('round-trips a record and reports its class and stamp', async () => {
    const v = await openVault(ME, memoryStorage(), { now: () => NOW });
    await v.put('t1', 'personal_plan', { title: 'Read ch. 4' }, stamp());
    const got = await v.get('t1');
    expect(got).toMatchObject({ id: 't1', cls: 'personal_plan', stamp: stamp(), value: { title: 'Read ch. 4' } });
    expect(await v.get('nope')).toBeNull();
  });

  it('never writes the plaintext, the key bytes, or a field name to storage', async () => {
    const s = memoryStorage();
    const v = await openVault(ME, s);
    await v.put('t1', 'student_draft', { body: 'MARKER-the-quick-brown-fox' }, stamp());
    const text = await dump(s);
    expect(text).not.toContain('MARKER-the-quick-brown-fox');
    expect(text).not.toContain('body');
    // Control: the probe does see plaintext when plaintext is there. Without
    // this, a clean result above could just be a probe that reads nothing.
    const plain = memoryStorage();
    await plain.put('x', { body: 'MARKER-the-quick-brown-fox' });
    expect(await dump(plain)).toContain('MARKER-the-quick-brown-fox');
  });

  it('holds the key as a non-extractable CryptoKey', async () => {
    const s = memoryStorage();
    const v = await openVault(ME, s);
    await v.put('t1', 'personal_plan', { a: 1 }, stamp());
    const key = (await s.get(`${v.namespace}/key`)) as CryptoKey;
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('uses a fresh IV for every seal, so identical records do not look identical', async () => {
    const s = memoryStorage();
    const v = await openVault(ME, s);
    await v.put('a', 'personal_plan', { same: 1 }, stamp());
    await v.put('b', 'personal_plan', { same: 1 }, stamp());
    const [a, b] = await Promise.all([s.get(`${v.namespace}/r/a`), s.get(`${v.namespace}/r/b`)]) as { iv: Uint8Array; ct: Uint8Array }[];
    expect(Array.from(a.iv)).not.toEqual(Array.from(b.iv));
    expect(Array.from(a.ct)).not.toEqual(Array.from(b.ct));
  });

  describe('refuses before it encrypts', () => {
    for (const c of ['official_record', 'financial', 'protected_case', 'source_raw', 'guardian_control', 'credential'] as DataClass[]) {
      it(`${c}`, async () => {
        const s = memoryStorage();
        const v = await openVault(ME, s);
        await expect(v.put('r', c, { gpa: 4 }, stamp())).rejects.toMatchObject({ code: 'denied_class' });
        // Nothing was written, not even a sealed copy: only the key may exist, and it is made lazily.
        expect((await s.keys()).filter((k) => k.includes('/r/'))).toEqual([]);
      });
    }
    it('and an unknown class', async () => {
      const v = await openVault(ME, memoryStorage());
      await expect(v.put('r', 'grades' as DataClass, {}, stamp())).rejects.toMatchObject({ code: 'unknown_class' });
    });
  });

  it('keeps only allowlisted assignment fields — the rest never reach storage in any form', async () => {
    const v = await openVault(ME, memoryStorage());
    await v.put('a1', 'assignment_meta', { title: 'Lab 3', dueAt: 9, grade: '92', instructorNotes: 'late penalty' }, stamp());
    expect((await v.get('a1'))?.value).toEqual({ title: 'Lab 3', dueAt: 9 });
  });

  it('expires a record past its class’s age limit, and deletes it on the way', async () => {
    let t = NOW;
    const s = memoryStorage();
    const v = await openVault(ME, s, { now: () => t });
    await v.put('a1', 'assignment_meta', { title: 'Lab 3' }, stamp());
    await v.put('p1', 'personal_plan', { title: 'x' }, stamp());
    t += OFFLINE_RULES.assignment_meta.maxAgeMs! - 1;
    expect(await v.get('a1')).not.toBeNull(); // control: still inside the window
    t += 1;
    expect(await v.get('a1')).toBeNull();
    expect(await v.list('assignment_meta')).toEqual([]);
    expect(await v.get('p1')).not.toBeNull(); // no limit for the student's own plan
  });

  describe('tamper evidence', () => {
    it('will not open a ciphertext moved onto another record id', async () => {
      const s = memoryStorage();
      const v = await openVault(ME, s);
      await v.put('a', 'personal_plan', { title: 'real' }, stamp());
      await v.put('b', 'personal_plan', { title: 'other' }, stamp());
      await s.put(`${v.namespace}/r/b`, { ...(await s.get(`${v.namespace}/r/a`) as object), id: 'b' });
      await expect(v.get('b')).rejects.toMatchObject({ code: 'tampered' });
      expect((await v.get('a'))?.value).toEqual({ title: 'real' }); // control: the untouched one still opens
    });

    it('will not open a record whose class or stamp header was edited', async () => {
      const s = memoryStorage();
      const v = await openVault(ME, s);
      await v.put('a', 'personal_plan', { title: 'x' }, stamp());
      const row = (await s.get(`${v.namespace}/r/a`)) as Record<string, unknown>;
      await s.put(`${v.namespace}/r/a`, { ...row, cls: 'student_draft' });
      await expect(v.get('a')).rejects.toBeInstanceOf(VaultError);
      await s.put(`${v.namespace}/r/a`, { ...row, stamp: stamp(1) });
      await expect(v.get('a')).rejects.toMatchObject({ code: 'tampered' });
    });

    it('will not open a flipped bit', async () => {
      const s = memoryStorage();
      const v = await openVault(ME, s);
      await v.put('a', 'personal_plan', { title: 'x' }, stamp());
      const row = (await s.get(`${v.namespace}/r/a`)) as { ct: Uint8Array };
      const ct = new Uint8Array(row.ct);
      ct[0] ^= 1;
      await s.put(`${v.namespace}/r/a`, { ...row, ct });
      await expect(v.get('a')).rejects.toMatchObject({ code: 'tampered' });
    });

    it('will not let another person’s or device’s vault read it, even copied under their own namespace', async () => {
      const s = memoryStorage();
      const mine = await openVault(ME, s);
      await mine.put('a', 'personal_plan', { title: 'private' }, stamp());
      const sealed = await s.get(`${mine.namespace}/r/a`);

      for (const other of [{ ...ME, personId: 'p-2' }, { ...ME, deviceId: 'd-2' }, { ...ME, tenantId: 'other-u' }]) {
        const theirs = await openVault(other, s);
        expect(await theirs.get('a')).toBeNull(); // not visible by id
        expect(await theirs.list()).toEqual([]);
        await theirs.put('seed', 'personal_plan', { x: 1 }, stamp()); // gives them a key of their own
        await s.put(`${theirs.namespace}/r/a`, sealed); // …and the stolen row is planted under their name
        await expect(theirs.get('a')).rejects.toMatchObject({ code: 'tampered' });
      }
    });

    it('says tampered, not “not found”, when records survive but the key does not', async () => {
      const s = memoryStorage();
      const v = await openVault(ME, s);
      await v.put('a', 'personal_plan', { title: 'x' }, stamp());
      await s.del(`${v.namespace}/key`);
      await expect(v.get('a')).rejects.toMatchObject({ code: 'tampered' });
    });
  });

  it('distinguishes identities that would collide if joined naively', async () => {
    const s = memoryStorage();
    const a = await openVault({ tenantId: 'a.b', personId: 'c', deviceId: 'd' }, s);
    const b = await openVault({ tenantId: 'a', personId: 'b.c', deviceId: 'd' }, s);
    expect(a.namespace).not.toBe(b.namespace);
    await expect(openVault({ ...ME, personId: '' }, s)).rejects.toMatchObject({ code: 'bad_identity' });
  });

  describe('wipe', () => {
    it('destroys the key and every record, and ends the vault', async () => {
      const s = memoryStorage();
      const v = await openVault(ME, s);
      await v.put('a', 'personal_plan', { title: 'x' }, stamp());
      const other = await openVault({ ...ME, personId: 'p-2' }, s);
      await other.put('keep', 'personal_plan', { title: 'theirs' }, stamp());

      await v.wipe();
      expect((await s.keys()).filter((k) => k.startsWith(`${v.namespace}/`))).toEqual([]);
      await expect(v.get('a')).rejects.toMatchObject({ code: 'wiped' });
      await expect(v.put('b', 'personal_plan', {}, stamp())).rejects.toMatchObject({ code: 'wiped' });
      // Control: wiping one person's vault leaves the next person's alone.
      expect((await other.get('keep'))?.value).toEqual({ title: 'theirs' });
    });

    it('deletes the key first, so a wipe cut off midway leaves records nobody can open', async () => {
      const s = memoryStorage();
      const v = await openVault(ME, s);
      await v.put('a', 'personal_plan', { title: 'x' }, stamp());
      await v.put('b', 'personal_plan', { title: 'y' }, stamp());
      let deletes = 0;
      const dying: VaultStorage = {
        ...s,
        // Records listed before the key: the explicit key-first delete is what
        // is under test, not whichever order a storage happens to list in.
        keys: async () => (await s.keys()).sort().reverse(),
        del: async (id) => {
          if (++deletes > 1) throw new Error('tab closed');
          await s.del(id);
        },
      };
      const dyingVault = await openVault(ME, dying);
      await expect(dyingVault.wipe()).rejects.toThrow('tab closed');
      // The records are still there, as ciphertext…
      expect((await s.keys()).filter((k) => k.includes('/r/'))).toHaveLength(2);
      // …and the key is not, so they are noise rather than a student's drafts.
      expect(await s.get(`${v.namespace}/key`)).toBeUndefined();
      await expect(v.get('a')).rejects.toMatchObject({ code: 'tampered' });
    });

    it('leaves a copied ciphertext unreadable by a reopened vault, because the new key is a different key', async () => {
      const s = memoryStorage();
      const v = await openVault(ME, s);
      await v.put('a', 'personal_plan', { title: 'x' }, stamp());
      const copy = await s.get(`${v.namespace}/r/a`);
      await v.wipe();
      const again = await openVault(ME, s);
      await again.put('seed', 'personal_plan', {}, stamp());
      await s.put(`${again.namespace}/r/a`, copy);
      await expect(again.get('a')).rejects.toMatchObject({ code: 'tampered' });
    });
  });

  it('reports an environment with no Web Crypto instead of quietly storing plaintext', async () => {
    await expect(openVault(ME, memoryStorage(), { subtle: undefined as unknown as SubtleCrypto, random: undefined }))
      .resolves.toBeDefined(); // falls back to the global, which exists in the test runtime
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      await expect(openVault(ME, memoryStorage())).rejects.toMatchObject({ code: 'unavailable' });
    } finally {
      if (saved) Object.defineProperty(globalThis, 'crypto', saved);
    }
  });
});

describe('the IndexedDB storage', () => {
  it('keeps sealed records and the key across a reopen, and wipes through it', async () => {
    const saved = (globalThis as { indexedDB?: unknown }).indexedDB;
    (globalThis as { indexedDB?: unknown }).indexedDB = fakeIndexedDB();
    try {
      const first = await openVault(ME, idbStorage());
      await first.put('a', 'student_draft', { body: 'hello' }, stamp());
      // A second vault object over a fresh storage handle: what a reload does.
      const second = await openVault(ME, idbStorage());
      expect((await second.get('a'))?.value).toEqual({ body: 'hello' });
      expect(await second.list()).toEqual(['a']);
      await second.wipe();
      expect(await idbStorage().keys()).toEqual([]);
    } finally {
      (globalThis as { indexedDB?: unknown }).indexedDB = saved;
    }
  });
});
