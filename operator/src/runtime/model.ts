/**
 * The model port. An agent whose implementation is `model` (or a hybrid
 * agent on a task type without a deterministic handler) runs the model loop
 * in agentloop.ts through this interface. The runtime refuses that path when
 * no port is configured, and says so.
 *
 * Two ports exist. `noModel` is the default and throws. `createHttpModel`
 * speaks the Anthropic Messages API over Node's built-in fetch: no SDK
 * dependency is installed (adding one goes through the supply-chain
 * workflow in docs/AGENT-TOOLING.md), and it is constructed only when the
 * operator's own variable, SEMESTER_OPERATOR_MODEL_KEY, is set. A stray
 * ANTHROPIC_API_KEY in a developer's shell does not turn the model on. The
 * key is read into the port and sent in one header; it is never written to
 * the store, the audit or an evidence item.
 */
export interface ModelMessage { role: 'user' | 'assistant'; content: string }
export interface ModelRequest { system: string; messages: ModelMessage[]; maxTokens?: number }
export interface ModelResponse { text: string; inputTokens?: number; outputTokens?: number; costUsd?: number }
export interface ModelPort { readonly name: string; respond(request: ModelRequest): Promise<ModelResponse> }

export class ModelUnavailable extends Error {
  constructor() { super('No model port is configured. Model-backed agents stay configured but untested until one is supplied with its own credential and dependency approval.'); }
}

export const noModel: ModelPort = { name: 'none', respond: async () => { throw new ModelUnavailable(); } };

export interface HttpModelOptions {
  apiKey: string;
  model: string;
  /** Defaults to https://api.anthropic.com. Tests point it at a local server. */
  baseUrl?: string;
  /** USD per million tokens; when given, every response carries a cost the limiter can meter. */
  pricePerMillion?: { input: number; output: number };
  /** Defaults to 4096 output tokens per turn. */
  maxTokens?: number;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** A Messages-API port over fetch. The response text is the concatenation of the text blocks. */
export function createHttpModel(options: HttpModelOptions): ModelPort {
  const baseUrl = (options.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 120_000;
  return {
    name: `http:${options.model}`,
    async respond(request) {
      const body = { model: options.model, max_tokens: request.maxTokens ?? options.maxTokens ?? 4096, system: request.system, messages: request.messages };
      const response = await doFetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': options.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        // The error body is not echoed: a provider message could quote the request, and the request may hold repository content.
        throw new Error(`Model request failed: HTTP ${response.status}.`);
      }
      const json = (await response.json()) as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
      if (!Array.isArray(json.content)) throw new Error('Model response had no content array.');
      const text = json.content.filter((block) => block.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('\n');
      const inputTokens = json.usage?.input_tokens;
      const outputTokens = json.usage?.output_tokens;
      const costUsd = options.pricePerMillion && inputTokens !== undefined && outputTokens !== undefined
        ? (inputTokens * options.pricePerMillion.input + outputTokens * options.pricePerMillion.output) / 1_000_000
        : undefined;
      return { text, inputTokens, outputTokens, costUsd };
    },
  };
}

/**
 * The port the operator process runs with. Off unless SEMESTER_OPERATOR_MODEL_KEY
 * is set; SEMESTER_OPERATOR_MODEL names the model (default claude-sonnet-5-5) and
 * SEMESTER_OPERATOR_MODEL_URL overrides the endpoint. Prices are not assumed:
 * without SEMESTER_OPERATOR_MODEL_PRICE ("input,output" USD per million) cost
 * is unmetered and reported as such, never as zero.
 */
export function modelFromEnvironment(env: NodeJS.ProcessEnv = process.env): ModelPort {
  const apiKey = env.SEMESTER_OPERATOR_MODEL_KEY;
  if (!apiKey) return noModel;
  const price = env.SEMESTER_OPERATOR_MODEL_PRICE?.split(',').map(Number);
  const pricePerMillion = price && price.length === 2 && price.every((n) => Number.isFinite(n) && n >= 0) ? { input: price[0]!, output: price[1]! } : undefined;
  return createHttpModel({ apiKey, model: env.SEMESTER_OPERATOR_MODEL ?? 'claude-sonnet-5-5', baseUrl: env.SEMESTER_OPERATOR_MODEL_URL, pricePerMillion });
}
