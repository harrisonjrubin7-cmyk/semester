/**
 * Whether the shared Claude key can be sent at all, and what a failed send was.
 *
 * On 29 September 2026 the key was set on production and every signed-in call
 * still answered 502, "Claude could not be reached", with nothing in the logs:
 * the `fetch` to Anthropic threw, and `claude/index.ts` deliberately does not
 * repeat a thrown message. Two causes look identical from outside. A value
 * that cannot travel as a header (the `…` of the `sk-ant-…` placeholder, a
 * curly quote, a line break in the middle) makes `fetch` throw before
 * anything is sent. A network failure throws too. And each one cost a
 * student one of their sixty calls for a request that never left.
 *
 * So the key is checked once, before anybody is authenticated or counted, and
 * a key that cannot be sent is refused as a configuration fault in plain
 * words. A send that still throws is logged as a kind, never as its message,
 * which can carry the upstream address and, depending on the runtime, what
 * was being sent. Nothing here ever returns or logs a character of the key.
 */

/**
 * What a key has to be to be sent: printable ASCII with no spaces and no
 * quote marks. Anthropic's keys are letters, digits, `-` and `_`. Anything
 * else is a paste that went wrong, and sending it can only fail.
 */
const SENDABLE = /^[\x21-\x7e]+$/;
const QUOTES = /["'`]/;

/** The shape of a key, for a log line: never a character of it. */
export interface KeyShape {
  length: number;
  /** Starts `sk-ant-`, as every Anthropic API key does. */
  anthropicPrefix: boolean;
  /** Characters above U+007E, which `fetch` refuses to put in a header. */
  outsideAscii: number;
  /** Spaces, tabs or line breaks inside the key. */
  whitespace: number;
  /** Quote marks, which usually mean the value was pasted with its quotes. */
  quotes: number;
  sendable: boolean;
}

/** The key as the function should send it: surrounding whitespace dropped, as a header would drop it. */
export function sharedKey(raw: string | undefined): string {
  return (raw ?? '').trim();
}

export function keyShape(key: string): KeyShape {
  let outsideAscii = 0;
  let whitespace = 0;
  let quotes = 0;
  for (const ch of key) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x7e) outsideAscii += 1;
    else if (/\s/.test(ch)) whitespace += 1;
    else if (QUOTES.test(ch)) quotes += 1;
  }
  return {
    length: key.length,
    anthropicPrefix: key.startsWith('sk-ant-'),
    outsideAscii,
    whitespace,
    quotes,
    sendable: key.length > 0 && SENDABLE.test(key) && quotes === 0,
  };
}

/** What a caller is told when the key is set but cannot be used. */
export const KEY_UNUSABLE_MESSAGE =
  "This deployment's shared key is set but cannot be used. Add your own under Ask Claude → Settings.";

/** The kind of a thrown `fetch`, for a log line: never the message itself. */
export type ThrowKind = 'header' | 'network' | 'other';

export function describeThrow(e: unknown): { name: string; kind: ThrowKind } {
  const name = e instanceof Error ? e.name : typeof e;
  const message = e instanceof Error ? e.message : '';
  const kind: ThrowKind = /header|bytestring/i.test(message)
    ? 'header'
    : /dns|lookup|connect|refused|reset|tls|certificate|timed? ?out|sending request|network/i.test(message)
      ? 'network'
      : 'other';
  return { name, kind };
}
