import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const read = (path) => readFileSync(join(root, path), 'utf8');

const filesUnder = (path, suffix) => readdirSync(join(root, path), { recursive: true })
  .map(String)
  .filter((name) => name.endsWith(suffix))
  .map((name) => join(path, name));

const lineOf = (text, needle) => {
  const at = text.indexOf(needle);
  return at < 0 ? null : text.slice(0, at).split('\n').length;
};

const evidence = (path, needle) => {
  const text = read(path);
  const line = lineOf(text, needle);
  return line ? `${path}:${line}` : path;
};

const testsFor = (needle) => filesUnder('supabase', '.check.sql')
  .filter((path) => read(path).includes(needle))
  .sort();

const http = [
  ['billing-cancel', 'user_jwt', 'caller-owned subscription through RLS', false, 'billing and account identifiers', 'Stripe cancellation and cancellation record', 'provider request plus database ownership check', 'app/src/lib/billing/cancel.test.ts'],
  ['billing-checkout', 'user_jwt', 'caller identity passed to begin_checkout', true, 'billing consent, price and account identifiers', 'hosted checkout and checkout journal', 'database checkout id plus provider idempotency key', 'app/src/lib/billing/checkout.test.ts'],
  ['billing-webhook', 'stripe_signature', 'verified provider event only', true, 'invoice, subscription and payment-event metadata; no card data', 'billing state and payment-event ledger', 'provider event id is unique', 'app/src/lib/billing/webhook.test.ts'],
  ['calendar', 'calendar_bearer_token', 'token resolves one account feed', true, 'course names, deadline titles and dates', 'read and access-log write', 'read-only', 'app/src/lib/calendarserver.test.ts'],
  ['canvas', 'user_jwt_plus_canvas_token', 'authenticated Semester user; Canvas host/path allowlist', true, 'Canvas course and assignment data', 'bounded upstream read', 'read-only', 'app/src/lib/canvasproxy.test.ts'],
  ['claude', 'user_jwt_or_user_provider_key', 'caller identity and per-account usage policy', true, 'course materials and prompts', 'model request and usage count', 'usage row and bounded monthly count', 'app/src/lib/claudeserver.test.ts'],
  ['delete-account', 'user_jwt', 'subject is derived from validated token', true, 'all caller-owned personal data', 'account erasure', 'single subject-bound RPC', 'app/src/lib/deletion.test.ts'],
  ['fetchcal', 'user_jwt', 'authenticated caller; URL scheme/host/address validation', true, 'calendar URL and returned calendar text', 'bounded upstream read', 'read-only', 'app/src/lib/fetchcal.test.ts'],
  ['integration-tick', 'scheduler_vault_token', 'database validates presented scheduler token', true, 'tenant integration configuration and records', 'integration sync/reconciliation', 'durable inbox and connection-scoped event keys', 'app/server/integration/tick.test.ts'],
  ['lead-intake', 'strict_origin_plus_abuse_controls', 'public form route allowlist', true, 'contact details and inquiry text', 'lead record and optional notification', 'database-generated reference; IP-HMAC rate limit', 'app/src/lib/billing/leadintake.test.ts'],
  ['lti', 'oidc_state_nonce_and_signed_id_token', 'issuer/audience/deployment/course role and tenant binding', true, 'LTI identity, course context and grade passback metadata', 'login, launch, link binding and score passback', 'nonce spend and platform line-item identity', 'app/src/lib/ltiserver.test.ts'],
  ['productivity-sourcecheck', 'user_jwt', 'authenticated caller; public .edu or configured host', false, 'public source URL and short excerpt', 'bounded outbound availability check', 'read-only; no shared rate limit (audit finding AUD-P1-01)', 'no dedicated handler test'],
  ['push', 'scheduler_bearer_secret', 'dedicated cron secret', true, 'notification text, destination and device subscription', 'send notifications and retire dead subscriptions', 'bounded oldest-first queue; provider delivery is retryable', 'app/src/lib/pushchain.test.ts'],
  ['trust-room', 'procurement_link_token', 'hashed, expiring grant scoped to named artifacts', true, 'procurement artifacts and access metadata', 'access-log read and one-minute storage URL', 'read-only token spend/access log', 'app/src/lib/trust/room-server.test.ts'],
].map(([name, authn, authz, serviceRole, data, effects, idempotency, tests]) => ({
  id: `edge:${name}`,
  kind: 'supabase_edge_function',
  endpoint: `/functions/v1/${name}`,
  source: `supabase/functions/${name}/index.ts`,
  caller_type: authn.includes('scheduler') ? 'scheduler' : authn.includes('stripe') ? 'provider_webhook' : 'browser_or_external_client',
  authentication: authn,
  authorization_and_tenant_resolution: authz,
  data_classification: data,
  uses_service_role: serviceRole,
  side_effects: effects,
  rate_limit_expectation: name === 'lead-intake' ? 'implemented' : name === 'claude' ? 'implemented_usage_quota' : name === 'productivity-sourcecheck' ? 'missing_shared_limit' : 'endpoint-specific; verify before activation',
  idempotency_or_replay: idempotency,
  audit_logging: 'endpoint-specific; see source and SQL RPCs',
  error_behavior: 'bounded/generic unless noted in AUDIT-REPORT.md',
  tests: [tests],
}));

http.push({
  id: 'vercel:institution',
  kind: 'vercel_route',
  endpoint: '/api/institution/[...path]',
  source: 'app/api/institution/[...path].ts',
  caller_type: 'institution_browser_or_worker',
  authentication: 'Supabase bearer JWT',
  authorization_and_tenant_resolution: 'server adapter derives actor and tenant, then capability-checks every action',
  data_classification: 'institutional operational and education records by service area',
  uses_service_role: true,
  side_effects: 'read/write through narrow gateway RPCs and journal',
  rate_limit_expectation: 'implemented in shared database store',
  idempotency_or_replay: 'gateway action journal and request keys for mutations',
  audit_logging: 'gateway action journal with correlation id',
  error_behavior: 'typed refusal envelope; no stack traces',
  tests: ['app/server/institution/gateway.test.ts', 'app/server/institution/vercel-transport.test.ts'],
});

const grants = read('supabase/grants.check.sql');
const allowedBlock = grants.match(/allowed constant text\[\] := array\[([\s\S]*?)\n\s*\];/);
if (!allowedBlock) throw new Error('authenticated RPC allowlist not found');
const withoutComments = allowedBlock[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
const authenticatedSignatures = [...withoutComments.matchAll(/'((?:''|[^'])+)'/g)]
  .map((match) => match[1].replace(/''/g, "'"));

const migrationFiles = filesUnder('supabase/migrations', '.sql').sort();
const migrationText = new Map(migrationFiles.map((path) => [path, read(path)]));

const definitionFor = (signature) => {
  const name = signature.slice(0, signature.indexOf('('));
  let found = null;
  for (const [path, text] of migrationText) {
    const pattern = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\s*\\(`, 'ig');
    for (const match of text.matchAll(pattern)) found = `${path}:${text.slice(0, match.index).split('\n').length}`;
  }
  return found;
};

const rpc = [...new Set(authenticatedSignatures)].sort().map((signature) => {
  const name = signature.slice(0, signature.indexOf('('));
  return {
    id: `rpc:authenticated:${signature}`,
    kind: 'postgrest_rpc',
    endpoint: `/rest/v1/rpc/${name}`,
    signature,
    caller_type: 'authenticated_browser_or_gateway',
    authentication: 'Supabase authenticated JWT',
    authorization_and_tenant_resolution: 'function-specific; executable grant is fail-closed by supabase/grants.check.sql and the body must derive/verify actor scope',
    data_classification: 'function-specific',
    uses_service_role: false,
    side_effects: 'function-specific; do not infer from HTTP POST',
    rate_limit_expectation: 'required for abuse-sensitive mutations; coverage recorded in SECURITY-TEST-MATRIX.md',
    idempotency_or_replay: 'function-specific',
    audit_logging: 'function-specific',
    error_behavior: 'PostgREST error envelope; clients must sanitize',
    source: definitionFor(signature),
    tests: testsFor(name),
  };
});

const service = [];
for (const [path, text] of migrationText) {
  for (const match of text.matchAll(/grant\s+execute\s+on\s+function\s+((?:public|private)\.[\s\S]*?\))\s+to\s+service_role\s*;/gi)) {
    service.push({ signature: match[1].replace(/\s+/g, ' ').trim(), source: `${path}:${text.slice(0, match.index).split('\n').length}` });
  }
}
const privileged = [...new Map(service.map((entry) => [entry.signature, entry])).values()]
  .sort((a, b) => a.signature.localeCompare(b.signature))
  .map((entry) => ({
    id: `rpc:service:${entry.signature}`,
    kind: 'privileged_sql_operation',
    endpoint: null,
    signature: entry.signature,
    caller_type: 'service_role_worker_only',
    authentication: 'service-role credential at a server boundary',
    authorization_and_tenant_resolution: 'operation-specific; caller must derive tenant/subject before invocation',
    data_classification: 'privileged, function-specific',
    uses_service_role: true,
    side_effects: 'function-specific privileged operation',
    rate_limit_expectation: 'enforced at owning HTTP/worker boundary',
    idempotency_or_replay: 'function-specific',
    audit_logging: 'required for mutations; verify owning function',
    error_behavior: 'must be translated at owning boundary',
    source: entry.source,
    tests: testsFor(entry.signature.replace(/^(?:public|private)\./, '').split('(')[0]),
  }));

const manifest = {
  schema_version: 1,
  generated_at: '2026-10-02',
  generated_by: 'scripts/build_endpoint_manifest.mjs',
  limitations: [
    'Static inventory: deployment activation and dashboard configuration were not verified.',
    'Authenticated RPC membership is authoritative because supabase/grants.check.sql fails on additions or omissions; per-RPC metadata still requires body-level review.',
    'Service-role operations are explicit grants found in migration history; the PostgreSQL 17 schema harness must confirm final deployed state.',
  ],
  counts: { http_entry_points: http.length, authenticated_rpc_operations: rpc.length, explicit_service_role_operations: privileged.length },
  http_entry_points: http,
  authenticated_rpc_operations: rpc,
  privileged_sql_operations: privileged,
};

writeFileSync(join(root, 'endpoint-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`endpoint manifest: ${http.length} HTTP, ${rpc.length} authenticated RPC, ${privileged.length} service-role operations`);
