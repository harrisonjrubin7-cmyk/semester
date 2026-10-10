// Generated from app/../packages/platform/src/engines/canvas-read-adapter.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

/** Read-only, hosted-Canvas course-context adapter. */
import { ProviderHttpError, retryAfterMs } from './provider-error.ts';
import { systemClock, type Clock } from './clock.ts';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const COURSES_PATH = '/api/v1/courses';

interface PullRequest {
  connectionPublicId: string;
  tenantId: string;
  providerBaseUrl?: string;
  cursor: Record<string, unknown>;
  trigger: 'scheduled' | 'replay';
}

interface ProviderClient {
  call<T>(fn: (auth: { accessToken: string | null; secret: string | null }) => Promise<T>): Promise<T>;
}

interface CourseRecord { entityType: 'course'; id: string; fields: Record<string, unknown> }
interface CanvasBatch {
  idempotencyKey: string;
  eventType: string;
  eventVersion: string;
  trigger: 'scheduled' | 'replay';
  cursorBefore: Record<string, unknown>;
  cursorAfter: Record<string, unknown>;
  records: readonly CourseRecord[];
}

export const CANVAS_READ_DECLARATION = {
  id: 'canvas_lms_read', domain: 'lms', provider: 'Canvas', product: 'Canvas LMS', version: '1',
  authentication: 'api_key',
  // A live runtime never leases this sentinel; it requires the approved connection pointer.
  credentialsReference: 'vault:connections/canvas-lms-read',
  scopes: ['scope.lms.course_context_read'], classificationCeiling: 'T0', direction: 'read',
  modes: ['incremental_api'], cursor: 'page_token', freshnessTargetMinutes: 24 * 60,
  rateLimitPerMinute: 60, retry: { maxAttempts: 5, baseMs: 2_000, maxMs: 900_000 },
  deadLetter: 'table', sourceOfTruth: 'Canvas LMS', consentRequired: false, retentionDays: 400,
  degradedStates: ['provider_unavailable', 'rate_limited', 'stale'], disconnect: 'revoke_token',
  auditEvents: ['connection.approved', 'scope.approved', 'sync.paused', 'sync.resumed', 'replay.requested'],
  featureFlag: 'integration.lms_lti', killSwitch: 'kill.integration_sync',
  contractTests: ['app/server/integration/canvas-read-adapter.test.ts'], mock: false,
  entities: [{
    externalEntity: 'course', canonicalEntity: 'lms_context', version: 1,
    scope: 'scope.lms.course_context_read', classification: 'T0', personal: false,
    fields: [
      { external: 'id', canonical: 'external_id', type: 'string', required: true },
      { external: 'name', canonical: 'title', type: 'string', required: true, transform: 'trim' },
      { external: 'course_code', canonical: 'code', type: 'string', required: false, transform: 'trim' },
    ],
  }],
} as const;

export function canvasOrigin(value: string | undefined): string {
  let url: URL;
  try { url = new URL(value ?? ''); } catch { throw new Error('Canvas provider origin is not configured.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+instructure\.com$/.test(host) ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Canvas provider origin is not an approved hosted Instructure origin.');
  }
  return url.origin;
}

function tenantCredential(reference: string | null | undefined, tenantId: string): boolean {
  const match = /^(vault|env|secret-manager):([A-Za-z0-9_./-]{1,200})$/.exec(reference ?? '');
  return Boolean(match?.[2].startsWith(`tenants/${tenantId}/`));
}

function pageUrl(base: string, cursor: Record<string, unknown>): URL {
  const origin = canvasOrigin(base);
  if (typeof cursor.next === 'string') {
    const next = new URL(cursor.next);
    if (next.origin !== origin || next.pathname !== COURSES_PATH || next.username || next.password || next.hash) {
      throw new Error('Canvas pagination left the approved provider origin.');
    }
    if ([...next.searchParams.keys()].some((key) => /(token|secret|password|api[_-]?key)/i.test(key))) {
      throw new Error('Canvas pagination contained a credential-shaped parameter.');
    }
    return next;
  }
  const first = new URL(COURSES_PATH, origin);
  first.searchParams.set('enrollment_state', 'active');
  first.searchParams.set('per_page', '100');
  return first;
}

function nextPage(link: string | null, origin: string): string | null {
  if (!link) return null;
  for (const part of link.split(/,\s*(?=<)/)) {
    const match = /^<([^>]+)>\s*;\s*rel="([^"]+)"$/.exec(part.trim());
    if (match?.[2] === 'next') return pageUrl(origin, { next: match[1] }).toString();
  }
  return null;
}

async function boundedText(response: Response): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error('Canvas response exceeded the size limit.');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('Canvas response exceeded the size limit.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function courseRecords(value: unknown): CourseRecord[] {
  if (!Array.isArray(value)) throw new Error('Canvas returned a non-list course page.');
  return value.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : '';
    return { entityType: 'course', id, fields: {
      id: typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : row.id,
      name: row.name,
      ...(row.course_code === undefined || row.course_code === null ? {} : { course_code: row.course_code }),
    } };
  });
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createCanvasReadAdapter(fetcher: typeof fetch = fetch, clock: Clock = systemClock) {
  return {
    declaration: CANVAS_READ_DECLARATION,
    validateConnection(configuration: { tenantId: string; providerBaseUrl?: string; credentialReference?: string | null }) {
      try {
        canvasOrigin(configuration.providerBaseUrl);
        return tenantCredential(configuration.credentialReference, configuration.tenantId)
          ? null : 'Canvas credential reference is not in this tenant namespace.';
      } catch (error) {
        return error instanceof Error ? error.message : 'Canvas provider origin is invalid.';
      }
    },
    async pull(request: PullRequest, client: ProviderClient): Promise<CanvasBatch> {
      const origin = canvasOrigin(request.providerBaseUrl);
      const url = pageUrl(origin, request.cursor);
      const response = await client.call(async (auth) => {
        if (!auth.secret) throw new Error('Canvas credential is not configured.');
        return fetcher(url, { method: 'GET', redirect: 'error', headers: {
          accept: 'application/json', authorization: `Bearer ${auth.secret}`,
        } });
      });
      if (!response.ok) throw new ProviderHttpError(response.status, retryAfterMs(response.headers.get('retry-after'), clock.now()));
      if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        throw new Error('Canvas returned a non-JSON course page.');
      }
      const text = await boundedText(response);
      const records = courseRecords(JSON.parse(text));
      const next = nextPage(response.headers.get('link'), origin);
      return {
        idempotencyKey: `canvas-courses-${await sha256Base64Url(`${url.toString()}\n${text}`)}`,
        eventType: 'course.published', eventVersion: '1', trigger: request.trigger,
        cursorBefore: request.cursor, cursorAfter: next ? { next } : {}, records,
      };
    },
  };
}

export const CANVAS_READ_ADAPTER = createCanvasReadAdapter();
