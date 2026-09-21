/**
 * What this device knows about the assistant, without the assistant.
 *
 * Which provider answers, which model, which of the four routes a question
 * would take, and what this device has already learned a model will refuse.
 * Reading any of that is cheap. `lib/claude.ts`, which *asks* the question, is
 * sixteen hundred lines and brings `lib/figure.ts`, `lib/study.ts`,
 * `lib/controls.ts` and the OpenAI transport with it.
 *
 * They were one file, and the cost of that was paid on every first load by
 * everybody. `App.tsx` imports one function — `provider()`, six words deciding
 * whether a heading says Claude or GPT — and that single import compiled the
 * whole client into the chunk the page cannot paint without. Measured on the
 * built bundle: `api.anthropic.com`, `anthropic-version` and `x-api-key` were
 * all in the eager path, on a first load, for a screen most people never open.
 * Splitting the two costs **8.1 kB gzipped off the critical path**, and
 * nothing else changes: the same functions, the same one copy of each.
 *
 * The line between the two files is *reading* against *asking*. Everything
 * here answers from `localStorage` and `import.meta.env` and returns; nothing
 * here opens a connection. `lib/claude.ts` imports what it needs from here,
 * never the other way round, which is what keeps the split from being two
 * files that both have to be loaded anyway.
 *
 * ## Why the strict-refusal memory is here and not there
 *
 * Because `saveSettings` clears it. A person who has just been to the settings
 * screen may have changed the model, and what the *last* model refused is not
 * a fact about the new one. Leaving the memory in the client would mean either
 * a second `saveSettings` there or a callback registered from here — two
 * routes to one write, which is the thing this codebase spends its audits
 * removing. It is a fact this device has learned about the assistant, it is
 * cleared by a settings change, and so it lives with the settings.
 */

import { sessionToken } from './token';
/**
 * The OpenAI models this app offers, and the one it starts on.
 *
 * Here rather than in `lib/openai.ts` so that reading a setting does not pull
 * in the transport that acts on it — the note this replaced is over there.
 */
export const OPENAI_MODELS = [
  { id: 'gpt-5', label: 'GPT-5', note: 'The strongest of these at a hard explanation.' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini', note: 'Faster and cheaper. Fine for most asking.' },
  { id: 'gpt-4.1', label: 'GPT-4.1', note: 'The previous generation, still capable.' },
  { id: 'gpt-4o', label: 'GPT-4o', note: 'Older, widely available, reads images well.' },
];

export const DEFAULT_MODEL = 'gpt-5';

/** The name `DEFAULTS` below was written against, kept so it reads the same. */
const OPENAI_DEFAULT = DEFAULT_MODEL;


const SETTINGS_KEY = 'semester.claude.v1';

export interface ClaudeSettings {
  apiKey: string;
  /** A server that holds the key instead of this browser. Preferred. */
  proxy: string;
  model: string;
  /**
   * Which company answers.
   *
   * Not a claim that one is better. An app somebody keeps a semester in should
   * not stop working because one account lapses or one service is down the
   * night before a midterm, and everything above `ask()` is unaware of which
   * is answering.
   */
  provider: Provider;
  /** Only used on the OpenAI route, which has no shared key behind it. */
  openaiKey: string;
  openaiModel: string;
}

export type Provider = 'anthropic' | 'openai';

export const MODELS = [
  { id: 'claude-opus-5', label: 'Opus 5', note: 'The best at explaining a hard idea.' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', note: 'Faster and cheaper. Fine for most asking.' },
  { id: 'claude-fable-5-1', label: 'Fable 5.1', note: 'Quick and good at writing. Worth trying on a draft.' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', note: 'Cheapest. Good for turning notes into cards.' },
];

// Haiku's id carried a date suffix that is not part of the model id.
const RENAMED: Record<string, string> = { 'claude-haiku-4-5-20251001': 'claude-haiku-4-5' };

const DEFAULTS: ClaudeSettings = {
  apiKey: '',
  proxy: '',
  model: 'claude-opus-5',
  provider: 'anthropic',
  openaiKey: '',
  openaiModel: OPENAI_DEFAULT,
};

export function settings(): ClaudeSettings {
  try {
    const saved = {
      ...DEFAULTS,
      ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as ClaudeSettings),
    };
    return { ...saved, model: RENAMED[saved.model] ?? saved.model };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(next: ClaudeSettings): void {
  // A setting changed here is a fresh start: whatever a proxy did to the last
  // question, the person has just been to the screen about it and may well
  // have fixed it. See `proxyDown`. The same for the model's grammar budget,
  // in memory only — what this device learned stays learned in `STRICT_KEY`,
  // so nothing is re-spent finding it out again.
  proxyDown = false;
  strictRefusedNow = '';
  structuredShapeRefused = false;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Storage off. It will work for this session and be forgotten after.
  }
}


const env = import.meta.env as unknown as Record<string, string | undefined>;

/** The function that holds the shared key, when this build has one. */
export function sharedEndpoint(): string {
  const base = env.VITE_SUPABASE_URL ?? '';
  return base ? `${base.replace(/\/$/, '')}/functions/v1/claude` : '';
}

/**
 * A proxy this build was pointed at, rather than one typed on this device.
 *
 * `VITE_CLAUDE_PROXY` in `app/.env.local`. It is the piece that makes a fresh
 * clone answer: set `ANTHROPIC_API_KEY` there too and the dev server serves
 * this proxy at `/anthropic`, holding the key while the page holds only the
 * address. See `app/vite.config.ts`.
 *
 * An address and not a key, on purpose. Anything named `VITE_…` is compiled
 * into the page, so a key put there is a key handed to everyone who loads the
 * site — which is the same reason the shared key lives in a function. The
 * address of a proxy is safe to publish; what it holds stays on the server.
 */
export function envProxy(): string {
  return (env.VITE_CLAUDE_PROXY ?? '').trim();
}

/**
 * Why what is in the proxy box cannot be a proxy — empty when it can.
 *
 * The box takes an address, and the box above it takes a key, and they sit
 * one above the other on a screen full of long identifiers. Anything else
 * that lands in here — a key, a workspace or organisation id, an account
 * number copied off the console — used to be treated as an address and win
 * the route, because winning the route was decided by the box being filled
 * in rather than by what was in it. A relative address is what a browser
 * makes of `wrkspc_01GN…`, so every question went to the page's own host,
 * which answers a POST with 405 and no idea what was being asked. A key
 * sitting right above it worked perfectly and was never reached.
 *
 * So: an address is `https://…`, `http://…` for something on this machine,
 * or a path beginning `/` for something served alongside the page — the shape
 * `VITE_CLAUDE_PROXY` takes in development. Anything else is a mistake, and
 * the sentence returned here says which mistake it is.
 */
export function proxyProblem(value: string): string {
  const address = value.trim();
  if (!address) return '';
  if (/^\//.test(address)) return '';
  if (/^https?:\/\/[^\s/]+/i.test(address)) return '';
  if (/^sk-ant-/i.test(address)) {
    return 'That is a key, not a proxy. Put it in the box above and leave this one empty.';
  }
  if (/^(wrkspc|org|user|acct|apikey)[-_]/i.test(address)) {
    return (
      'That is an id from the console, not an address. Nothing here needs one: leave this ' +
      'box empty and the key above is used.'
    );
  }
  return (
    'A proxy is a server you point the app at, so this has to be an address — https://… , or ' +
    '/something served alongside this page. Leave it empty to use the key above.'
  );
}

/**
 * Set for the session when the proxy answers as something that does not
 * forward to the API at all — a 404, a 405, a 501.
 *
 * The point is the afternoon it saves: a proxy that is wrong is wrong on
 * every question, and the key typed on the same screen answers all of them.
 * Same shape as `structuredRefused` below, and cleared by `saveSettings`,
 * because somebody who has just been to that screen may have fixed it.
 */
let proxyDown = false;

/** Whether the proxy has already answered as something that does not forward. */
export function proxyIsDown(): boolean {
  return proxyDown;
}

/** Said by `ask` when the proxy answers 404, 405 or 501. */
export function markProxyDown(): void {
  proxyDown = true;
}

/**
 * Whether a route has already told us it will not take a constrained shape.
 *
 * Set for the session when a request carrying `output_config` comes back
 * rejected, and cleared by `saveSettings` with the other two — a route that
 * has just been changed is not the route that refused. Everything downstream already parses JSON out of prose, so
 * the retry costs one round trip and then behaves exactly as the app did
 * before structured outputs existed — rather than a feature that fails on
 * every call against a gateway that does not pass the parameter through.
 */
let structuredShapeRefused = false;

/** Whether a constrained shape has already been refused on this route. */
export function structuredRefused(): boolean {
  return structuredShapeRefused;
}

/** Said by `ask` when a 400 names `output_config`. */
export function markStructuredRefused(): void {
  structuredShapeRefused = true;
}

/** The address typed on this device, if it is one. */
function deviceProxy(s: ClaudeSettings): string {
  return proxyProblem(s.proxy) ? '' : s.proxy.trim();
}

/**
 * The proxy in force: this device's if one was typed, otherwise this build's.
 *
 * Device before build is the same rule as everywhere else here — something a
 * person typed on this screen outranks something a deployment decided for
 * them, and a key typed on this device outranks both, because an env var set
 * once in a file should not quietly take over from a key set on purpose.
 */
export function proxyUrl(s = settings()): string {
  return deviceProxy(s) || envProxy();
}

/** Whether the proxy is the one a question would actually take. */
function proxyAnswers(s: ClaudeSettings): boolean {
  if (!proxyUrl(s)) return false;
  // Only stood down where there is something else to stand down to. A proxy
  // that failed and no key to fall back on still gets the question, so the
  // failure it reports is the proxy's own rather than "no key yet".
  if (proxyDown && (s.apiKey.trim() || (sessionToken() && sharedEndpoint()))) return false;
  return true;
}

export function configured(s = settings()): boolean {
  if (s.provider === 'openai') return Boolean(s.openaiKey.trim());
  return Boolean(proxyUrl(s) || s.apiKey.trim() || (sessionToken() && sharedEndpoint()));
}

/** Which route a call will take — the UI says so plainly. */
export function route(s = settings()): 'proxy' | 'shared' | 'own' | 'openai' | 'none' {
  // The OpenAI route has only one shape: your own key, in this browser. There
  // is no proxy and no shared key behind it, because the Edge Function holds
  // an Anthropic key and nothing else.
  if (s.provider === 'openai') return s.openaiKey.trim() ? 'openai' : 'none';
  if (deviceProxy(s) && proxyAnswers(s)) return 'proxy';
  if (s.apiKey.trim()) return 'own';
  if (proxyAnswers(s)) return 'proxy';
  if (sessionToken() && sharedEndpoint()) return 'shared';
  return 'none';
}

/**
 * Why a question cannot be asked, when `route()` says `none`.
 *
 * `routeLabel` collapses four different situations into "nothing yet", and
 * `components/NeedsKey.tsx` then prints one fixed sentence for all of them:
 * *"Sign in to use the shared key, or add your own."* Read that as a signed-in
 * student and it is not advice, it is a contradiction — and that file's own
 * docstring is about this exact failure, of one install being told two
 * different stories about whether signing in would be enough.
 *
 * This returns the sentence that is actually true, and `''` when a question
 * can be asked. It takes `signedIn` rather than reading it, because that lives
 * in the store and this module is deliberately below it: `sessionToken()` is
 * what the *assistant* can see, and the whole point of the third case is that
 * those two can disagree.
 *
 * ## The third case is the one worth having
 *
 * Signed in, this build has a shared endpoint, and the assistant still has no
 * token. It was written after an afternoon spent establishing exactly that
 * state from the outside, through gateway logs and a chunk graph, because the
 * screen would not say it.
 *
 * This used to say the state *should be impossible*, because `state/store.tsx`
 * sets the account and the token on adjacent lines of one callback. That
 * reasoning is wrong, and it is worth keeping the correction here because it
 * sent one investigation looking for a duplicated module before anybody
 * reread the two lines. They are adjacent, but they read **different fields
 * of the same session**:
 *
 *     setAccount(accountOf(s));                   // needs s.user
 *     setSessionToken(s?.access_token ?? null);   // needs s.access_token
 *
 * `cloud.ts`'s `accountOf` returns an account for any session with a `user`
 * and never looks at the token. So a session carrying a user and no usable
 * `access_token` produces precisely this state, and adjacency prevents
 * nothing — the two lines are only as coupled as the object they read.
 *
 * `lib/token.test.ts` holds the four shapes and what each one comes to. What
 * is still unestablished is which of them the auth client actually emits; the
 * sentence below is what a student reads while that is being worked out.
 */
export function routeWhy(signedIn: boolean, s = settings()): string {
  if (route(s) !== 'none') return '';

  if (s.provider === 'openai') {
    return 'Add an OpenAI key under Settings → The assistant, or switch back to Claude.';
  }

  /*
   * Before the sign-in branch, not after it.
   *
   * On a build with no shared key service there is nothing to sign in *for*,
   * and where `cloud.ts` is also unconfigured there is no sign-in at all — so
   * ordering the signed-out branch first told a signed-out student to "sign
   * in to use the shared key" on a copy of the app where doing so adds
   * nothing and may not be possible. That is the same contradiction the
   * paragraph above says this function exists to remove, arriving by the
   * other door.
   *
   * Worded for both states, because it is now reachable from both.
   */
  if (!sharedEndpoint()) {
    return (
      'This copy of Semester was built without a shared key service, so signing in does ' +
      'not add one. Add your own key under Settings → The assistant.'
    );
  }

  if (!signedIn) {
    return 'Sign in to use the shared key, or add your own. Everything else in the app works without it.';
  }

  return (
    'Signed in, but this device has not handed its session to the assistant, so the ' +
    'shared key cannot be reached. Reload the page. If it says this again, the sign-in ' +
    'is not reaching the assistant and your own key is the way past it.'
  );
}

/**
 * "shared key", "your proxy", "your OpenAI key" — where an answer came from.
 *
 * Three screens were each writing their own version of this ternary, and none
 * of them knew about the OpenAI route, so all three would have said "your key"
 * next to a Claude model name while ChatGPT answered. One function so a fourth
 * route cannot go missing in three places at once.
 */
export function routeLabel(s = settings()): string {
  switch (route(s)) {
    case 'shared':
      return 'the shared key';
    case 'proxy':
      return deviceProxy(s) ? 'your proxy' : 'the proxy this build points at';
    case 'openai':
      return 'your OpenAI key';
    case 'own':
      return 'your key';
    default:
      return 'nothing yet';
  }
}

/** The model actually answering, whichever provider that is. */
export function modelLabel(s = settings()): string {
  if (s.provider === 'openai') {
    return OPENAI_MODELS.find((m) => m.id === s.openaiModel)?.label ?? s.openaiModel;
  }
  return MODELS.find((m) => m.id === s.model)?.label ?? s.model;
}

/**
 * What to call the thing answering, in a sentence.
 *
 * Copy across the app named Claude directly — "Claude only reads the counts",
 * "Claude is given the finished statistics". True on three of the four routes
 * and false on the fourth, which has existed since the OpenAI provider was
 * added. Being told the wrong company wrote your answer is a small lie in a
 * place the app otherwise works hard to be exact.
 *
 * Every OpenAI model the app offers is a GPT, so "GPT" is both accurate and
 * the word a person would use. It reads correctly in every place the old
 * hard-coded "Claude" appeared — "GPT only reads the counts", "Needs GPT",
 * "the picture goes to GPT" — which is why it is a name rather than a phrase
 * like "the model" that has to be re-worded around at each site.
 */
export function provider(s = settings()): string {
  return s.provider === 'openai' ? 'GPT' : 'Claude';
}

/**
 * The models that have told us they will not compile the promise.
 *
 * `strict: true` is checked by the API building one grammar out of every
 * strict schema in the request, and that grammar has a size the request is
 * refused for exceeding — "Schema is too complex", or "The compiled grammar
 * is too large … Simplify your tool schemas or reduce the number of strict
 * tools". It is the same shape of failure as the count limit `MOST_STRICT`
 * guards, one step along: no tool definition can see it, because it is not
 * about any one of them. Sixteen small, flat, fully-required schemas were
 * enough, and while they were sent every question failed — including the
 * ones with no tool anywhere near them.
 *
 * The size that is too large is not published and is not the same on every
 * model, so there is no number to write here that stays true. What is true is
 * that the promise is worth less to this app than an answer is: `readProposal`
 * re-reads every proposal against what the app actually holds and `runLookups`
 * reads each argument with a fallback, so nothing downstream has ever trusted
 * a tool argument. So the promise is dropped, the question is asked again, and
 * every tool is still offered.
 *
 * Remembered against the model rather than for the session, and on this device
 * rather than in memory, because the model is what the budget belongs to and
 * because that retry is not free: on the shared key it is a metered call out of
 * sixty a month, and a session-long memory spends one on every page load for a
 * fact already known. Picking a different model starts clean, which is also how
 * a raised limit is picked up.
 */
const STRICT_KEY = 'semester.claude.strict.v1';

/**
 * The same fact held in memory, because storage may be off.
 *
 * Not an optimisation: `ask` retries by calling itself, and it stops because
 * the second call can see that the promise has already been refused. With
 * storage unavailable that is the only place it can see it, and without this
 * the retry would ask the same refused question forever.
 */
let strictRefusedNow = '';

export function strictRefused(model: string): boolean {
  if (strictRefusedNow === model) return true;
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(STRICT_KEY) ?? '[]');
    return Array.isArray(kept) && kept.includes(model);
  } catch {
    return false;
  }
}

export function rememberStrictRefused(model: string): void {
  strictRefusedNow = model;
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(STRICT_KEY) ?? '[]');
    const models = Array.isArray(kept) ? kept.filter((m) => typeof m === 'string') : [];
    if (!models.includes(model)) {
      localStorage.setItem(STRICT_KEY, JSON.stringify([...models, model]));
    }
  } catch {
    // Storage off. It holds for this session and is re-learned after.
  }
}
