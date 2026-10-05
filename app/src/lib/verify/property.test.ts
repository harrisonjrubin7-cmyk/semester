import { describe, expect, it } from 'vitest';
import {
  arrayOf, assertMachine, assertMachineAsync, assertProperty, asyncCommand, bool, command, int, oneOf, record, rng, runMachine, runMachineAsync, runProperty, runPropertyAsync, subset,
} from './property';

/**
 * The harness, held to its own claims.
 *
 * A checker that has never failed is not known to be a checker, so most of
 * these are controls: a property that is plainly false must be found, must
 * shrink to the smallest case, and must replay from its seed. A harness that
 * reported every property true would pass the suite that depends on it.
 */

describe('the generator', () => {
  it('is deterministic from its seed, and different seeds differ', () => {
    const a = rng(1); const b = rng(1); const c = rng(2);
    const xs = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(xs);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(xs);
  });

  it('stays inside its bounds, both ends reachable', () => {
    const r = rng(9);
    const seen = new Set(Array.from({ length: 400 }, () => r.int(3, 6)));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });
});

describe('runProperty', () => {
  it('runs every case of a true property, and says so', () => {
    let n = 0;
    const out = runProperty(int(0, 100), () => { n++; }, { runs: 123 });
    expect(out).toEqual({ ok: true, runs: 123 });
    expect(n).toBe(123);
  });

  it('finds a false property and shrinks an integer to the boundary', () => {
    const out = runProperty(int(0, 1000), (v) => v < 50);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.minimal).toBe(50);
  });

  it('shrinks a list to the one element that matters', () => {
    const out = runProperty(arrayOf(int(0, 20), 10), (xs) => !xs.includes(7), { runs: 500 });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.minimal).toEqual([7]);
  });

  it('shrinks each field of a record independently', () => {
    const out = runProperty(record({ a: int(0, 100), b: int(0, 100), c: bool }), (v) => !(v.a >= 10 && v.b >= 20));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.minimal).toEqual({ a: 10, b: 20, c: false });
  });

  it('counts a thrown error as a failure and reports its message', () => {
    const out = runProperty(int(0, 10), (v) => { if (v === 4) throw new Error('four'); });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out).toMatchObject({ minimal: 4, error: 'four' });
  });

  it('replays: the same seed finds the same counterexample', () => {
    const p = (xs: number[]) => xs.length < 3;
    const a = runProperty(arrayOf(int(0, 9), 8), p, { seed: 77 });
    const b = runProperty(arrayOf(int(0, 9), 8), p, { seed: 77 });
    expect(a).toEqual(b);
    expect(a.ok).toBe(false);
  });

  it('shrinks an option list and a subset toward the front and toward empty', () => {
    const o = runProperty(oneOf(['a', 'b', 'c', 'd']), (v) => v === 'a');
    if (!o.ok) expect(o.minimal).toBe('b');
    const s = runProperty(subset([1, 2, 3, 4]), (xs) => !xs.includes(3), { runs: 200 });
    if (!s.ok) expect(s.minimal).toEqual([3]);
    expect(o.ok || s.ok).toBe(false);
  });
});

describe('assertProperty', () => {
  it('passes a true property and throws the seed and the smallest case for a false one', () => {
    assertProperty('true', int(0, 5), (v) => v <= 5);
    expect(() => assertProperty('small', int(0, 500), (v) => v < 7)).toThrow(/Smallest failing case: 7[\s\S]*Replay: VERIFY_SEED=\d+/);
  });
});

describe('the state machine runner', () => {
  // A counter that forgets everything when it reaches three: the bug needs
  // three increments in a row with nothing between them that would reset it.
  const make = (buggy: boolean) => ({
    init: () => ({ model: { n: 0 }, sut: { n: 0 } }),
    commands: [
      command<{ n: number }, { n: number }, number>({
        name: 'inc', args: int(1, 1),
        step: (m, s) => { m.n++; s.n = buggy && s.n === 2 ? 0 : s.n + 1; if (s.n !== m.n) throw new Error(`model ${m.n}, system ${s.n}`); },
      }),
      command<{ n: number }, { n: number }, number>({
        name: 'reset', args: int(0, 0),
        step: (m, s) => { m.n = 0; s.n = 0; },
      }),
    ],
  });

  it('passes a faithful system', () => {
    expect(runMachine(make(false)).ok).toBe(true);
  });

  it('finds the planted bug and shrinks the sequence to three increments', () => {
    const out = runMachine(make(true));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.minimal.map((s) => s.name)).toEqual(['inc', 'inc', 'inc']);
  });

  it('skips a command whose precondition is not met, rather than failing it', () => {
    let ran = 0;
    assertMachine('pre', {
      init: () => ({ model: {}, sut: {} }),
      commands: [command<object, object, number>({ name: 'never', args: int(0, 1), pre: () => false, step: () => { ran++; } })],
    });
    expect(ran).toBe(0);
  });

  it('checks the invariant after every step, not only at the end', () => {
    const out = runMachine({
      init: () => ({ model: { n: 0 }, sut: { n: 0 } }),
      commands: [command<{ n: number }, { n: number }, number>({ name: 'up', args: int(1, 1), step: (m, s) => { m.n++; s.n++; } })],
      invariant: (m) => { if (m.n > 4) throw new Error('over four'); },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.minimal).toHaveLength(5);
  });
});

describe('the asynchronous runners', () => {
  const later = () => new Promise<void>((r) => setTimeout(r, 0));

  it('find a false property and shrink it, as the synchronous one does', async () => {
    const out = await runPropertyAsync(int(0, 1000), async (v) => { await later(); return v < 50; });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.minimal).toBe(50);
  });

  it('pass a true property, and count a rejected promise as a failure with its message', async () => {
    expect(await runPropertyAsync(int(0, 9), async () => { await later(); }, { runs: 40 })).toEqual({ ok: true, runs: 40 });
    const out = await runPropertyAsync(int(0, 10), async (v) => { await later(); if (v === 4) throw new Error('four'); });
    expect(out).toMatchObject({ ok: false, minimal: 4, error: 'four' });
  });

  it('run a machine whose steps await, find the planted bug and shrink the sequence', async () => {
    const make = (buggy: boolean) => ({
      init: () => ({ model: { n: 0 }, sut: { n: 0 } }),
      commands: [
        asyncCommand<{ n: number }, { n: number }, number>({
          name: 'inc', args: int(1, 1),
          step: async (m, s) => { await later(); m.n++; s.n = buggy && s.n === 2 ? 0 : s.n + 1; if (s.n !== m.n) throw new Error(`model ${m.n}, system ${s.n}`); },
        }),
      ],
    });
    await assertMachineAsync('faithful', make(false), { runs: 50 });
    const out = await runMachineAsync(make(true), { runs: 100 });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.minimal.map((s) => s.name)).toEqual(['inc', 'inc', 'inc']);
  });

  it('run cases one after another, never together, so a shared fake cannot interleave', async () => {
    let inside = 0; let worst = 0;
    await runPropertyAsync(int(0, 9), async () => { inside++; worst = Math.max(worst, inside); await later(); inside--; }, { runs: 30 });
    expect(worst).toBe(1);
  });
});
