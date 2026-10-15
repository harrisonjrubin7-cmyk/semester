/**
 * What a shared-key call costs, in dollars, so the monthly allowance can be
 * one too.
 *
 * `functions/claude` caps an account at sixty calls a month. The bill is by
 * the token, and the models differ by a factor of ten: sixty calls is about
 * $2.40 on Sonnet at the app's usual size and about $8.40 on Opus 5.5 at the
 * premium one (`docs/commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md` §1).
 * `PLAN_MODELS` in `clamp.ts` bounds which models a plan may name; this bounds
 * what a plan may *spend*, which is the quantity the owner is actually
 * exposed to. The call count stays as a backstop.
 *
 * Money is kept in **micro-dollars** (1 000 000 = $1) in a `bigint` column,
 * because summing floats is how a cap drifts. Anthropic prices per million
 * tokens, so a rate of $N/MTok is exactly N micro-dollars per token and no
 * rounding enters until the very end.
 *
 * ## Reserve, then settle
 *
 * The cost of a call is not known until it finishes, and a student can
 * disconnect before it does. So the worst case is **reserved** before the
 * call is forwarded (counted input + the full `max_tokens` + every search the
 * request may run) and the difference is **settled** when the stream ends.
 * An abandoned stream therefore costs the reservation, never nothing — the
 * same reason `count_call` runs before the fetch.
 *
 * ## Decisions that are not this file's to make
 *
 * - **The allowances** are proposals (`PLAN_ALLOWANCE_MICROS`), overridable
 *   per deployment, and disagree with the finance model's 8/40 "tasks". The
 *   owner chooses; the rule they were sized by is "worst-case contribution
 *   margin of at least 40%" at the plan's price.
 * - **The rate card** is the published price list at the time of writing and
 *   is a constant here. Cache-write and web-search figures are marked
 *   `verify`: they are conservative estimates, not read from an invoice.
 *
 * Pure, and free of Deno APIs, so the app's test suite imports it the way it
 * imports `clamp.ts`. Anything that fetches takes `fetch` as a parameter.
 */
import type { SharedPlan } from './clamp.ts';

/** Micro-dollars per token, which is the same number as dollars per million. */
export interface Rate {
  input: number;
  output: number;
}

/** Keyed by the model names `ALLOWED_MODELS` lists; `aispend.test.ts` holds them together. */
export const RATE_CARD: Readonly<Record<string, Rate>> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-fable-5-1': { input: 10, output: 50 },
};

/** Cache reads bill at a tenth of input. */
export const CACHE_READ_FACTOR = 0.1;
/** verify: the 5-minute write premium; the hour tier is dearer and is not offered. */
export const CACHE_WRITE_FACTOR = 1.25;
/** verify: $10 per thousand searches. */
export const SEARCH_MICROS = 10_000;

/**
 * Unknown models are priced as the dearest one, never as free: a rate card
 * that has fallen behind the model list must overcharge the meter, not leave a
 * model unmetered.
 */
const DEAREST: Rate = { input: 10, output: 50 };

export const rateFor = (model: string): Rate => RATE_CARD[model] ?? DEAREST;

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  searches: number;
}

export const emptyUsage = (): Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  searches: 0,
});

/** What a finished call cost, rounded up to a whole micro-dollar. */
export function costMicros(u: Usage, model: string): number {
  const r = rateFor(model);
  return Math.ceil(
    u.inputTokens * r.input +
      u.cacheReadTokens * r.input * CACHE_READ_FACTOR +
      u.cacheWriteTokens * r.input * CACHE_WRITE_FACTOR +
      u.outputTokens * r.output +
      u.searches * SEARCH_MICROS,
  );
}

export interface ReserveInput {
  model: string;
  inputTokens: number;
  maxTokens: number;
  searches: number;
  /** The request asks for prompt caching, so its input may bill at the write premium. */
  cacheable: boolean;
}

/**
 * The most a call could cost. Thinking tokens bill as output and count toward
 * `max_tokens`, so the ceiling covers them; `actual <= reserve` for any usage
 * the request can produce, and `aispend.test.ts` holds that as a property.
 */
export function reserveMicros(i: ReserveInput): number {
  const r = rateFor(i.model);
  const inFactor = i.cacheable ? CACHE_WRITE_FACTOR : 1;
  return Math.ceil(i.inputTokens * r.input * inFactor + i.maxTokens * r.output + i.searches * SEARCH_MICROS);
}

/** What a clamped request body is going to be priced on. */
export function describeRequest(body: string, bytes: number): Omit<ReserveInput, 'inputTokens'> & { estimateTokens: number } {
  const parsed = JSON.parse(body) as { model?: unknown; max_tokens?: unknown; tools?: unknown };
  const tools = Array.isArray(parsed.tools) ? (parsed.tools as { type?: unknown; max_uses?: unknown }[]) : [];
  let searches = 0;
  for (const t of tools) {
    if (typeof t?.type === 'string' && t.type.startsWith('web_search')) {
      searches += typeof t.max_uses === 'number' ? t.max_uses : 5;
    }
  }
  return {
    model: String(parsed.model),
    maxTokens: typeof parsed.max_tokens === 'number' ? parsed.max_tokens : 0,
    searches,
    cacheable: body.includes('"cache_control"'),
    // Characters per token runs near four in prose and lower in code, so a
    // third errs on the side of reserving too much, which settling gives back.
    estimateTokens: Math.ceil(bytes / 3),
  };
}

/**
 * Input tokens for a clamped body, from Anthropic's own counter, falling back
 * to the byte estimate when it cannot be reached. Never throws: a counter that
 * is down must not take the shared key down with it, and the estimate
 * over-reserves rather than under.
 */
export async function countInputTokens(
  body: string,
  estimate: number,
  call: (input: string, init: RequestInit) => Promise<Response>,
  key: string,
  timeoutMs = 3000,
): Promise<number> {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    // The counter takes the fields that make up the prompt, not the sampling knobs.
    const { model, system, messages, tools, thinking } = parsed;
    const res = await call('https://api.anthropic.com/v1/messages/count_tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, system, messages, tools, thinking }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return estimate;
    const n = ((await res.json()) as { input_tokens?: unknown }).input_tokens;
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : estimate;
  } catch {
    return estimate;
  }
}

/**
 * Reads token usage out of a response as it streams past, without holding or
 * altering it. Feed it every chunk; read `usage` at the end.
 *
 * Server-sent events carry `message_start` (input and cache tokens, and a
 * first output count) and `message_delta` (cumulative output tokens, and
 * `server_tool_use` search counts). Chunk boundaries fall anywhere, so it
 * buffers by line.
 */
export class UsageScanner {
  usage: Usage = emptyUsage();
  /**
   * True once the closing `message_delta` has been read. A stream that never
   * got there (cut off, or errored mid-way) is priced at its reserve: its
   * output count is only a first reading.
   */
  seen = false;
  private tail = '';
  private readonly decoder = new TextDecoder();

  push(chunk: Uint8Array): void {
    this.tail += this.decoder.decode(chunk, { stream: true });
    const lines = this.tail.split('\n');
    this.tail = lines.pop() ?? '';
    for (const line of lines) this.line(line);
  }

  end(): void {
    this.tail += this.decoder.decode();
    if (this.tail) this.line(this.tail);
    this.tail = '';
  }

  private line(line: string): void {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      this.event(JSON.parse(data));
    } catch {
      /* a line that is not JSON is not usage */
    }
  }

  private event(e: unknown): void {
    if (typeof e !== 'object' || e === null) return;
    const ev = e as { type?: unknown; message?: { usage?: unknown }; usage?: unknown };
    if (ev.type === 'message_start') this.take(ev.message?.usage);
    else if (ev.type === 'message_delta') {
      this.take(ev.usage);
      this.seen = true;
    }
  }

  take(u: unknown): void {
    if (typeof u !== 'object' || u === null) return;
    const x = u as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
    // Cumulative fields: later values replace earlier ones; absent ones leave them.
    this.usage.inputTokens = n(x.input_tokens) ?? this.usage.inputTokens;
    this.usage.outputTokens = n(x.output_tokens) ?? this.usage.outputTokens;
    this.usage.cacheReadTokens = n(x.cache_read_input_tokens) ?? this.usage.cacheReadTokens;
    this.usage.cacheWriteTokens = n(x.cache_creation_input_tokens) ?? this.usage.cacheWriteTokens;
    const st = x.server_tool_use as { web_search_requests?: unknown } | undefined;
    this.usage.searches = n(st?.web_search_requests) ?? this.usage.searches;
  }
}

/** Usage out of a non-streaming JSON response body. */
export function usageFromJson(text: string): Usage | null {
  try {
    const u = (JSON.parse(text) as { usage?: unknown }).usage;
    if (typeof u !== 'object' || u === null) return null;
    const s = new UsageScanner();
    s.take(u);
    return s.usage;
  } catch {
    return null;
  }
}

/**
 * Monthly shared-key spend per plan, in micro-dollars. **Proposals.** Sized so
 * that the worst case a plan can spend leaves at least 40% contribution at its
 * price (Free is a cost of acquisition, bounded instead). Override per
 * deployment with `AI_ALLOWANCE_MICROS_FREE|PLUS|PRO`; a value that is not a
 * non-negative integer is ignored rather than trusted.
 */
export const PLAN_ALLOWANCE_MICROS: Record<SharedPlan, number> = {
  free: 750_000,
  plus: 2_000_000,
  pro: 4_000_000,
};

export function allowanceFor(plan: SharedPlan, env: (name: string) => string | undefined = () => undefined): number {
  const raw = env(`AI_ALLOWANCE_MICROS_${plan.toUpperCase()}`);
  const n = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);
  return Number.isSafeInteger(n) && n >= 0 ? n : PLAN_ALLOWANCE_MICROS[plan];
}

/** `error.code` of a refusal because the month's dollar allowance is spent. */
export const ALLOWANCE_EXHAUSTED = 'ai_allowance_exhausted';

/**
 * Appears in the refusal's message so a client that only sees text can tell an
 * exhausted allowance from rate limiting, which the app answers with "wait a
 * moment". Same device as `NOT_ACTIVATED_MARK`.
 */
export const ALLOWANCE_MARK = 'shared AI allowance';

export const ALLOWANCE_MESSAGE =
  `You have used this month's ${ALLOWANCE_MARK} for your plan. ` +
  `Add your own key under Ask Claude → Settings to carry on — it bypasses this limit — or it renews next month.`;
