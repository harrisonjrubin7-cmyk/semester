import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_MODELS,
  MAX_BODY_BYTES,
  MAX_OUTPUT_TOKENS,
  MAX_SEARCHES,
  clampRequest,
} from '../../../supabase/functions/_shared/clamp';
import { MODELS } from './assistant';
import { MOST_SEARCHES, searchTool } from './research';

/**
 * The shared key pays only for what the app itself asks for.
 *
 * `supabase/functions/claude` forwarded the caller's body unread, so any
 * signed-in account could name a model and a `max_tokens` the app never
 * sends and spend one of sixty calls on a request costing far more than the
 * app's own. `_shared/clamp.ts` rebuilds the body. These tests hold it to two
 * things at once: every request the app really sends passes through
 * unchanged, and everything else is refused or cut back.
 */

const clamp = (body: unknown) => {
  const raw = JSON.stringify(body);
  return clampRequest(raw, raw.length);
};

/** What `ask()` in `lib/claude.ts` sends with every option switched on. */
const appRequest = () => ({
  model: 'claude-opus-5',
  max_tokens: 12000,
  system: [{ type: 'text', text: 'You are a tutor.', cache_control: { type: 'ephemeral' } }],
  stream: true,
  thinking: { type: 'adaptive' },
  tools: [
    {
      name: 'find_deadlines',
      description: 'Look something up in the app',
      input_schema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
      strict: true,
    },
    searchTool('claude-opus-5'),
  ],
  output_config: { format: { type: 'json_schema', schema: { type: 'object' } } },
  messages: [{ role: 'user', content: 'Explain opportunity cost.' }],
});

describe('the shared key and the app agree on what is asked for', () => {
  it('allows exactly the models the app offers', () => {
    expect([...ALLOWED_MODELS].sort()).toEqual(MODELS.map((m) => m.id).sort());
  });

  it('allows exactly the searches the app asks for', () => {
    expect(MAX_SEARCHES).toBe(MOST_SEARCHES);
  });

  it('passes a real app request through unchanged', () => {
    const request = appRequest();
    const out = clamp(request);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(JSON.parse(out.body)).toEqual(request);
    expect(out.dropped).toEqual([]);
  });

  it('passes every model the app offers', () => {
    for (const { id } of MODELS) {
      expect(clamp({ ...appRequest(), model: id }).ok, id).toBe(true);
    }
  });
});

describe('what the shared key refuses', () => {
  it('refuses a model the app does not offer, rather than swapping one in', () => {
    const out = clamp({ ...appRequest(), model: 'claude-opus-4-1' });
    expect(out).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses a body that is not JSON, or not an object', () => {
    expect(clampRequest('{not json', 9)).toMatchObject({ ok: false, status: 400 });
    expect(clamp([1, 2])).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses a request with no messages', () => {
    expect(clamp({ ...appRequest(), messages: [] })).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses a max_tokens that is not a positive whole number', () => {
    for (const bad of [0, -1, 1.5, '100', null]) {
      expect(clamp({ ...appRequest(), max_tokens: bad }).ok, String(bad)).toBe(false);
    }
  });

  it('refuses an oversize body before reading it', () => {
    expect(clampRequest('{}', MAX_BODY_BYTES + 1)).toMatchObject({ ok: false, status: 413 });
  });
});

describe('what the shared key cuts back', () => {
  const sent = (body: unknown) => {
    const out = clamp(body);
    if (!out.ok) throw new Error(out.message);
    return { body: JSON.parse(out.body) as Record<string, unknown>, dropped: out.dropped };
  };

  it('clamps max_tokens to the ceiling', () => {
    const { body, dropped } = sent({ ...appRequest(), max_tokens: 128_000 });
    expect(body.max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(dropped).toContain(`max_tokens>${MAX_OUTPUT_TOKENS}`);
  });

  it('holds the ceiling above everything the app asks for', () => {
    expect(MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(12_000);
  });

  it('drops server tools the app never uses, and caps web search', () => {
    const { body, dropped } = sent({
      ...appRequest(),
      tools: [
        { type: 'code_execution_20260521', name: 'code_execution' },
        { type: 'web_fetch_20260209', name: 'web_fetch' },
        { type: 'mcp_toolset', mcp_server_name: 'x' },
        { type: 'web_search_20260209', name: 'web_search', max_uses: 50 },
      ],
    });
    expect(body.tools).toEqual([{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_SEARCHES }]);
    expect(dropped).toEqual(
      expect.arrayContaining(['tool:code_execution_20260521', 'tool:web_fetch_20260209', 'tool:mcp_toolset']),
    );
  });

  it('drops a fixed thinking budget and the costliest effort levels', () => {
    const { body } = sent({
      ...appRequest(),
      thinking: { type: 'enabled', budget_tokens: 100_000 },
      output_config: { effort: 'max', task_budget: { type: 'tokens', total: 500_000 } },
    });
    expect(body.thinking).toBeUndefined();
    expect(body.output_config).toBeUndefined();
  });

  it('drops top-level fields the app never sends', () => {
    const { body, dropped } = sent({
      ...appRequest(),
      mcp_servers: [{ type: 'url', url: 'https://example.com', name: 'x' }],
      container: { skills: [] },
      service_tier: 'priority',
      speed: 'fast',
      fallbacks: 'default',
    });
    for (const k of ['mcp_servers', 'container', 'service_tier', 'speed', 'fallbacks']) {
      expect(body[k], k).toBeUndefined();
      expect(dropped, k).toContain(k);
    }
  });
});

describe('the function uses the clamp, and before the meter', () => {
  const fn = readFileSync(new URL('../../../supabase/functions/claude/index.ts', import.meta.url), 'utf8');
  const code = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('clamps the body', () => {
    expect(code).toMatch(/clampRequest\(/);
  });

  it('clamps before counting, so a refused request costs no call', () => {
    expect(code.indexOf('clampRequest(')).toBeGreaterThan(-1);
    expect(code.indexOf('clampRequest(')).toBeLessThan(code.indexOf("rpc('count_call'"));
  });

  it('forwards only the clamped body', () => {
    expect(code).toMatch(/const body = clamped\.body;/);
    expect(code.match(/req\.text\(\)/g) ?? []).toHaveLength(1);
  });
});
