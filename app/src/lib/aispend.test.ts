import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALLOWED_MODELS, PLAN_MODELS } from '../../../supabase/functions/_shared/clamp';
import { ALLOWANCE_MARK as CLIENT_MARK, explainAskError } from './claude';
import {
  ALLOWANCE_MARK,
  ALLOWANCE_MESSAGE,
  PLAN_ALLOWANCE_MICROS,
  RATE_CARD,
  UsageScanner,
  allowanceFor,
  costMicros,
  countInputTokens,
  describeRequest,
  emptyUsage,
  rateFor,
  reserveMicros,
  usageFromJson,
} from '../../../supabase/functions/_shared/aispend';

/**
 * What a shared-key call costs, and what a plan may spend.
 *
 * The figures in the cost tests are the ones in
 * `docs/commercial/unit-economics-model.py`, so the doc and the meter cannot
 * quietly price the same call differently.
 */

const usage = (inputTokens: number, outputTokens: number, extra: Partial<ReturnType<typeof emptyUsage>> = {}) => ({
  ...emptyUsage(),
  inputTokens,
  outputTokens,
  ...extra,
});

describe('the rate card', () => {
  it('prices every model the shared key will serve, so none is metered at a guess', () => {
    for (const m of ALLOWED_MODELS) expect(RATE_CARD[m], m).toBeDefined();
    for (const plan of Object.values(PLAN_MODELS)) for (const m of plan) expect(RATE_CARD[m], m).toBeDefined();
  });

  it('prices a model it does not know as the dearest, never as free', () => {
    const dearest = Math.max(...Object.values(RATE_CARD).map((r) => r.output));
    expect(rateFor('claude-future-9').output).toBeGreaterThanOrEqual(dearest);
    expect(costMicros(usage(1000, 1000), 'claude-future-9')).toBeGreaterThan(0);
  });
});

describe('what a finished call costs, in micro-dollars', () => {
  it.each([
    ['a standard Sonnet call, 10k in and 2k out', 'claude-sonnet-5', 10_000, 2_000, 40_000],
    ['a heavy Sonnet call, 30k in and 4k out', 'claude-sonnet-5', 30_000, 4_000, 100_000],
    ['an Opus 5 call, 10k in and 3k out', 'claude-opus-5', 10_000, 3_000, 125_000],
    ['a Fable 5.1 call at the output ceiling', 'claude-fable-5-1', 30_000, 16_000, 1_100_000],
    ['a Haiku call, 10k in and 2k out', 'claude-haiku-4-5', 10_000, 2_000, 20_000],
  ])('%s', (_, model, input, output, micros) => {
    expect(costMicros(usage(input, output), model)).toBe(micros);
  });

  it('bills cache reads at a tenth, cache writes at the premium, and each search', () => {
    expect(costMicros(usage(0, 0, { cacheReadTokens: 10_000 }), 'claude-sonnet-5')).toBe(2_000);
    expect(costMicros(usage(0, 0, { cacheWriteTokens: 10_000 }), 'claude-sonnet-5')).toBe(25_000);
    expect(costMicros(usage(0, 0, { searches: 3 }), 'claude-sonnet-5')).toBe(30_000);
  });
});

describe('the reservation is never less than the call can cost', () => {
  const body = (extra: object = {}) =>
    JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 4000, messages: [], ...extra });

  it('covers input, the whole output ceiling and every search the request may run', () => {
    const d = describeRequest(body({ tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }] }), 1000);
    expect(d.searches).toBe(5);
    expect(d.maxTokens).toBe(4000);
    const reserve = reserveMicros({ ...d, inputTokens: 10_000 });
    expect(reserve).toBe(10_000 * 2 + 4000 * 10 + 5 * 10_000);
  });

  it('holds as a property: any usage within the request’s own limits costs no more than its reserve', () => {
    for (const model of Object.keys(RATE_CARD)) {
      for (const input of [0, 1, 999, 50_000]) {
        for (const max of [1, 4000, 16_000]) {
          for (const searches of [0, 5]) {
            for (const cacheable of [false, true]) {
              const reserve = reserveMicros({ model, inputTokens: input, maxTokens: max, searches, cacheable });
              // Worst case actual: every input token billed at the dearest input tier it can be.
              const actual = costMicros(
                usage(cacheable ? 0 : input, max, { cacheWriteTokens: cacheable ? input : 0, searches }),
                model,
              );
              expect(actual).toBeLessThanOrEqual(reserve);
            }
          }
        }
      }
    }
  });

  it('prices a request that names cache_control at the write premium', () => {
    expect(describeRequest(body({ system: [{ type: 'text', text: 'x', cache_control: { type: 'ephemeral' } }] }), 10).cacheable).toBe(true);
    expect(describeRequest(body(), 10).cacheable).toBe(false);
  });

  it('estimates tokens from bytes at a third, which over-reserves rather than under', () => {
    expect(describeRequest(body(), 3000).estimateTokens).toBe(1000);
  });
});

describe('reading usage out of a stream', () => {
  const sse = (events: object[]) => events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const stream = sse([
    { type: 'message_start', message: { usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 300 } } },
    { type: 'content_block_delta', delta: { text: 'hello' } },
    { type: 'message_delta', usage: { output_tokens: 450, server_tool_use: { web_search_requests: 2 } } },
    { type: 'message_stop' },
  ]);
  const bytes = new TextEncoder().encode(stream);

  const scan = (chunks: Uint8Array[]) => {
    const s = new UsageScanner();
    for (const c of chunks) s.push(c);
    s.end();
    return s;
  };

  it('reads input, cache, output and searches, the last output count winning', () => {
    const s = scan([bytes]);
    expect(s.usage).toMatchObject({ inputTokens: 1200, cacheReadTokens: 300, outputTokens: 450, searches: 2 });
    expect(s.seen).toBe(true);
  });

  it('gives the same answer wherever the chunk boundaries fall, including inside a multi-byte character', () => {
    const want = scan([bytes]).usage;
    for (let cut = 1; cut < bytes.length; cut += 7) {
      expect(scan([bytes.slice(0, cut), bytes.slice(cut)]).usage, `cut at ${cut}`).toEqual(want);
    }
    const accented = new TextEncoder().encode(sse([{ type: 'content_block_delta', delta: { text: 'café ✓' } }]) + stream);
    for (let cut = 1; cut < accented.length; cut += 3) {
      expect(scan([accented.slice(0, cut), accented.slice(cut)]).usage.outputTokens, `cut at ${cut}`).toBe(450);
    }
  });

  it('does not call a stream settled until the closing message_delta has arrived', () => {
    const cut = scan([new TextEncoder().encode(sse([{ type: 'message_start', message: { usage: { input_tokens: 5, output_tokens: 1 } } }]))]);
    expect(cut.seen).toBe(false);
  });

  it('ignores lines that are not JSON, and a body with no usage', () => {
    expect(scan([new TextEncoder().encode('data: not json\n\ndata: [DONE]\n\n: ping\n\n')]).seen).toBe(false);
    expect(usageFromJson('{"content":[]}')).toBeNull();
    expect(usageFromJson('nope')).toBeNull();
  });

  it('reads a non-streaming response', () => {
    expect(usageFromJson(JSON.stringify({ usage: { input_tokens: 10, output_tokens: 20 } }))).toMatchObject({
      inputTokens: 10,
      outputTokens: 20,
    });
  });

  it('refuses nonsense counts rather than pricing them', () => {
    const s = scan([new TextEncoder().encode(sse([{ type: 'message_delta', usage: { output_tokens: -5 } }]))]);
    expect(s.usage.outputTokens).toBe(0);
  });
});

describe('counting input tokens', () => {
  const ok = (n: unknown) => async () => new Response(JSON.stringify({ input_tokens: n }), { status: 200 });
  const body = JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }], temperature: 1 });

  it('uses the counter’s answer when it gives one', async () => {
    expect(await countInputTokens(body, 999, ok(42), 'k')).toBe(42);
  });

  it('sends the prompt fields and not the sampling knobs', async () => {
    let sent: Record<string, unknown> = {};
    await countInputTokens(body, 1, async (_u, init) => {
      sent = JSON.parse(String(init.body));
      return new Response('{"input_tokens":1}');
    }, 'k');
    expect(Object.keys(sent)).not.toContain('max_tokens');
    expect(Object.keys(sent)).not.toContain('temperature');
    expect(sent.model).toBe('claude-sonnet-5');
  });

  it.each([
    ['an error status', async () => new Response('{}', { status: 500 })],
    ['a body with no count', ok(undefined)],
    ['a negative count', ok(-1)],
    ['a network failure', async () => { throw new Error('down'); }],
  ])('falls back to the estimate on %s, and never throws', async (_, call) => {
    expect(await countInputTokens(body, 777, call as never, 'k')).toBe(777);
  });
});

describe('the allowances', () => {
  it('widen with the plan', () => {
    expect(PLAN_ALLOWANCE_MICROS.free).toBeLessThan(PLAN_ALLOWANCE_MICROS.plus);
    expect(PLAN_ALLOWANCE_MICROS.plus).toBeLessThan(PLAN_ALLOWANCE_MICROS.pro);
  });

  it('are overridable per deployment, and a bad override is ignored rather than trusted', () => {
    expect(allowanceFor('plus', (n) => (n === 'AI_ALLOWANCE_MICROS_PLUS' ? '3000000' : undefined))).toBe(3_000_000);
    for (const bad of ['', ' ', 'abc', '-1', '1.5', 'Infinity', '1e999']) {
      expect(allowanceFor('plus', () => bad), bad).toBe(PLAN_ALLOWANCE_MICROS.plus);
    }
    expect(allowanceFor('free', () => undefined)).toBe(PLAN_ALLOWANCE_MICROS.free);
  });

  it('leave room for one ordinary call on every plan, so the cap is not a wall on the first request', () => {
    // A Sonnet call at the app's usual size, reserved at the output ceiling.
    const reserve = reserveMicros({ model: 'claude-sonnet-5', inputTokens: 30_000, maxTokens: 16_000, searches: 5, cacheable: false });
    for (const plan of Object.keys(PLAN_ALLOWANCE_MICROS) as (keyof typeof PLAN_ALLOWANCE_MICROS)[]) {
      expect(PLAN_ALLOWANCE_MICROS[plan], plan).toBeGreaterThan(reserve);
    }
  });

  it('words the refusal so the client can tell it from rate limiting', () => {
    expect(ALLOWANCE_MESSAGE).toContain(ALLOWANCE_MARK);
    expect(CLIENT_MARK).toBe(ALLOWANCE_MARK);
  });

  it('is shown to the student as it was written, not as "wait a moment", while a real 429 still is', () => {
    expect(explainAskError('shared', 429, ALLOWANCE_MESSAGE)).toBe(ALLOWANCE_MESSAGE);
    expect(explainAskError('shared', 429, 'Too many requests')).toContain('wait a moment');
  });
});

describe('where the meter sits in the handler', () => {
  const src = readFileSync(new URL('../../../supabase/functions/claude/index.ts', import.meta.url), 'utf8');
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    expect(i, needle).toBeGreaterThan(-1);
    return i;
  };

  it('reserves after the clamp and before the call is counted or forwarded', () => {
    expect(at('clampRequest(')).toBeLessThan(at("spend(reserve, allowance)"));
    expect(at("spend(reserve, allowance)")).toBeLessThan(at("rpc('count_call'"));
    expect(at("rpc('count_call'")).toBeLessThan(at('await fetch(upstreamTo.url'));
  });

  it('gives the reservation back when the call counter or the call cap refuses, and when upstream refuses', () => {
    expect(src).toMatch(/release\(reserve, 'meter'\)/);
    expect(src).toMatch(/release\(reserve, 'call cap'\)/);
    expect(src).toMatch(/release\(reserve, `upstream/);
  });

  it('does not give it back when the fetch throws: nobody can say whether the request arrived', () => {
    const catchBlock = src.slice(at('the call to Anthropic threw'), at('the call to Anthropic threw') + 700);
    expect(catchBlock).not.toMatch(/release\(/);
  });
});
