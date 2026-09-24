import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface RateLimitIdentity {
  institutionId: string;
  userId: string;
}

export interface RateLimiter {
  allow(identity: RateLimitIdentity, now: number): boolean | Promise<boolean>;
}

export interface RateLimitPolicy {
  windowMs: number;
  max: number;
}

export const DEFAULT_RATE_LIMIT = { windowMs: 60_000, max: 60 } as const;

/** Single-process fallback for local development and deterministic tests. */
export class MemoryRateLimiter implements RateLimiter {
  private limits = new Map<string, { until: number; count: number }>();
  private policy: RateLimitPolicy;

  constructor(policy: RateLimitPolicy = DEFAULT_RATE_LIMIT) {
    this.policy = policy;
  }

  allow(identity: RateLimitIdentity, now: number): boolean {
    for (const [id, limit] of this.limits) if (limit.until <= now) this.limits.delete(id);
    const key = `${identity.institutionId}:${identity.userId}`;
    const limit = this.limits.get(key) ?? { until: now + this.policy.windowMs, count: 0 };
    limit.count += 1;
    this.limits.set(key, limit);
    return limit.count <= this.policy.max;
  }
}

export interface PostgresRateLimiterOptions {
  client?: SupabaseClient;
  url?: string;
  serviceKey?: string;
  policy?: RateLimitPolicy;
}

/**
 * Shared, atomic rate limiting for horizontally scaled and serverless gateways.
 * The RPC stores only the tenant, actor and fixed-window counter; it never sees
 * tokens, request bodies or university records.
 */
export class PostgresRateLimiter implements RateLimiter {
  private client: SupabaseClient;
  private policy: RateLimitPolicy;

  constructor(options: PostgresRateLimiterOptions) {
    if (!options.client && (!options.url || !options.serviceKey)) {
      throw new Error('A server-only Supabase service client is required for shared rate limiting.');
    }
    this.policy = options.policy ?? DEFAULT_RATE_LIMIT;
    if (!Number.isInteger(this.policy.windowMs) || this.policy.windowMs < 1_000 || this.policy.windowMs > 3_600_000) {
      throw new Error('The rate-limit window must be an integer from 1 second through 1 hour.');
    }
    if (!Number.isInteger(this.policy.max) || this.policy.max < 1 || this.policy.max > 10_000) {
      throw new Error('The rate-limit maximum must be an integer from 1 through 10,000.');
    }
    this.client = options.client ?? createClient(options.url!, options.serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  async allow(identity: RateLimitIdentity, now: number): Promise<boolean> {
    const { data, error } = await this.client.rpc('gateway_take_rate_limit', {
      want_tenant: identity.institutionId,
      want_actor: identity.userId,
      want_now: new Date(now).toISOString(),
      want_window_seconds: this.policy.windowMs / 1_000,
      want_max: this.policy.max,
    }) as { data: boolean; error: unknown };
    // A failed limiter must fail closed. Returning false lets the gateway use
    // its ordinary 429 response without exposing infrastructure details.
    return !error && data === true;
  }
}
