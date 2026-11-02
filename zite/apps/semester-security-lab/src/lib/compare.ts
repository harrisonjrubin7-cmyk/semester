export type CompareCfg = { rate: number; capacity: number; windowSec: number; windowLimit: number; duration: number };
export type Pattern = { key: string; label: string; rps: number; burst: number; every: number };

export const PATTERNS: Pattern[] = [
  { key: 'steady', label: 'Steady: 20 req/s', rps: 20, burst: 0, every: 10 },
  { key: 'bursty', label: 'Bursty: 20 req/s + 300-request bursts every 10s', rps: 20, burst: 300, every: 10 },
  { key: 'overload', label: 'Overload: 80 req/s + the same bursts', rps: 80, burst: 300, every: 10 },
];

function arrivals(p: Pattern, duration: number) {
  const out: number[] = [];
  for (let i = 0; i < p.rps * duration; i++) out.push(i / p.rps);
  if (p.burst) for (let s = 0; s < duration; s += p.every) for (let k = 0; k < p.burst; k++) out.push(s);
  return out.sort((a, b) => a - b);
}

function tokenBucket(ts: number[], c: CompareCfg) {
  let tokens = c.capacity, last = 0, ok = 0;
  for (const t of ts) {
    tokens = Math.min(c.capacity, tokens + (t - last) * c.rate);
    last = t;
    if (tokens >= 1) { tokens -= 1; ok++; }
  }
  return ok;
}

function slidingLog(ts: number[], c: CompareCfg) {
  const log: number[] = [];
  let head = 0, ok = 0;
  for (const t of ts) {
    while (head < log.length && log[head] <= t - c.windowSec) head++;
    if (log.length - head < c.windowLimit) { log.push(t); ok++; }
  }
  return ok;
}

// Deterministic admission comparison only — measures nothing about throughput, latency, or Redis.
export function compare(c: CompareCfg) {
  return PATTERNS.map((p) => {
    const ts = arrivals(p, c.duration);
    return { pattern: p.label, offered: ts.length, bucket: tokenBucket(ts, c), window: slidingLog(ts, c) };
  });
}
