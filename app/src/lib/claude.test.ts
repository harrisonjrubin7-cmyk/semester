// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ask, readCitation, withAttachments } from './claude';

const user = [{ role: 'user' as const, content: 'What is due first?' }];

const pdf = { mediaType: 'application/pdf', data: 'JVBERi0=', title: 'Econ1020.pdf' };
const shot = { mediaType: 'image/png', data: 'iVBOR' };

/** The blocks on the last user turn, whatever shape the turn came back in. */
function blocks(out: ReturnType<typeof withAttachments>) {
  const last = out[out.length - 1] as { content: unknown };
  return last.content as { type: string; [k: string]: unknown }[];
}

describe('what gets attached to a request', () => {
  it('leaves the messages alone when there is nothing to attach', () => {
    expect(withAttachments(user, undefined, undefined)).toBe(user);
    expect(withAttachments(user, [], [])).toBe(user);
  });

  it('puts a document before the question', () => {
    // A picture or a page followed by the question about it reads better to
    // the model than the reverse, and it is what the docs specify.
    const out = blocks(withAttachments(user, undefined, [pdf]));
    expect(out.map((b) => b.type)).toEqual(['document', 'text']);
    expect(out[1].text).toBe('What is due first?');
  });

  it('sends a PDF as base64 and plain text as text', () => {
    const asPdf = blocks(withAttachments(user, undefined, [pdf]))[0];
    expect(asPdf.source).toEqual({
      type: 'base64',
      media_type: 'application/pdf',
      data: 'JVBERi0=',
    });

    const asText = blocks(
      withAttachments(user, undefined, [{ mediaType: 'text/plain', data: 'Week 1' }]),
    )[0];
    expect(asText.source).toEqual({ type: 'text', media_type: 'text/plain', data: 'Week 1' });
  });

  it('asks for citations only when told to, and then on every document', () => {
    // All-or-none across a request: one document with citations on and
    // another with it off is rejected outright.
    const off = blocks(withAttachments(user, undefined, [pdf, pdf]));
    expect(off.filter((b) => b.type === 'document').every((b) => !b.citations)).toBe(true);

    const on = blocks(withAttachments(user, undefined, [pdf, pdf], true));
    expect(
      on.filter((b) => b.type === 'document').every((b) => (b.citations as object) !== undefined),
    ).toBe(true);
  });

  it('carries a title, and leaves it out when there is none', () => {
    expect(blocks(withAttachments(user, undefined, [pdf]))[0].title).toBe('Econ1020.pdf');
    expect(
      blocks(withAttachments(user, undefined, [{ mediaType: 'application/pdf', data: 'x' }]))[0],
    ).not.toHaveProperty('title');
  });

  it('keeps images working alongside documents', () => {
    const out = blocks(withAttachments(user, [shot], [pdf]));
    expect(out.map((b) => b.type)).toEqual(['document', 'image', 'text']);
  });

  it('attaches to the last user turn and no other', () => {
    const chat = [
      { role: 'user' as const, content: 'first' },
      { role: 'assistant' as const, content: 'reply' },
      { role: 'user' as const, content: 'second' },
    ];
    const out = withAttachments(chat, undefined, [pdf]);
    expect(out[0].content).toBe('first');
    expect(out[1].content).toBe('reply');
    expect(blocks(out).map((b) => b.type)).toEqual(['document', 'text']);
  });
});

describe('reading a citation off the wire', () => {
  it('takes the quoted text and the page it is on', () => {
    expect(
      readCitation({
        type: 'page_location',
        cited_text: 'Problem sets are due Fridays.',
        document_title: 'Econ1020.pdf',
        start_page_number: 4,
        end_page_number: 4,
      }),
    ).toEqual({ text: 'Problem sets are due Fridays.', page: 4, title: 'Econ1020.pdf' });
  });

  it('accepts a citation with no page — plain text has none', () => {
    expect(readCitation({ cited_text: 'Week 1: supply.' })).toEqual({ text: 'Week 1: supply.' });
  });

  it('drops a citation with nothing quoted in it', () => {
    expect(readCitation({ cited_text: '   ' })).toBeNull();
    expect(readCitation({})).toBeNull();
  });

  it('ignores a page number that is not one', () => {
    expect(readCitation({ cited_text: 'x y z', start_page_number: 0 })).toEqual({ text: 'x y z' });
  });
});


// ── The wire ──────────────────────────────────────────────────────────────
//
// The API is not reachable from a test, so the request is caught on its way
// out and a canned stream is fed back in. That covers the two things a live
// call could not tell us any better: what the app sends, and what it does
// with what comes back.

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

const citedAt = (text: string, page: number) => ({
  type: 'content_block_delta',
  delta: {
    type: 'citations_delta',
    citation: {
      type: 'page_location',
      cited_text: text,
      document_title: 'Econ1020.pdf',
      start_page_number: page,
      end_page_number: page,
    },
  },
});

let sent: { url: string; body: Record<string, unknown> } | null = null;

beforeEach(() => {
  localStorage.setItem(
    'semester.claude.v1',
    JSON.stringify({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-opus-5' }),
  );
  sent = null;
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

function catchRequest(events: object[]) {
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    sent = { url: String(url), body: JSON.parse(String(init.body)) };
    return Promise.resolve(stream(events));
  });
}

describe('what actually goes on the wire', () => {
  it('sends the document, asks for citations, and hands them back', async () => {
    catchRequest([
      said('Problem Set 1 is due 11 September.'),
      citedAt('Problem sets are due Fridays at 11:59 PM.', 4),
    ]);

    const got: unknown[] = [];
    const text = await ask({
      system: 'You read syllabi.',
      messages: [{ role: 'user', content: 'What is due first?' }],
      docs: [{ mediaType: 'application/pdf', data: 'JVBERi0=', title: 'Econ1020.pdf' }],
      cite: true,
      onCitation: (c) => got.push(c),
    });

    expect(text).toBe('Problem Set 1 is due 11 September.');
    expect(got).toEqual([
      { text: 'Problem sets are due Fridays at 11:59 PM.', page: 4, title: 'Econ1020.pdf' },
    ]);

    const blocks = (sent!.body.messages as { content: { type: string }[] }[])[0].content;
    expect(blocks.map((b) => b.type)).toEqual(['document', 'text']);
    expect((blocks[0] as { citations?: unknown }).citations).toEqual({ enabled: true });
  });

  it('marks the system prompt for caching only when asked', async () => {
    catchRequest([said('ok')]);
    await ask({ system: 'Stable instructions.', messages: [{ role: 'user', content: 'hi' }] });
    expect(sent!.body.system).toBe('Stable instructions.');

    catchRequest([said('ok')]);
    await ask({
      system: 'Stable instructions.',
      messages: [{ role: 'user', content: 'hi' }],
      cache: true,
    });
    expect(sent!.body.system).toEqual([
      { type: 'text', text: 'Stable instructions.', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('leaves the text alone when a citation arrives', async () => {
    // A citation is a reference to the source, not something the model wrote.
    // Folding it into the reply would corrupt the JSON the importer parses.
    catchRequest([said('{"items":['), citedAt('due Fridays', 4), said(']}')]);
    const chunks: string[] = [];
    const text = await ask({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      cite: true,
      onText: (c) => chunks.push(c),
    });
    expect(text).toBe('{"items":[]}');
    expect(chunks.join('')).toBe('{"items":[]}');
  });
});

describe('a tool the model wants to use', () => {
  const toolStart = (id: string, name: string) => ({
    type: 'content_block_start',
    content_block: { type: 'tool_use', id, name, input: {} },
  });
  const args = (partial_json: string) => ({
    type: 'content_block_delta',
    delta: { type: 'input_json_delta', partial_json },
  });
  const blockStop = { type: 'content_block_stop' };

  it('reassembles arguments that arrive in pieces', async () => {
    // The JSON streams as fragments; parsing before the block closes gets a
    // syntax error on half an object.
    catchRequest([
      said('Ticking that off.'),
      toolStart('toolu_1', 'tick_deadline'),
      args('{"id":"eco'),
      args('n-ps4","title":"Pro'),
      args('blem Set 4"}'),
      blockStop,
    ]);

    const calls: unknown[] = [];
    await ask({
      system: 's',
      messages: [{ role: 'user', content: 'done with PS4' }],
      tools: [
        {
          name: 'tick_deadline',
          description: 'x',
          input_schema: { type: 'object', properties: {} },
        },
      ],
      onToolUse: (c) => calls.push(c),
    });

    expect(calls).toEqual([
      { id: 'toolu_1', name: 'tick_deadline', input: { id: 'econ-ps4', title: 'Problem Set 4' } },
    ]);
    expect((sent!.body.tools as unknown[]).length).toBe(1);
  });

  it('drops a call whose arguments did not survive the stream', async () => {
    // Acting on a half-read instruction is the one outcome worse than not
    // acting at all.
    catchRequest([toolStart('toolu_2', 'tick_deadline'), args('{"id":"eco'), blockStop]);
    const calls: unknown[] = [];
    await ask({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      onToolUse: (c) => calls.push(c),
    });
    expect(calls).toEqual([]);
  });

  it('sends no tools when none were offered', async () => {
    catchRequest([said('ok')]);
    await ask({ system: 's', messages: [{ role: 'user', content: 'q' }] });
    expect(sent!.body).not.toHaveProperty('tools');
  });
});

describe('a constrained reply shape', () => {
  const schema = {
    type: 'json_schema' as const,
    schema: { type: 'object', properties: { cards: { type: 'array' } } },
  };

  it('is asked for when there is nothing to cite', async () => {
    catchRequest([said('{"cards":[]}')]);
    await ask({ system: 's', messages: [{ role: 'user', content: 'q' }], format: schema });
    expect(sent!.body.output_config).toEqual({ format: schema });
  });

  it('gives way to citations, which are worth more', async () => {
    // A request carrying both is refused outright, so the choice has to be
    // made before it is sent rather than discovered as an error.
    catchRequest([said('ok')]);
    await ask({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      format: schema,
      cite: true,
      docs: [{ mediaType: 'application/pdf', data: 'x' }],
    });
    expect(sent!.body).not.toHaveProperty('output_config');
  });

  it('drops it for the session when a route refuses it, and still answers', async () => {
    // A gateway that will not pass the parameter through would otherwise fail
    // every call. One round trip, then it behaves as it did before.
    let attempt = 0;
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      attempt += 1;
      sent = { url: String(url), body: JSON.parse(String(init.body)) };
      if (attempt === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: 'output_config: unsupported' } }), {
            status: 400,
          }),
        );
      }
      return Promise.resolve(stream([said('{"cards":[]}')]));
    });

    const text = await ask({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      format: schema,
    });
    expect(attempt).toBe(2);
    expect(text).toBe('{"cards":[]}');
    expect(sent!.body).not.toHaveProperty('output_config');
  });
});
