// @vitest-environment jsdom
/**
 * Whether what the student said actually leaves with a request.
 *
 * The model in `aboutme.test.ts` is pure and proves nothing about this. A
 * preference list that is stored, rendered, capped and never sent is the
 * failure this feature is most likely to have, and it is invisible from the
 * screen: the assistant answers, it just answers as though nobody had said
 * anything, which is what it did before.
 *
 * So this catches the request on its way out and reads the system prompt. It
 * is written against `ask` rather than against any one screen because `ask` is
 * the single door — the claim being tested is that *every* feature inherits
 * this, and there is no way to test "every" at twenty-five call sites.
 *
 * ## The controls
 *
 * Three, and they are the point of the file as much as the positive case is:
 *
 * - **Nothing said sends nothing.** Not an empty block, not a stray blank
 *   line — the byte-identical prompt the app sent before this existed.
 * - **A deleted line stops travelling.** A memory you cannot remove is a
 *   different feature from the one on the screen.
 * - **The caller's own prompt is unchanged.** Every one of those twenty-five
 *   callers wrote its instructions to sit where they sit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ask } from './claude';
import { saveSettings } from './assistant';
import { addFact, dropFact, hold, preamble, type Fact } from './aboutme';
import { forget } from './spend';

/** An SSE body in the shape the Messages API streams. */
function stream(events: object[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const e of events) controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

const said = (text: string) => ({
  type: 'content_block_delta',
  delta: { type: 'text_delta', text },
});

let sent: { url: string; body: Record<string, unknown> } | null = null;

function catchRequest() {
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    sent = { url: String(url), body: JSON.parse(String(init.body)) };
    return Promise.resolve(stream([said('ok')]));
  });
}

/** The system prompt as it went, whichever wire form it took. */
function systemSent(): string {
  const s = sent!.body.system;
  if (typeof s === 'string') return s;
  return (s as { text: string }[]).map((b) => b.text).join('');
}

const CALLER = 'You are helping a university student with their own coursework.';

const one = async () => {
  catchRequest();
  await ask({ system: CALLER, messages: [{ role: 'user', content: 'q' }] });
};

beforeEach(() => {
  saveSettings({
    provider: 'anthropic',
    apiKey: 'sk-ant-test',
    model: 'claude-opus-5',
    proxy: '',
    openaiKey: '',
    openaiModel: '',
  });
  hold([]);
  sent = null;
});

afterEach(() => {
  hold([]);
  forget();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('what the student said, on the wire', () => {
  it('sends the caller’s prompt and nothing else when nothing has been said', async () => {
    // The control. `claude.test.ts` asserts this same equality from the other
    // side, without knowing this feature exists; if either goes red, every
    // cached system prompt in the app has quietly changed.
    await one();
    expect(systemSent()).toBe(CALLER);
  });

  it('appends the lines once something has been said', async () => {
    hold(addFact([], 'Professor Larsen wants Chicago footnotes'));
    await one();
    expect(systemSent()).toContain('Professor Larsen wants Chicago footnotes');
  });

  it('leaves the caller’s own instructions where the caller put them', async () => {
    // Appended, not prepended and not interleaved. The refusal in
    // `screens/Work.tsx` is written as the opening of its system prompt.
    const list = addFact([], 'I am dyslexic — headings and short paragraphs');
    hold(list);
    await one();
    expect(systemSent()).toBe(`${CALLER}\n\n${preamble(list)}`);
  });

  it('stops sending a line that was deleted', async () => {
    let list: Fact[] = addFact([], 'I lose steam after 9pm');
    hold(list);
    await one();
    expect(systemSent()).toContain('after 9pm');

    list = dropFact(list, list[0].id);
    hold(list);
    await one();
    expect(systemSent()).not.toContain('after 9pm');
    // And all the way back to the untouched prompt, not to a leftover header.
    expect(systemSent()).toBe(CALLER);
  });

  it('travels on a cached prompt too, inside the cached block', async () => {
    // `cache: true` sends the system prompt as a block with the breakpoint on
    // it. Anything appended outside that block would not be cached and,
    // worse, would not be sent at all.
    hold(addFact([], 'Chicago footnotes'));
    catchRequest();
    await ask({ system: CALLER, messages: [{ role: 'user', content: 'q' }], cache: true });
    const blocks = sent!.body.system as { text: string; cache_control: unknown }[];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[0].text).toContain('Chicago footnotes');
  });

  it('travels on the OpenAI route as well', async () => {
    /*
     * The second provider is the half a single-door test is most likely to
     * miss: `ask` branches to `askOpenAI` before it reaches the Anthropic
     * body, so an injection written into only the second half would pass
     * every test above and silently drop the student's preferences for
     * anybody who switched provider.
     */
    saveSettings({
      provider: 'openai',
      apiKey: '',
      model: 'claude-opus-5',
      proxy: '',
      openaiKey: 'sk-openai-test',
      openaiModel: 'gpt-5',
    });
    hold(addFact([], 'Chicago footnotes'));
    // That route reads a different stream format, so it gets its own canned
    // reply rather than the Messages API one above.
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      sent = { url: String(url), body: JSON.parse(String(init.body)) };
      const chunks = [
        `data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}`,
        'data: [DONE]',
      ];
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              const enc = new TextEncoder();
              for (const c of chunks) controller.enqueue(enc.encode(`${c}\n\n`));
              controller.close();
            },
          }),
          { status: 200 },
        ),
      );
    });
    await ask({ system: CALLER, messages: [{ role: 'user', content: 'q' }] });

    const messages = sent!.body.messages as { role: string; content: unknown }[];
    const system = messages.filter((m) => m.role === 'system' || m.role === 'developer');
    expect(JSON.stringify(system)).toContain('Chicago footnotes');
  });
});
