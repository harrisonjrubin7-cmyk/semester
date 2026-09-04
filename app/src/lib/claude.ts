/**
 * Claude, inside the app.
 *
 * What it is for, concretely: turning a reading into cards that land in every
 * study format at once, explaining the card you keep failing, and answering a
 * question about a course with that course's own guide in front of it.
 *
 * **Three routes to the same API, in this order of preference:**
 *
 *  1. **A proxy** you point the app at, holding the key server-side.
 *  2. **The shared key**, when signed in — an Edge Function checks the account
 *     and meters it, so a new user can generate a course without first going
 *     and getting a key of their own.
 *  3. **Your own key**, stored on this device.
 *
 * Talking to the API from a page means the key is in the page: anything running
 * in that browser can read it, and a key baked into a deployed site is a key
 * handed to everyone who loads it. That is why the shared key lives in a
 * function, and why the app says all of this on the screen where a key is typed.
 */

import type { StudyCard } from './types';

import { DEFAULT_MODEL as OPENAI_DEFAULT, OPENAI_MODELS, askOpenAI } from './openai';

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
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Storage off. It will work for this session and be forgotten after.
  }
}

/** Set by the store on sign-in, which is what makes the shared key available. */
let sessionToken: string | null = null;

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

const env = import.meta.env as unknown as Record<string, string | undefined>;

/** The function that holds the shared key, when this build has one. */
function sharedEndpoint(): string {
  const base = env.VITE_SUPABASE_URL ?? '';
  return base ? `${base.replace(/\/$/, '')}/functions/v1/claude` : '';
}

export function configured(s = settings()): boolean {
  if (s.provider === 'openai') return Boolean(s.openaiKey.trim());
  return Boolean(s.proxy.trim() || s.apiKey.trim() || (sessionToken && sharedEndpoint()));
}

/** Which of the three routes a call will take — the UI says so plainly. */
export function route(s = settings()): 'proxy' | 'shared' | 'own' | 'openai' | 'none' {
  // The OpenAI route has only one shape: your own key, in this browser. There
  // is no proxy and no shared key behind it, because the Edge Function holds
  // an Anthropic key and nothing else.
  if (s.provider === 'openai') return s.openaiKey.trim() ? 'openai' : 'none';
  if (s.proxy.trim()) return 'proxy';
  if (s.apiKey.trim()) return 'own';
  if (sessionToken && sharedEndpoint()) return 'shared';
  return 'none';
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
      return 'your proxy';
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

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

type Route = 'proxy' | 'shared' | 'own' | 'openai' | 'none';

/**
 * Turn a failed call into a sentence that names the fix.
 *
 * The failure worth spelling out is the shared route against a project where
 * the function has not been deployed: Supabase answers 404 with its gateway's
 * wording, so the app would otherwise show a student the number 404 for a
 * setup step they cannot even perform. Everything recognised says who has to
 * do what; everything else is passed through, because the API's own wording
 * beats a guess.
 */
export function explainAskError(taking: Route, status: number, detail: string): string {
  if (taking === 'shared') {
    if (status === 404 || /function was not found|not_found/i.test(detail)) {
      return (
        'The shared key is not switched on for this deployment yet — the `claude` ' +
        'function has not been deployed. Add your own key under Settings to carry on ' +
        'now; whoever runs this deployment can turn the shared one on (SETUP.md).'
      );
    }
    if (status === 401) {
      return 'That session is no longer valid. Sign out and back in, then try again.';
    }
    if (status === 546 || status === 503) {
      return (
        'The shared-key function is deployed but failed to run. Whoever runs this ' +
        'deployment should check its logs; your own key under Settings works meanwhile.'
      );
    }
  }
  if (taking === 'own' && status === 401) {
    return `${detail}\n\nThat key was refused. Check it under Settings — a key is not the same as a project id.`;
  }
  if (taking === 'proxy' && (status === 404 || status === 502)) {
    return `${detail}\n\nThe proxy did not answer at /v1/messages. Check the address under Settings.`;
  }
  if (status === 529 || status === 429) {
    return `${detail}\n\nThat is rate limiting rather than a mistake — wait a moment and ask again.`;
  }
  return detail;
}

/** What a browser reports when the request never reached anything. */
function explainNetworkError(taking: Route, e: unknown): Error {
  if (e instanceof DOMException && e.name === 'AbortError') return e as unknown as Error;
  const said = e instanceof Error ? e.message : String(e);
  if (taking === 'shared') {
    return new Error(
      `${said}\n\nThe request never reached the shared-key function — it is either not ` +
        'deployed or is refusing this origin. Add your own key under Settings to carry on.',
    );
  }
  if (taking === 'proxy') {
    return new Error(`${said}\n\nThe proxy did not answer. Check its address under Settings.`);
  }
  return new Error(`${said}\n\nNo connection. This is the one part of the app that needs one.`);
}

/** A photograph or screenshot, ready to send. */
export interface Shot {
  /** "image/jpeg", "image/png", "image/webp" or "image/gif". */
  mediaType: string;
  /** Base64, with no data: prefix and no newlines. */
  data: string;
}

/** A document sent whole, so the model sees the page rather than a flattening. */
export interface Doc {
  /** "application/pdf" or "text/plain". */
  mediaType: string;
  /** Base64 for a PDF; the raw string for text. */
  data: string;
  /** Shown against every citation that comes out of it. */
  title?: string;
}

/**
 * A span the model says it took from a document, and where in it.
 *
 * Not the model's account of what it copied — the API returns these, so a
 * quote carrying one is a quote that can be checked against the file rather
 * than trusted. See `lib/cite.ts` for what the app does with them.
 */
export interface Citation {
  /** Verbatim from the document. */
  text: string;
  /** 1-indexed, for a PDF. Absent for plain text. */
  page?: number;
  title?: string;
}

interface AskOptions {
  system: string;
  messages: Turn[];
  maxTokens?: number;
  /**
   * Documents to attach to the last user message, before the text.
   *
   * A syllabus flattened to text by pdf.js has lost the one thing that makes
   * it readable — a table with weeks down the left and dates across, where
   * column alignment is the only thing saying which date belongs to which
   * reading. Sent whole, the model sees the page.
   */
  docs?: Doc[];
  /**
   * Ask the API to cite what it used.
   *
   * All-or-none across the documents in a request, which is why it is one
   * flag rather than a property of each. Incompatible with structured
   * outputs, so anything using this parses JSON out of the text itself.
   */
  cite?: boolean;
  /** Told about each citation as it arrives. */
  onCitation?: (c: Citation) => void;
  /**
   * Cache the system prompt.
   *
   * Worth it wherever the same large block of course material opens every
   * request. Caching is a prefix match, so this only helps if the system
   * prompt is byte-identical between calls — a timestamp in it silently
   * costs the whole saving.
   */
  cache?: boolean;
  /**
   * Images to attach to the last user message.
   *
   * The API wants them before the text in the same content array — a picture
   * followed by the question about it reads better to the model than the
   * reverse, and it is what the documentation specifies.
   */
  images?: Shot[];
  /**
   * Let the model think before answering.
   *
   * Worth it for reading a photograph of a whiteboard or taking an assignment
   * apart; wasted on a short question. Thinking blocks arrive as their own
   * delta type, which the reader below ignores, so nothing leaks into the text.
   */
  think?: boolean;
  onText?: (chunk: string) => void;
  signal?: AbortSignal;
}

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | {
      type: 'document';
      source:
        | { type: 'base64'; media_type: string; data: string }
        | { type: 'text'; media_type: 'text/plain'; data: string };
      title?: string;
      citations?: { enabled: true };
    };

/**
 * A citation as the wire sends it.
 *
 * The shape depends on what was cited: a PDF gives page numbers, plain text
 * gives character offsets. Only the page is useful to a person, so the rest
 * is read and dropped.
 */
interface RawCitation {
  type?: string;
  cited_text?: string;
  document_title?: string | null;
  start_page_number?: number;
  end_page_number?: number;
}

/** One wire citation, or null if there is nothing usable in it. */
export function readCitation(raw: RawCitation): Citation | null {
  const text = (raw?.cited_text ?? '').trim();
  if (!text) return null;
  const page = raw.start_page_number;
  return {
    text,
    ...(typeof page === 'number' && page > 0 ? { page } : {}),
    ...(raw.document_title ? { title: raw.document_title } : {}),
  };
}

/**
 * The messages array, with documents and images hung off the final user turn.
 *
 * Both go before the text. A picture followed by the question about it reads
 * better to the model than the reverse, and for documents it is what the
 * documentation specifies.
 */
export function withAttachments(
  messages: Turn[],
  images: Shot[] | undefined,
  docs: Doc[] | undefined,
  cite = false,
) {
  const hasImages = images && images.length > 0;
  const hasDocs = docs && docs.length > 0;
  if (!hasImages && !hasDocs) return messages;

  const last = messages.length - 1;
  return messages.map((m, i) => {
    if (i !== last || m.role !== 'user') return m;
    const blocks: Block[] = [
      ...(docs ?? []).map((d) => ({
        type: 'document' as const,
        source:
          d.mediaType === 'text/plain'
            ? { type: 'text' as const, media_type: 'text/plain' as const, data: d.data }
            : { type: 'base64' as const, media_type: d.mediaType, data: d.data },
        ...(d.title ? { title: d.title } : {}),
        // All-or-none across a request: one document with citations on and
        // another with it off is rejected.
        ...(cite ? { citations: { enabled: true as const } } : {}),
      })),
      ...(images ?? []).map((img) => ({
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
      })),
      { type: 'text' as const, text: m.content },
    ];
    return { role: m.role, content: blocks };
  });
}

/**
 * One call to the Messages API, streamed.
 *
 * Returns the whole reply; `onText` sees it arriving. Errors come back as
 * thrown Errors with the API's own wording, which is more use than "something
 * went wrong".
 */
export async function ask(options: AskOptions): Promise<string> {
  const s = settings();
  const taking = route(s);
  if (taking === 'none') {
    throw new Error(
      s.provider === 'openai'
        ? 'No OpenAI key yet. Add one under Ask Claude → Settings, or switch back to Claude.'
        : 'No key yet. Sign in to use the shared one, or add your own under Settings.',
    );
  }

  // The one branch in the whole app that knows there are two providers.
  // Everything above this — the guides, the email drafting, the diagrams, the
  // problem solver — calls ask() and never learns which company answered.
  if (taking === 'openai') {
    return askOpenAI({
      apiKey: s.openaiKey,
      model: s.openaiModel,
      system: options.system,
      messages: options.messages,
      maxTokens: options.maxTokens,
      images: options.images,
      onText: options.onText,
      signal: options.signal,
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  let url: string;

  if (taking === 'proxy') {
    // A proxy holds its own credentials; nothing goes in the headers.
    url = `${s.proxy.trim().replace(/\/$/, '')}/v1/messages`;
  } else if (taking === 'shared') {
    // The function verifies the account and meters the call.
    url = sharedEndpoint();
    headers.Authorization = `Bearer ${sessionToken}`;
  } else {
    url = 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = s.apiKey.trim();
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      signal: options.signal,
      body: JSON.stringify({
        model: s.model,
        max_tokens: options.maxTokens ?? 1400,
        // A cached system prompt is sent as a block so the breakpoint can sit
        // on it. Plain string otherwise, which is the shorter wire form.
        system: options.cache
          ? [{ type: 'text', text: options.system, cache_control: { type: 'ephemeral' } }]
          : options.system,
        stream: true,
        ...(options.think ? { thinking: { type: 'adaptive' } } : {}),
        messages: withAttachments(options.messages, options.images, options.docs, options.cite),
      }),
    });
  } catch (e) {
    throw explainNetworkError(taking, e);
  }

  if (!res.ok || !res.body) {
    let detail = `${res.status}`;
    try {
      // Anthropic nests it; Supabase's gateway does not. Read either.
      const body = (await res.json()) as { error?: { message?: string }; message?: string };
      detail = body.error?.message ?? body.message ?? detail;
    } catch {
      /* keep the status */
    }
    throw new Error(explainAskError(taking, res.status, detail));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // The last piece may be half a line; keep it for the next read.
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const event = JSON.parse(payload) as {
          type: string;
          delta?: { type?: string; text?: string; citation?: RawCitation };
        };
        if (event.type === 'content_block_delta' && event.delta?.text) {
          text += event.delta.text;
          options.onText?.(event.delta.text);
        }
        // Citations arrive on their own delta type against the text block
        // they belong to. The text is unaffected — a citation is a reference
        // to the source, not something the model wrote.
        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'citations_delta' &&
          event.delta.citation
        ) {
          const c = readCitation(event.delta.citation);
          if (c) options.onCitation?.(c);
        }
      } catch {
        // A partial or unknown event. Skipping it is correct.
      }
    }
  }

  return text;
}

/**
 * Ask for study cards and get back cards, or nothing.
 *
 * The prompt asks for JSON and the parser refuses anything else. A card that
 * cannot be read cleanly is dropped rather than half-guessed — these go into
 * the drill, and a wrong card is worse than a missing one.
 */
export async function makeCards(
  material: string,
  context: string,
  signal?: AbortSignal,
): Promise<StudyCard[]> {
  const reply = await ask({
    signal,
    maxTokens: 2000,
    cache: true,
    system:
      'You write study cards for a university student, from material they give you. ' +
      'Reply with JSON only: {"cards":[{"q":"…","a":"…"}]}. ' +
      'Each q is a question an exam could actually ask. Each a is the full answer in prose, ' +
      'with the specific numbers, names and mechanisms in it — never a hint, never a topic label. ' +
      'Use only what the material says. If it does not support a card, leave it out. ' +
      'Between 3 and 15 cards.',
    messages: [
      { role: 'user', content: `Course context:\n${context}\n\nMaterial:\n${material}` },
    ],
  });

  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(reply.slice(start, end + 1)) as { cards?: StudyCard[] };
    return (parsed.cards ?? [])
      .filter((c) => typeof c?.q === 'string' && typeof c?.a === 'string' && c.q && c.a)
      .map((c) => ({ q: c.q.trim(), a: c.a.trim() }));
  } catch {
    return [];
  }
}

/**
 * Check a key by using it, before it is saved.
 *
 * A key typed with a trailing space, or a project id pasted by mistake, fails
 * at the moment it matters — halfway through generating a course from a
 * syllabus somebody just spent five minutes uploading. One cheap call up front
 * turns that into a sentence on the screen where the key was typed.
 */
export async function checkKey(apiKey: string): Promise<{ ok: boolean; detail: string }> {
  const key = apiKey.trim();
  if (!key) return { ok: false, detail: 'No key given.' };
  if (!/^sk-ant-/.test(key)) {
    return {
      ok: false,
      detail:
        'That does not look like an Anthropic API key — they begin sk-ant-. A key is not the ' +
        'same as your claude.ai login, and not the same as an organisation id.',
    };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      // The smallest call that proves the key works: one token, cheapest model.
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    if (res.ok) return { ok: true, detail: 'Key works.' };

    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const said = body.error?.message ?? `${res.status}`;
    if (res.status === 401) return { ok: false, detail: `${said}\n\nThe key was refused.` };
    if (res.status === 400 && /credit|balance/i.test(said)) {
      return {
        ok: false,
        detail: `${said}\n\nThe key is valid but the account has no credit. Add some at console.anthropic.com under Billing.`,
      };
    }
    return { ok: false, detail: said };
  } catch (e) {
    return {
      ok: false,
      detail: `${e instanceof Error ? e.message : String(e)}\n\nCould not reach the API to check.`,
    };
  }
}

/**
 * Read a photograph of course material and turn it into cards.
 *
 * The case this exists for: the board at the end of a lecture, a page of a
 * textbook, a printed handout with no digital copy. Typing those up is the
 * reason material never makes it into a study app at all.
 *
 * The same refusal as everywhere else applies — it transcribes and organises
 * what is in the picture and does not invent around it, because a card you
 * cannot trace to the board is a card that gets drilled and believed.
 */
export async function readShots(
  images: Shot[],
  context: string,
  signal?: AbortSignal,
): Promise<{ cards: StudyCard[]; note: string }> {
  const reply = await ask({
    signal,
    images,
    think: true,
    maxTokens: 3000,
    system:
      'You are reading photographs of a university student\'s course material — a lecture ' +
      'board, a page of notes, a handout, a slide. Transcribe and organise; do not invent.\n\n' +
      'Reply with JSON only: {"note":"…","cards":[{"q":"…","a":"…"}]}\n\n' +
      '- note: what the picture actually shows, in one or two sentences. Say plainly if it is ' +
      'unreadable, blurred, or not course material at all — and then return no cards.\n' +
      '- cards: questions an exam could ask, answered from what is written in the image, with ' +
      'the specific numbers, names and steps that appear there. Between 0 and 12.\n' +
      '- Anything you cannot read, leave out. Do not fill a gap from general knowledge, and do ' +
      'not guess at a word that is cut off or out of focus.',
    messages: [
      {
        role: 'user',
        content: `Course context:\n${context}\n\nRead these and make cards from what they show.`,
      },
    ],
  });

  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end === -1) return { cards: [], note: '' };
  try {
    const parsed = JSON.parse(reply.slice(start, end + 1)) as {
      cards?: StudyCard[];
      note?: string;
    };
    return {
      note: typeof parsed.note === 'string' ? parsed.note.trim() : '',
      cards: (parsed.cards ?? [])
        .filter((c) => typeof c?.q === 'string' && typeof c?.a === 'string' && c.q && c.a)
        .map((c) => ({ q: c.q.trim(), a: c.a.trim() })),
    };
  } catch {
    return { cards: [], note: '' };
  }
}
