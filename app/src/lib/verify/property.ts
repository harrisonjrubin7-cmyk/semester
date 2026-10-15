/**
 * A small property-checking harness for the rules that must always be true.
 *
 * Example tests say "this input gives this answer". The rules this app most
 * needs to keep — a revoked share never reads again, a kill switch beats
 * every other setting, a small cohort is never shown, a deleted record does
 * not come back — are statements about *every* input, and the inputs that
 * break them are the ones nobody thought to write down. This generates them,
 * and when one fails it shrinks it to the smallest case that still fails,
 * which is the difference between a finding and a puzzle.
 *
 * ## Why it is written here and not installed
 *
 * It is about two hundred lines, it has no dependency to keep patched, and it
 * is deterministic by default: a fixed seed, so the same suite gives the same
 * answer in file order and in `test:shuffle`. A property test that finds a
 * different counterexample on each run is a test that fails on a stranger's
 * pull request and passes when they push again, which is the flake this
 * repository's rules say is never a root cause. Depth is a knob, not a
 * surprise: `VERIFY_RUNS=20000 VERIFY_SEED=7 npm test` searches harder, and a
 * failure prints the seed that replays it.
 *
 * ## What it is not
 *
 * Not a proof. A property that holds for ten thousand generated cases has
 * held for ten thousand cases. What it adds over an example test is that it
 * searches, shrinks, and can be pointed at a rule by name; the model-based
 * `runMachine` does the same for sequences of actions against a simple model
 * of what the answer should be. Anything claimed "verified" in this repository
 * means exactly that, and `docs/VERIFICATION.md` says so.
 */

// ── Randomness ────────────────────────────────────────────────────────────

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [lo, hi], both ends included. */
  int(lo: number, hi: number): number;
}

/** mulberry32: a 32-bit seeded generator, small and good enough to search with. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)) };
}

// ── Generators ────────────────────────────────────────────────────────────

/** How to make a value, and how to make a simpler one that might still fail. */
export interface Gen<T> {
  gen(r: Rng): T;
  /** Simpler candidates, simplest first. Must not yield `v` itself. */
  shrink(v: T): Iterable<T>;
}

export const int = (lo: number, hi: number): Gen<number> => ({
  gen: (r) => r.int(lo, hi),
  *shrink(v) {
    const target = lo <= 0 && hi >= 0 ? 0 : lo;
    if (v === target) return;
    yield target;
    for (let d = Math.trunc((v - target) / 2); d !== 0; d = Math.trunc(d / 2)) yield v - d;
    if (v - 1 >= lo && v - 1 !== target) yield v - 1;
  },
});

export const bool: Gen<boolean> = {
  gen: (r) => r.next() < 0.5,
  *shrink(v) {
    if (v) yield false;
  },
};

/** One of a fixed list; shrinks toward the front of it. */
export const oneOf = <T>(values: readonly T[]): Gen<T> => ({
  gen: (r) => values[r.int(0, values.length - 1)]!,
  *shrink(v) {
    const i = values.indexOf(v);
    for (let j = 0; j < i; j++) yield values[j]!;
  },
});

export const arrayOf = <T>(item: Gen<T>, max = 8): Gen<T[]> => ({
  gen: (r) => Array.from({ length: r.int(0, max) }, () => item.gen(r)),
  *shrink(v) {
    if (v.length === 0) return;
    yield [];
    if (v.length > 1) {
      yield v.slice(0, Math.ceil(v.length / 2));
      yield v.slice(Math.floor(v.length / 2));
    }
    for (let i = 0; i < v.length; i++) yield [...v.slice(0, i), ...v.slice(i + 1)];
    for (let i = 0; i < v.length; i++) for (const s of item.shrink(v[i]!)) yield [...v.slice(0, i), s, ...v.slice(i + 1)];
  },
});

/** Some of `values`, in their original order. */
export const subset = <T>(values: readonly T[]): Gen<T[]> => ({
  gen: (r) => values.filter(() => r.next() < 0.5),
  *shrink(v) {
    if (v.length === 0) return;
    yield [];
    for (let i = 0; i < v.length; i++) yield [...v.slice(0, i), ...v.slice(i + 1)];
  },
});

type Shape = Record<string, Gen<unknown>>;
type Made<S extends Shape> = { [K in keyof S]: S[K] extends Gen<infer T> ? T : never };

export const record = <S extends Shape>(shape: S): Gen<Made<S>> => ({
  gen: (r) => Object.fromEntries(Object.entries(shape).map(([k, g]) => [k, g.gen(r)])) as Made<S>,
  *shrink(v) {
    for (const k of Object.keys(shape)) {
      for (const s of shape[k]!.shrink(v[k as keyof S])) yield { ...v, [k]: s };
    }
  },
});

// ── Running a property ────────────────────────────────────────────────────

export interface Options {
  runs?: number;
  seed?: number;
  /** Most candidate simplifications tried while shrinking one failure. */
  maxShrinks?: number;
}

export type Outcome<T> =
  | { ok: true; runs: number }
  | { ok: false; seed: number; runs: number; original: T; minimal: T; error: string; shrinks: number };

const env = (name: string): number | undefined => {
  const raw = typeof process === 'undefined' ? undefined : process.env[name];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

/** What the run was given, with the environment's depth and seed applied. */
export const DEFAULT_SEED = 0x5e3e57;
export const DEFAULT_RUNS = 300;

/** A property holds when it returns anything but `false` and does not throw. */
function fails<T>(prop: (v: T) => unknown, v: T): string | null {
  try {
    return prop(v) === false ? 'the property returned false' : null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export function runProperty<T>(g: Gen<T>, prop: (v: T) => unknown, o: Options = {}): Outcome<T> {
  const runs = o.runs ?? env('VERIFY_RUNS') ?? DEFAULT_RUNS;
  const seed = o.seed ?? env('VERIFY_SEED') ?? DEFAULT_SEED;
  const r = rng(seed);
  for (let i = 0; i < runs; i++) {
    const v = g.gen(r);
    let error = fails(prop, v);
    if (error === null) continue;
    // Shrink: take the first simpler candidate that still fails, and start
    // again from it, until none does or the budget is spent.
    let minimal = v;
    let shrinks = 0;
    let progressed = true;
    while (progressed && shrinks < (o.maxShrinks ?? 2000)) {
      progressed = false;
      for (const c of g.shrink(minimal)) {
        shrinks++;
        const e = fails(prop, c);
        if (e !== null) {
          minimal = c;
          error = e;
          progressed = true;
          break;
        }
        if (shrinks >= (o.maxShrinks ?? 2000)) break;
      }
    }
    return { ok: false, seed, runs: i + 1, original: v, minimal, error, shrinks };
  }
  return { ok: true, runs };
}

/** For tests: throws with the seed and the smallest failing case. */
export function assertProperty<T>(name: string, g: Gen<T>, prop: (v: T) => unknown, o: Options = {}): void {
  const out = runProperty(g, prop, o);
  if (out.ok) return;
  throw new Error(
    `Property "${name}" failed after ${out.runs} case${out.runs === 1 ? '' : 's'} (seed ${out.seed}, ${out.shrinks} shrinks).\n` +
      `Smallest failing case: ${JSON.stringify(out.minimal)}\n` +
      `Reason: ${out.error}\n` +
      `Replay: VERIFY_SEED=${out.seed} npm test`,
  );
}

// ── The same, for things that return promises ─────────────────────────────

async function failsAsync<T>(prop: (v: T) => unknown, v: T): Promise<string | null> {
  try {
    return (await prop(v)) === false ? 'the property returned false' : null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** `runProperty` for a property that awaits. Cases run one after another, never together, so a shared fake cannot interleave. */
export async function runPropertyAsync<T>(g: Gen<T>, prop: (v: T) => unknown, o: Options = {}): Promise<Outcome<T>> {
  const runs = o.runs ?? env('VERIFY_RUNS') ?? DEFAULT_RUNS;
  const seed = o.seed ?? env('VERIFY_SEED') ?? DEFAULT_SEED;
  const r = rng(seed);
  for (let i = 0; i < runs; i++) {
    const v = g.gen(r);
    let error = await failsAsync(prop, v);
    if (error === null) continue;
    let minimal = v;
    let shrinks = 0;
    let progressed = true;
    const cap = o.maxShrinks ?? 2000;
    while (progressed && shrinks < cap) {
      progressed = false;
      for (const c of g.shrink(minimal)) {
        shrinks++;
        const e = await failsAsync(prop, c);
        if (e !== null) {
          minimal = c;
          error = e;
          progressed = true;
          break;
        }
        if (shrinks >= cap) break;
      }
    }
    return { ok: false, seed, runs: i + 1, original: v, minimal, error, shrinks };
  }
  return { ok: true, runs };
}

// ── Model-based sequences ─────────────────────────────────────────────────

/**
 * One action against the system under test, and what the model says it does.
 * `step` performs the action on `sut`, updates `model`, and throws if the
 * system's answer and the model's differ — the model is the specification, and
 * it is deliberately the simplest thing that could be right.
 */
export interface Command<M, S> {
  name: string;
  args: Gen<unknown>;
  /** A command that is not legal in this state is skipped, not failed. */
  pre?(model: M, args: unknown): boolean;
  step(model: M, sut: S, args: unknown): void;
}

/** Declare a command with typed arguments. */
export function command<M, S, A>(c: {
  name: string;
  args: Gen<A>;
  pre?(model: M, args: A): boolean;
  step(model: M, sut: S, args: A): void;
}): Command<M, S> {
  return c as unknown as Command<M, S>;
}

export interface Machine<M, S> {
  init(): { model: M; sut: S };
  commands: readonly Command<M, S>[];
  /** Checked after every step. */
  invariant?(model: M, sut: S): void;
}

interface Step {
  c: number;
  a: unknown;
}

export function runMachine<M, S>(m: Machine<M, S>, o: Options & { maxCommands?: number } = {}): Outcome<{ name: string; args: unknown }[]> {
  const maxCommands = o.maxCommands ?? 25;
  const stepGen: Gen<Step> = {
    gen: (r) => {
      const c = r.int(0, m.commands.length - 1);
      return { c, a: m.commands[c]!.args.gen(r) };
    },
    *shrink(v) {
      for (const a of m.commands[v.c]!.args.shrink(v.a)) yield { c: v.c, a };
    },
  };
  const seqGen = arrayOf(stepGen, maxCommands);
  const run = (seq: Step[]) => {
    const { model, sut } = m.init();
    for (const s of seq) {
      const cmd = m.commands[s.c]!;
      if (cmd.pre && !cmd.pre(model, s.a)) continue;
      cmd.step(model, sut, s.a);
      m.invariant?.(model, sut);
    }
  };
  const named = (seq: Step[]) => seq.map((s) => ({ name: m.commands[s.c]!.name, args: s.a }));
  const out = runProperty(seqGen, (seq) => { run(seq); }, o);
  return out.ok ? out : { ...out, original: named(out.original), minimal: named(out.minimal) };
}

export function assertMachine<M, S>(name: string, m: Machine<M, S>, o: Options & { maxCommands?: number } = {}): void {
  const out = runMachine(m, o);
  if (out.ok) return;
  throw new Error(
    `Machine "${name}" failed after ${out.runs} sequence${out.runs === 1 ? '' : 's'} (seed ${out.seed}, ${out.shrinks} shrinks).\n` +
      `Smallest failing sequence: ${JSON.stringify(out.minimal)}\n` +
      `Reason: ${out.error}\n` +
      `Replay: VERIFY_SEED=${out.seed} npm test`,
  );
}

// ── Model-based sequences, where the steps await ──────────────────────────

export interface AsyncCommand<M, S> {
  name: string;
  args: Gen<unknown>;
  pre?(model: M, args: unknown): boolean;
  step(model: M, sut: S, args: unknown): void | Promise<void>;
}

export function asyncCommand<M, S, A>(c: {
  name: string;
  args: Gen<A>;
  pre?(model: M, args: A): boolean;
  step(model: M, sut: S, args: A): void | Promise<void>;
}): AsyncCommand<M, S> {
  return c as unknown as AsyncCommand<M, S>;
}

export interface AsyncMachine<M, S> {
  init(): { model: M; sut: S };
  commands: readonly AsyncCommand<M, S>[];
  invariant?(model: M, sut: S): void | Promise<void>;
}

export async function runMachineAsync<M, S>(m: AsyncMachine<M, S>, o: Options & { maxCommands?: number } = {}): Promise<Outcome<{ name: string; args: unknown }[]>> {
  const maxCommands = o.maxCommands ?? 20;
  const stepGen: Gen<Step> = {
    gen: (r) => {
      const c = r.int(0, m.commands.length - 1);
      return { c, a: m.commands[c]!.args.gen(r) };
    },
    *shrink(v) {
      for (const a of m.commands[v.c]!.args.shrink(v.a)) yield { c: v.c, a };
    },
  };
  const run = async (seq: Step[]) => {
    const { model, sut } = m.init();
    for (const s of seq) {
      const cmd = m.commands[s.c]!;
      if (cmd.pre && !cmd.pre(model, s.a)) continue;
      await cmd.step(model, sut, s.a);
      await m.invariant?.(model, sut);
    }
  };
  const named = (seq: Step[]) => seq.map((s) => ({ name: m.commands[s.c]!.name, args: s.a }));
  const out = await runPropertyAsync(arrayOf(stepGen, maxCommands), async (seq) => { await run(seq); }, o);
  return out.ok ? out : { ...out, original: named(out.original), minimal: named(out.minimal) };
}

export async function assertMachineAsync<M, S>(name: string, m: AsyncMachine<M, S>, o: Options & { maxCommands?: number } = {}): Promise<void> {
  const out = await runMachineAsync(m, o);
  if (out.ok) return;
  throw new Error(
    `Machine "${name}" failed after ${out.runs} sequence${out.runs === 1 ? '' : 's'} (seed ${out.seed}, ${out.shrinks} shrinks).\n` +
      `Smallest failing sequence: ${JSON.stringify(out.minimal)}\n` +
      `Reason: ${out.error}\n` +
      `Replay: VERIFY_SEED=${out.seed} npm test`,
  );
}
