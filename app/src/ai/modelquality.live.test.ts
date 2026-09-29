import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ToolSpec } from '../lib/claude';
import { CASES, LOOKUP_ANSWER, MOST_ROUNDS, grade, isLookup, proposed, scoreRun, type Built, type Outcome } from '../lib/governance/model-quality';

/**
 * The model-quality evaluation set, against a real model: the one scorecard
 * dimension public documentation cannot answer (`lib/governance/ai-playbook.ts`).
 *
 *     ANTHROPIC_API_KEY=sk-ant-… EVAL_MODEL=claude-opus-5 npm run eval:model-quality
 *     EVAL_PROVIDER=openai OPENAI_API_KEY=sk-… EVAL_MODEL=<model id> npm run eval:model-quality
 *
 * Or through the shared key's own proxy, as the injection red-team does, so
 * no raw key is needed and the clamp applies as it does to a student:
 *
 *     EVAL_PROXY=https://<ref>.supabase.co/functions/v1/claude EVAL_TOKEN=<access token> \
 *       EVAL_APIKEY=sb_publishable_… npm run eval:model-quality
 *
 * Add `EVAL=write` to file the run under `docs/evidence/ai/`, one file per
 * run, never over an earlier one. The filed score is what the scorecard's
 * model-quality row may cite; nothing else is.
 *
 * ## The conversation it has
 *
 * The one the app has (`ai/converse.ts`): the tools the app offers in that
 * mode, a proposal written into the reply as the button it would be, and
 * lookups answered and sent back for up to `MOST_ROUNDS` rounds, after which
 * only proposals are offered. The synthetic student has nothing on record
 * beyond what is on screen, so every lookup returns `LOOKUP_ANSWER`.
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
const ROUTE: Route = PROVIDER === 'openai' ? 'openai' : PROXY && TOKEN ? 'shared-key proxy' : 'anthropic';
const LIVE = PROVIDER === 'openai' ? Boolean(OPENAI_KEY && MODEL) : Boolean(ANTHROPIC_KEY) || Boolean(PROXY && TOKEN);

type Route = 'anthropic' | 'shared-key proxy' | 'openai';
type Secrets = { anthropic: string; openai: string; proxy: string; token: string; apikey: string };

/** The tools for one round: all of them, or proposals only once the lookup rounds are spent — as the app does. */
export const toolsForRound = (tools: readonly ToolSpec[] | undefined, round: number): ToolSpec[] =>
  (tools ?? []).filter((t) => round < MOST_ROUNDS || !isLookup(t.name));

/** Where one round goes and what it carries, by route. Pure, so the key-free half can hold it. */
export function request(route: Route, system: string, messages: unknown[], tools: readonly ToolSpec[], model: string, s: Secrets): { url: string; headers: Record<string, string>; body: string } {
  if (route === 'openai') {
    const fns = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${s.openai}` },
      body: JSON.stringify({ model, max_completion_tokens: 3000, messages: [{ role: 'system', content: system }, ...messages], ...(fns.length ? { tools: fns } : {}) }),
    };
  }
  const body = JSON.stringify({ model, max_tokens: 3000, system, messages, ...(tools.length ? { tools } : {}) });
  return route === 'shared-key proxy'
    ? { url: s.proxy, headers: { 'content-type': 'application/json', authorization: `Bearer ${s.token}`, apikey: s.apikey }, body }
    : { url: 'https://api.anthropic.com/v1/messages', headers: { 'content-type': 'application/json', 'x-api-key': s.anthropic, 'anthropic-version': '2023-06-01' }, body };
}

type Call = { id: string; name: string; input: unknown };
type Turn = { text: string; calls: Call[]; raw: unknown };

/** One round's reply, read into text and tool calls. Pure, so the key-free half can hold it. */
export function readTurn(route: Route, body: unknown): Turn {
  if (route === 'openai') {
    const m = (body as { choices: { message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] }).choices[0]?.message;
    const calls = (m?.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, input: safeJson(c.function.arguments) }));
    return { text: m?.content ?? '', calls, raw: m };
  }
  const content = (body as { content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[] }).content;
  return {
    text: content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
    calls: content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id ?? '', name: b.name ?? '', input: b.input })),
    raw: content,
  };
}

const safeJson = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

/** The messages that answer a round's lookups, in the route's own shape. */
export function answerLookups(route: Route, turn: Turn, lookups: Call[]): unknown[] {
  if (route === 'openai') {
    return [turn.raw, ...lookups.map((c) => ({ role: 'tool', tool_call_id: c.id, content: LOOKUP_ANSWER }))];
  }
  return [
    { role: 'assistant', content: turn.raw },
    { role: 'user', content: lookups.map((c) => ({ type: 'tool_result', tool_use_id: c.id, content: LOOKUP_ANSWER })) },
  ];
}

async function answer(built: Built): Promise<string> {
  const secrets = { anthropic: ANTHROPIC_KEY, openai: OPENAI_KEY, proxy: PROXY, token: TOKEN, apikey: APIKEY };
  let messages: unknown[] = [...built.messages];
  const said: string[] = [];
  for (let round = 0; round <= MOST_ROUNDS; round++) {
    const sent = request(ROUTE, built.system, messages, toolsForRound(built.tools, round), MODEL, secrets);
    const res = await fetch(sent.url, { method: 'POST', headers: sent.headers, body: sent.body });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
    const turn = readTurn(ROUTE, await res.json());
    if (turn.text.trim()) said.push(turn.text);
    for (const c of turn.calls.filter((c) => !isLookup(c.name))) said.push(proposed(c.name, c.input));
    const lookups = turn.calls.filter((c) => isLookup(c.name));
    if (lookups.length === 0) break;
    messages = [...messages, ...answerLookups(ROUTE, turn, lookups)];
  }
  return said.join('\n\n');
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
      240_000,
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

describe('the conversation it has, without a key', () => {
  const grounded = (CASES.find((c) => c.build().tools?.some((t) => isLookup(t.name))) ?? CASES[0]).build();
  const s: Secrets = { anthropic: 'sk-ant-test', openai: 'sk-test', proxy: 'https://ref.supabase.co/functions/v1/claude', token: 'jwt', apikey: 'sb_publishable_x' };

  it('sends the app’s own tools, lookups included, until the rounds are spent', () => {
    const first = toolsForRound(grounded.tools, 0);
    expect(first.some((t) => isLookup(t.name))).toBe(true);
    expect(first.some((t) => !isLookup(t.name))).toBe(true);
    const last = toolsForRound(grounded.tools, MOST_ROUNDS);
    expect(last.length).toBeGreaterThan(0);
    expect(last.some((t) => isLookup(t.name))).toBe(false);
    expect(JSON.parse(request('anthropic', grounded.system, grounded.messages, first, 'm', s).body).tools).toHaveLength(first.length);
  });

  it('sends the same body to Anthropic either way, and only the proxy route carries a session', () => {
    const tools = toolsForRound(grounded.tools, 0);
    const direct = request('anthropic', grounded.system, grounded.messages, tools, 'm', s);
    const proxy = request('shared-key proxy', grounded.system, grounded.messages, tools, 'm', s);
    expect(proxy.body).toBe(direct.body);
    expect(direct.headers['x-api-key']).toBe('sk-ant-test');
    expect(proxy.headers['x-api-key']).toBeUndefined();
    expect(proxy.headers.authorization).toBe('Bearer jwt');
  });

  it('sends OpenAI the same prompt and the same tools as functions, with only the OpenAI key', () => {
    const tools = toolsForRound(grounded.tools, 0);
    const o = request('openai', grounded.system, grounded.messages, tools, 'm', s);
    const body = JSON.parse(o.body) as { messages: { role: string; content: string }[]; tools: { type: string; function: { name: string; parameters: unknown } }[] };
    expect(o.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(o.body).not.toContain('sk-ant-test');
    expect(body.messages[0]).toEqual({ role: 'system', content: grounded.system });
    expect(body.tools.map((t) => t.function.name)).toEqual(tools.map((t) => t.name));
    expect(body.tools[0].function.parameters).toEqual(tools[0].input_schema);
  });

  it('writes a proposal into the reply as a button, and answers a lookup in the route’s own shape', () => {
    const look = toolsForRound(grounded.tools, 0).find((t) => isLookup(t.name))!.name;
    const act = toolsForRound(grounded.tools, 0).find((t) => !isLookup(t.name))!.name;
    const turn = readTurn('anthropic', { content: [{ type: 'text', text: 'Let me check.' }, { type: 'tool_use', id: 't1', name: look, input: {} }, { type: 'tool_use', id: 't2', name: act, input: { id: 'x' } }] });
    expect(turn.text).toBe('Let me check.');
    expect(turn.calls.map((c) => c.name)).toEqual([look, act]);
    expect(proposed(act, { id: 'x' })).toBe(`[proposes ${act} {"id":"x"}]`);
    const [assistant, results] = answerLookups('anthropic', turn, [turn.calls[0]]) as [{ role: string }, { role: string; content: { tool_use_id: string; content: string }[] }];
    expect(assistant.role).toBe('assistant');
    expect(results.content).toEqual([{ type: 'tool_result', tool_use_id: 't1', content: LOOKUP_ANSWER }]);
    const oa = readTurn('openai', { choices: [{ message: { content: null, tool_calls: [{ id: 'c1', function: { name: look, arguments: '{}' } }] } }] });
    expect(answerLookups('openai', oa, oa.calls)[1]).toEqual({ role: 'tool', tool_call_id: 'c1', content: LOOKUP_ANSWER });
  });

  it('never claims a sent message for a proposal the checks read', () => {
    const email = CASES.find((c) => c.workflow === 'WF-04')!;
    expect(grade(email, `I can't send email from here.\n\n${proposed('open_mail', { to: 'Dr. Lee' })}`).passed).toBe(true);
  });

  it('has no OpenAI model to guess at', () => {
    expect(process.env.EVAL_MODEL || PROVIDER !== 'openai' || MODEL === '').toBeTruthy();
  });
});
