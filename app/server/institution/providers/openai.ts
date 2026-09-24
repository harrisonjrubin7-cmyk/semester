import OpenAI from 'openai';
import type { InstitutionModelProvider, ProviderGenerationRequest } from './types.ts';
import { InstitutionProviderError } from './types.ts';

interface ResponsesClient {
  responses: {
    create(
      body: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<{
      id?: string;
      status?: string;
      output_text?: string;
      error?: { message?: string } | null;
      incomplete_details?: { reason?: string } | null;
      usage?: { input_tokens?: number; output_tokens?: number } | null;
    }>;
  };
}

export interface OpenAIProviderOptions {
  apiKey?: string;
  client?: ResponsesClient;
  maximumOutputTokens?: number;
}

const DEFAULT_OUTPUT_TOKENS = 1_200;

function inputFor(request: ProviderGenerationRequest) {
  const evidence = request.sources.map((source) => ({
    id: source.id,
    body: source.body,
  }));
  return [
    {
      role: 'developer',
      content: [
        {
          type: 'input_text',
          text:
            `You are Semester Intelligence in ${request.mode} mode. ` +
            'Use only the approved source material below. Separate direct source support from inference. ' +
            'Return only the requested JSON. Cite only source ids you actually used. ' +
            'Do not invent citations or claim an action occurred.',
        },
      ],
    },
    {
      role: 'user',
      content: [
        { type: 'input_text', text: request.question },
        { type: 'input_text', text: `Approved sources:\n${JSON.stringify(evidence)}` },
      ],
    },
  ];
}

export function createOpenAIProvider(options: OpenAIProviderOptions): InstitutionModelProvider {
  const apiKey = options.apiKey?.trim() ?? '';
  if (!options.client && !apiKey) throw new Error('OPENAI_API_KEY is required for the OpenAI provider.');
  const client: ResponsesClient = options.client ?? new OpenAI({ apiKey, maxRetries: 0, timeout: 20_000 });
  const providerCeiling = Math.max(1, Math.floor(options.maximumOutputTokens ?? DEFAULT_OUTPUT_TOKENS));

  return {
    async generate(request, signal) {
      if (request.provider !== 'openai') {
        throw new InstitutionProviderError('refused', 'The selected route is not an OpenAI route.');
      }
      const maxOutputTokens = Math.min(providerCeiling, Math.max(1, Math.floor(request.maxOutputTokens)));
      let response;
      try {
        response = await client.responses.create(
          {
            model: request.model,
            input: inputFor(request),
            store: false,
            background: false,
            max_output_tokens: maxOutputTokens,
            text: {
              format: {
                type: 'json_schema',
                name: 'semester_grounded_answer',
                strict: true,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    answer: { type: 'string' },
                    cited_source_ids: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['answer', 'cited_source_ids'],
                },
              },
            },
          },
          { signal },
        );
      } catch (error) {
        if (signal.aborted) throw new InstitutionProviderError('timeout', 'The approved model request timed out.');
        throw new InstitutionProviderError(
          'unavailable',
          error instanceof Error && error.message ? error.message : 'The approved model provider is unavailable.',
        );
      }

      const output = response.output_text?.trim() ?? '';
      if (response.status !== 'completed' || !output) {
        const reason = response.incomplete_details?.reason || response.error?.message || 'The provider returned no usable response.';
        throw new InstitutionProviderError('invalid-response', reason);
      }
      const inputTokens = response.usage?.input_tokens;
      const outputTokens = response.usage?.output_tokens;
      if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
        throw new InstitutionProviderError('invalid-response', 'The provider response did not include authoritative usage.');
      }
      let answer: unknown;
      let citedSourceIds: unknown;
      try {
        const parsed = JSON.parse(output) as { answer?: unknown; cited_source_ids?: unknown };
        answer = parsed.answer;
        citedSourceIds = parsed.cited_source_ids;
      } catch {
        throw new InstitutionProviderError('invalid-response', 'The provider response was not valid grounded-answer JSON.');
      }
      const allowed = new Set(request.sources.map((source) => source.id));
      if (
        typeof answer !== 'string' || !answer.trim() ||
        !Array.isArray(citedSourceIds) ||
        citedSourceIds.some((id) => typeof id !== 'string' || !allowed.has(id))
      ) {
        throw new InstitutionProviderError('invalid-response', 'The provider response contained invalid or unapproved citations.');
      }
      return {
        text: answer.trim(),
        citedSourceIds: [...new Set(citedSourceIds as string[])],
        inputTokens: inputTokens as number,
        outputTokens: outputTokens as number,
        providerRequestId: response.id ?? '',
      };
    },
  };
}
