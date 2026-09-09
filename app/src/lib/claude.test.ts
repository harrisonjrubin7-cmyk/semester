// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ask,
  configured,
  readCitation,
  readMaterial,
  route,
  routeLabel,
  withAttachments,
  asSent,
  wire,
  CUT_OFF,
} from './claude';
import type { Turn } from './claude';

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
  vi.unstubAllEnvs();
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

/**
 * Turning an attached reading into study material.
 *
 * The screen that calls this used to attach the file and stop there, so the
 * guide gained a PDF and every study format carried on showing what it had
 * before. What matters now is the same thing that matters everywhere else the
 * model writes into a guide: nothing malformed reaches the deck, and a reply
 * that is not what was asked for produces no cards rather than bad ones.
 */
describe('reading material into cards', () => {
  const REPLY = {
    note: 'Chapter 4 of Trounstine, on federal lending grades and local zoning.',
    cards: [{ q: 'What did the HOLC grade?', a: 'It graded 239 cities between 1930 and 1960.' }],
    terms: [{ t: 'Redlining', d: 'Marking a neighbourhood as too risky to lend into.' }],
  };

  it('sends the course and its units, so a card is filed where it belongs', async () => {
    catchRequest([said(JSON.stringify(REPLY))]);
    await readMaterial('The reading itself.', 'ECON 1020 — Micro\nUnits:\n1. Supply');
    const asked = (sent!.body.messages as { content: string }[])[0].content;
    expect(asked).toContain('ECON 1020');
    expect(asked).toContain('1. Supply');
    expect(asked).toContain('The reading itself.');
  });

  it('hands back the cards, the terms and what it made of the material', async () => {
    catchRequest([said(JSON.stringify(REPLY))]);
    const got = await readMaterial('x', 'ECON 1020');
    expect(got.cards).toEqual(REPLY.cards);
    expect(got.terms).toEqual(REPLY.terms);
    expect(got.note).toBe(REPLY.note);
  });

  it('carries a figure the reading actually contained', async () => {
    // The gap this closed: a reading with a table in it produced cards and
    // terms and nothing else, so the Figures tab never grew past week one.
    catchRequest([
      said(
        JSON.stringify({
          ...REPLY,
          figures: [
            {
              type: 'bars',
              title: 'Cities graded',
              caption: 'HOLC, 1930-1960',
              unit: 'cities',
              max: 239,
              rows: [
                { l: 'Graded', v: 239 },
                { l: 'Ungraded', v: 61 },
              ],
            },
          ],
        }),
      ),
    ]);
    const got = await readMaterial('x', 'c');
    expect(got.figures).toHaveLength(1);
    expect(got.figures[0]).toMatchObject({ type: 'bars', title: 'Cities graded', max: 239 });
  });

  it('drops a figure it cannot draw without losing the cards beside it', async () => {
    // A made-up diagram name is the failure mode with teeth: accepted, it
    // renders as a blank card in the middle of a real guide.
    catchRequest([
      said(
        JSON.stringify({
          ...REPLY,
          figures: [{ type: 'diagram', title: 'Phillips curve', caption: '', kind: 'phillips' }],
        }),
      ),
    ]);
    const got = await readMaterial('x', 'c');
    expect(got.figures).toEqual([]);
    expect(got.cards).toHaveLength(1);
  });

  it('asks for figures in the vocabulary the app can actually render', async () => {
    catchRequest([said(JSON.stringify(REPLY))]);
    await readMaterial('x', 'c');
    const system = sent!.body.system as string;
    expect(system).toContain('"type":"bars"');
    expect(system).toContain('supply-demand');
    expect(system).toContain('Return no figure rather than the nearest one.');
  });

  it('reads the JSON out of a reply that arrives wrapped in prose', async () => {
    // Models preface and fence. The screen must not lose a whole reading to a
    // sentence in front of the brace.
    catchRequest([said('Here you are:\n```json\n' + JSON.stringify(REPLY) + '\n```\nHope that helps.')]);
    expect((await readMaterial('x', 'c')).cards).toHaveLength(1);
  });

  it('adds nothing at all when the reply is not JSON', async () => {
    // Better a guide that gained a file than a guide that gained nonsense.
    catchRequest([said('I could not read that.')]);
    expect(await readMaterial('x', 'c')).toEqual({
      cards: [],
      terms: [],
      figures: [],
      frames: [],
      selfTest: [],
      cases: [],
      examples: [],
      note: '',
    });
  });

  it('adds nothing when the JSON is cut off mid-stream', async () => {
    catchRequest([said('{"cards":[{"q":"half a ques')]);
    expect((await readMaterial('x', 'c')).cards).toEqual([]);
  });

  it('drops a half-written card rather than showing a blank side', async () => {
    // A card with no answer is drilled, turned over, and shows nothing.
    catchRequest([
      said(
        JSON.stringify({
          cards: [
            { q: 'Kept?', a: 'Yes.' },
            { q: 'No answer' },
            { q: '', a: 'No question' },
            { a: 'Nor this' },
          ],
          terms: [{ t: 'Kept', d: 'Yes.' }, { t: 'No definition' }, { d: 'No term' }],
        }),
      ),
    ]);
    const got = await readMaterial('x', 'c');
    expect(got.cards).toEqual([{ q: 'Kept?', a: 'Yes.' }]);
    expect(got.terms).toEqual([{ t: 'Kept', d: 'Yes.' }]);
  });

  it('copes with a reply that answers with no cards and no terms', async () => {
    // What it is told to do when the file is not course material at all.
    catchRequest([said(JSON.stringify({ note: 'This is a receipt, not a reading.' }))]);
    const got = await readMaterial('x', 'c');
    expect(got.note).toBe('This is a receipt, not a reading.');
    expect(got.cards).toEqual([]);
    expect(got.terms).toEqual([]);
  });

  it('does not send a whole textbook, whatever was attached', async () => {
    // A 400-page PDF read to text would be refused by the API, and the refusal
    // would arrive as a failure rather than a shorter deck.
    catchRequest([said('{}')]);
    await readMaterial('x'.repeat(500_000), 'c');
    const asked = (sent!.body.messages as { content: string }[])[0].content;
    expect(asked.length).toBeLessThan(130_000);
  });
});

describe('a stopped answer, on the way back to the model', () => {
  const cut = { role: 'assistant' as const, content: 'Half an ans', incomplete: true };
  const whole = { role: 'assistant' as const, content: 'A whole answer.' };
  const asked = { role: 'user' as const, content: 'A question.' };

  it('says in the transcript that it was cut off', () => {
    // Kept, because half an answer is context. Marked, because a model given a
    // truncation as though it were complete builds on a sentence that stopped
    // mid-clause.
    const [, a] = asSent([asked, cut]);
    expect(a.content).toBe(`Half an ans\n\n${CUT_OFF}`);
  });

  it('never posts the flag itself, which the API would reject', () => {
    for (const m of asSent([asked, cut, asked])) {
      expect(Object.keys(m).sort()).toEqual(['content', 'role']);
    }
  });

  it('leaves a finished answer exactly as it is', () => {
    expect(asSent([asked, whole])).toEqual([asked, whole]);
  });

  it('is the same array when nothing was stopped, so nothing is copied for free', () => {
    const messages = [asked, whole];
    expect(asSent(messages)).toBe(messages);
  });

  it('does not mark an empty one, which has nothing to be cut off', () => {
    const [, a] = asSent([asked, { role: 'assistant', content: '  ', incomplete: true }]);
    expect(a.content).toBe('  ');
  });
});


// ── Tool results, going back ──────────────────────────────────────────────
//
// The read-only lookups in `lib/lookup.ts` only work if a call and its answer
// survive the trip back. The API's rule is unforgiving and silent: an
// assistant message carrying `tool_use` is invalid unless the very next
// message answers every one of those calls, and what comes back when it does
// not is a 400 with nothing in it that says which call was missing.

describe('a lookup and its answer, on the wire', () => {
  const chat: Turn[] = [
    { role: 'user', content: 'How am I doing in ECON?' },
    {
      role: 'assistant',
      content: 'Let me read them.',
      calls: [{ id: 'toolu_1', name: 'read_grades', input: { course: 'ECON 1020' } }],
    },
    { role: 'user', content: '', results: [{ id: 'toolu_1', text: 'ECON 1020: 74%.' }] },
  ];

  it('leaves an ordinary conversation as plain strings', () => {
    const plain: Turn[] = [{ role: 'user', content: 'hi' }];
    // Identity, not equality: every conversation that never looked anything up
    // must cost nothing at all here.
    expect(wire(plain)).toBe(plain);
  });

  it('pairs the call with the answer, in the order the API wants them', () => {
    const [, answer, back] = wire(chat) as {
      role: string;
      content: { type: string; id?: string; tool_use_id?: string; name?: string }[];
    }[];
    expect(answer.content.map((b) => b.type)).toEqual(['text', 'tool_use']);
    expect(answer.content[1].name).toBe('read_grades');
    // Results first in the message that answers them, which is what the API
    // requires and also how a person would read it.
    expect(back.content.map((b) => b.type)).toEqual(['tool_result']);
    expect(back.content[0].tool_use_id).toBe(answer.content[1].id);
  });

  it('drops the empty text of a turn that is only an answer', () => {
    // An empty text block is not the same as no text block: the API rejects
    // one, and there is nothing for the model to read in it anyway.
    const [, , back] = wire(chat) as { content: unknown[] }[];
    expect(back.content).toHaveLength(1);
  });

  it('marks a lookup that failed, so the model is not told a guess', async () => {
    catchRequest([said('ok')]);
    await ask({
      system: 's',
      messages: [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: '', calls: [{ id: 'toolu_9', name: 'read_tasks', input: {} }] },
        { role: 'user', content: '', results: [{ id: 'toolu_9', text: 'No such lookup.', failed: true }] },
      ],
    });
    const messages = sent!.body.messages as { content: { is_error?: boolean }[] }[];
    expect(messages[2].content[0].is_error).toBe(true);
  });

  it('keeps the calls on a conversation that also had an answer stopped', () => {
    /*
     * `asSent` used to rebuild each turn from `role` and `content` alone,
     * which quietly dropped the calls off any conversation containing a
     * stopped answer — and a `tool_use` with no `tool_result` after it is the
     * 400 with nothing in it.
     */
    const withStop: Turn[] = [...chat, { role: 'assistant', content: 'half', incomplete: true }];
    const [, answer] = wire(asSent(withStop)) as { content: { type: string }[] }[];
    expect(answer.content.map((b) => b.type)).toEqual(['text', 'tool_use']);
  });
});

describe('why the model stopped', () => {
  it('reports the reason the closing event gives', async () => {
    catchRequest([
      said('As much as fits'),
      { type: 'message_delta', delta: { stop_reason: 'max_tokens' }, usage: { output_tokens: 12 } },
    ]);
    let why = '';
    await ask({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      onStop: (r) => {
        why = r;
      },
    });
    expect(why).toBe('max_tokens');
  });

  it('says nothing where the stream reported nothing', async () => {
    catchRequest([said('done')]);
    let called = false;
    await ask({
      system: 's',
      messages: [{ role: 'user', content: 'q' }],
      onStop: () => {
        called = true;
      },
    });
    expect(called).toBe(false);
  });
});

/**
 * Where a question goes, and what travels with it.
 *
 * Four routes reach the same API and only one of them keeps the key out of the
 * browser without an account: a proxy the build was pointed at, which on a
 * clone of this repo is the dev server holding ANTHROPIC_API_KEY from
 * app/.env.local. What has to be true of it is that it answers when nothing
 * has been typed into the app, that the request carries no key, and that it
 * still gives way to anything the person using the app chose for themselves.
 */
describe('which route a question takes', () => {
  /** The headers as well as the body, which is the point of these. */
  let call: { url: string; headers: Record<string, string> } | null = null;

  function catchHeaders() {
    call = null;
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      call = { url: String(url), headers: (init.headers ?? {}) as Record<string, string> };
      return Promise.resolve(stream([said('ok')]));
    });
  }

  const on = (device: Partial<{ apiKey: string; proxy: string }>) =>
    localStorage.setItem(
      'semester.claude.v1',
      JSON.stringify({ provider: 'anthropic', model: 'claude-opus-5', apiKey: '', proxy: '', ...device }),
    );

  it('uses the build\'s proxy when nothing has been typed into the app', async () => {
    on({});
    vi.stubEnv('VITE_CLAUDE_PROXY', '/anthropic');

    expect(configured()).toBe(true);
    expect(route()).toBe('proxy');

    catchHeaders();
    await ask({ system: 's', messages: [{ role: 'user', content: 'q' }] });
    expect(call!.url).toBe('/anthropic/v1/messages');
    // The whole reason for this route: the key is on the server, so there is
    // nothing here for anything running in the browser to read.
    expect(call!.headers['x-api-key']).toBeUndefined();
  });

  it('does not mind a trailing slash on the address', async () => {
    on({});
    vi.stubEnv('VITE_CLAUDE_PROXY', 'https://proxy.example.com/');
    catchHeaders();
    await ask({ system: 's', messages: [{ role: 'user', content: 'q' }] });
    expect(call!.url).toBe('https://proxy.example.com/v1/messages');
  });

  it('gives way to a key set on this device', async () => {
    // An env var set once in a file should not quietly take over from a key
    // somebody went and typed on the settings screen.
    on({ apiKey: 'sk-ant-mine' });
    vi.stubEnv('VITE_CLAUDE_PROXY', '/anthropic');

    expect(route()).toBe('own');
    catchHeaders();
    await ask({ system: 's', messages: [{ role: 'user', content: 'q' }] });
    expect(call!.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call!.headers['x-api-key']).toBe('sk-ant-mine');
  });

  it('gives way to a proxy set on this device', async () => {
    on({ proxy: 'https://mine.example.com', apiKey: 'sk-ant-mine' });
    vi.stubEnv('VITE_CLAUDE_PROXY', '/anthropic');

    expect(route()).toBe('proxy');
    catchHeaders();
    await ask({ system: 's', messages: [{ role: 'user', content: 'q' }] });
    expect(call!.url).toBe('https://mine.example.com/v1/messages');
  });

  it('says which proxy is answering, since one of them is not your doing', () => {
    on({});
    vi.stubEnv('VITE_CLAUDE_PROXY', '/anthropic');
    expect(routeLabel()).toBe('the proxy this build points at');

    on({ proxy: 'https://mine.example.com' });
    expect(routeLabel()).toBe('your proxy');
  });

  it('is still nothing when the build was given nothing', async () => {
    on({});
    vi.stubEnv('VITE_CLAUDE_PROXY', '');

    expect(configured()).toBe(false);
    expect(route()).toBe('none');
    await expect(ask({ system: 's', messages: [{ role: 'user', content: 'q' }] })).rejects.toThrow(
      /No key yet/,
    );
  });
});
