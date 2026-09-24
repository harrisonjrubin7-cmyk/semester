import { describe, expect, it, vi } from 'vitest';
import { createOpenAIProvider } from './openai.ts';

const request = () => ({
  provider: 'openai',
  model: 'gpt-5-mini',
  question: 'What should I review?',
  mode: 'review' as const,
  sources: [{ id: 'source-1', evidenceIds: ['evidence-1'], body: 'Elasticity is on the exam.' }],
  maxOutputTokens: 900,
});

describe('governed OpenAI Responses provider', () => {
  it('uses the selected model, stateless foreground responses and bounded output', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'resp_1', status: 'completed',
      output_text: JSON.stringify({ answer: 'Review elasticity.', cited_source_ids: ['source-1'] }),
      usage: { input_tokens: 42, output_tokens: 8 },
    });
    const provider = createOpenAIProvider({
      client: { responses: { create } },
      maximumOutputTokens: 600,
    });
    const signal = new AbortController().signal;
    const result = await provider.generate(request(), signal);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-5-mini', store: false, background: false, max_output_tokens: 600,
    }), { signal });
    expect(JSON.stringify(create.mock.calls[0][0])).toContain('Elasticity is on the exam.');
    expect(result).toEqual({
      text: 'Review elasticity.', citedSourceIds: ['source-1'], inputTokens: 42, outputTokens: 8, providerRequestId: 'resp_1',
    });
  });

  it('refuses a citation that was not in the approved provider request', async () => {
    const provider = createOpenAIProvider({
      client: { responses: { create: vi.fn().mockResolvedValue({
        id: 'resp_2', status: 'completed',
        output_text: JSON.stringify({ answer: 'Invented.', cited_source_ids: ['source-other'] }),
        usage: { input_tokens: 10, output_tokens: 3 },
      }) } },
    });
    await expect(provider.generate(request(), new AbortController().signal)).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('propagates cancellation and refuses incomplete or unmetered output', async () => {
    const aborted = new AbortController();
    aborted.abort();
    const rejecting = createOpenAIProvider({
      client: { responses: { create: vi.fn().mockRejectedValue(new Error('socket closed')) } },
    });
    await expect(rejecting.generate(request(), aborted.signal)).rejects.toMatchObject({ code: 'timeout' });

    const incomplete = createOpenAIProvider({
      client: { responses: { create: vi.fn().mockResolvedValue({ status: 'incomplete', output_text: '', usage: {} }) } },
    });
    await expect(incomplete.generate(request(), new AbortController().signal)).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('cannot be used for a provider route selected for another vendor', async () => {
    const provider = createOpenAIProvider({
      client: { responses: { create: vi.fn() } },
    });
    await expect(provider.generate({ ...request(), provider: 'anthropic' }, new AbortController().signal))
      .rejects.toMatchObject({ code: 'refused' });
  });
});
