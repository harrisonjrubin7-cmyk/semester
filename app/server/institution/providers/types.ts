import type { IntelligenceMode } from '../../../../packages/institution/src/intelligence.ts';
import type { ApprovedIntelligenceSource } from '../intelligence.ts';

export interface ProviderGenerationRequest {
  provider: string;
  model: string;
  question: string;
  mode: IntelligenceMode;
  sources: ApprovedIntelligenceSource[];
  maxOutputTokens: number;
}

export interface ProviderGenerationResult {
  text: string;
  /** Provider-declared source use; Semester verifies every id before exposing evidence. */
  citedSourceIds: string[];
  inputTokens: number;
  outputTokens: number;
  providerRequestId: string;
  costCents?: number;
}

/** A provider declares source use, but citation authority stays with Semester. */
export interface InstitutionModelProvider {
  generate(
    request: ProviderGenerationRequest,
    signal: AbortSignal,
  ): Promise<ProviderGenerationResult>;
}

export class InstitutionProviderError extends Error {
  readonly code: 'refused' | 'timeout' | 'unavailable' | 'invalid-response';

  constructor(
    code: 'refused' | 'timeout' | 'unavailable' | 'invalid-response',
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = 'InstitutionProviderError';
  }
}
