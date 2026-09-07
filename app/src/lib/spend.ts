/**
 * What the asking has cost, counted rather than guessed.
 *
 * A key typed into this app is billed to the student's own card, and until
 * now the app spent it silently. There was no number anywhere — not per
 * question, not per week — which is a poor way to treat somebody's money and
 * a worse way to treat a nineteen-year-old's.
 *
 * ## Tokens are the fact; money is the conversion
 *
 * Every reply carries a `usage` block, and those counts are reported by the
 * API rather than estimated here. They are the part that cannot drift.
 *
 * The rates below are published list prices, written down with the date they
 * were read, and they *can* drift — a price changes and nothing in this app
 * finds out. So the meter shows tokens as a fact and money as an estimate,
 * says which rates it used, and never rounds a guess up into a number that
 * looks measured. If a rate here is stale the token counts are still right,
 * which is the property worth having.
 *
 * ## Its own key in localStorage
 *
 * Not in `semester.v1`. That key already holds a quarter of a megabyte of
 * courses and is rewritten whole on every state change; a ledger that grows
 * with every question would be re-serialised alongside all of it, forever.
 * This is a small, separate, append-only thing and it lives on its own.
 */

/** What one reply reported. Every field comes from the API. */
export interface Usage {
  /** Tokens charged at the full input rate. */
  input: number;
  output: number;
  /** Written to the cache. Costs more than plain input, once. */
  cacheWrite: number;
  /** Served from the cache. The cheap ones. */
  cacheRead: number;
}

export const NO_USAGE: Usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

/**
 * List prices per million tokens, and when they were read.
 *
 * Shown to the student alongside the number so a stale rate is visible rather
 * than silently wrong. Cache pricing is a multiplier on the input rate rather
 * than its own column, which is how it is published.
 */
export const RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  // Fable 5.1 is deliberately absent. Its list price is not something this
  // file has read, and the rule above is the whole reason this table is safe
  // to trust: a model with no rate here prices at zero and is counted in
  // `unpriced`, so the screen says "3 unpriced" instead of quietly charging
  // it at Sonnet's number. Add it when there is a published figure to add.
};

/** Published list prices as at this date. Say it; do not imply it is live. */
export const RATES_READ = 'June 2026';

/** Writing to the cache costs more than plain input. Reading costs far less. */
const CACHE_WRITE = 1.25;
const CACHE_READ = 0.1;

/**
 * What one reply cost, in dollars.
 *
 * Zero for a model with no rate here rather than a number invented from the
 * nearest one — a made-up price on a screen about money is worse than a blank.
 */
export function costOf(use: Usage, model: string): number {
  const rate = RATES[model];
  if (!rate) return 0;
  const perToken = rate.input / 1_000_000;
  return (
    use.input * perToken +
    use.cacheWrite * perToken * CACHE_WRITE +
    use.cacheRead * perToken * CACHE_READ +
    (use.output * rate.output) / 1_000_000
  );
}

/** Whether this model has a price at all, so the screen can say so. */
export function priced(model: string): boolean {
  return model in RATES;
}

export interface Spent {
  at: number;
  model: string;
  /** Which screen asked. Enough to see where the money goes, and no more. */
  from: string;
  use: Usage;
}

const KEY = 'semester.spend.v1';

/**
 * How many entries are kept.
 *
 * A term is about fifteen weeks. Somebody asking twenty questions a day for
 * all of it lands around two thousand, so this holds a term and a half and
 * then forgets the oldest — the alternative is a list that grows until the
 * store is full, which is the failure this app has already had once.
 */
const KEEP = 3000;

export function read(): Spent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw) as Spent[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    // A ledger that cannot be read is not worth breaking a screen over.
    return [];
  }
}

/** Add one reply's usage. Silent on failure — this must never fail a question. */
export function record(entry: Spent): void {
  if (entry.use.input + entry.use.output + entry.use.cacheRead + entry.use.cacheWrite === 0) return;
  try {
    const rows = [...read(), entry];
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-KEEP)));
  } catch {
    /* A full store must not swallow the answer the student just got. */
  }
}

export function forget(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

export interface Totals {
  /** How many replies. */
  asks: number;
  tokens: number;
  /** Dollars, at the rates above. */
  dollars: number;
  /** Replies whose model has no rate here, so the dollars are short by this. */
  unpriced: number;
}

export function total(rows: Spent[]): Totals {
  let tokens = 0;
  let dollars = 0;
  let unpriced = 0;
  for (const r of rows) {
    tokens += r.use.input + r.use.output + r.use.cacheRead + r.use.cacheWrite;
    dollars += costOf(r.use, r.model);
    if (!priced(r.model)) unpriced += 1;
  }
  return { asks: rows.length, tokens, dollars, unpriced };
}

/** Everything since a moment — this month, this week, this conversation. */
export function since(rows: Spent[], at: number): Spent[] {
  return rows.filter((r) => r.at >= at);
}

/** The first moment of the month `now` falls in. */
export function monthStart(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

/**
 * Money, at the scale this app deals in.
 *
 * A question costs somewhere between a twentieth of a cent and three cents,
 * and "$0.00" for all of them is a meter that tells you nothing. Under a cent
 * it counts in cents to one decimal; over a dollar it stops pretending to
 * that much precision.
 */
export function money(dollars: number): string {
  if (dollars === 0) return '0¢';
  if (dollars < 0.01) return `${(dollars * 100).toFixed(2)}¢`;
  if (dollars < 1) return `${(dollars * 100).toFixed(1)}¢`;
  return `$${dollars.toFixed(2)}`;
}

/** Tokens, at the scale a person can hold in their head. */
export function tokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/**
 * One line about a conversation, or nothing.
 *
 * Nothing when no reply reported usage — a proxy that strips the block, the
 * OpenAI route, an answer that came from the app itself with no request
 * behind it. A meter reading zero where it simply did not measure is a lie
 * that costs more than the missing number.
 */
export function line(rows: Spent[]): string {
  if (rows.length === 0) return '';
  const t = total(rows);
  const cached = rows.reduce((n, r) => n + r.use.cacheRead, 0);
  const saved = cached > 0 ? `, ${tokens(cached)} of it from cache` : '';
  return `${t.asks} ${t.asks === 1 ? 'answer' : 'answers'} · ${tokens(t.tokens)} tokens${saved} · about ${money(t.dollars)}`;
}
