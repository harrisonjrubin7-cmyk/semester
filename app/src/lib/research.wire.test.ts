// @vitest-environment jsdom
/**
 * Whether the search tool actually goes out, and its results actually come back.
 *
 * `research.test.ts` is pure and proves what the pieces do. It cannot see the
 * two things most likely to be wrong: whether the tool reaches the request at
 * all, and whether a failed search is read as a failure rather than as an
 * empty world. The second is the one that matters — a search that errors
 * returns HTTP 200, so the screen's honest "nothing came up" and its dishonest
 * one look identical from everywhere except here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ask } from './claude';
import { saveSettings } from './assistant';
import { MOST_SEARCHES, type Found } from './research';
import { forget } from './spend';

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

/** A search result block, as the API streams it: complete at its start. */
const results = (rows: { url: string; title?: string }[]) => ({
  type: 'content_block_start',
  content_block: { type: 'web_search_tool_result', content: rows },
});

const searchFailed = (code: string) => ({
  type: 'content_block_start',
  content_block: {
    type: 'web_search_tool_result',
    content: { type: 'web_search_tool_result_error', error_code: code },
  },
});

let sent: Record<string, unknown> | null = null;

function catchRequest(events: object[]) {
  vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return Promise.resolve(stream(events));
  });
}

/** The tools on the outgoing request, whatever else is in the body. */
const toolsSent = () => (sent?.tools ?? []) as { type?: string; name?: string }[];

beforeEach(() => {
  saveSettings({
    provider: 'anthropic',
    apiKey: 'sk-ant-test',
    model: 'claude-opus-5',
    proxy: '',
    openaiKey: '',
    openaiModel: '',
  });
  sent = null;
});

afterEach(() => {
  forget();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('what goes out', () => {
  it('sends no search tool unless the caller asked for one', async () => {
    // The control, and the claim the rest of the app depends on: Ask Claude,
    // the study tools and the drafting tools do not reach the web.
    catchRequest([said('ok')]);
    await ask({ system: 's', messages: [{ role: 'user', content: 'q' }] });
    expect(sent).not.toHaveProperty('tools');
  });

  it('sends it when asked, capped, on the type this model takes', async () => {
    catchRequest([said('ok')]);
    await ask({ system: 's', messages: [{ role: 'user', content: 'q' }], search: true });
    const web = toolsSent().find((t) => t.name === 'web_search');
    expect(web).toBeTruthy();
    expect(web?.type).toBe('web_search_20260209');
    expect((web as { max_uses?: number }).max_uses).toBe(MOST_SEARCHES);
  });

  it('sends the basic type on a model that predates the dated one', async () => {
    saveSettings({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5',
      proxy: '',
      openaiKey: '',
      openaiModel: '',
    });
    catchRequest([said('ok')]);
    await ask({ system: 's', messages: [{ role: 'user', content: 'q' }], search: true });
    expect(toolsSent().find((t) => t.name === 'web_search')?.type).toBe('web_search_20250305');
  });

  it('carries the caller’s own tools alongside it, with their schemas intact', async () => {
    // Research sends none today, but a server tool that quietly dropped the
    // client ones would break every proposal in the app the day one is added.
    catchRequest([said('ok')]);
    await ask({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      search: true,
      tools: [
        {
          name: 'open_screen',
          description: 'Go to a screen.',
          input_schema: { type: 'object', properties: { screen: { type: 'string' } } },
        },
      ],
    });
    expect(toolsSent().map((t) => t.name).sort()).toEqual(['open_screen', 'web_search']);
    const mine = toolsSent().find((t) => t.name === 'open_screen');
    expect(mine).toHaveProperty('input_schema');
    expect(mine).not.toHaveProperty('type');
  });
});

describe('what comes back', () => {
  it('hands over the pages a search found', async () => {
    const found: Found[] = [];
    catchRequest([
      results([{ url: 'https://www.jstor.org/stable/2009958', title: 'Deterrence and Perception' }]),
      said('Two positions dominate.'),
    ]);
    const text = await ask({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      search: true,
      onFound: (f) => found.push(...f),
    });

    expect(text).toBe('Two positions dominate.');
    expect(found).toHaveLength(1);
    expect(found[0].site).toBe('jstor.org');
  });

  it('reports a failed search as a failure, not as an empty world', async () => {
    /*
     * The whole reason this file exists. The request succeeds — HTTP 200, a
     * normal stream — and the error rides inside a result block. Read as
     * results, it is an empty list, and the screen says nothing came up: a
     * claim about the literature, made from a request that never ran.
     */
    const found: Found[] = [];
    const trouble: string[] = [];
    catchRequest([searchFailed('max_uses_exceeded'), said('I could not search.')]);
    await ask({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      search: true,
      onFound: (f) => found.push(...f),
      onSearchTrouble: (t) => trouble.push(t),
    });

    expect(found).toEqual([]);
    expect(trouble).toHaveLength(1);
    expect(trouble[0]).toContain(String(MOST_SEARCHES));
  });

  it('does not raise on a search failure, because the request did not fail', async () => {
    // A thrown error here would lose the answer streaming alongside it.
    catchRequest([searchFailed('unavailable'), said('Nothing to go on.')]);
    await expect(
      ask({ system: 's', messages: [{ role: 'user', content: 'q' }], search: true }),
    ).resolves.toBe('Nothing to go on.');
  });
});
