import { describe, expect, it } from '../../../app/node_modules/vitest/dist/index.js';
import { chooseModel, parseIntelligenceGatewayRequest } from './intelligence.ts';

describe('institution intelligence contract', () => {
  it('routes only to an allowed model under the tenant cost ceiling', () => {
    const route = chooseModel(
      { allowedModels: ['openai:gpt-5-mini'], maxCents: 2 },
      {
        candidates: [
          { model: 'openai:gpt-5-mini', provider: 'openai', estimatedCents: 1.4 },
          { model: 'anthropic:large', provider: 'anthropic', estimatedCents: 7 },
        ],
      },
    );
    expect(route.model).toBe('openai:gpt-5-mini');
    expect(route.estimatedCents).toBeLessThanOrEqual(2);
  });

  it('accepts evidence identifiers but no protected source bodies', () => {
    const parsed = parseIntelligenceGatewayRequest({
      version: 1,
      clientState: 'production',
      tenantId: 'northstar',
      personId: 'student-1',
      question: 'What should I review?',
      mode: 'explain',
      category: 'study',
      sourceIds: ['syllabus'],
      evidenceIds: ['evidence-1'],
      proposedActions: [],
    });
    expect(parsed.evidenceIds).toEqual(['evidence-1']);
    expect(JSON.stringify(parsed)).not.toContain('excerpt');
  });
});
