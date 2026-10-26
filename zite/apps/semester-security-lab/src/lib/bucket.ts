export type BucketCfg = { capacity: number; rate: number; cost: number; actors: number; instances: number; rps: number; duration: number; pattern: 'steady' | 'burst' | 'random'; scope: 'shared' | 'per-actor' };
export type Point = { t: number; tokens: number; allowed: number; denied: number };

// Deterministic PRNG so repeated simulations match.
function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296); }

export function simulate(c: BucketCfg) {
  const rand = rng(42);
  const arrivals: { t: number; actor: number }[] = [];
  for (let a = 0; a < c.actors; a++) {
    if (c.pattern === 'steady') {
      for (let t = 0; t < c.duration; t += 1 / c.rps) arrivals.push({ t, actor: a });
    } else if (c.pattern === 'burst') {
      for (let s = 0; s < c.duration; s += 5) for (let k = 0; k < c.rps * 5; k++) arrivals.push({ t: s + k * 0.01, actor: a });
    } else {
      let t = 0;
      while (t < c.duration) { t += -Math.log(1 - rand()) / c.rps; arrivals.push({ t, actor: a }); }
    }
  }
  arrivals.sort((x, y) => x.t - y.t);
  const buckets = new Map<string, { tokens: number; updated: number }>();
  const points: Point[] = Array.from({ length: Math.ceil(c.duration) }, (_, t) => ({ t, tokens: 0, allowed: 0, denied: 0 }));
  let allowed = 0, denied = 0, maxRetry = 0;
  for (const a of arrivals) {
    if (a.t >= c.duration) continue;
    const key = c.scope === 'shared' ? 'shared' : `actor-${a.actor}`;
    const b = buckets.get(key) ?? { tokens: c.capacity, updated: a.t };
    b.tokens = Math.min(c.capacity, b.tokens + (a.t - b.updated) * c.rate);
    b.updated = a.t;
    const p = points[Math.floor(a.t)];
    if (b.tokens >= c.cost) { b.tokens -= c.cost; allowed++; p.allowed++; }
    else { denied++; p.denied++; maxRetry = Math.max(maxRetry, Math.ceil(((c.cost - b.tokens) * 1000) / c.rate)); }
    p.tokens = b.tokens;
    buckets.set(key, b);
  }
  // Instance count doesn't change outcome: a correct shared atomic store makes N instances act as one bucket.
  return { points, allowed, denied, maxRetryMs: maxRetry, remaining: Math.floor([...buckets.values()][0]?.tokens ?? c.capacity) };
}
