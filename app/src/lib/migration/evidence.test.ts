import { describe, expect, it } from 'vitest';
import { GENESIS, append, canonical, digestOf, evidenceHead, verifyChain } from './evidence.ts';
import type { AppendInput, EvidenceEntry } from './evidence.ts';

const input = (n: number, over: Partial<AppendInput> = {}): AppendInput => ({
  at: `2026-10-0${n}T09:00:00.000Z`, actor: 'lead', kind: 'check_run', subject: 'finance',
  artifact: { run: n, failures: [] }, summary: `run ${n}`, retainUntil: '2036-10-01T00:00:00.000Z', ...over,
});

async function ledger(n = 4): Promise<EvidenceEntry[]> {
  let l: EvidenceEntry[] = [];
  for (let i = 1; i <= n; i++) l = await append(l, input(i));
  return l;
}

describe('the evidence ledger', () => {
  it('chains each entry to the one before and verifies', async () => {
    const l = await ledger();
    expect(l[0].prevHash).toBe(GENESIS);
    expect(l[1].prevHash).toBe(l[0].hash);
    expect(await verifyChain(l)).toEqual({ ok: true });
    expect(await verifyChain([])).toEqual({ ok: true });
  });

  it('names the first entry that was edited', async () => {
    const l = await ledger();
    const edited = l.map((e, i) => (i === 1 ? { ...e, summary: 'nothing failed' } : e));
    expect(await verifyChain(edited)).toEqual({ ok: false, at: 1, reason: 'hash' });
  });

  it('notices a removed entry, a swapped pair and a truncated-then-forged tail', async () => {
    const l = await ledger();
    expect(await verifyChain([l[0], l[2], l[3]])).toMatchObject({ ok: false, at: 1 });
    expect(await verifyChain([l[1], l[0], l[2], l[3]])).toMatchObject({ ok: false, at: 0 });
    const forged = { ...l[2], prevHash: l[0].hash };
    expect(await verifyChain([l[0], l[1], forged])).toMatchObject({ ok: false, at: 2 });
  });

  it('is not fooled by re-hashing an edited entry, because the next one commits to the old hash', async () => {
    const l = await ledger();
    const rewritten = await append([l[0]], { ...input(2), summary: 'quietly changed', artifact: { run: 2, failures: [] } });
    expect(rewritten[1].hash).not.toBe(l[1].hash);
    expect(await verifyChain([l[0], rewritten[1], l[2], l[3]])).toMatchObject({ ok: false, at: 2, reason: 'link' });
  });

  it('requires a retention date from the institution and refuses a nonsensical one', async () => {
    await expect(append([], input(1, { retainUntil: '' }))).rejects.toThrow(/records schedule/);
    await expect(append([], input(1, { retainUntil: '2026-01-01T00:00:00.000Z' }))).rejects.toThrow(/after the entry/);
  });

  it('keeps no value in the ledger: the artifact is a digest, and the summary is sanitised', async () => {
    const l = await append([], input(1, { artifact: { secret: 'student 20260431 gpa 3.9' }, summary: 'failed for jo@school.edu id 20260431' }));
    expect(JSON.stringify(l)).not.toContain('20260431');
    expect(JSON.stringify(l)).not.toContain('jo@school.edu');
    expect(l[0].artifactDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives the same digest for the same value however its keys were ordered', async () => {
    expect(await digestOf({ a: 1, b: { c: 2, d: [3, { e: 4, f: 5 }] } })).toBe(await digestOf({ b: { d: [3, { f: 5, e: 4 }], c: 2 }, a: 1 }));
    expect(canonical({ b: 1, a: undefined })).toBe('{"a":null,"b":1}');
    expect(await digestOf({ a: 1 })).not.toBe(await digestOf({ a: 2 }));
  });

  it('binds sign-offs to the last evidence that is not itself a sign-off', async () => {
    const l = await ledger(2);
    const head = evidenceHead(l);
    const signed = await append(l, input(3, { kind: 'signoff', artifact: { by: 'registrar' } }));
    expect(evidenceHead(signed)).toBe(head);
    const moved = await append(signed, input(4));
    expect(evidenceHead(moved)).not.toBe(head);
    expect(evidenceHead([])).toBe(GENESIS);
  });
});
