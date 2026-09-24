import type { ModelTask } from '../../../packages/institution/src/index.ts';
import { createIntelligenceService, type IntelligenceAuditRecord, type IntelligenceService } from './intelligence.ts';
import { createSupabaseIntelligenceRepository } from './intelligence-repository.ts';
import { createOpenAIProvider } from './providers/openai.ts';
import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';

export interface IntelligenceRuntimeOptions {
  authUrl: string;
  authServiceKey: string;
  openAIKey: string;
  configuredModels: readonly string[];
  maxRequestCents: number;
  estimatedRequestCents: number;
  status: 'configured-sandbox' | 'configured-production';
  audit?: (identity: UniversityIdentity, record: IntelligenceAuditRecord) => void;
}

const disabled = (audit?: IntelligenceRuntimeOptions['audit']): IntelligenceService =>
  createIntelligenceService({
    status: 'policy-disabled',
    loadPolicy: async () => ({
      state: 'off', permittedRoles: [], allowedModes: [], allowedModels: [],
      maxRequestCents: 0, monthlyBudgetCents: 0, monthlySpentCents: 0, retentionDays: 0,
    }),
    loadApprovedSources: async () => [],
    modelTask: async () => ({ candidates: [] }),
    generate: async () => { throw new Error('No approved institutional model provider is installed.'); },
    execute: async () => ({ verified: false }),
    audit,
  });

export function createInstitutionIntelligenceRuntime(options: IntelligenceRuntimeOptions): IntelligenceService {
  const models = [...new Set(options.configuredModels.map((model) => model.trim()).filter(Boolean))];
  const onlyOpenAI = models.length > 0 && models.every((model) => model.startsWith('openai:'));
  const limitsAreValid =
    Number.isFinite(options.maxRequestCents) && options.maxRequestCents > 0 &&
    Number.isFinite(options.estimatedRequestCents) && options.estimatedRequestCents >= 0 &&
    options.estimatedRequestCents <= options.maxRequestCents;
  if (!options.authUrl || !options.authServiceKey || !options.openAIKey || !onlyOpenAI || !limitsAreValid) {
    return disabled(options.audit);
  }

  const repository = createSupabaseIntelligenceRepository({
    url: options.authUrl,
    serviceKey: options.authServiceKey,
    configuredModels: models,
    maxRequestCents: options.maxRequestCents,
  });
  const provider = createOpenAIProvider({ apiKey: options.openAIKey });
  const task: ModelTask = {
    candidates: models.map((model) => ({
      model,
      provider: 'openai',
      estimatedCents: options.estimatedRequestCents,
    })),
  };
  return createIntelligenceService({
    status: options.status,
    loadPolicy: repository.loadPolicy,
    loadApprovedSources: repository.loadApprovedSources,
    modelTask: async () => task,
    generate: provider.generate,
    reserveBudget: repository.reserveBudget,
    settleBudget: repository.settleBudget,
    // Provider actions are never executed by this runtime. Each adapter must
    // supply its own authoritative write plus readback before actions can ship.
    execute: async () => ({ verified: false }),
    audit: options.audit,
  });
}
