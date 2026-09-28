import type { SupabaseClient } from '@supabase/supabase-js';
import { PostgresRateLimiter } from './rate-limit.ts';
import { PostgresScimRepository } from './postgres-scim.ts';
import { createScimService, type ScimRateLimiter } from './scim.ts';
import type { InstitutionEnvironment } from './runtime.ts';

/**
 * Where SCIM is mounted on the institution gateway, and whether it is.
 *
 * Off unless `SEMESTER_SCIM=on`. Off, a request under `/scim/v2` goes to the
 * gateway like any other path and gets its 404: the endpoint's existence is
 * not advertised by a distinct answer. On, it needs `SEMESTER_SCIM_PUBLIC_URL`
 * — the address the identity provider is given, which is also what every
 * `meta.location` says — and refuses to start without one rather than
 * inventing it from a request's Host header.
 *
 * The SCIM service matches requests against a fixed base, so a request is
 * re-addressed onto `SCIM_INTERNAL_BASE` before it is handed over. That keeps
 * the service's origin check meaningful whichever host the gateway is served
 * from (`api/institution/[...path].ts` rewrites to one; `start.ts` to another).
 */
export const SCIM_PATH = '/scim/v2';
export const SCIM_INTERNAL_BASE = 'http://scim.internal/scim/v2';

type Handler = (request: Request) => Promise<Response>;

export function scimEnabled(env: InstitutionEnvironment): boolean {
  return env.SEMESTER_SCIM === 'on';
}

export function isScimPath(pathname: string): boolean {
  return pathname === SCIM_PATH || pathname.startsWith(`${SCIM_PATH}/`);
}

/** Requests under `/scim/v2` to `scim` when there is one; everything else to `gateway`. */
export function withScim(gateway: Handler, scim: Handler | null): Handler {
  if (!scim) return gateway;
  return async (request) => {
    const url = new URL(request.url);
    if (!isScimPath(url.pathname)) return gateway(request);
    const internal = new URL(`${SCIM_INTERNAL_BASE}${url.pathname.slice(SCIM_PATH.length)}${url.search}`);
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    return scim(new Request(internal, { method: request.method, headers: request.headers, body }));
  };
}

/** One SCIM bucket per credential, on the gateway's shared Postgres limiter. */
export function scimRateLimiter(limiter: Pick<PostgresRateLimiter, 'allow'>): ScimRateLimiter {
  return {
    allow: async (tenantId, credentialId) =>
      limiter.allow({ institutionId: tenantId, userId: `scim:${credentialId}` }, Date.now()),
  };
}

export function createProductionScim(
  env: InstitutionEnvironment,
  connection: { url: string; serviceKey: string; client?: SupabaseClient },
): Handler | null {
  if (!scimEnabled(env)) return null;
  const publicBaseUrl = (env.SEMESTER_SCIM_PUBLIC_URL || '').trim();
  if (!publicBaseUrl) {
    throw new Error('SEMESTER_SCIM=on requires SEMESTER_SCIM_PUBLIC_URL, the HTTPS address identity providers are given.');
  }
  return createScimService({
    baseUrl: SCIM_INTERNAL_BASE,
    repository: new PostgresScimRepository({ ...connection, publicBaseUrl }),
    rateLimiter: scimRateLimiter(new PostgresRateLimiter(connection)),
  });
}
