import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askOpenAI, explain, readChunk, toMessages } from './openai';

describe('toMessages', () => {
  it('turns a top-level system prompt into a system message', () => {
    const out = toMessages('Be brief.', [{ role: 'user', content: 'Hello' }]);
    expect(out[0]).toEqual({ role: 'system', content: 'Be brief.' });
    expect(out[1]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('keeps a conversation in order', () => {
    const out = toMessages('s', [
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
    ]);
    expect(out.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });

  it('turns an image into a data URL on the last user turn', () => {
    // Getting this wrong gives a request that is accepted and silently ignores
    // the picture, which is worse than one that fails.
    const out = toMessages('s', [{ role: 'user', content: 'What is this?' }], [
      { mediaType: 'image/png', data: 'AAAA' },
    ]);
    const parts = out[1].content as { type: string; image_url?: { url: string } }[];
    expect(parts[0].type).toBe('image_url');
    expect(parts[0].image_url?.url).toBe('data:image/png;base64,AAAA');
    expect(parts[1]).toEqual({ type: 'text', text: 'What is this?' });
  });

  it('puts the image on the last user turn, not the first', () => {
    const out = toMessages(
      's',
      [
        { role: 'user', content: 'earlier' },
        { role: 'assistant', content: 'ok' },
        { role: 'user', content: 'look at this' },
      ],
      [{ mediaType: 'image/jpeg', data: 'B' }],
    );
    expect(typeof out[1].content).toBe('string');
    expect(Array.isArray(out[3].content)).toBe(true);
  });

  it('leaves the turn a plain string when there are no images', () => {
    const out = toMessages('s', [{ role: 'user', content: 'Hello' }], []);
    expect(out[1].content).toBe('Hello');
  });
});

describe('readChunk', () => {
  it('reads a delta', () => {
    expect(readChunk('data: {"choices":[{"delta":{"content":"Hi"}}]}')).toBe('Hi');
  });

  it('ignores the terminator, which is not JSON', () => {
    expect(readChunk('data: [DONE]')).toBeNull();
  });

  it('ignores a keep-alive and a blank line', () => {
    expect(readChunk(': keep-alive')).toBeNull();
    expect(readChunk('')).toBeNull();
    expect(readChunk('data: ')).toBeNull();
  });

  it('ignores a chunk that carries no content, like a role announcement', () => {
    expect(readChunk('data: {"choices":[{"delta":{"role":"assistant"}}]}')).toBeNull();
    expect(readChunk('data: {"choices":[{"delta":{"content":""}}]}')).toBeNull();
  });

  it('survives a half-arrived line rather than throwing mid-stream', () => {
    expect(readChunk('data: {"choices":[{"delta":{"cont')).toBeNull();
  });

  it('does not lose a delta that is only whitespace', () => {
    // A space between two words is a real part of the answer.
    expect(readChunk('data: {"choices":[{"delta":{"content":" "}}]}')).toBe(' ');
  });
});

describe('explain', () => {
  it('names the app as the place to fix a bad key', () => {
    expect(explain(401, '')).toContain('Settings');
  });

  it('separates out of credit from going too fast, which share a status', () => {
    expect(explain(429, 'You exceeded your current quota')).toContain('out of credit');
    expect(explain(429, 'Rate limit reached')).toContain('Wait a few seconds');
  });

  it('suggests a model the account is likelier to have', () => {
    expect(explain(403, '')).toContain('GPT-4o');
    expect(explain(404, 'The model `gpt-9` does not exist')).toContain('Pick another');
  });

  it('says a server error is not the student’s fault', () => {
    expect(explain(503, '')).toContain('Nothing here is wrong');
  });

  it('passes an unrecognised error through rather than guessing', () => {
    expect(explain(418, 'teapot')).toBe('teapot');
  });
});

// ── The wire ──────────────────────────────────────────────────────────────

/** An SSE body in the shape this API streams, line by line. */
function stream(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const l of lines) controller.enqueue(enc.encode(`${l}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

const delta = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`;

const call = (lines: string[]) => {
  vi.stubGlobal('fetch', () => Promise.resolve(stream(lines)));
  return askOpenAI({ apiKey: 'sk-test', model: 'gpt-5', system: 's', messages: [{ role: 'user', content: 'q' }] });
};

describe('a stream that stopped rather than ended', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  /*
   * `[DONE]` is the sentence this API closes with, and `readChunk` was
   * already reading it — to skip it, which is not the same as noticing it.
   * Without that, a connection dropped mid-answer read exactly like a
   * finished one. The same repair, and what it cost, is in `lib/claude.ts`.
   */
  it('takes the terminator as the answer having ended', async () => {
    let why = '';
    vi.stubGlobal('fetch', () => Promise.resolve(stream([delta('All of it'), 'data: [DONE]'])));
    const text = await askOpenAI({
      apiKey: 'sk-test', model: 'gpt-5', system: 's',
      messages: [{ role: 'user', content: 'q' }],
      onStop: (r) => { why = r; },
    });
    expect(text).toBe('All of it');
    expect(why).toBe('');
  });

  it('calls a stream that stopped without it cut, and keeps the words', async () => {
    let why = '';
    vi.stubGlobal('fetch', () => Promise.resolve(stream([delta('Half a sen')])));
    const text = await askOpenAI({
      apiKey: 'sk-test', model: 'gpt-5', system: 's',
      messages: [{ role: 'user', content: 'q' }],
      onStop: (r) => { why = r; },
    });
    expect(text).toBe('Half a sen');
    expect(why).toBe('cut');
  });

  it('throws rather than returning an empty answer when nothing arrived', async () => {
    await expect(call([])).rejects.toThrow(/connection closed/i);
    await expect(call(['data: {oh no'])).rejects.toThrow(/connection closed/i);
  });
});
