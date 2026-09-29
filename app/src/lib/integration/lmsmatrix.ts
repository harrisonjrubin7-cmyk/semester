/**
 * The LMS interoperability matrix: Canvas, Blackboard Learn, Moodle and D2L
 * Brightspace compared across LTI 1.3, gradebook exchange, API extensibility,
 * rate limits, pagination and events — and what Semester's own integration
 * layer promises against each — from five documents of 28 September 2026,
 * held to what the tree already has.
 *
 * `docs/LMS-INTEROPERABILITY-MATRIX.md` is rendered from this file by
 * `lmsmatrix.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## The finding the five documents share
 *
 * All four platforms can take an LTI 1.3 launch, but registration, the
 * Advantage services a tenant has enabled, admin permissions, throttling and
 * event delivery differ per tenant, not per vendor. So the standard is:
 * standards first, discovery second, proprietary APIs third. Launch with LTI
 * 1.3; use NRPS and AGS only when they appear in the verified launch; use REST
 * or Web Services only for a documented, approved need; reconcile every
 * synchronization that matters. Never infer a capability from a vendor name.
 *
 * ## What is held to what
 *
 * - The registration record the documents ask for is read field by field
 *   against the `lti_platform` table in the migrations; the test holds each
 *   field that claims a column to a column that exists.
 * - The eleven steps of the event processor and the ten pagination rules each
 *   name the file that already does it, or say none does; the test holds every
 *   cited path to the tree and every `have` mark to a code citation.
 * - The Canvas scope list is held to the scopes `ltiags.ts` and the LTI
 *   function actually request.
 * - The scoring rubric's weights sum to one hundred, and the pass/fail gates
 *   come before any total.
 *
 * A supplied PDF is never evidence. The docs pages the repository already had
 * for LTI (`docs/LTI-1.3-LAUNCH-RUNBOOK.md`) and for Gradescope
 * (`GRADESCOPE-TURNITIN.md`) are cited where they carry the fact.
 */

export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/EdTech-Stack-Audit-LTI-AI-Grading-and-API-Extensibility.pdf',
    title: 'EdTech stack audit: compare Canvas, Blackboard, Moodle, and D2L Brightspace across LTI 1.3 standards, AI grading, and API extensibility',
    what: 'The five-dimension landscape table, the source-grounded work-completion chain, the source-aware grading workflow and the QTI 3 interaction library.',
  },
  {
    path: 'docs/expansion/LMS-Sortable-Matrix-and-AI-Grading-Comparison.pdf',
    title: 'Canvas vs Blackboard vs Moodle vs D2L: a sortable LTI 1.3, AI grading, and API extensibility matrix for enterprise EdTech stacks',
    what: 'The weighted scorecard and its pass/fail gates, the API extensibility matrix, the Gradescope/Turnitin/Copyleaks comparison and the Semester API target.',
  },
  {
    path: 'docs/expansion/LMS-API-Comparison-Rate-Limits-Scopes-and-LTI-Endpoints.pdf',
    title: 'Sortable LMS API comparison: Canvas vs Blackboard vs Moodle vs D2L Brightspace — rate limits, OAuth scopes, and LTI 1.3 endpoints',
    what: 'The rate-limit comparison with confidence, the adaptive client behaviour, the full LTI 1.3 matrix, the endpoint discovery record and the QTI 3 migration phases.',
  },
  {
    path: 'docs/expansion/LMS-Developer-Migration-Guide-and-One-System.pdf',
    title: 'Canvas vs Blackboard vs Moodle vs D2L Brightspace API limits, OAuth scopes, and LTI 1.3 endpoints compared in one interactive dashboard',
    what: 'The full comparison, the per-tenant registration object, the Canvas LTI Advantage scopes, the secure token flow — and the one-system platform grammar, which has its own page.',
  },
  {
    path: 'docs/expansion/LMS-Migration-Runbook-Blackboard-Moodle-and-Shared-Object-Model.pdf',
    title: 'Sortable LTI 1.3 dashboard: Canvas vs Blackboard vs Moodle vs D2L Brightspace API limits, OAuth scopes, and AGS/NRPS endpoints compared',
    what: 'The Blackboard and Moodle checklists and risk controls, the plugin risk review, the pagination rules, the discovery test — and the shared object model, which the one-system page carries.',
  },
];

export const STANDARD =
  'Standards first, discovery second, proprietary APIs third. Launch with LTI 1.3; use NRPS and AGS only when they appear in the verified launch; use REST or Web Services only for a documented, approved need; reconcile every synchronization that matters.';

export const PLATFORMS = ['canvas', 'blackboard', 'moodle', 'brightspace'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_NAME: Record<Platform, string> = {
  canvas: 'Canvas',
  blackboard: 'Blackboard Learn',
  moodle: 'Moodle',
  brightspace: 'D2L Brightspace',
};

/** How far a published statement can be trusted before the customer's tenant is tested. */
export type Confidence = 'high' | 'medium' | 'low';

export interface Dimension {
  /** A slug, stable. */
  id: string;
  title: string;
  cells: Record<Platform, string>;
  /** What Semester's own layer promises, in the documents' words. */
  semester: string;
}

/** The full comparison, merged from the five documents' tables. One row per dimension; the wording is the documents' own. */
export const MATRIX: readonly Dimension[] = [
  {
    id: 'baseline',
    title: 'Primary integration baseline',
    cells: {
      canvas: 'LTI 1.3/LTI Advantage plus REST APIs; Developer Keys and LTI registration, JSON or hosted-JSON config',
      blackboard: 'LTI 1.3/LTI Advantage plus REST APIs; availability documented for supported Learn SaaS and eligible hosted versions',
      moodle: 'LTI 1.3, Web Services, plugins, custom APIs; strongly version- and admin-dependent',
      brightspace: 'LTI 1.3/LTI Advantage Complete (Core, AGS v2, Deep Linking v2, NRPS v2) plus the Brightspace Developer Platform',
    },
    semester: 'LTI 1.3/LTI Advantage first; proprietary APIs only when a customer-approved need requires them.',
  },
  {
    id: 'registration',
    title: 'LTI registration',
    cells: {
      canvas: 'Admin-managed Developer Key and deployment; static or hosted JSON supported',
      blackboard: 'Admin registers the tool, approves it, configures user fields and grade access',
      moodle: 'Site-admin configuration; behaviour depends on version and plugins',
      brightspace: 'Tenant-admin registration and permitted services',
    },
    semester: 'A secure per-tenant registration record and an onboarding checklist; never reuse a deployment across tenants.',
  },
  {
    id: 'oidc',
    title: 'OIDC login initiation and JWT launch',
    cells: {
      canvas: 'Tool configuration provides login-initiation and target-link setup; platform JWKS and claims validation',
      blackboard: 'Tenant/admin configuration required; platform JWKS and claims validation',
      moodle: 'OAuth 2.0 / OpenID Connect security model; platform JWKS and claims validation',
      brightspace: 'Tenant/admin configuration required; platform JWKS and claims validation',
    },
    semester: 'Validate state, nonce, issuer, audience, expiry, deployment id and redirect URI on every launch, from the signed claims and never from an expected URL shape.',
  },
  {
    id: 'deployment',
    title: 'Deployment isolation',
    cells: {
      canvas: 'Deployment ids distinguish installations of a developer key',
      blackboard: 'Deployment id captured after registration',
      moodle: 'Deployment and configuration vary by instance',
      brightspace: 'Deployment and configuration vary by tenant',
    },
    semester: 'Bind every launch, access token, roster and grade operation to tenant + deployment + course context.',
  },
  {
    id: 'jwks',
    title: 'JWKS and key model',
    cells: {
      canvas: 'Tool public JWK statically configured or served at a URL Canvas can fetch',
      blackboard: 'Platform/tool JWKS configuration varies by deployment',
      moodle: 'Instance/tool configuration varies',
      brightspace: 'Tenant/tool configuration varies',
    },
    semester: 'Support rotation; pin issuer and domain; log the kid; cache JWKS by issuer and kid; dual-key overlap, expiry alerts and a rotation runbook.',
  },
  {
    id: 'nrps',
    title: 'NRPS roster service',
    cells: {
      canvas: 'Supported with the explicit contextmembership.readonly scope',
      blackboard: 'Availability depends on admin setup and Learn deployment',
      moodle: 'Version/configuration dependent',
      brightspace: 'NRPS v2 in LTI Advantage Complete',
    },
    semester: 'Optional. Request the minimum roster and role fields; read the endpoint from the verified launch claim; support a no-roster fallback.',
  },
  {
    id: 'ags',
    title: 'AGS line items, scores and results',
    cells: {
      canvas: 'Supported with enabled Developer-Key scopes for line items, scores and results',
      blackboard: 'Requires explicit grade-service access configuration by the admin',
      moodle: 'Version/configuration dependent',
      brightspace: 'AGS v2 in LTI Advantage Complete; service availability must be tested per tenant',
    },
    semester: 'Required if Semester writes back grades. Every grade write is explicit, previewable, idempotent, audited and reconciled; the line-items endpoint comes from the claim.',
  },
  {
    id: 'deeplinking',
    title: 'Deep Linking',
    cells: {
      canvas: 'Supported through configured tool capability and placements',
      blackboard: 'Admin and tool placement dependent',
      moodle: 'Version/configuration dependent',
      brightspace: 'Deep Linking v2 in LTI Advantage Complete',
    },
    semester: 'Optional but preferred; feature-detect it and always offer a manual content workflow.',
  },
  {
    id: 'api-auth',
    title: 'REST/API authentication',
    cells: {
      canvas: 'Developer Key plus OAuth/API token model; scoped keys',
      blackboard: 'OAuth 2.0 application registration; API enabled per Learn instance',
      moodle: 'Admin-enabled Web Services and tokens; OAuth 2 configuration for external systems; plugin/hosting model varies',
      brightspace: 'Application/API credentials and REST-like APIs',
    },
    semester: 'OAuth 2/OIDC, scoped credentials, secret rotation, tenant isolation.',
  },
  {
    id: 'api-docs',
    title: 'API documentation and customization model',
    cells: {
      canvas: 'Mature developer documentation; hosted SaaS with supported API/LTI extensions',
      blackboard: 'Validate current developer documentation by deployment; enterprise configuration and integration',
      moodle: 'Extensive community documentation; highest code-level flexibility but highest governance and upgrade burden',
      brightspace: 'REST-like API reference and developer platform; enterprise API and partner ecosystem',
    },
    semester: 'Public OpenAPI contracts, SDKs, change log, rate limits, webhook docs, a synthetic sandbox; composable tenant-configurable modules without customer code execution.',
  },
  {
    id: 'rate-limits',
    title: 'Rate limits',
    cells: {
      canvas: 'Dynamic throttling: each request has a cost against a replenishing quota; throttled calls return HTTP 429',
      blackboard: 'No consistently disclosed production limit; an older 10,000-requests-per-day figure was a technical-preview setting and is not a benchmark',
      moodle: 'No universal quota; instance, host, reverse proxy, plugins and custom controls decide',
      brightspace: 'Token-bucket credits with variable per-call cost; a published 50,000-credit-per-minute bucket; headers give remaining budget, cost, reset and Retry-After',
    },
    semester: 'Adaptive per-tenant queue with backoff and jitter, circuit breaking and durable reconciliation; never hardcode a vendor-wide requests-per-minute.',
  },
  {
    id: 'pagination',
    title: 'Pagination and incremental sync',
    cells: {
      canvas: 'Endpoint-specific Link headers and per-page parameters; API/event strategy varies by resource',
      blackboard: 'Endpoint/version-specific paging parameters; validate modified-since support per endpoint',
      moodle: 'Web-service-function-specific limitfrom/limitnum or custom patterns; often needs a timestamp or report approach',
      brightspace: 'Endpoint-specific page/bookmark/query model; validate filters and change feeds',
    },
    semester: 'A connector-specific paginator with checkpointing; a stored watermark plus an overlap window; resumable jobs with idempotent item processing.',
  },
  {
    id: 'events',
    title: 'Events and webhooks',
    cells: {
      canvas: 'Validate the platform event model per tenant',
      blackboard: 'Validate event/subscription capability per Learn deployment',
      moodle: 'Plugins and custom hosting decide; native behaviour varies',
      brightspace: 'Validate event/subscription mechanisms per tenant',
    },
    semester: 'An at-least-once internal event model, signed outbound webhooks with delivery logs, retries, replay protection and versions; downstream events are hints and reconciliation is mandatory.',
  },
  {
    id: 'ai-grading',
    title: 'AI-assisted grading posture',
    cells: {
      canvas: 'Institution, licence and tool dependent',
      blackboard: 'Institution, licence and tool dependent',
      moodle: 'Plugin/provider dependent; institution selects governance',
      brightspace: 'Institution, licence and tool dependent',
    },
    semester: 'AI suggests evidence, rubric alignment and feedback drafts; an authorized human owns every consequential grade.',
  },
  {
    id: 'portability',
    title: 'Assessment portability',
    cells: {
      canvas: 'Imports and integrations vary',
      blackboard: 'Standards and vendor import tools vary',
      moodle: 'Strong community formats and plugins; portability depends on content type',
      brightspace: 'Enterprise content and integration tooling',
    },
    semester: 'QTI 3 import/export, assessment versioning, item-bank provenance, accessibility metadata, results portability.',
  },
  {
    id: 'risk',
    title: 'Biggest integration risk',
    cells: {
      canvas: 'Incorrect Developer Key scopes and differing tenant permissions',
      blackboard: 'Hosting, version and admin configuration variance',
      moodle: 'Plugin, version, hosting and security-governance variance',
      brightspace: 'Tenant entitlement, configuration and variable request cost',
    },
    semester: 'Never infer capability from a vendor name; test in the customer sandbox and keep a capability-discovery checklist per integration.',
  },
  {
    id: 'approach',
    title: 'Best Semester approach',
    cells: {
      canvas: 'LTI first; the Canvas API only for a documented, customer-approved gap',
      blackboard: 'Capability discovery first, then LTI or API as approved; treat each tenant as a separate discovery',
      moodle: 'Favour LTI and standard Web Services; avoid dependence on custom plugins',
      brightspace: 'LTI first; Developer Platform APIs for explicit approved flows',
    },
    semester: 'Publish supported capability tiers and per-LMS integration test results.',
  },
];

// ── The weighted scorecard ───────────────────────────────────────────────────

export interface Criterion {
  dimension: string;
  test: string;
  evidence: string;
  /** Per cent; the weights sum to 100. */
  weight: number;
}

export const SCORECARD: readonly Criterion[] = [
  { dimension: 'LTI 1.3 / Advantage', test: 'OIDC launch, JWKS rotation, Deep Linking, NRPS roster access, AGS line items and results, deployment isolation', evidence: 'Sandbox test, scopes list, launch logs, grade-write reconciliation', weight: 20 },
  { dimension: 'API breadth', test: 'Courses, enrollments, users, content, assignments, submissions, grades, analytics, files, calendar, roles', evidence: 'OpenAPI/reference docs, rate limits, pagination, version and deprecation policy', weight: 15 },
  { dimension: 'API quality', test: 'OAuth/OIDC, scoped permissions, webhooks, idempotency, retries, sandbox, auditability', evidence: 'Security docs, developer portal, test tenant', weight: 15 },
  { dimension: 'Assessment portability', test: 'QTI import/export, item banks, outcomes, rubrics, test settings, results', evidence: 'Round-trip QTI test and item behaviour validation', weight: 10 },
  { dimension: 'Grade integration', test: 'Create and update line items, post results, read released grades, retry and reconcile writes', evidence: 'AGS test, error queue, audit record', weight: 15 },
  { dimension: 'AI grading governance', test: 'Human review, rubric evidence, source and citation trace, bias and accessibility testing, appeal process', evidence: 'Product workflow demo and policy artifacts', weight: 15 },
  { dimension: 'Security and operations', test: 'Tenant isolation, MFA, audit logs, DPA, retention, uptime, support, incident response', evidence: 'Security package, contract terms, architecture review', weight: 10 },
];

export const SCORE_SCALE: readonly { score: number; meaning: string }[] = [
  { score: 0, meaning: 'Missing, unsupported, or the vendor will not evidence it' },
  { score: 1, meaning: 'Exists only through custom workarounds or limited plugin support' },
  { score: 2, meaning: 'Available but difficult to configure, poorly documented, or weakly governed' },
  { score: 3, meaning: 'Supported, documented, configurable, and tested in your tenant' },
  { score: 4, meaning: 'Mature, scoped, observable, versioned, sandboxed, and independently evidenced' },
];

/** Any one failing stops the comparison before a total is calculated. */
export const PASS_FAIL_GATES: readonly string[] = [
  'LTI 1.3/OIDC validation works.',
  'Roles and tenant/course context are correct.',
  'Grade writes are previewable and auditable.',
  'Student data does not cross tenants.',
  'The critical accessibility workflow passes.',
  'AI-assisted grading retains authorized human accountability.',
];

/** Weighted total: Σ (score × weight) / (4 × Σ weight), as a percentage. */
export const weightedScore = (scores: Readonly<Record<string, number>>): number => {
  let sum = 0;
  let max = 0;
  for (const c of SCORECARD) {
    const s = scores[c.dimension];
    if (s === undefined) throw new Error(`no score for ${c.dimension}`);
    if (!Number.isInteger(s) || s < 0 || s > 4) throw new Error(`score for ${c.dimension} is not 0–4`);
    sum += s * c.weight;
    max += 4 * c.weight;
  }
  return (100 * sum) / max;
};

// ── Rate limits: what each publishes, and how confident to be ────────────────

export interface RateLimit {
  platform: Platform;
  auth: string;
  published: string;
  implication: string;
  confidence: Confidence;
  why: string;
}

export const RATE_LIMITS: readonly RateLimit[] = [
  {
    platform: 'canvas',
    auth: 'Developer Keys and scoped API/LTI configuration; OAuth-based API access',
    published: 'Dynamic throttling: calls have a cost against a replenishing quota; throttled calls return HTTP 429',
    implication: 'Read quota and throttling headers, constrain concurrent calls, jittered exponential backoff, persisted idempotency keys, reconcile state',
    confidence: 'high',
    why: 'High for the mechanism; the actual capacity varies by tenant',
  },
  {
    platform: 'blackboard',
    auth: 'OAuth 2.0 key/secret and application registration; API enabled per Learn instance',
    published: 'No consistently disclosed production limit; the older 10,000-requests-per-24-hours figure was explicitly a technical-preview setting',
    implication: 'Confirm deployment, version, endpoint access, quota, token behaviour and event options during tenant discovery; generic 429 and circuit-breaker handling',
    confidence: 'medium',
    why: 'Medium to low until the customer confirms',
  },
  {
    platform: 'moodle',
    auth: 'Admin-enabled Web Services and tokens; OAuth 2 for external systems; plugin and hosting model varies',
    published: 'No universal quota across deployments; institution, host, reverse proxy, plugins and custom controls decide',
    implication: 'Treat each instance as unique; negotiate and load-test approved quotas; incremental sync, pagination, checkpointing, reconciliation',
    confidence: 'low',
    why: 'Low as a universal number; high that the variance is real',
  },
  {
    platform: 'brightspace',
    auth: 'Brightspace Developer Platform, REST-like API and application credentials',
    published: 'Token-bucket credits; a published 50,000-credits-per-minute bucket with variable, dynamically adjustable call cost; headers carry remaining budget, cost, reset and Retry-After',
    implication: 'Adapt worker concurrency to the headers; cache reads; batch where supported; honour Retry-After; idempotent grade writes',
    confidence: 'high',
    why: 'High for the mechanism; the per-tenant operational policy still needs verifying',
  },
];

/** What every Semester connector does, whichever platform it talks to. */
export const CLIENT_BEHAVIOUR: readonly string[] = [
  'Read response headers on every API call.',
  'Track quota or credits by tenant, credential, endpoint family and worker.',
  'Use bounded concurrency rather than a fixed global parallelism level.',
  'Retry only transient failures: 429, 408, selected 5xx and network errors.',
  'Honour Retry-After where present.',
  'Use exponential backoff with jitter.',
  'Use idempotency keys for writes where supported; otherwise a local write ledger.',
  'Pause or circuit-break on sustained failures.',
  'Use durable queues and a dead-letter queue.',
  'Run scheduled reconciliation, because API and webhook delivery can be incomplete or delayed.',
  'Expose sync lag, failed records, retry state and repair actions in the Operations Console.',
];

/** What the integration assumes about any downstream event stream. Designing around the opposite is the failure. */
export const DELIVERY_CONTRACT: readonly string[] = [
  'At-least-once delivery.',
  'Events may be duplicated.',
  'Events may arrive out of order.',
  'Events may be delayed.',
  'Some events may be absent.',
  'Destination state may change outside the integration.',
];

// ── Canvas LTI Advantage scopes ──────────────────────────────────────────────

export interface Scope {
  use: string;
  scope: string;
  when: string;
}

export const CANVAS_SCOPES: readonly Scope[] = [
  { use: 'Read course roster and roles', scope: 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly', when: 'Only if roster or role synchronization is necessary' },
  { use: 'Create, read, update and delete gradebook line items', scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem', when: 'Only for assessments that need Semester-managed grade columns' },
  { use: 'Read a specific line item', scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly', when: 'Prefer this where write access is not needed' },
  { use: 'Post scores', scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score', when: 'Only if an authorized human or institution workflow writes grades' },
  { use: 'Read results', scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly', when: 'Only if Semester must reconcile released grades or results' },
  { use: 'Read Canvas page content through postMessage', scope: 'https://canvas.instructure.com/lti/page_content/show', when: 'Only for the explicit page-content feature' },
];

/** Canvas permissions an administrator holds; an instructor is never assumed to hold them. */
export const CANVAS_ADMIN_PERMISSIONS: readonly string[] = ['manage_lti_add', 'manage_developer_keys', 'manage_grades'];

/** The secure token flow, launch to audit. */
export const TOKEN_FLOW: readonly string[] = [
  'Semester receives the LTI 1.3 launch.',
  'Validates the JWT signature and the core claims.',
  'Identifies the tenant and the deployment.',
  'Reads the allowed service endpoints and scopes from the verified claims.',
  'Signs a client-credentials token request with the tenant-specific RSA private key.',
  'Requests only the required scopes.',
  'Receives a short-lived access token.',
  'Calls only the released endpoints for that course or resource context.',
  'Writes an audit event.',
  'Caches the token only until expiry, encrypted and tenant-scoped, and retries safely under rate-limit controls.',
];

// ── The per-tenant registration record ───────────────────────────────────────

export interface RegistrationField {
  field: string;
  /** The `lti_platform` column that carries it, or null when none does. */
  column: string | null;
  note: string;
}

// ── Pagination ───────────────────────────────────────────────────────────────

export const PAGINATION_RULES: readonly string[] = [
  'Request the maximum documented safe page size only after tenant testing.',
  'Persist the cursor, bookmark, Link-header URL, offset or page token.',
  'Store a checkpoint after every successful page.',
  'Deduplicate records by stable external id plus source version or updated time.',
  'Use an overlap window for modified-since queries to catch clock skew and delayed indexing.',
  'Use idempotent upserts rather than inserts.',
  'Stop on 429, apply Retry-After or backoff, and resume from the checkpoint.',
  'Place malformed or unreadable records in an exception queue; do not kill the full sync.',
  'Run periodic full or scoped reconciliation.',
  'Track count, lag, error rate, throughput, throttle events and the last good checkpoint.',
];

// ── The sandbox test before any production connector ─────────────────────────

export const SANDBOX_TEST: readonly { area: string; steps: readonly string[] }[] = [
  {
    area: 'Authentication',
    steps: ['Obtain and refresh a token.', 'Test token expiry and key rotation.', 'Remove a permission and verify the failure is clear.'],
  },
  {
    area: 'Pagination',
    steps: ['Pull several pages of courses, enrollments and content.', 'Restart midway and resume from the stored checkpoint.', 'Verify no skipped or duplicated records after concurrent source changes.'],
  },
  {
    area: 'Throttle',
    steps: ['Run a bounded controlled burst.', 'Record 429/503 behaviour, rate-limit headers, Retry-After, the error body and recovery.', 'Set a safe concurrency and a sustained-call budget.'],
  },
  {
    area: 'Write',
    steps: ['Create a non-production artifact or grade line item if permitted.', 'Repeat the same request with the idempotency record.', 'Verify no duplicate write.', 'Test revoke, rollback and reconciliation behaviour.'],
  },
  {
    area: 'Reconciliation',
    steps: ['Introduce an intentional source-side change without an event.', 'Confirm scheduled reconciliation catches and repairs the difference.'],
  },
];

/** What a passing Canvas or Brightspace evaluation means. */
export const SUCCESS: readonly string[] = [
  'No duplicate grade posted.',
  'No missed final state after reconciliation.',
  'No cross-tenant record access.',
  'No unbounded retry storm.',
  'Every failed grade sync has a visible exception and an operator action.',
];

// ── Blackboard and Moodle: the cautious two ──────────────────────────────────

export const BLACKBOARD_CHECKLIST: readonly string[] = [
  'Confirm the Learn deployment type: SaaS, managed hosting or self-hosted.',
  'Confirm the exact Learn release and version.',
  'Register Semester as an LTI 1.3 tool.',
  'Obtain and store the issuer, client id, deployment id, OIDC initiation endpoint, authorization endpoint, JWKS endpoint, OAuth access-token endpoint and the redirect URI allowlist.',
  'Confirm which Advantage services are enabled: Deep Linking, NRPS, AGS.',
  'Confirm the identity fields released in the launch: subject, name, email, roles, institution and person identifiers, custom claims.',
  'Confirm grade-service permissions: create line item, read line item, post score, read results, view grade status in the student view.',
  'Confirm role mapping: instructor, teaching assistant, student, observer, administrator, custom institutional roles.',
  'Confirm data-retention and logging expectations.',
];

export const BLACKBOARD_API_USES: readonly { need: string; prefer: string; apiOnlyWhen: string }[] = [
  { need: 'Launch Semester in a course', prefer: 'LTI 1.3 Core', apiOnlyWhen: 'Not applicable' },
  { need: 'Identify the current course context and role', prefer: 'LTI launch claims', apiOnlyWhen: 'Additional system context is essential' },
  { need: 'Read the roster', prefer: 'NRPS', apiOnlyWhen: 'NRPS is unavailable or insufficient and the customer approves the REST scope' },
  { need: 'Create a content link', prefer: 'Deep Linking', apiOnlyWhen: 'The customer requires a specific managed-placement workflow' },
  { need: 'Post an assessment score', prefer: 'AGS', apiOnlyWhen: 'The institution requires a Blackboard-specific official-grade workflow' },
  { need: 'Read course content', prefer: 'LTI context and approved sources', apiOnlyWhen: 'Semester needs specific customer-approved content synchronization' },
  { need: 'Read grades', prefer: 'AGS results', apiOnlyWhen: 'The institution explicitly authorizes a Blackboard gradebook integration' },
  { need: 'Provision and deprovision accounts', prefer: 'SCIM or the identity provider', apiOnlyWhen: 'The Blackboard API is a defined, customer-approved lifecycle source' },
];

export const BLACKBOARD_NEVER: readonly string[] = [
  'Assume API parity across SaaS and non-SaaS deployments.',
  'Assume every LTI Advantage service is enabled.',
  'Treat Blackboard REST access as a substitute for proper LTI context.',
  'Use instructor credentials for server-to-server integration.',
  'Bulk-pull student content or grade data without purpose limitation.',
  'Rely on undocumented request limits or event behaviour.',
  'Write grades without a preview, an idempotency record, a sync status and a reconciliation process.',
];

export const MOODLE_CHECKLIST: readonly string[] = [
  'Confirm the Moodle version and its support lifecycle.',
  'Confirm hosting: MoodleCloud, managed hosting, institutional self-hosting, consortium or shared service, or a customized deployment.',
  'Confirm whether Semester is configured as an external tool, an LTI consumer, an LTI provider, or both.',
  'Obtain and store the issuer, client id, deployment id, OIDC initiation endpoint, authorization endpoint, JWKS endpoint, access-token endpoint and the redirect URI allowlist.',
  'Confirm the LTI Advantage services enabled: NRPS, AGS, Deep Linking.',
  'Confirm course, user, role and identity claims.',
  'Confirm the allowed external web-service functions.',
  'Confirm the authentication model: service token, OAuth 2, plugin-managed flow, user-bound token, or another approved institutional method.',
  'Confirm the plugin inventory and customizations affecting roles, enrollments, gradebook, events, content, files, privacy, retention and API behaviour.',
  'Confirm test or staging site availability.',
];

export const MOODLE_PRINCIPLES: readonly string[] = [
  'Use a dedicated integration service account.',
  'Grant only the specific external-service functions needed.',
  'Restrict the service account to the smallest role and context possible.',
  'Separate sandbox credentials from production credentials.',
  'Rotate tokens and credentials.',
  'Disable unused services and protocols.',
  'Log function calls and export activity.',
  'Use version-compatible functions and test after Moodle and plugin upgrades.',
  'Avoid a custom plugin dependency unless the customer can own its lifecycle.',
];

export const PLUGIN_RISK_REVIEW: readonly string[] = [
  'Maintainer and update cadence',
  'Security advisories and CVE response',
  'Supported Moodle versions',
  'Data processing and subprocessors',
  'Role and capability changes',
  'Database schema impact',
  'Performance impact',
  'Privacy API support',
  'Backup and restore behaviour',
  'Accessibility testing',
  'Exit and removal plan',
];

/** How Blackboard and Moodle are onboarded: as capability-discovery integrations. */
export const DISCOVERY_FLOW: readonly string[] = [
  'Register',
  'Validate the LTI launch',
  'Discover released services and scopes',
  'Test pagination and rate behaviour',
  'Enable only needed data flows',
  'Establish reconciliation',
  'Monitor health',
  'Revalidate after a vendor, version or hosting change',
];

// ── Semester's own developer contract ────────────────────────────────────────

export const API_TARGET: readonly { area: string; promise: string }[] = [
  { area: 'Identity', promise: 'OIDC, SAML, SCIM, tenant-aware roles, MFA for privileged access.' },
  { area: 'Standards', promise: 'LTI 1.3/LTI Advantage, OneRoster, QTI 3, CASE when relevant, Open Badges and CLR later.' },
  { area: 'APIs', promise: 'REST/OpenAPI, OAuth 2.0, scoped tokens, cursor pagination, idempotency, resource versioning and ETags, clear rate limits, predictable errors.' },
  { area: 'Events', promise: 'Signed webhooks, event versioning, retries, a delivery log, replay protection, a customer webhook dashboard.' },
  { area: 'Data', promise: 'Field-level permissions, source/scope/status metadata, export APIs, retention metadata, deletion and revocation events, tenant isolation.' },
  { area: 'Developer operations', promise: 'A synthetic sandbox, test tenants, SDKs, an API explorer, a changelog, deprecation windows, an integration-health dashboard, support runbooks.' },
  { area: 'Grade writes', promise: 'Preview → human or institution confirmation → idempotent delivery → destination acknowledgment → reconciliation → exception queue → immutable audit event.' },
];

/** The decision rule: choose an integration on proof, never on who claims the most AI. */
export const DECISION_RULE: readonly string[] = [
  'Interoperability: the standards work in the specific customer tenant.',
  'Control: permissions, grade writes and data access are scoped and auditable.',
  'Assessment quality: items are accessible, versioned, aligned and portable.',
  'Human accountability: AI assists but does not silently decide grades or misconduct.',
  'Student rights: source visibility, accessible alternatives, feedback, correction, appeal, export and privacy are built into the workflow.',
];

// ── Held to the tree ─────────────────────────────────────────────────────────

/**
 * The per-tenant registration object the documents ask for, read against
 * `public.lti_platform`. Eight of the twenty-four fields have a column; the
 * test reads the migrations and holds every named column to one that exists.
 * The AGS and Deep Linking endpoints arrive in the launch claim, per launch,
 * and are never stored on the platform row — which is the documents' own
 * rule ("read the endpoint from the verified launch claim"), so their absence
 * here is a design, not a gap. The rest is the gap.
 */
export const REGISTRATION: readonly RegistrationField[] = [
  { field: 'tenant_id', column: 'tenant_id', note: 'The Semester school the deployment belongs to; removing the school sets it null rather than deleting the registration.' },
  { field: 'lms_provider', column: null, note: 'Indirect: the connection row (`connection_id`) names the provider; nothing on the platform row does.' },
  { field: 'lms_version', column: null, note: 'Not recorded.' },
  { field: 'environment (sandbox / production)', column: null, note: 'Only the tenant feature state — off, preview, sandbox, production — in ltientitlement.ts; not per registration.' },
  { field: 'issuer', column: 'issuer', note: 'Part of the primary key; exact-match, never brand-level.' },
  { field: 'client_id', column: 'client_id', note: 'Part of the primary key.' },
  { field: 'deployment_id', column: 'deployment_id', note: 'Part of the primary key; a deployment is never reused across tenants because the key is (issuer, client, deployment).' },
  { field: 'oidc_login_initiation_url', column: 'auth_login_url', note: 'Where the OIDC authentication request goes; `https` by check constraint.' },
  { field: 'authorization_url', column: 'auth_login_url', note: 'The same column: the platform’s authorization endpoint is where the login initiation redirects.' },
  { field: 'jwks_url', column: 'jwks_url', note: '`https` by check constraint; the function verifies every launch against it.' },
  { field: 'access_token_url', column: 'token_url', note: 'Nullable; `https` by check; needed only to call back for AGS.' },
  { field: 'redirect_uris', column: null, note: 'The launch target is checked against the tool’s own origin (`foreign-target`), not an allowlist per registration.' },
  { field: 'deep_linking_endpoint', column: null, note: 'By design, per launch: read from the Deep Linking settings claim (`ltideeplink.ts` readSettings).' },
  { field: 'nrps_context_memberships_url', column: null, note: 'NRPS is not requested (`ltikey.ts` excludes contextmembership on purpose); nothing to store.' },
  { field: 'ags_lineitems_url', column: null, note: 'By design, per launch and per user: `lti_line_item.lineitems_url`, read from the AGS claim.' },
  { field: 'ags_results_url', column: null, note: 'Results are never read back (`SCOPE.result` is defined and unused); nothing to store.' },
  { field: 'ags_scores_url', column: null, note: 'Derived from `lti_line_item.lineitem_url` by `scoresUrl()` at post time.' },
  { field: 'enabled_scopes', column: null, note: 'Per user in `lti_line_item.scopes`, as the claim released them; not per registration.' },
  { field: 'enabled_message_types', column: null, note: 'Resource-link and Deep Linking requests are both accepted; nothing records which a tenant enabled.' },
  { field: 'claims_released', column: null, note: 'The minimum claims are in the runbook; the platform row does not record what a tenant releases.' },
  { field: 'key_rotation_method', column: null, note: 'The tool serves one key with an hour’s cache; no rotation, overlap or expiry alert.' },
  { field: 'admin_owner', column: null, note: 'Indirect: `integration_connections.owner_account_id` and `approved_by` on the connection.' },
  { field: 'last_validated_at', column: null, note: 'The connection has `last_successful_sync_at`; no launch validation date.' },
  { field: 'fallback_mode', column: null, note: 'Not recorded; the runbook’s answers (`unbound`, `no-registration` …) are the fallback behaviour.' },
];

/** The migrations the test reads for the `lti_platform` columns, in order. */
export const LTI_MIGRATIONS: readonly string[] = [
  'supabase/migrations/20260921160000_lti.sql',
  'supabase/migrations/20260921162000_lti_token_url.sql',
  'supabase/migrations/20260927180000_lti_integration_binding.sql',
];

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Step {
  /** `P01`…, `C01`…, `W01`…, stable. */
  id: string;
  step: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

const RUNBOOK = 'docs/INTEGRATION-OPERATOR-RUNBOOK.md';
const ROADMAP = 'docs/ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md';
const PIPELINE_TEST = 'app/src/lib/integration/pipeline.test.ts';
const WORKER = 'app/server/integration/worker.ts';
const WORKER_TEST = 'app/server/integration/worker.test.ts';
const CONTROL_PLANE = 'supabase/migrations/20260927170000_integration_control_plane.sql';

/**
 * The eleven steps of the event processor, each at what the tree has. Two
 * facts frame every row: there is no inbound webhook endpoint (INT-013), so
 * sync is pull-based on a fifteen-minute tick; and `ADAPTERS` in the registry
 * is empty, so nothing syncs yet. What exists is the pipeline the tick would
 * run.
 */
export const PROCESSOR: readonly Step[] = steps([
  {
    id: 'P01', step: 'Verify the webhook signature and timestamp when available.', status: 'designed',
    evidence: [[ROADMAP, 'inbound webhooks, their signature and replay verification are open items'], ['app/src/lib/blueprint.ts', 'INT-013: no inbound webhook endpoint, so no signature, timestamp or replay verification']],
    gap: 'No inbound endpoint. Signatures are verified only on LTI id_tokens and SCIM bearer credentials.',
  },
  {
    id: 'P02', step: 'Store the raw event metadata and a correlation id.', status: 'building',
    evidence: [[CONTROL_PLANE, '`integration_webhook_events` keeps a payload hash and an optional payload reference, never the payload'], [WORKER, 'stores the hash of what it received']],
    gap: 'No correlation id on the events table; correlation ids exist on the gateway and the domain outbox only.',
  },
  {
    id: 'P03', step: 'Deduplicate with the event id or an idempotency key.', status: 'tested',
    evidence: [[CONTROL_PLANE, 'a unique index on (connection_id, idempotency_key) plus provider_event_id'], ['app/src/lib/integration/pipeline.ts', 'claimIdempotencyKey before processing'], [WORKER_TEST, 'a duplicate insert is treated as a duplicate, not an error']],
    gap: 'None for the pipeline; nothing feeds it yet.',
  },
  {
    id: 'P04', step: 'Place the event on a durable queue.', status: 'building',
    evidence: [['supabase/scheduler.sql', 'the fifteen-minute `integration-sync` cron calls integration-tick'], ['packages/institution/src/events.ts', 'the domain outbox and drainOutbox exist, with a unique idempotency index'], ['docs/architecture/0008-event-envelope-and-outbox.md', 'the at-least-once envelope']],
    gap: 'No inbound queue: sync is pull-based; the outbox drainer has no caller.',
  },
  {
    id: 'P05', step: 'Process with tenant, deployment and course context.', status: 'tested',
    evidence: [[WORKER, 'tenant_id comes from the connection row, never from the provider'], [WORKER_TEST, 'the worker refuses a record whose tenant is not the connection’s']],
    gap: 'Tenant only: no deployment or course context on an event.',
  },
  {
    id: 'P06', step: 'Use optimistic concurrency or version checks where supported.', status: 'tested',
    evidence: [['app/src/lib/integration/pipeline.ts', 'a record older than the stored copy is refused as timestamp_regression'], [PIPELINE_TEST, 'the regression check'], ['app/src/lib/integration/reconcile.ts', 'compares a version or etag when the provider gives one'], ['app/server/institution/gateway.ts', 'commit re-checks the record version']],
    gap: 'No If-Match or ETag on writes.',
  },
  {
    id: 'P07', step: 'Retry transient failures with exponential backoff and jitter.', status: 'tested',
    evidence: [['app/src/lib/integration/retry.ts', 'backoffMs with full jitter; five attempts, two-second base, fifteen-minute cap'], [PIPELINE_TEST, 'the backoff schedule']],
    gap: 'None.',
  },
  {
    id: 'P08', step: 'Respect 429 and Retry-After.', status: 'building',
    evidence: [['app/src/lib/integration/retry.ts', 'afterFailure takes the longer of the backoff and a Retry-After'], [PIPELINE_TEST, 'Retry-After wins when longer'], [WORKER, 'calls afterFailure without a Retry-After']],
    gap: 'Nothing parses the header from a provider response; the worker never passes one.',
  },
  {
    id: 'P09', step: 'Put permanent failures in an operator-visible dead-letter queue.', status: 'tested',
    evidence: [[CONTROL_PLANE, '`integration_dead_letter_events`'], [WORKER, 'inserts a dead letter after the last attempt'], ['app/server/integration/tick.ts', 'runs operator-requested replays and holds a connection with an open dead letter'], ['app/server/integration/tick.test.ts', 'a held connection is not synced']],
    gap: 'None.',
  },
  {
    id: 'P10', step: 'Reconcile source-of-truth state on a schedule.', status: 'building',
    evidence: [['app/src/lib/integration/reconcile.ts', 'reconcilePlan and reconcile, with discrepancies typed'], ['supabase/migrations/20260928040000_integration_quality.sql', '`integration_reconciliation_runs` and `_discrepancies`'], ['docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md', 'the reconciliation rule']],
    gap: 'No scheduler or caller invokes it; the tick does not.',
  },
  {
    id: 'P11', step: 'Show a customer-visible health dashboard: last success, lag, failed records, retry state, repair actions.', status: 'tested',
    evidence: [['app/src/components/institutional/IntegrationDashboard.tsx', 'last successful sync, freshness, open errors, sync history with retry counts, dead letters, conflicts, pause and replay'], ['app/src/components/institutional/IntegrationDashboard.test.tsx', 'every domain with status and health; pausing needs a reason'], [RUNBOOK, 'watch, pause, resume, replay']],
    gap: 'No numeric lag metric and no per-record repair; freshness stands in for lag.',
  },
]);

/** The adaptive client behaviours, each at what the tree has. */
export const CLIENT: readonly Step[] = steps([
  { id: 'C01', step: 'Read rate-limit headers on every API call.', status: 'not-started', evidence: [[ROADMAP, 'rate-limit handling is an open item']], gap: 'No code reads an X-Rate-Limit-*, RateLimit-* or Retry-After header, including the Canvas token proxy.' },
  { id: 'C02', step: 'Track quota by tenant, credential, endpoint family and worker.', status: 'building', evidence: [['app/src/lib/integration/retry.ts', 'a RateLimiter token bucket keyed by tenant and connection']], gap: 'Defined and unused; nothing calls it.' },
  { id: 'C03', step: 'Bounded concurrency rather than a fixed global parallelism.', status: 'designed', evidence: [['docs/operating-model/AI-ASSURANCE.md', 'MR-28: rate limits and concurrency caps are tested for the gateway’s own callers, not for outbound calls'], ['app/src/lib/governance/ai-assurance.ts', 'records that there is no concurrency cap']], gap: 'No concurrency control on any outbound call.' },
  { id: 'C04', step: 'Retry only transient failures: 429, 408, selected 5xx, network errors.', status: 'tested', evidence: [['app/src/lib/integration/retry.ts', 'the retry policy'], [PIPELINE_TEST, 'retries stop at the cap']], gap: 'The worker classifies every failure as provider_unavailable; it does not distinguish a 4xx it should not retry.' },
  { id: 'C05', step: 'Idempotency keys for writes, or a local write ledger.', status: 'building', evidence: [['app/server/institution/journal.ts', 'the gateway action journal'], ['packages/institution/src/events.ts', 'outbox idempotency keys'], ['supabase/functions/_shared/escalation.ts', 'a delivery id per outbound webhook']], gap: 'None of it covers an LMS write; the AGS score post has no key and no ledger.' },
  { id: 'C06', step: 'Pause or circuit-break on sustained failures.', status: 'designed', evidence: [['docs/STRATEGIC-EXPANSION-REGISTER.md', 'VND-009: circuit breakers, named as a mitigation and not built'], ['app/src/lib/governance/rollout.ts', 'the breaker named as a mitigation']], gap: 'Manual pause and the kill switches only.' },
  { id: 'C07', step: 'Durable queues and a dead-letter queue.', status: 'tested', evidence: [[CONTROL_PLANE, '`integration_dead_letter_events`'], [WORKER_TEST, 'the last attempt dead-letters']], gap: 'No inbound queue, as P04.' },
  { id: 'C08', step: 'Scheduled reconciliation.', status: 'building', evidence: [['app/src/lib/integration/reconcile.ts', 'built and typed']], gap: 'Never scheduled, as P10.' },
  { id: 'C09', step: 'Sync lag, failed records, retry state and repair actions in the Operations Console.', status: 'building', evidence: [['app/src/lib/integration/dashboard.ts', 'the school-staff dashboard model'], ['app/src/lib/ops/console.ts', 'the console’s integration control is approvals only']], gap: 'The staff dashboard has it; the operations console has no health view.' },
]);

/** The grade write, preview to audit, at what the tree has for the AGS score post. */
export const GRADE_WRITE: readonly Step[] = steps([
  { id: 'W01', step: 'Preview: what will be written, where, under whose authority.', status: 'designed', evidence: [['docs/LTI-1.3-LAUNCH-RUNBOOK.md', 'the passback section: the score is sent when a quiz ends'], ['app/server/institution/gateway.ts', 'the prepare → commit pattern exists for institutional actions, not for AGS']], gap: 'The Drill screen posts the score as the quiz ends; nothing is previewed.' },
  { id: 'W02', step: 'Human or institution confirmation.', status: 'tested', evidence: [['supabase/migrations/20260927180000_lti_integration_binding.sql', '`lti_passback_decision`: kill switches, the writeback flag, an approved write connection and the score_publish scope'], ['app/src/lib/ltigate.test.ts', 'every refusal reason of the gate'], ['supabase/lti-integration.check.sql', 'the gate walked in SQL']], gap: 'Institutional, once, per connection; no per-write confirmation.' },
  { id: 'W03', step: 'Idempotent delivery.', status: 'not-started', evidence: [['docs/LTI-1.3-LAUNCH-RUNBOOK.md', 'one POST, no retry']], gap: 'No idempotency key, no write ledger, no retry.' },
  { id: 'W04', step: 'Destination acknowledgment.', status: 'building', evidence: [['app/src/lib/ltiscore.ts', 'the synchronous reply and the line the Drill screen shows']], gap: 'A synchronous `reported: true` only; nothing durable.' },
  { id: 'W05', step: 'Reconciliation against released results.', status: 'not-started', evidence: [['docs/LTI-1.3-LAUNCH-RUNBOOK.md', 'results are never read back']], gap: '`SCOPE.result` is defined and never requested.' },
  { id: 'W06', step: 'An exception queue for failed writes.', status: 'not-started', evidence: [['docs/LTI-1.3-LAUNCH-RUNBOOK.md', 'the gaps section: refusals are logged, not persisted']], gap: 'Refusals go to the function log only.' },
  { id: 'W07', step: 'An immutable audit event.', status: 'building', evidence: [['packages/institution/src/policy.ts', 'the action grade.passback.submit with audit event grade.passback_requested'], ['packages/institution/src/events.ts', 'grade.passback_requested and grade.passback_reconciled in EVENT_TYPES']], gap: 'Declared; no producer emits either event.' },
]);

type Row = Omit<Step, 'evidence'> & { evidence: readonly [path: string, shows: string][] };
function steps(rows: readonly Row[]): readonly Step[] {
  return rows.map((r) => ({ ...r, evidence: r.evidence.map(([path, shows]) => ({ path, shows })) }));
}

export const ALL_STEPS: readonly Step[] = [...PROCESSOR, ...CLIENT, ...GRADE_WRITE];

/**
 * Found while reading the tree on 28 September and fixed since: the LTI
 * runbook said the nonce was spent after `checkLaunch`, and the function
 * spends the state first; the pipeline audit said no worker existed, and
 * `app/server/integration/worker.ts` does; and the function's own comment
 * above the spend said the check removes the guard and watches a replay go
 * through, where it asserts a sequential single use. The test holds all three
 * to the corrected wording, so the list stays empty until something new is
 * found.
 */
export const FOUND: readonly string[] = [];
