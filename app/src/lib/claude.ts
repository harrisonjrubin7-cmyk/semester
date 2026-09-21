/**
 * Claude, inside the app.
 *
 * What it is for, concretely: turning a reading into cards that land in every
 * study format at once, explaining the card you keep failing, and answering a
 * question about a course with that course's own guide in front of it.
 *
 * **Four routes to the same API, in this order of preference:**
 *
 *  1. **A proxy** you point the app at, holding the key server-side.
 *  2. **Your own key**, stored on this device.
 *  3. **A proxy this build was given** — `VITE_CLAUDE_PROXY`. Running your own
 *     copy, that is the dev server: put `ANTHROPIC_API_KEY` in
 *     `app/.env.local` and it holds the key while the page holds only the
 *     address, so the assistant answers on first load with nothing to type.
 *  4. **The shared key**, when signed in — an Edge Function checks the account
 *     and meters it, so a new user can generate a course without first going
 *     and getting a key of their own.
 *
 * Talking to the API from a page means the key is in the page: anything running
 * in that browser can read it, and a key baked into a deployed site is a key
 * handed to everyone who loads it. That is why the shared key lives in a
 * function, and why the app says all of this on the screen where a key is typed.
 */

import { UNNAMED, record, type Usage } from './spend';
import type { CaseFile, CourseId, Example, Figure, Frame, StudyCard } from './types';
import { figureShapes, readFigures } from './figure';
import { fetchWithin, timedOut, tookTooLong } from './net';
import { readStudyParts, studyShapes } from './study';
import {
  DEFAULTS as NO_CONTROLS,
  MOST,
  capsFor,
  shapeSays,
  type Controls,
} from './controls';

import { sessionToken } from './token';
import { held, preamble } from './aboutme';
import { NOTHING_ARRIVED, askOpenAI } from './openai';
import {
  markProxyDown,
  markStructuredRefused,
  proxyIsDown,
  proxyUrl,
  rememberStrictRefused,
  route,
  settings,
  sharedEndpoint,
  strictRefused,
  structuredRefused,
} from './assistant';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
  /**
   * An answer that stopped before it finished — Stop was pressed, or the
   * connection went.
   *
   * Kept and still sent, because half an answer is context and deleting it
   * would leave the next question hanging off nothing. What it must not do is
   * arrive looking finished: a model given a truncated answer as though it
   * were complete reasons from a conclusion that was never reached, and will
   * happily build on the sentence that got cut in half.
   *
   * Never reaches the API as a field. `ask` rewrites these into the content —
   * see `asSent` — so no caller can forget, and no unknown key is posted to an
   * API that validates them.
   */
  incomplete?: boolean;
  /**
   * The tools this answer asked to have run, on an assistant turn.
   *
   * Only the read-only ones — see `lib/lookup.ts`. A proposal is not a call:
   * it is shown to the student with a button and never returns anything to
   * the model, so it is not kept here and no result is ever sent for it.
   *
   * Kept on the turn rather than beside it because the API requires the pair
   * to travel together: an assistant message carrying `tool_use` is only
   * valid when the message after it answers every one of them.
   */
  calls?: ToolCall[];
  /**
   * What those calls returned, on the user turn immediately after.
   *
   * Written by the app from its own state, never by the model. One per call
   * on the turn above, in any order, and the API rejects a set that does not
   * cover them all — which is why `runLookups` answers every call it is
   * given, including the ones it does not recognise.
   */
  results?: ToolResult[];
}

/** What a read-only tool gave back, ready to be sent as the answer to a call. */
export interface ToolResult {
  /** The `id` of the `ToolCall` this answers. */
  id: string;
  /** The answer itself, as text the model reads. */
  text: string;
  /** True when the lookup could not be run at all. */
  failed?: boolean;
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
// The sentence for a stream that opened and then said nothing. Defined in
// `lib/openai.ts`, which both routes can reach without a cycle, and re-exported
// here so it is found beside the explanations it belongs with. `CUT_OFF`
// further down is a different thing: how *half* an answer is described to the
// model, once there is half an answer to describe.
export { NOTHING_ARRIVED };

export function explainAskError(
  taking: Route,
  status: number,
  detail: string,
  addressUsed = '',
): string {
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
  if (taking === 'proxy' && (status === 404 || status === 405 || status === 501)) {
    /*
     * The host answered, and it is not a proxy.
     *
     * 405 is what a static host — GitHub Pages, a preview server — says to a
     * POST, and it is exactly what a proxy box holding something that is not
     * an address produces: the browser reads it as a path on this site, so
     * the question goes to whatever is serving the page. Naming the address
     * is the whole fix, because seeing it written out is usually the moment
     * it becomes obvious.
     */
    return (
      `${leading(detail, status)}Nothing at ${addressUsed || 'that address'} forwards to the API — it ` +
      `answered ${status} rather than Claude. Clear the proxy box under Settings → The assistant to ` +
      'use your key instead, or correct the address.'
    );
  }
  if (taking === 'proxy' && status === 502) {
    return `${detail}\n\nThe proxy did not answer at /v1/messages. Check the address under Settings.`;
  }
  /*
   * Something answered, and it was not an API — on a route with no box to fix.
   *
   * The branch above is the common way this happens and names the proxy box.
   * The same fact reaches the other routes too: a function that has moved, a
   * network that intercepts a request and answers it itself, an address that
   * was right when the build was made. There the app printed the number on
   * its own, which is the one thing a student cannot act on — so this says
   * what was posted to and what came back, which is the whole of what is
   * known.
   */
  if (status === 404 || status === 405 || status === 501) {
    return `${leading(detail, status)}${whatAnswered(taking, addressUsed, status)} ${insteadTry(taking)}`;
  }
  if (status === 529 || status === 429) {
    return `${detail}\n\nThat is rate limiting rather than a mistake — wait a moment and ask again.`;
  }
  /*
   * Out of credit, which is not a broken key and must not read like one.
   *
   * The key-check button already said this properly and the live path did
   * not, so somebody whose balance ran out mid-term got the API's raw
   * sentence and no idea whether to replace the key or top it up. Those are
   * very different afternoons.
   */
  if (status === 400 && /credit|balance|quota/i.test(detail)) {
    return taking === 'shared'
      ? `${detail}\n\nThe shared key has run out for this month. Add your own under Settings to carry on now.`
      : `${detail}\n\nThe key works — the account behind it has no credit left. Top it up at console.anthropic.com under Billing; nothing needs replacing.`;
  }
  /*
   * A number with no words in it.
   *
   * `detail` starts as the status and is replaced by whatever the body said,
   * so it is still the status exactly when nothing readable came back: an
   * HTML error page from a static host, an empty body, anything in the way
   * that is not an API. A bare "405" in a red box is a failure this app has
   * already had once, and naming the address is what made it solvable — so no
   * status reaches a student on its own, whatever the number turns out to be.
   */
  if (detail === String(status)) {
    return `The question never reached Claude: ${named(addressUsed)} answered ${status} and sent nothing an API would send. ${insteadTry(taking)}`;
  }
  return detail;
}

/** The body's own sentence first, when it had one, and nothing when it did not. */
function leading(detail: string, status: number): string {
  return detail === String(status) ? '' : `${detail}\n\n`;
}

/** What was posted to, for a sentence — never an empty space where it should be. */
function named(addressUsed: string): string {
  return addressUsed || 'the address this build uses';
}

/**
 * What answered, in one clause.
 *
 * Two different facts wear the same status. On a route with an address in it,
 * a 404 or a 405 means the address is not a thing that forwards to the API —
 * the address is the mistake. On your own key the address is Claude's own and
 * cannot be wrong, so the same number means something else answered in its
 * place, and saying "nothing there forwards to the API" about Anthropic's own
 * endpoint would send somebody looking in the one place that is correct.
 */
function whatAnswered(taking: Route, addressUsed: string, status: number): string {
  return taking === 'own'
    ? `${named(addressUsed)} answered ${status}, which Claude’s API does not do.`
    : `Nothing at ${named(addressUsed)} forwards to the API — it answered ${status}.`;
}

/** Where to go next, which is a different place on each route. */
function insteadTry(taking: Route): string {
  switch (taking) {
    case 'shared':
      return (
        'That is the shared key’s function rather than Claude itself. Add your own key under ' +
        'Settings → The assistant to carry on now; whoever runs this deployment can look at ' +
        'the function (SETUP.md).'
      );
    case 'own':
      return (
        'Nothing in the app is pointing at the wrong place — that is Claude’s own address — so it ' +
        'is either something between this browser and Claude, a network that intercepts requests ' +
        'or an extension, or Claude itself having a moment. Asking again says which.'
      );
    default:
      return 'Check the address under Settings → The assistant, or clear it to use the key above.';
  }
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

/** The usage block as the wire sends it. Every field is optional on the wire. */
interface RawUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
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
   * Tools the model may propose using.
   *
   * Proposals only. Nothing here executes anything — `ask` collects the calls
   * and hands them back, and the screen decides what to show and what to ask
   * before any of it touches the student's semester. See `lib/tools.ts`.
   */
  tools?: ToolSpec[];
  /** Told about each tool the model wants to use, once its arguments are whole. */
  onToolUse?: (call: ToolCall) => void;
  /**
   * What the reply cost, in tokens, as the API reported it.
   *
   * Called once at the end, and not at all where nothing was reported — a
   * proxy that strips the usage block, an aborted request, the OpenAI route.
   * A caller that shows a meter has to be able to tell "nothing was spent"
   * from "nothing was measured", so silence is the signal for the second.
   */
  onUsage?: (use: Usage) => void;
  /**
   * What this call is for, and which course it is for.
   *
   * Every reply that reports usage is written to the ledger in `lib/spend.ts`
   * from inside `ask` — not by the caller — and these two fields are the whole
   * of what the caller has to supply.
   *
   * It was the caller's job until now, through {@link AskOptions.onUsage}, and
   * **one of twenty-five call sites did it**. The other twenty-four spent the
   * student's money and recorded nothing, so the meter in Settings said "about
   * 12¢ this month" to somebody who had built three courses — a number that is
   * wrong being worse than no number, which is the argument `lib/spend.ts` is
   * built on and was the one place it was not being kept.
   *
   * A call that names neither is still counted, under {@link UNNAMED}: money
   * with nowhere to file it is a row on a screen somebody can fix, and money
   * that was never counted is not. `lib/spendnames.test.ts` reads this file's
   * callers and fails on a new one that does not say.
   */
  about?: string;
  courseId?: CourseId | null;
  /**
   * Constrain the shape of the reply.
   *
   * The alternative — asking for JSON in a prompt and finding it in prose —
   * works and has a defensive parser behind it, but it fails in the one way
   * that is hardest to see: a reply that is *nearly* the right shape.
   *
   * Incompatible with `cite`. A request carrying both is refused by the API,
   * so the syllabus extractor keeps its parser and its citations, and this is
   * for the paths that have no document to cite.
   */
  format?: { type: 'json_schema'; schema: Record<string, unknown> };
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
  /**
   * Why the model stopped: "end_turn", "tool_use", "max_tokens", "refusal".
   *
   * The one a caller cannot work out for itself is `max_tokens` — an answer
   * cut off at the ceiling arrives looking finished, and the only signal that
   * it is not is this field. `tool_use` is the other: it is how a lookup loop
   * knows there is a second round to run rather than an answer to show.
   */
  onStop?: (reason: string) => void;
  signal?: AbortSignal;
}

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: true }
  | {
      type: 'document';
      source:
        | { type: 'base64'; media_type: string; data: string }
        | { type: 'text'; media_type: 'text/plain'; data: string };
      title?: string;
      citations?: { enabled: true };
    };


/**
 * Whether a 400 is the API refusing to compile the strict promise.
 *
 * Matched on the wording rather than the status because a 400 is also how a
 * genuinely wrong request comes back, and those must still reach the student.
 * Three sentences have been seen for the one fact — the complexity of the
 * compiled grammar, its size, and the count of strict tools — and all three
 * are fixed by the same thing.
 */
function aboutStrictTools(detail: string): boolean {
  return /schema is too complex|compiled grammar|grammar is too large|strict tool/i.test(detail);
}

/** A tool as the API is told about it. */
export interface ToolSpec {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    /** Filled in by `strictly` on the way out; no schema need write it. */
    additionalProperties?: false;
  };
  /** Guarantees the arguments validate against the schema. */
  strict?: boolean;
}

/**
 * A strict tool's schema, closed the way a strict API insists on.
 *
 * `strict: true` is a promise the API will only make if it can check it, and
 * the check has two conditions: every object in the schema must close itself
 * with `additionalProperties: false`, and every property it names must be
 * required. Miss either and nothing degrades gracefully — the whole request
 * comes back 400 ("For 'object' type, 'additionalProperties' must be
 * explicitly set to false"), so the student sees an error where an answer
 * should be, on every question, however unrelated to tools.
 *
 * Done here rather than in each of the twenty schemas in `lib/tools.ts` and
 * `lib/lookup.ts`, because a rule spread across twenty literals is a rule the
 * twenty-first forgets — and it is not a thing the schemas are *about*.
 */
function closed(node: unknown): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
  const schema: Record<string, unknown> = { ...(node as Record<string, unknown>) };
  const props = schema.properties;

  if (schema.type === 'object' || (props && typeof props === 'object')) {
    const properties = (props ?? {}) as Record<string, unknown>;
    const names = Object.keys(properties);
    // Nested objects are held to the same rule: the API walks the whole tree.
    schema.properties = Object.fromEntries(names.map((n) => [n, closed(properties[n])]));
    schema.additionalProperties = false;
    // Declared order first, so a schema that already said what it wants reads
    // on the wire the way it was written.
    const declared = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    schema.required = [
      ...declared.filter((n) => names.includes(n)),
      ...names.filter((n) => !declared.includes(n)),
    ];
  }

  if (schema.items) schema.items = closed(schema.items);
  return schema;
}

/**
 * How many tools the API will make that promise for at once.
 *
 * Twenty. The twenty-first is not a warning: the whole request is refused —
 * "Too many strict tools (22). The maximum number of strict tools supported
 * is 20" — which is the same afternoon as the schemas that did not close
 * themselves. Every question in the app failing, on a limit that none of the
 * twenty-two tool definitions can see from where it is written.
 */
const MOST_STRICT = 20;

/**
 * Every strict tool, ready for the wire. Anything else is passed through.
 *
 * Past the cap the *guarantee* is dropped and the tool is still offered,
 * which is the right way round: a tool the model cannot see is a thing the
 * app can no longer do, while a tool whose arguments were not checked by the
 * API is one whose arguments are checked here — `readProposal` re-reads every
 * proposal against what the app actually holds, and `runLookups` reads each
 * argument with a fallback. Nothing downstream ever trusted a tool argument
 * anyway, which is what makes this safe to spend.
 *
 * Which twenty keep it is the caller's order, and `ai/converse.ts` sends the
 * writes first on purpose: a write changes the student's semester, so it is
 * the one worth the promise, and a lookup that comes back malformed costs a
 * re-read.
 *
 * None keep it on a model that has already refused to compile the promise at
 * all — see `STRICT_KEY`, which is the same trade made for the whole set.
 */
export function strictly(tools: ToolSpec[], model = ''): ToolSpec[] {
  if (model && strictRefused(model)) {
    return tools.map((t) => {
      if (!t.strict) return t;
      const loosened = { ...t };
      delete loosened.strict;
      return loosened;
    });
  }
  let promised = 0;
  return tools.map((t) => {
    if (!t.strict) return t;
    if (promised >= MOST_STRICT) {
      const loosened = { ...t };
      delete loosened.strict;
      return loosened;
    }
    promised += 1;
    return { ...t, input_schema: closed(t.input_schema) as ToolSpec['input_schema'] };
  });
}

/** A tool the model wants to use, with the arguments it chose. */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

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
/** How a stopped answer is described to the model, in the transcript itself. */
export const CUT_OFF = '[This answer was stopped here and is unfinished.]';

/**
 * The transcript as the API may see it.
 *
 * Two jobs, and both are guarantees rather than conveniences. It strips
 * `incomplete`, which is ours and would be an unknown field to an API that
 * rejects them; and it says so in the content instead, so the truncation
 * survives the strip rather than being silently dropped on the way out.
 *
 * Called inside `ask` rather than by each caller, because "remember to mark
 * the stopped turn" is exactly the kind of thing four call sites do three ways.
 */
export function asSent(messages: Turn[]): Turn[] {
  if (!messages.some((m) => m.incomplete)) return messages;
  return messages.map(({ incomplete, ...turn }) =>
    // Spread rather than rebuilt from two fields: this used to name `role` and
    // `content` and nothing else, which quietly dropped the tool calls off a
    // conversation the moment anything in it had been stopped — and a
    // `tool_use` with no `tool_result` after it is a 400 with nothing in it
    // that says why.
    incomplete && turn.content.trim()
      ? { ...turn, content: `${turn.content}\n\n${CUT_OFF}` }
      : turn,
  );
}

/**
 * A message as the wire carries it: plain text, or a list of blocks.
 *
 * `Turn` is the app's shape — a role, a string, and two fields the API has
 * never heard of. This is what those become. Keeping them apart is what lets
 * a transcript be stored, trimmed, titled and rendered as prose while still
 * round-tripping tool calls exactly as the API requires.
 */
export interface Sent {
  role: 'user' | 'assistant';
  content: string | Block[];
}

/**
 * The transcript as blocks, so a tool call and its answer survive the trip.
 *
 * The API's rule is strict and worth stating: an assistant message containing
 * `tool_use` is only valid when the very next message answers every one of
 * those calls with a matching `tool_result`. So the pair is rendered here,
 * from the two fields on `Turn`, rather than assembled by whoever happens to
 * be building a request — a lookup loop that drops one result gets a 400 with
 * no clue in it, and this is the one place that cannot get the pairing wrong.
 *
 * Turns with neither field are left as strings, which is every turn in every
 * conversation that never looked anything up.
 */
export function wire(messages: Turn[]): Sent[] {
  if (!messages.some((m) => m.calls?.length || m.results?.length)) return messages;
  return messages.map((m): Sent => {
    if (m.role === 'assistant' && m.calls?.length) {
      return {
        role: 'assistant',
        content: [
          ...(m.content.trim() ? [{ type: 'text' as const, text: m.content }] : []),
          ...m.calls.map((c) => ({
            type: 'tool_use' as const,
            id: c.id,
            name: c.name,
            input: c.input,
          })),
        ],
      };
    }
    if (m.role === 'user' && m.results?.length) {
      return {
        role: 'user',
        content: [
          // Results first. The API wants them at the top of the message, and
          // anything the student typed reads as a follow-up to them anyway.
          ...m.results.map((r) => ({
            type: 'tool_result' as const,
            tool_use_id: r.id,
            content: r.text,
            ...(r.failed ? { is_error: true as const } : {}),
          })),
          ...(m.content.trim() ? [{ type: 'text' as const, text: m.content }] : []),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

export function withAttachments(
  messages: Sent[],
  images: Shot[] | undefined,
  docs: Doc[] | undefined,
  cite = false,
) {
  const hasImages = images && images.length > 0;
  const hasDocs = docs && docs.length > 0;
  if (!hasImages && !hasDocs) return messages;

  const last = messages.length - 1;
  return messages.map((m, i) => {
    // A turn already rendered to blocks is a tool-result turn, which carries
    // no attachments and never ends a request anyway.
    if (i !== last || m.role !== 'user' || typeof m.content !== 'string') return m;
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
        ? 'No OpenAI key yet. Add one under Settings → The assistant, or switch back to Claude.'
        : 'No key yet. Sign in to use the shared one, or add your own under Settings.',
    );
  }

  /*
   * The student's own standing preferences, added here and only here.
   *
   * This is the single door out of the app — every assistant feature calls
   * `ask`, whichever provider answers — and that is the argument for putting
   * it at the door rather than at the twenty-five call sites. A memory that
   * reaches some of the tools is worse than one that reaches none: the
   * student cannot tell which ones heard them, so the ones that did not read
   * as the app forgetting.
   *
   * Appended rather than prepended. With `cache` on, the breakpoint sits on
   * the whole system block, so this invalidates a cached prefix either way —
   * but a caller's own instructions keep their position in the prompt, which
   * is where every one of them was written to be.
   *
   * Empty adds nothing, not even a blank line. See `preamble`.
   */
  const mine = preamble(held());
  const system = mine ? `${options.system}\n\n${mine}` : options.system;

  // The one branch in the whole app that knows there are two providers.
  // Everything above this — the guides, the email drafting, the diagrams, the
  // problem solver — calls ask() and never learns which company answered.
  if (taking === 'openai') {
    return askOpenAI({
      apiKey: s.openaiKey,
      model: s.openaiModel,
      system,
      messages: asSent(options.messages),
      maxTokens: options.maxTokens,
      images: options.images,
      onText: options.onText,
      // So a cut stream is marked on this route too. Everything above `ask()`
      // is unaware of which company answered, and that has to include how an
      // answer failed to finish.
      onStop: options.onStop,
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
    url = `${proxyUrl(s).replace(/\/$/, '')}/v1/messages`;
  } else if (taking === 'shared') {
    // The function verifies the account and meters the call.
    url = sharedEndpoint();
    headers.Authorization = `Bearer ${sessionToken()}`;
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
          ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
          : system,
        stream: true,
        ...(options.think ? { thinking: { type: 'adaptive' } } : {}),
        ...(options.tools?.length ? { tools: strictly(options.tools, s.model) } : {}),
        // Never both: the API refuses a request that asks for citations and a
        // constrained shape at once, and the citations are worth more.
        ...(options.format && !options.cite && !structuredRefused()
          ? { output_config: { format: options.format } }
          : {}),
        messages: withAttachments(
          wire(asSent(options.messages)),
          options.images,
          options.docs,
          options.cite,
        ),
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
    // A route that will not take a constrained shape says so with a 400
    // naming the parameter. Remember it and try once more without — the
    // callers all parse JSON out of prose anyway, so the only cost is a round
    // trip, and the alternative is a feature that fails on every call.
    if (res.status === 400 && options.format && !structuredRefused() && /output_config|format/i.test(detail)) {
      markStructuredRefused();
      return ask(options);
    }

    /*
     * The same move for the other promise, and for the same reason.
     *
     * A grammar the API will not compile refuses the whole request, so every
     * question fails — including the ones that were never going to call a
     * tool. Dropping `strict` costs a guarantee the app was already making
     * for itself; not dropping it costs the assistant. See `strictRefused`.
     */
    if (
      res.status === 400 &&
      options.tools?.length &&
      !strictRefused(s.model) &&
      aboutStrictTools(detail)
    ) {
      rememberStrictRefused(s.model);
      return ask(options);
    }

    /*
     * A proxy that is not one, with a key sitting right there.
     *
     * 404, 405 and 501 all mean the same thing here: something answered and
     * it does not forward to the API. That is a permanent fact about the
     * address, not a bad moment, so every question after this one would fail
     * the same way — while a key typed on the same screen answers all of
     * them. Remembered for the session and the question asked again, so the
     * student gets an answer rather than a number. `saveSettings` clears it,
     * because going back to that screen is how a proxy gets fixed.
     */
    if (taking === 'proxy' && !proxyIsDown() && [404, 405, 501].includes(res.status)) {
      markProxyDown();
      if (route(s) !== 'proxy') return ask(options);
    }

    throw new Error(explainAskError(taking, res.status, detail, url));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  /**
   * The tool call currently arriving.
   *
   * Arguments stream in as fragments of JSON across many events, so a call is
   * only whole at `content_block_stop`. Parsing early gets a syntax error on
   * half an object; handing a half-parsed one to a screen would be worse.
   */
  let building: { id: string; name: string; json: string } | null = null;

  /**
   * The usage counts, assembled from two events.
   *
   * `message_start` carries the input side — including how much was read from
   * the cache, which is the number that says whether caching is working at
   * all. `message_delta` carries the output count once generation has
   * finished. Neither alone is the cost of a reply.
   *
   * Null until something reports, so a route that strips the block stays
   * distinguishable from a reply that genuinely cost nothing.
   */
  let counted: Usage | null = null;

  /** Why the model stopped, as the closing event reports it. */
  let stopped = '';

  /*
   * Whether the stream *said* it was finished, rather than simply stopping.
   *
   * A reader that runs out is not the same thing as an answer that ends, and
   * this loop could not tell the two apart: it read until `done` and returned
   * whatever had arrived. So a connection dropped mid-answer — the ordinary
   * failure of a streamed API on a phone — came back as a complete reply.
   *
   * Measured, with the response mocked and nothing else changed:
   *
   *   200, empty body            no answer, and the turn drawn as finished
   *   200, unparseable events    the same
   *   200, cut mid-event         the same
   *   one delta, then cut        "The three things due", drawn as finished
   *
   * The last is the one that costs something. `ai/converse.ts` already
   * carries the argument, for the ceiling: *"an answer cut off at the ceiling
   * arrives looking finished — it ends on a full sentence about as often as
   * not"*, and marks the turn so the reader sees it and the model is not
   * later sent a conclusion it never reached. A stream that dies is the same
   * failure with a different cause, and was the one case not covered, because
   * `onStop` only fires on a reason the stream reported.
   *
   * Either closing event will do. `message_delta` carries the reason and
   * `message_stop` ends the stream, and a route that forwards one forwards
   * the other.
   */
  let closed = false;
  /**
   * Whether anything a reader could use arrived — words, or a whole tool call.
   *
   * Not "any event": a stream that opens with `message_start` and then dies
   * has still said nothing, and an empty answer under a "Stopped here." is
   * not better than the sentence saying the connection went.
   */
  let gave = false;
  /*
   * What the stream itself said went wrong, if it said anything.
   *
   * A streamed answer can fail after the 200: the connection is open, the
   * headers are long sent, and the trouble arrives as an event —
   * `{"type":"error","error":{"message":"Overloaded"}}`. Nothing here read
   * those, so an overloaded server was reported as one of two lies depending
   * on its timing. Before any text: "the answer never arrived", which says the
   * model had nothing to say. After some: "stopped here", which says the
   * connection dropped. Both send somebody to look at their own signal for a
   * fault at the other end.
   *
   * Kept rather than thrown where it is read, because the `catch` around the
   * parse exists to skip an event this build does not know — and it would
   * swallow this throw along with them.
   */
  let failed = '';
  const count = (u: RawUsage | undefined) => {
    if (!u) return;
    counted = {
      input: u.input_tokens ?? counted?.input ?? 0,
      output: u.output_tokens ?? counted?.output ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? counted?.cacheWrite ?? 0,
      cacheRead: u.cache_read_input_tokens ?? counted?.cacheRead ?? 0,
    };
  };

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
          message?: { usage?: RawUsage };
          usage?: RawUsage;
          content_block?: { type?: string; id?: string; name?: string };
          error?: { type?: string; message?: string };
          delta?: {
            type?: string;
            text?: string;
            citation?: RawCitation;
            partial_json?: string;
            stop_reason?: string;
          };
        };

        if (event.type === 'error') {
          failed = event.error?.message?.trim() || 'The service reported an error mid-answer.';
          break;
        }
        // Input counts open the stream; output counts close it.
        if (event.type === 'message_start') count(event.message?.usage);
        if (event.type === 'message_delta') {
          count(event.usage);
          if (event.delta?.stop_reason) {
            stopped = event.delta.stop_reason;
            closed = true;
          }
        }
        if (event.type === 'message_stop') closed = true;

        if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          building = {
            id: event.content_block.id ?? '',
            name: event.content_block.name ?? '',
            json: '',
          };
        }
        if (event.type === 'content_block_delta' && typeof event.delta?.partial_json === 'string') {
          if (building) building.json += event.delta.partial_json;
        }
        if (event.type === 'content_block_stop' && building) {
          const done = building;
          building = null;
          try {
            // Never string-match a serialised tool input: escaping varies.
            const input = done.json ? (JSON.parse(done.json) as Record<string, unknown>) : {};
            if (done.name) {
              options.onToolUse?.({ id: done.id, name: done.name, input });
              gave = true;
            }
          } catch {
            // Arguments that did not survive the stream. Dropping the call is
            // right: acting on a half-read instruction is the one outcome
            // worse than not acting.
          }
        }
        if (event.type === 'content_block_delta' && event.delta?.text) {
          text += event.delta.text;
          gave = true;
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
    if (failed) break;
  }

  /*
   * The stream's own error, in the words every other failure here uses.
   *
   * Thrown before the two fallbacks below rather than after, because both of
   * those describe a stream that went quiet, and this one did not — it said
   * what was wrong on the way past. What had arrived goes with it: an
   * overloaded server is a "try that again", and half an answer sitting under
   * a button offering to try again is half an answer somebody may act on.
   */
  if (failed) throw new Error(explainAskError(taking, 0, failed));

  if (!closed) {
    /*
     * Nothing usable came through at all, so there is no answer to draw and
     * no half of one to keep. That is a failure, and the assistant already
     * knows how to say so — every other failure here throws, and the screen
     * puts the sentence under a "Try that again". Reported as a completed
     * empty turn instead, it reads as the model having nothing to say.
     */
    if (!gave) throw new Error(NOTHING_ARRIVED);
    // Something arrived and then the stream stopped without ending. The words
    // are kept — half an answer is still context — and marked, which is what
    // `cut` says to the caller.
    stopped = stopped || 'cut';
  }

  if (counted) {
    /*
     * Recorded here, once, rather than by whoever called.
     *
     * The alternative is a hook every caller has to remember, which is what
     * this was, and the twenty-fourth caller to forget it is not a thing to
     * find out from a bank statement. `record` swallows its own failures —
     * a full store must never lose the answer the student just got.
     */
    record({
      at: Date.now(),
      model: s.model,
      from: options.about || UNNAMED,
      ...(options.courseId ? { courseId: options.courseId } : {}),
      use: counted,
    });
    options.onUsage?.(counted);
  }
  if (stopped) options.onStop?.(stopped);
  return text;
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
    // Bounded, because this one blocks a button: the check is the only thing
    // the settings screen is doing while it runs, and a connection that
    // accepts and then says nothing would spin it for the rest of the
    // session. The streaming call above cannot take a fixed deadline — a long
    // answer legitimately takes minutes — but a one-token key check can.
    const res = await fetchWithin('https://api.anthropic.com/v1/messages', {
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
    if (timedOut(e)) return { ok: false, detail: tookTooLong('The API') };
    return {
      ok: false,
      detail: `${e instanceof Error ? e.message : String(e)}\n\nCould not reach the API to check.`,
    };
  }
}

/**
 * Whether the shared key is actually there, asked without signing anything up.
 *
 * The screen above this said "Signed in, so this is already working" and
 * nothing had checked it. That sentence is true of the *account*, which the
 * app can see, and a guess about the *deployment*, which it cannot: the
 * function has to be deployed, and it has to have been given an
 * `ANTHROPIC_API_KEY` secret. Both are the deployment owner's doing, neither
 * is visible from a browser, and a student who is told it is already working
 * finds out otherwise after picking a syllabus and waiting for it to be read.
 * `checkKey` has spared the own-key route that afternoon since the two settings
 * forms were merged; the shared route is the one where the failure is not even
 * the student's to fix, and it had nothing.
 *
 * **Deliberately unauthenticated.** `supabase/functions/claude/index.ts` looks
 * for its key *before* it looks at the caller's token, and meters the call
 * after both. So a POST carrying no `Authorization` header reaches the one
 * thing worth knowing and stops two steps short of the meter: it cannot spend
 * a generation out of somebody's sixty, and it works signed out, which is what
 * makes it answerable before a pilot rather than after one.
 *
 * **What a pass does not say.** Reaching the token check proves the function is
 * live and holds a key. It cannot prove that key still has credit, because
 * proving that means spending some. The sentence says so rather than implying
 * the stronger thing.
 */
export async function checkShared(): Promise<{ ok: boolean; detail: string }> {
  const url = sharedEndpoint();
  if (!url) {
    return {
      ok: false,
      detail:
        'This build has no shared key to check — it was built without a Supabase project, so ' +
        'signing in cannot answer questions here. Your own key below is the route.',
    };
  }

  let res: Response;
  try {
    res = await fetchWithin(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch (e) {
    if (timedOut(e)) return { ok: false, detail: tookTooLong('The shared-key function') };
    return {
      ok: false,
      detail: `${e instanceof Error ? e.message : String(e)}\n\nCould not reach the shared-key function at ${url}.`,
    };
  }

  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    message?: string;
  };
  const said = body.error?.message ?? '';

  if (res.status === 401) {
    /*
     * Two quite different things answer 401 here, and reading them as one
     * would make this probe worse than no probe.
     *
     * The function's own 401 is the pass: it ran, it had a key, and it turned
     * the request away for having no token — which is exactly as far as an
     * unauthenticated request is meant to get. Supabase's gateway also
     * answers 401, before the function runs at all, when a deploy left JWT
     * verification on. That one proves nothing about the key, and reported as
     * a pass it would confirm a shared key that does not exist.
     *
     * The two are told apart by shape. Everything this function returns is
     * `{ error: { message } }`; the gateway writes a bare `message` or `msg`
     * beside a code. `.github/workflows/functions.yml` passes
     * `--no-verify-jwt` on every deploy, so the gateway case means somebody
     * deployed this function another way, and saying that is more useful than
     * a shrug.
     */
    if (said) {
      return {
        ok: true,
        detail:
          'The shared key is live: the function answered, and it has a key. Signing in is ' +
          'enough to build a course.\n\nThis did not spend one of the monthly generations, ' +
          'which is also the limit of what it proves — it cannot tell you the key still has ' +
          'credit behind it.',
      };
    }
    return {
      ok: false,
      detail:
        'Supabase turned the request away before the function ran, so whether there is a key ' +
        'behind it is not knowable from here. That happens when the function was deployed with ' +
        'JWT verification left on; deploying it with --no-verify-jwt, the way ' +
        '.github/workflows/functions.yml does, lets it answer for itself.',
    };
  }

  if (res.status === 501) {
    return {
      ok: false,
      detail:
        'The function is deployed and has no key in it, so signing in buys nothing — every ' +
        'account gets this. Whoever runs this deployment sets one with `supabase secrets set ' +
        'ANTHROPIC_API_KEY=…` (SETUP.md). Your own key below works meanwhile.',
    };
  }

  if (res.status === 404) {
    return {
      ok: false,
      detail:
        `Nothing is deployed at ${url} — the \`claude\` function has not been pushed to this ` +
        'project, so signing in cannot answer questions here for anybody. Your own key below ' +
        'works meanwhile.',
    };
  }

  return {
    ok: false,
    detail:
      `${said || body.message || res.status} \n\nThat came back from ${url} rather than the ` +
      'refusal an unauthenticated check expects, so the shared key cannot be confirmed from here.',
  };
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

/**
 * Photographed pages, back as the text that is on them.
 *
 * The third sibling, and the one the import screen needed. `readShots` reads a
 * *board* — it looks at course material and writes exam questions from it, and
 * a syllabus put through it comes back as flashcards about the attendance
 * policy. What `screens/Import.tsx` needs from a photograph is the opposite
 * and much duller: the words, in order, so the same pipeline that reads an
 * uploaded PDF can read a photographed one.
 *
 * So this transcribes and does nothing else. No summary, no cards, no tidying
 * of a table into prose — the grade weighting is a table on most syllabi and
 * flattening it is how a 25% becomes unreadable two steps later, in
 * `lib/grades.ts`, which is parsing exactly that string.
 *
 * ## It says when it cannot read
 *
 * A photograph of a syllabus is taken in a lecture theatre by somebody
 * holding a phone at an angle, and a page of it may be blurred, cropped or
 * glared out. The refusal matters more here than in the other two: a
 * transcription that quietly invents a plausible deadline is worse than no
 * transcription, because every date in this app is shown with the sentence it
 * came from and that sentence would be fiction. Anything unreadable is left
 * out and named, in the text, where the review step will show it.
 */
export async function readPages(images: Shot[], signal?: AbortSignal): Promise<string> {
  const reply = await ask({
    signal,
    images,
    think: false,
    maxTokens: 8000,
    system:
      'You are transcribing photographs of a document — most often a university syllabus, ' +
      'sometimes a handout or a posted schedule. Return the text that is on the pages and ' +
      'nothing else.\n\n' +
      '- Transcribe faithfully and in reading order, page by page in the order given.\n' +
      '- Keep tables as tables, one row per line, with the columns separated by " | ". A ' +
      'grading table is the most important thing on a syllabus and its percentages are read ' +
      'literally later, so keep "25%", "25–30%" and "80 pts" exactly as written.\n' +
      '- Keep dates exactly as written. Do not normalise, expand or correct them.\n' +
      '- Do not summarise, reorder, explain, or add headings that are not on the page.\n' +
      '- Where something is unreadable — blurred, cropped, glared out — write ' +
      '[unreadable] in its place rather than guessing. Never invent a date, a weight, a ' +
      'title or a name to fill a gap.\n' +
      '- If a photograph is not a document at all, say so on its own line and transcribe ' +
      'nothing for it.',
    messages: [
      {
        role: 'user',
        content:
          'Transcribe these pages. Plain text, in order, with the tables kept as tables.',
      },
    ],
  });
  return reply.trim();
}

/**
 * Turn a reading into cards and terms.
 *
 * The sibling of `readShots`, for prose rather than photographs. Adding a
 * reading to a course used to attach the file and, where it happened to be
 * plain text, drop it in the box — where `lib/parse.ts` looked for things
 * already shaped like a question and an answer. A journal article is not
 * shaped like that, so the guide gained a file and nothing else: the screen
 * said the material was added and every study format stayed exactly as it was.
 *
 * The refusals are the same ones the syllabus pipeline makes, and for the same
 * reason — this material joins the guide the student revises from, so a card
 * invented out of general knowledge is worse than a shorter deck.
 */
export async function readMaterial(
  text: string,
  context: string,
  signal?: AbortSignal,
  /**
   * How much, at what level, and how many cards.
   *
   * Optional and defaulted, so every caller that has no controls to pass gets
   * byte-for-byte the prompt this function had before they existed — see the
   * note on `shapeSays` in `lib/controls.ts` for why that matters.
   */
  controls: Controls = NO_CONTROLS,
): Promise<{
  cards: StudyCard[];
  terms: { t: string; d: string }[];
  figures: Figure[];
  frames: Frame[];
  selfTest: StudyCard[];
  cases: CaseFile[];
  examples: Example[];
  note: string;
}> {
  const caps = capsFor(controls);
  const says = shapeSays(controls);

  const reply = await ask({
    signal,
    think: true,
    // Raised with figures: a table of twelve rows and a caption is a few
    // hundred tokens, and the ceiling used to be reached by cards alone.
    //
    // Scaled with the ceiling rather than fixed: fifty cards asked for at
    // `full` do not fit in the budget eight thousand was set for, and a reply
    // cut off mid-JSON parses as nothing at all — the student would see "could
    // not read it" for a reading the model read perfectly well.
    maxTokens: Math.min(16_000, 8_000 + Math.max(0, caps.cards - MOST.cards) * 160),
    system:
      'You are reading course material a university student has added to a study guide — a ' +
      'reading, a handout, a set of lecture notes. Turn it into study material; do not invent.\n\n' +
      'Reply with JSON only: {"note":"…","cards":[{"q":"…","a":"…"}],"terms":[{"t":"…","d":"…"}],' +
      '"figures":[…],"frames":[…],"selfTest":[…],"cases":[…],"examples":[…]}\n\n' +
      '- note: what this material is, in one or two sentences. Say plainly if it is not course ' +
      'material at all — and then return no cards.\n' +
      '- cards: questions an exam could ask, answered in full prose with the specific numbers, ' +
      'names, dates and steps the text actually gives. Not topic labels: "Know the GGL study" ' +
      `is not a card. Between 0 and ${caps.cards}, however many the material genuinely supports.\n` +
      `- terms: vocabulary this material defines, with the definition it gives. Between 0 and ${caps.terms}.\n` +
      '- ' + figureShapes(caps) + '\n' +
      '- ' + studyShapes(caps) + '\n' +
      '- Everything must come from the text in front of you. Do not complete a half-stated idea ' +
      'from general knowledge, and leave out anything the material only alludes to.' +
      // Empty on the defaults, so the prompt is unchanged for anybody who has
      // not touched a control.
      (says ? `\n- ${says}` : ''),
    messages: [
      {
        role: 'user',
        content: `Course context:\n${context}\n\nThe material:\n\n${text.slice(0, 120_000)}`,
      },
    ],
  });

  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end === -1) return { ...NOTHING_READ };
  try {
    const parsed = JSON.parse(reply.slice(start, end + 1)) as {
      cards?: StudyCard[];
      terms?: { t?: string; d?: string }[];
      figures?: unknown;
      frames?: unknown;
      selfTest?: unknown;
      cases?: unknown;
      examples?: unknown;
      note?: string;
    };
    return {
      note: typeof parsed.note === 'string' ? parsed.note.trim() : '',
      /*
       * Cut to the ceiling, not merely asked for it.
       *
       * The number in the prompt is a request and a model is free to ignore
       * it — so "at most 12 cards" was twelve in the instruction and eighteen
       * on the screen, which is a control that does not control anything. The
       * four readers below have always cut at their ceiling; cards and terms
       * were the two that only ever asked.
       *
       * Taken from the front rather than sampled, so what survives is what the
       * model put first, which is what it judged most worth knowing.
       */
      cards: (parsed.cards ?? [])
        .filter((c) => typeof c?.q === 'string' && typeof c?.a === 'string' && c.q && c.a)
        .slice(0, caps.cards)
        .map((c) => ({ q: c.q.trim(), a: c.a.trim() })),
      terms: (parsed.terms ?? [])
        .filter((t) => typeof t?.t === 'string' && typeof t?.d === 'string' && t.t && t.d)
        .slice(0, caps.terms)
        .map((t) => ({ t: (t.t as string).trim(), d: (t.d as string).trim() })),
      // Every check lives in `lib/figure.ts`, including the one that matters:
      // a figure that does not survive validation is dropped, never repaired.
      figures: readFigures(parsed.figures, caps),
      // The field guide and the cram sheet, which cards and terms never
      // reached. Checked in `lib/study.ts`, on the same rule: dropped whole
      // rather than rendered with a gap.
      ...readStudyParts(parsed, caps),
    };
  } catch {
    return { ...NOTHING_READ };
  }
}

/**
 * What comes back when nothing could be read.
 *
 * One constant rather than the same literal at each early return — it grew a
 * field twice in one week, and the second time only two of the three copies
 * were updated.
 */
const NOTHING_READ = {
  cards: [] as StudyCard[],
  terms: [] as { t: string; d: string }[],
  figures: [] as Figure[],
  frames: [] as Frame[],
  selfTest: [] as StudyCard[],
  cases: [] as CaseFile[],
  examples: [] as Example[],
  note: '',
};
