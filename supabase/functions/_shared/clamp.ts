/**
 * What the shared key will pay for.
 *
 * `functions/claude` used to forward the caller's request body to Anthropic
 * byte for byte. The account check and the monthly count made sure the caller
 * was somebody, and that they could only ask sixty times — but not *what* they
 * could ask for. Any signed-in account could name the most expensive model,
 * set `max_tokens` to the model's ceiling, attach server tools the app never
 * uses, and spend one of their sixty calls on a request costing a hundred of
 * the app's own. The cap counted calls; the bill counts tokens.
 *
 * So the body is read here and rebuilt from the fields the app itself sends
 * (`app/src/lib/claude.ts`, `ask()`), each held to what the app asks for:
 *
 *  - **model** — one of the models the app offers (`lib/assistant.ts`). Any
 *    other is refused rather than substituted: quietly answering with a
 *    different model than the one named is a lie about who answered.
 *  - **max_tokens** — clamped, not refused. The app's own largest ask is
 *    12 000; the ceiling sits above that so nothing the app does is cut.
 *  - **thinking** — adaptive or nothing. A fixed budget is a cost knob the
 *    app never turns.
 *  - **tools** — the app's own client tools (a name and a schema, run on the
 *    device) and web search, with `max_uses` held to the app's five. Every
 *    other server tool — code execution, fetch, MCP toolsets — is dropped:
 *    each runs on Anthropic's side and is billed there.
 *  - **output_config** — `format` passes; `effort` only at the levels that do
 *    not raise spend above the default; anything else is dropped.
 *  - Everything else at the top level (`mcp_servers`, `container`,
 *    `service_tier`, `speed`, `inference_geo`, `fallbacks`, …) is dropped.
 *
 * Pure, and free of Deno APIs, so the app's test suite can import it the way
 * it imports `ltideeplink.ts`.
 */

/** The models `lib/assistant.ts` offers. Kept in step by `claudeclamp.test.ts`. */
export const ALLOWED_MODELS: readonly string[] = [
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-fable-5-1',
  'claude-haiku-4-5',
];

/**
 * Which of those models each plan's shared-key calls may name.
 *
 * Every model on the list costs a different amount, and the monthly cap
 * counts calls, so before this table one account could spend all sixty on the
 * dearest model: at the cap on Opus 5 about as much as Plus's monthly price,
 * on Fable 5.1 several times it (`docs/commercial/PRICING-UNIT-ECONOMICS-
 * ARCHITECTURE.md` §1, F1). A plan now names the models it may use, widening
 * as it goes: Free the two cheaper ones, Plus adds Opus 5, Pro adds Fable 5.1.
 *
 * **These lists are a product decision, written down once, here.** `free` is
 * also what anything this table does not recognise gets — a plan that cannot
 * be read must never widen what the key will pay for. Another plan, or
 * another split, is one edit in this object and the test that holds it.
 */
export const PLAN_MODELS = {
  free: ['claude-haiku-4-5', 'claude-sonnet-5'],
  plus: ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5'],
  pro: ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1'],
} as const satisfies Record<string, readonly string[]>;

export type SharedPlan = keyof typeof PLAN_MODELS;

/** The models a plan's shared-key calls may name. Anything unrecognised is Free. */
export function modelsForPlan(plan: string | null | undefined): readonly string[] {
  return Object.hasOwn(PLAN_MODELS, plan ?? '') ? PLAN_MODELS[plan as SharedPlan] : PLAN_MODELS.free;
}

/**
 * The `error.code` a refusal for a model outside the caller's plan carries,
 * with `error.allowed_models`, so the app can switch to one the plan covers
 * instead of showing a person a sentence about a model they never chose.
 */
export const MODEL_NOT_ON_PLAN = 'model_not_on_plan';

/** Above the app's largest ask (12 000) so nothing the app does is cut. */
export const MAX_OUTPUT_TOKENS = 16_000;

/** The app's own search cap, `MOST_SEARCHES` in `lib/research.ts`. */
export const MAX_SEARCHES = 5;

/**
 * Under Anthropic's own 32 MB request limit, so an oversize body is refused
 * here — before it costs one of the caller's calls — rather than upstream.
 */
export const MAX_BODY_BYTES = 24 * 1024 * 1024;

const SEARCH_TYPES = new Set(['web_search_20260209', 'web_search_20250305']);
const EFFORTS = new Set(['low', 'medium', 'high']);

export type Clamped =
  | { ok: true; body: string; dropped: string[] }
  | { ok: false; status: number; message: string; code?: string; allowed?: readonly string[] };

const refuse = (status: number, message: string): Clamped => ({ ok: false, status, message });

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A tool the app defines and runs itself: a name and a schema, no server type. */
function isClientTool(t: Record<string, unknown>): boolean {
  return (
    typeof t.name === 'string' &&
    isObject(t.input_schema) &&
    (t.type === undefined || t.type === 'custom')
  );
}

export interface ClampOptions {
  models?: readonly string[];
  maxOutputTokens?: number;
}

/**
 * Read a request body and rebuild it from what the shared key pays for.
 * `bytes` is the body's size on the wire, measured by the caller.
 */
export function clampRequest(raw: string, bytes: number, options: ClampOptions = {}): Clamped {
  const models = options.models ?? ALLOWED_MODELS;
  const ceiling = options.maxOutputTokens ?? MAX_OUTPUT_TOKENS;

  if (bytes > MAX_BODY_BYTES) {
    return refuse(413, 'That request is too large to send. Try a shorter document or fewer attachments.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return refuse(400, 'The request could not be read.');
  }
  if (!isObject(parsed)) return refuse(400, 'The request could not be read.');

  const { model, messages } = parsed;
  if (typeof model !== 'string' || !models.includes(model)) {
    return {
      ok: false,
      status: 400,
      message:
        `The shared key answers with ${models.join(', ')} on your plan. Choose one of those, ` +
        'or add your own key under Ask Claude → Settings, which can use any model.',
      code: MODEL_NOT_ON_PLAN,
      allowed: models,
    };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return refuse(400, 'The request has no messages.');
  }

  const asked = parsed.max_tokens;
  if (typeof asked !== 'number' || !Number.isInteger(asked) || asked < 1) {
    return refuse(400, 'The request needs a whole-number max_tokens.');
  }

  const dropped: string[] = [];
  const out: Record<string, unknown> = {
    model,
    max_tokens: Math.min(asked, ceiling),
    messages,
  };
  if (asked > ceiling) dropped.push(`max_tokens>${ceiling}`);

  if (typeof parsed.system === 'string' || Array.isArray(parsed.system)) out.system = parsed.system;
  if (typeof parsed.stream === 'boolean') out.stream = parsed.stream;
  if (Array.isArray(parsed.stop_sequences)) out.stop_sequences = parsed.stop_sequences;

  if (isObject(parsed.thinking)) {
    if (parsed.thinking.type === 'adaptive') {
      out.thinking = typeof parsed.thinking.display === 'string'
        ? { type: 'adaptive', display: parsed.thinking.display }
        : { type: 'adaptive' };
    } else {
      dropped.push('thinking');
    }
  }

  if (Array.isArray(parsed.tools)) {
    const kept: Record<string, unknown>[] = [];
    for (const t of parsed.tools) {
      if (!isObject(t)) continue;
      if (isClientTool(t)) {
        kept.push(t);
      } else if (typeof t.type === 'string' && SEARCH_TYPES.has(t.type)) {
        const uses = typeof t.max_uses === 'number' ? Math.min(t.max_uses, MAX_SEARCHES) : MAX_SEARCHES;
        kept.push({ type: t.type, name: 'web_search', max_uses: Math.max(1, uses) });
      } else {
        dropped.push(`tool:${typeof t.type === 'string' ? t.type : 'unknown'}`);
      }
    }
    if (kept.length > 0) out.tools = kept;
  }

  if (isObject(parsed.tool_choice) && out.tools) out.tool_choice = parsed.tool_choice;

  if (isObject(parsed.output_config)) {
    const config: Record<string, unknown> = {};
    if (isObject(parsed.output_config.format)) config.format = parsed.output_config.format;
    const effort = parsed.output_config.effort;
    if (typeof effort === 'string' && EFFORTS.has(effort)) config.effort = effort;
    else if (effort !== undefined) dropped.push('effort');
    for (const k of Object.keys(parsed.output_config)) {
      if (k !== 'format' && k !== 'effort') dropped.push(`output_config.${k}`);
    }
    if (Object.keys(config).length > 0) out.output_config = config;
  }

  const handled = new Set([
    'model', 'max_tokens', 'messages', 'system', 'stream', 'stop_sequences',
    'thinking', 'tools', 'tool_choice', 'output_config',
  ]);
  for (const k of Object.keys(parsed)) if (!handled.has(k)) dropped.push(k);

  return { ok: true, body: JSON.stringify(out), dropped };
}
