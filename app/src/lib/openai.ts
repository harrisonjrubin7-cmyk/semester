/**
 * A second provider, so the app is not one company's tenant.
 *
 * The point of this file is not that GPT is better or worse than Claude at
 * explaining macroeconomics. It is that an app a student keeps a semester in
 * should not stop working because one account lapses, one key is revoked, or
 * one service is down the night before a midterm. So `ask()` in `claude.ts`
 * dispatches on a provider setting, and everything above it — the guides, the
 * email drafting, the diagrams, the problem solver — is unchanged and unaware.
 *
 * ## The shapes that differ
 *
 * Both stream server-sent events and both take images, but nothing about
 * either is the same, so this translates rather than pretends:
 *
 * - The system prompt is a top-level field for Anthropic and a message with
 *   `role: "system"` for OpenAI.
 * - Images are base64 in a typed source block for Anthropic and a `data:` URL
 *   in an `image_url` block for OpenAI.
 * - Deltas arrive as `content_block_delta` there and as `choices[].delta` here.
 * - Anthropic's extended thinking has no direct equivalent; asking for it is
 *   silently a no-op rather than an error, which is the honest way to degrade.
 *
 * ## The key
 *
 * There is no shared-key route here. The Edge Function holds an Anthropic key
 * and nothing else, so using this means putting your own OpenAI key in this
 * browser, where anyone with the device can read it out of local storage. It
 * is a billable key with no spend cap of its own. The screen says that in
 * those words before the field, not after it.
 */

import type { Shot, Turn } from './claude';

export const OPENAI_MODELS = [
  { id: 'gpt-5', label: 'GPT-5', note: 'The strongest of these at a hard explanation.' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini', note: 'Faster and cheaper. Fine for most asking.' },
  { id: 'gpt-4.1', label: 'GPT-4.1', note: 'The previous generation, still capable.' },
  { id: 'gpt-4o', label: 'GPT-4o', note: 'Older, widely available, reads images well.' },
];

export const DEFAULT_MODEL = 'gpt-5';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

type Part =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface Msg {
  role: 'system' | 'user' | 'assistant';
  content: string | Part[];
}

/**
 * Anthropic's message list, as OpenAI wants it.
 *
 * Images go on the last user turn in both, but as a data URL rather than a
 * base64 field with its media type beside it. Exported for its test: getting
 * this wrong produces a request that is accepted and silently ignores the
 * picture, which is worse than one that fails.
 */
export function toMessages(system: string, turns: Turn[], images?: Shot[]): Msg[] {
  const out: Msg[] = [{ role: 'system', content: system }];
  const last = turns.length - 1;

  turns.forEach((turn, i) => {
    if (i === last && turn.role === 'user' && images && images.length > 0) {
      out.push({
        role: 'user',
        content: [
          ...images.map(
            (img): Part => ({
              type: 'image_url',
              image_url: { url: `data:${img.mediaType};base64,${img.data}` },
            }),
          ),
          { type: 'text', text: turn.content },
        ],
      });
      return;
    }
    out.push({ role: turn.role, content: turn.content });
  });

  return out;
}

/**
 * One delta out of an SSE line, or null.
 *
 * Split out so the parsing is testable without a network. The two cases that
 * actually occur and would otherwise break a stream: `[DONE]`, which is not
 * JSON, and a keep-alive comment line, which is not data.
 */
export function readChunk(line: string): string | null {
  if (!line.startsWith('data:')) return null;
  const body = line.slice(5).trim();
  if (!body || body === '[DONE]') return null;
  try {
    const json = JSON.parse(body) as {
      choices?: { delta?: { content?: unknown } }[];
    };
    const piece = json.choices?.[0]?.delta?.content;
    return typeof piece === 'string' && piece ? piece : null;
  } catch {
    // A partial line. The caller keeps the remainder and tries again.
    return null;
  }
}

/**
 * Why a call failed, in words a student can act on.
 *
 * 401 is the one that matters — it means the key is wrong or revoked, and the
 * fix is in this app rather than anywhere else. 429 splits two very different
 * problems that share a status code: out of quota, and going too fast.
 */
export function explain(status: number, detail: string): string {
  if (status === 401) {
    return 'OpenAI did not accept that key. Check it under Ask Claude → Settings — a revoked or mistyped key gives exactly this.';
  }
  if (status === 403) {
    return 'OpenAI refused the request. Often this is a model your account cannot use yet — try GPT-4o.';
  }
  if (status === 429) {
    return /quota|billing|insufficient/i.test(detail)
      ? 'That OpenAI key is out of credit. Add billing on the OpenAI account, or switch back to Claude.'
      : 'Too many requests in a row. Wait a few seconds and try again.';
  }
  if (status === 404 && /model/i.test(detail)) {
    return 'That model name is not one this key can reach. Pick another under Settings.';
  }
  if (status >= 500) return 'OpenAI is having trouble. Nothing here is wrong — try again shortly.';
  return detail || `OpenAI said ${status}.`;
}

export interface OpenAiAsk {
  apiKey: string;
  model: string;
  system: string;
  messages: Turn[];
  maxTokens?: number;
  images?: Shot[];
  onText?: (chunk: string) => void;
  signal?: AbortSignal;
}

/** One streamed call. Returns the whole reply; `onText` sees it arriving. */
export async function askOpenAI(options: OpenAiAsk): Promise<string> {
  const key = options.apiKey.trim();
  if (!key) throw new Error('No OpenAI key yet. Add one under Ask Claude → Settings.');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      messages: toMessages(options.system, options.messages, options.images),
      // The newer models name this differently, and sending the wrong one is a
      // 400 rather than a default, so both go in — the API ignores the one it
      // does not know.
      max_completion_tokens: options.maxTokens ?? 2000,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(explain(res.status, detail));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let whole = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Keep the trailing fragment: a delta can be cut mid-line by a chunk
    // boundary, and parsing half a JSON object drops that piece of the answer.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const piece = readChunk(line);
      if (piece === null) continue;
      whole += piece;
      options.onText?.(piece);
    }
  }

  return whole;
}
