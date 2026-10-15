// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MODEL_NOT_ON_PLAN, PLAN_MODELS, clampRequest, modelsForPlan } from '../../../supabase/functions/_shared/clamp';
import { modelLabel, route, saveSettings } from './assistant';
import { ask } from './claude';
import {
  MODEL_NOT_ON_PLAN_CODE,
  SHARED_FALLBACK_MODEL,
  SHARED_MODELS_KEY,
  SHARED_MODELS_TTL_MS,
  forgetSharedModels,
  modelOnSharedKey,
  modelsFromRefusal,
  rememberSharedModels,
} from './sharedmodels';
import { setSessionToken } from './token';

/**
 * The app learning which models the shared key will answer with.
 *
 * The default model is Opus 5 and a Free account's list does not hold it, so
 * the first question a free student asks is refused by the function — and has
 * to be asked again on a model the plan covers without the student seeing a
 * thing go wrong. The refusals used below are the clamp's own output, not
 * hand-written ones, so the two sides cannot drift apart unnoticed.
 */

const FREE = [...PLAN_MODELS.free];

/** The refusal a Free account's request for `model` actually gets from the function. */
function refusalFor(model: string): { status: number; body: unknown } {
  const raw = JSON.stringify({ model, max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] });
  const out = clampRequest(raw, raw.length, { models: modelsForPlan('free') });
  if (out.ok) throw new Error(`the clamp let ${model} through on Free`);
  return {
    status: out.status,
    body: { error: { message: out.message, code: out.code, allowed_models: out.allowed } },
  };
}

function stream(text: string): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const event = { type: 'content_block_delta', delta: { type: 'text_delta', text } };
      controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setSessionToken(null);
});

describe('the code the two sides share', () => {
  it('is the one the function sends', () => {
    expect(MODEL_NOT_ON_PLAN_CODE).toBe(MODEL_NOT_ON_PLAN);
  });

  it('lands a student on a model every Free account is allowed', () => {
    expect(FREE).toContain(SHARED_FALLBACK_MODEL);
  });
});

describe('which model goes to the shared key', () => {
  it('is the one chosen when nothing has been learned, so the first question may find out', () => {
    expect(modelOnSharedKey('claude-opus-5')).toBe('claude-opus-5');
  });

  it('is the one chosen when the learned list holds it', () => {
    rememberSharedModels(FREE);
    expect(modelOnSharedKey('claude-haiku-4-5')).toBe('claude-haiku-4-5');
    expect(modelOnSharedKey('claude-sonnet-5')).toBe('claude-sonnet-5');
  });

  it('is the fallback when the learned list does not hold the one chosen', () => {
    rememberSharedModels(FREE);
    expect(modelOnSharedKey('claude-opus-5')).toBe(SHARED_FALLBACK_MODEL);
    expect(modelOnSharedKey('claude-fable-5-1')).toBe(SHARED_FALLBACK_MODEL);
  });

  it('is the first on the list when the list does not hold the usual fallback', () => {
    rememberSharedModels(['claude-haiku-4-5']);
    expect(modelOnSharedKey('claude-opus-5')).toBe('claude-haiku-4-5');
  });

  it('forgets after a day, so a student who upgraded is not held to the cheaper list', () => {
    const t0 = 1_000_000_000_000;
    rememberSharedModels(FREE, t0);
    expect(modelOnSharedKey('claude-opus-5', t0 + SHARED_MODELS_TTL_MS)).toBe(SHARED_FALLBACK_MODEL);
    expect(modelOnSharedKey('claude-opus-5', t0 + SHARED_MODELS_TTL_MS + 1)).toBe('claude-opus-5');
  });

  it('does not trust a list stamped in the future', () => {
    const t0 = 1_000_000_000_000;
    rememberSharedModels(FREE, t0 + 60_000);
    expect(modelOnSharedKey('claude-opus-5', t0)).toBe('claude-opus-5');
  });

  it('ignores storage that is not a list it wrote, and storage that will not answer', () => {
    for (const bad of ['not json', '{}', '{"models":"x","at":1}', '{"models":[1],"at":1}', '{"models":[],"at":1}', 'null']) {
      localStorage.setItem(SHARED_MODELS_KEY, bad);
      expect(modelOnSharedKey('claude-opus-5', 2), bad).toBe('claude-opus-5');
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(modelOnSharedKey('claude-opus-5')).toBe('claude-opus-5');
    vi.restoreAllMocks();
  });

  it('can be forgotten', () => {
    rememberSharedModels(FREE);
    forgetSharedModels();
    expect(modelOnSharedKey('claude-opus-5')).toBe('claude-opus-5');
  });
});

describe('reading the function’s refusal', () => {
  it('takes the list from the refusal the function really sends', () => {
    const { status, body } = refusalFor('claude-opus-5');
    expect(modelsFromRefusal(status, body)).toEqual(FREE);
  });

  it('takes nothing from any other answer', () => {
    const { body } = refusalFor('claude-opus-5');
    expect(modelsFromRefusal(429, body)).toBeNull();
    expect(modelsFromRefusal(400, { error: { message: 'x' } })).toBeNull();
    expect(modelsFromRefusal(400, { error: { code: 'other', allowed_models: FREE } })).toBeNull();
    expect(modelsFromRefusal(400, { error: { code: MODEL_NOT_ON_PLAN, allowed_models: [] } })).toBeNull();
    expect(modelsFromRefusal(400, { error: { code: MODEL_NOT_ON_PLAN, allowed_models: [1] } })).toBeNull();
    expect(modelsFromRefusal(400, { error: { code: MODEL_NOT_ON_PLAN } })).toBeNull();
    expect(modelsFromRefusal(400, null)).toBeNull();
    expect(modelsFromRefusal(400, 'text')).toBeNull();
  });
});

describe('asking on the shared key', () => {
  /** The shared route: signed in, a shared key service in the build, no key or proxy of the student's own. */
  function onSharedKey(model = 'claude-opus-5') {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_KEY', 'sb_publishable_test');
    vi.stubEnv('VITE_CLAUDE_PROXY', '');
    setSessionToken('session-token');
    saveSettings({ provider: 'anthropic', apiKey: '', model, proxy: '', openaiKey: '', openaiModel: '' });
    expect(route()).toBe('shared');
  }

  /** Replies in order, one per call, and records the model each call named. */
  function replies(...answers: (Response | (() => Response))[]) {
    const asked: string[] = [];
    let i = 0;
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
      asked.push((JSON.parse(String(init.body)) as { model: string }).model);
      const next = answers[Math.min(i++, answers.length - 1)];
      return Promise.resolve(typeof next === 'function' ? next() : next);
    });
    return asked;
  }

  const refusal = (model: string) => {
    const { status, body } = refusalFor(model);
    return () => new Response(JSON.stringify(body), { status });
  };
  const question = { system: 'You tutor.', messages: [{ role: 'user' as const, content: 'hi' }] };

  it('asks again on a model the plan covers when the first is refused, and the student gets an answer', async () => {
    onSharedKey('claude-opus-5');
    const asked = replies(refusal('claude-opus-5'), () => stream('Opportunity cost is the next best use.'));

    await expect(ask(question)).resolves.toBe('Opportunity cost is the next best use.');
    expect(asked).toEqual(['claude-opus-5', SHARED_FALLBACK_MODEL]);
  });

  it('goes straight to the covered model on the next question, with no second refusal', async () => {
    onSharedKey('claude-opus-5');
    let asked = replies(refusal('claude-opus-5'), () => stream('one'));
    await ask(question);

    asked = replies(() => stream('two'));
    await expect(ask(question)).resolves.toBe('two');
    expect(asked).toEqual([SHARED_FALLBACK_MODEL]);
  });

  it('says which model is answering once it has learned, not the one that was refused', async () => {
    onSharedKey('claude-opus-5');
    expect(modelLabel()).toBe('Opus 5');
    replies(refusal('claude-opus-5'), () => stream('ok'));
    await ask(question);
    expect(modelLabel()).toBe('Sonnet 5');
  });

  it('asks for the model chosen again once the memory lapses', async () => {
    onSharedKey('claude-opus-5');
    rememberSharedModels(FREE, Date.now() - SHARED_MODELS_TTL_MS - 1);
    const asked = replies(() => stream('wider now'));
    await ask(question);
    expect(asked).toEqual(['claude-opus-5']);
  });

  it('never refuses, retries or remembers anything for a plan that covers the model chosen', async () => {
    onSharedKey('claude-haiku-4-5');
    const asked = replies(() => stream('fine'));
    await ask(question);
    expect(asked).toEqual(['claude-haiku-4-5']);
    expect(localStorage.getItem(SHARED_MODELS_KEY)).toBeNull();
  });

  it('does not loop when the function names a list that still holds the model it just refused', async () => {
    onSharedKey('claude-opus-5');
    const contradiction = () =>
      new Response(
        JSON.stringify({
          error: { message: 'No.', code: MODEL_NOT_ON_PLAN, allowed_models: ['claude-opus-5', 'claude-haiku-4-5'] },
        }),
        { status: 400 },
      );
    const asked = replies(contradiction);
    await expect(ask(question)).rejects.toThrow();
    expect(asked).toEqual(['claude-opus-5']);
  });

  it('shows any other refusal as the error it is, and does not take a list from it', async () => {
    onSharedKey('claude-opus-5');
    const asked = replies(() => new Response(JSON.stringify({ error: { message: 'Slow down.' } }), { status: 429 }));
    await expect(ask(question)).rejects.toThrow();
    expect(asked).toEqual(['claude-opus-5']);
    expect(localStorage.getItem(SHARED_MODELS_KEY)).toBeNull();
  });

  it('leaves a student’s own key alone: it names any model, whatever the shared key has learned', async () => {
    rememberSharedModels(FREE);
    vi.stubEnv('VITE_CLAUDE_PROXY', '');
    saveSettings({
      provider: 'anthropic',
      apiKey: 'sk-ant-own',
      model: 'claude-fable-5-1',
      proxy: '',
      openaiKey: '',
      openaiModel: '',
    });
    expect(route()).toBe('own');
    const asked = replies(() => stream('mine'));
    await ask(question);
    expect(asked).toEqual(['claude-fable-5-1']);
    expect(modelLabel()).toBe('Fable 5.1');
  });
});
