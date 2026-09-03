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

const SETTINGS_KEY = 'semester.claude.v1';

export interface ClaudeSettings {
  apiKey: string;
  /** A server that holds the key instead of this browser. Preferred. */
  proxy: string;
  model: string;
}

export const MODELS = [
  { id: 'claude-sonnet-5', label: 'Sonnet 5', note: 'Fast. The right default.' },
  { id: 'claude-opus-5', label: 'Opus 5', note: 'Slower, better at hard explanation.' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', note: 'Cheapest.' },
];

const DEFAULTS: ClaudeSettings = { apiKey: '', proxy: '', model: 'claude-sonnet-5' };

export function settings(): ClaudeSettings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as object) };
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
  return Boolean(s.proxy.trim() || s.apiKey.trim() || (sessionToken && sharedEndpoint()));
}

/** Which of the three routes a call will take — the UI says so plainly. */
export function route(s = settings()): 'proxy' | 'shared' | 'own' | 'none' {
  if (s.proxy.trim()) return 'proxy';
  if (s.apiKey.trim()) return 'own';
  if (sessionToken && sharedEndpoint()) return 'shared';
  return 'none';
}

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface AskOptions {
  system: string;
  messages: Turn[];
  maxTokens?: number;
  /** Called with each new piece of text as it arrives. */
  onText?: (chunk: string) => void;
  signal?: AbortSignal;
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
    throw new Error('No key yet. Sign in to use the shared one, or add your own under Settings.');
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

  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal: options.signal,
    body: JSON.stringify({
      model: s.model,
      max_tokens: options.maxTokens ?? 1400,
      system: options.system,
      stream: true,
      messages: options.messages,
    }),
  });

  if (!res.ok || !res.body) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      /* keep the status */
    }
    throw new Error(detail);
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
          delta?: { text?: string };
        };
        if (event.type === 'content_block_delta' && event.delta?.text) {
          text += event.delta.text;
          options.onText?.(event.delta.text);
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
