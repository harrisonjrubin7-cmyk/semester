import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CASES, grade, scoreRun, type Built, type Outcome } from '../lib/governance/model-quality';

/**
 * The model-quality evaluation set, against a real model: the one scorecard
 * dimension public documentation cannot answer (`lib/governance/ai-playbook.ts`).
 *
 *     ANTHROPIC_API_KEY=sk-ant-… EVAL_MODEL=claude-opus-5 npx vitest run src/ai/modelquality.live.test.ts
 *     EVAL_PROVIDER=openai OPENAI_API_KEY=sk-… EVAL_MODEL=<model id> npx vitest run src/ai/modelquality.live.test.ts
 *
 * Or through the shared key's own proxy, as the injection red-team does, so
 * no raw key is needed and the clamp applies as it does to a student:
 *
 *     EVAL_PROXY=https://<ref>.supabase.co/functions/v1/claude EVAL_TOKEN=<access token> \
 *       EVAL_APIKEY=sb_publishable_… npx vitest run src/ai/modelquality.live.test.ts
 *
 * Add `EVAL=write` to file the run under `docs/evidence/ai/`, one file per
 * run, never over an earlier one. The filed score is what the scorecard's
 * model-quality row may cite; nothing else is.
 *
 * Without a key every case is skipped and reported as skipped, never as
 * passed. A case that fails is a finding, not a flake: each reply is printed
 * with the checks it failed.
 */

const PROVIDER = process.env.EVAL_PROVIDER === 'openai' ? 'openai' : 'anthropic';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? '';
const PROXY = process.env.EVAL_PROXY ?? '';
const TOKEN = process.env.EVAL_TOKEN ?? '';
const APIKEY = process.env.EVAL_APIKEY ?? '';
/** OpenAI has no default here: a model id this file guessed would be a score for the wrong model. */
const MODEL = process.env.EVAL_MODEL ?? (PROVIDER === 'anthropic' ? 'claude-opus-5' : '');
const ROUTE = PROVIDER === 'openai' ? 'openai' : PROXY && TOKEN ? 'shared-key proxy' : 'anthropic';
const LIVE = PROVIDER === 'openai' ? Boolean(OPENAI_KEY && MODEL) : Boolean(ANTHROPIC_KEY) || Boolean(PROXY && TOKEN);

type Route = 'anthropic' | 'shared-key proxy' | 'openai';
type Secrets = { anthropic: string; openai: string; proxy: string; token: string; apikey: string };

/** Where a request goes and what it carries, by route. Pure, so the key-free half can hold it. */
export function request(route: Route, built: Built, model: string, s: Secrets): { url: string; headers: Record<string, string>; body: string } {
  if (route === 'openai') {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${s.openai}` },
      body: JSON.stringify({ model, max_completion_tokens: 3000, messages: [{ role: 'system', content: built.system }, ...built.messages] }),
    };
  }
  const body = JSON.stringify({ model, max_tokens: 3000, system: built.system, messages: built.messages });
  return route === 'shared-key proxy'
    ? { url: s.proxy, headers: { 'content-type': 'application/json', authorization: `Bearer ${s.token}`, apikey: s.apikey }, body }
    : { url: 'https://api.anthropic.com/v1/messages', headers: { 'content-type': 'application/json', 'x-api-key': s.anthropic, 'anthropic-version': '2023-06-01' }, body };
}

async function answer(built: Built): Promise<string> {
  const sent = request(ROUTE, built, MODEL, { anthropic: ANTHROPIC_KEY, openai: OPENAI_KEY, proxy: PROXY, token: TOKEN, apikey: APIKEY });
  const res = await fetch(sent.url, { method: 'POST', headers: sent.headers, body: sent.body });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  if (ROUTE === 'openai') {
    const body = (await res.json()) as { choices: { message: { content: string | null } }[] };
    return body.choices[0]?.message.content ?? '';
  }
  const body = (await res.json()) as { content: { type: string; text?: string }[] };
  return body.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
}

const run: (Outcome & { failed: readonly string[]; reply: string })[] = [];

describe.skipIf(!LIVE)('the model-quality set, against the model', () => {
  for (const c of CASES) {
    it(
      `${c.id} ${c.name}`,
      async () => {
        const reply = await answer(c.build());
        const g = grade(c, reply);
        run.push({ id: c.id, passed: g.passed, failed: g.failed, reply });
        console.log(`\n[${g.passed ? 'pass' : `FAIL: ${g.failed.join('; ')}`}] ${c.id} ${c.name}\n${reply.replace(/^/gm, '  │ ')}\n`);
        expect(g.failed, `${c.id} failed`).toEqual([]);
      },
      120_000,
    );
  }

  it('scores the run, and files it when asked to', () => {
    const scored = scoreRun(run);
    console.log(`\nmodel quality: ${scored.score}/5 · ${(scored.rate * 100).toFixed(0)}% passed · critical failed: ${scored.criticalFailed.join(', ') || 'none'}\n`);
    if (process.env.EVAL !== 'write') return;
    const dir = join(process.cwd(), '..', 'docs', 'evidence', 'ai');
    mkdirSync(dir, { recursive: true });
    const at = new Date().toISOString();
    const file = join(dir, `model-quality-${at.replace(/[:.]/g, '-')}-${ROUTE.replace(/\s+/g, '-')}-${MODEL}.json`);
    if (existsSync(file)) throw new Error(`${file} already exists; a run is never overwritten`);
    writeFileSync(file, `${JSON.stringify({ at, provider: PROVIDER, route: ROUTE, model: MODEL, ...scored, cases: run }, null, 2)}\n`);
    expect(existsSync(file)).toBe(true);
  });
});

describe('the three routes, without a key', () => {
  const built = CASES[0].build();
  const s: Secrets = { anthropic: 'sk-ant-test', openai: 'sk-test', proxy: 'https://ref.supabase.co/functions/v1/claude', token: 'jwt', apikey: 'sb_publishable_x' };

  it('sends the same body to Anthropic either way, and only the proxy route carries a session', () => {
    const direct = request('anthropic', built, 'm', s);
    const proxy = request('shared-key proxy', built, 'm', s);
    expect(proxy.body).toBe(direct.body);
    expect(direct.headers['x-api-key']).toBe('sk-ant-test');
    expect(proxy.headers['x-api-key']).toBeUndefined();
    expect(proxy.headers.authorization).toBe('Bearer jwt');
  });

  it('sends OpenAI the same system prompt and messages, with only the OpenAI key', () => {
    const o = request('openai', built, 'm', s);
    const body = JSON.parse(o.body) as { messages: { role: string; content: string }[] };
    expect(o.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(o.headers.authorization).toBe('Bearer sk-test');
    expect(o.body).not.toContain('sk-ant-test');
    expect(body.messages[0]).toEqual({ role: 'system', content: built.system });
    expect(body.messages.slice(1)).toEqual(built.messages);
  });

  it('has no OpenAI model to guess at', () => {
    expect(process.env.EVAL_MODEL || PROVIDER !== 'openai' || MODEL === '').toBeTruthy();
  });
});
