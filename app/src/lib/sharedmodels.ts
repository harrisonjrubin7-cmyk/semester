/**
 * Which models the shared key will answer with for this account, as the app
 * learns it.
 *
 * `supabase/functions/_shared/clamp.ts` gives each plan a list of models the
 * shared key will pay for, and refuses a request that names another with a 400
 * carrying `error.code = 'model_not_on_plan'` and `error.allowed_models`. The
 * app's default model is Opus 5, which a Free account's list does not hold, so
 * without this the first question every free student asked would be refused.
 *
 * ## Learned from the refusal, not looked up
 *
 * The app does not know the account's plan and does not need to. A refusal is
 * free — it comes before the call is counted — and carries the list, so
 * `ask()` takes it, remembers it, and asks again on a model the plan covers.
 * An account whose plan allows the model it asked for is never refused and
 * never learns anything, which is right: nothing was in its way.
 *
 * ## Remembered for a day
 *
 * A remembered list cannot be left to stand for ever, because a plan can get
 * wider: a student who upgrades would stay on the cheaper models until they
 * cleared their storage. After a day the memory lapses and the next question
 * asks for the model the student chose; if the plan still does not cover it,
 * that is one more free refusal and the list is learned again.
 *
 * ## Only the shared key
 *
 * A student's own key, a proxy and the OpenAI route are not served by this
 * key and are never restricted by it. `ask()` calls this only on the shared
 * route.
 *
 * `supabase/functions/_shared/clamp.ts` and this file agree on the code
 * through `sharedmodels.test.ts`, which imports both.
 */

export const SHARED_MODELS_KEY = 'semester.shared-models';

/** How long a learned list is trusted. */
export const SHARED_MODELS_TTL_MS = 24 * 60 * 60 * 1000;

/** Where a student lands when the model they chose is not on their plan. */
export const SHARED_FALLBACK_MODEL = 'claude-sonnet-5';

/** The code the function's refusal carries. Held to `MODEL_NOT_ON_PLAN` by the test. */
export const MODEL_NOT_ON_PLAN_CODE = 'model_not_on_plan';

interface Remembered {
  models: string[];
  at: number;
}

function read(now: number): string[] | null {
  try {
    const raw = localStorage.getItem(SHARED_MODELS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Remembered>;
    if (
      !Array.isArray(saved.models) ||
      !saved.models.every((m) => typeof m === 'string') ||
      typeof saved.at !== 'number' ||
      now - saved.at > SHARED_MODELS_TTL_MS ||
      saved.at > now
    ) {
      return null;
    }
    return saved.models.length > 0 ? saved.models : null;
  } catch {
    return null;
  }
}

/** Keep the list a refusal named. A storage that will not take it loses only a round trip. */
export function rememberSharedModels(models: string[], now = Date.now()): void {
  try {
    localStorage.setItem(SHARED_MODELS_KEY, JSON.stringify({ models, at: now } satisfies Remembered));
  } catch {
    /* a refused write costs one more free refusal, never an answer */
  }
}

export function forgetSharedModels(): void {
  try {
    localStorage.removeItem(SHARED_MODELS_KEY);
  } catch {
    /* nothing was kept */
  }
}

/**
 * The model to send on the shared key: the one chosen, unless the plan's
 * remembered list does not hold it. Nothing remembered means the one chosen —
 * the first question is allowed to find out.
 */
export function modelOnSharedKey(chosen: string, now = Date.now()): string {
  const allowed = read(now);
  if (!allowed || allowed.includes(chosen)) return chosen;
  return allowed.includes(SHARED_FALLBACK_MODEL) ? SHARED_FALLBACK_MODEL : allowed[0];
}

/**
 * The models a refusal says the plan covers, or null when it is not that
 * refusal. Reads only what the function writes and checks it: a list that is
 * not strings, or is empty, teaches nothing.
 */
export function modelsFromRefusal(status: number, body: unknown): string[] | null {
  if (status !== 400 || typeof body !== 'object' || body === null) return null;
  const error = (body as { error?: { code?: unknown; allowed_models?: unknown } }).error;
  if (!error || error.code !== MODEL_NOT_ON_PLAN_CODE) return null;
  const list = error.allowed_models;
  if (!Array.isArray(list) || list.length === 0 || !list.every((m) => typeof m === 'string')) return null;
  return list as string[];
}
