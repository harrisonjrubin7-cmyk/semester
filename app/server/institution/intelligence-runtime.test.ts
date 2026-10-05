import { describe, expect, it } from 'vitest';
import { createInstitutionIntelligenceRuntime } from './intelligence-runtime.ts';

const configured = {
  authUrl: 'https://example.supabase.co',
  authServiceKey: 'service-role-test',
  openAIKey: 'openai-test',
  configuredModels: ['openai:gpt-5-mini'],
  maxRequestCents: 2,
  estimatedRequestCents: 1,
  status: 'configured-sandbox' as const,
};

describe('institution intelligence runtime', () => {
  it('remains policy-disabled when a server-only provider credential is missing', () => {
    expect(createInstitutionIntelligenceRuntime({ ...configured, openAIKey: '' }).status).toBe('policy-disabled');
  });

  it('refuses mixed providers instead of routing them through the OpenAI adapter', () => {
    expect(createInstitutionIntelligenceRuntime({
      ...configured,
      configuredModels: ['openai:gpt-5-mini', 'anthropic:claude-sonnet'],
    }).status).toBe('policy-disabled');
  });

  it('reports a configured runtime only when provider, policy store and cost bounds exist', () => {
    expect(createInstitutionIntelligenceRuntime(configured).status).toBe('configured-sandbox');
  });
});
