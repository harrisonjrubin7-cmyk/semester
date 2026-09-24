import { createGateway } from './gateway.ts';
import { supabaseIdentity } from './auth.ts';
import { adapters } from './adapters.ts';
import { createMembershipResolver, supabaseMembershipDirectory, supabaseSsoConfigLoader } from './membership.ts';
import { PostgresActionJournal } from './postgres-journal.ts';
import { PostgresRateLimiter } from './rate-limit.ts';
import { PostgresIntelligenceActionStore } from './intelligence-action-store.ts';
import { createInstitutionIntelligenceRuntime } from './intelligence-runtime.ts';
import { institutionReadiness } from './readiness.ts';

export type InstitutionEnvironment = Record<string, string | undefined>;

export function exactAppOrigin(env: InstitutionEnvironment): string {
  const origin = env.SEMESTER_APP_ORIGIN || '';
  const parsed = new URL(origin);
  const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (!origin || parsed.origin !== origin || !(parsed.protocol === 'https:' || local)) {
    throw new Error('Set SEMESTER_APP_ORIGIN to an exact HTTPS application origin (or localhost while developing).');
  }
  return origin;
}

export function environmentJournalKey(env: InstitutionEnvironment): Buffer {
  const secret = env.SEMESTER_JOURNAL_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(secret)) {
    throw new Error('Set SEMESTER_JOURNAL_KEY to 32 random bytes encoded as hex, stored only on the server.');
  }
  return Buffer.from(secret, 'hex');
}

/**
 * Stateless production composition for serverless or horizontally scaled
 * gateways. Every mutable boundary is Supabase-backed; there is no filesystem
 * journal, process-local action queue or process-local request counter.
 */
export function createProductionInstitutionRuntime(env: InstitutionEnvironment) {
  const authUrl = env.SEMESTER_AUTH_URL || '';
  const authKey = env.SEMESTER_AUTH_PUBLIC_KEY || '';
  const serviceKey = env.SEMESTER_AUTH_SERVICE_KEY || '';
  if (!authUrl || !authKey || !serviceKey) {
    throw new Error('Production requires SEMESTER_AUTH_URL, SEMESTER_AUTH_PUBLIC_KEY and SEMESTER_AUTH_SERVICE_KEY.');
  }
  const key = environmentJournalKey(env);
  const journal = new PostgresActionJournal({ url: authUrl, serviceKey, encryptionKey: key });
  const rateLimiter = new PostgresRateLimiter({ url: authUrl, serviceKey });
  const actionStore = new PostgresIntelligenceActionStore({ url: authUrl, serviceKey, encryptionKey: key });
  const membershipResolver = createMembershipResolver(
    supabaseMembershipDirectory(authUrl, serviceKey),
    async (event) => console.info(JSON.stringify({ event: 'institution.authorization', ...event })),
  );
  const authenticate = supabaseIdentity(authUrl, authKey, membershipResolver);
  const models = (env.SEMESTER_AI_PROVIDERS || '').split(',').map((model) => model.trim()).filter(Boolean);
  const intelligence = createInstitutionIntelligenceRuntime({
    authUrl,
    authServiceKey: serviceKey,
    openAIKey: env.OPENAI_API_KEY || '',
    configuredModels: models,
    maxRequestCents: Number(env.SEMESTER_AI_MAX_REQUEST_CENTS || '0'),
    estimatedRequestCents: Number(env.SEMESTER_AI_ESTIMATED_REQUEST_CENTS || '0'),
    status: env.SEMESTER_AI_RUNTIME_STATUS === 'production' ? 'configured-production' : 'configured-sandbox',
    audit: journal.auditIntelligence.bind(journal),
    actionStore,
  });
  const ssoDomain = (env.SEMESTER_SSO_DOMAIN || '').trim().toLowerCase();
  const ssoLabel = (env.SEMESTER_SSO_LABEL || '').trim();
  const minimumAdapters = Number(env.SEMESTER_MINIMUM_ADAPTERS || '1');
  if (!Number.isInteger(minimumAdapters) || minimumAdapters < 0) {
    throw new Error('SEMESTER_MINIMUM_ADAPTERS must be a non-negative integer.');
  }
  return createGateway({
    origin: exactAppOrigin(env),
    institutionName: env.SEMESTER_INSTITUTION_NAME || 'Your university',
    authenticate,
    refreshIdentity: async (_identity, token) => authenticate(token),
    adapters,
    journal,
    rateLimiter,
    intelligence,
    readiness: () => institutionReadiness({
      journal,
      monitoringConfigured: env.SEMESTER_MONITORING_READY === '1',
      adaptersInstalled: adapters.length,
      minimumAdapters,
      integrationsHealthy: env.SEMESTER_INTEGRATIONS_READY === '1',
      intelligenceStatus: intelligence.status,
      requireProductionIntelligence: env.SEMESTER_REQUIRE_AI === '1',
    }),
    telemetry: async (event) => console.info(JSON.stringify(event)),
    loadSsoConfig: ssoDomain && ssoLabel
      ? supabaseSsoConfigLoader(authUrl, serviceKey, ssoDomain, ssoLabel)
      : async () => null,
  });
}
