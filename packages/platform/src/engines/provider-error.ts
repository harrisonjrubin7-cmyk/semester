/** Provider response error shared by server and Edge integration runtimes. */
export class ProviderHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | undefined;
  constructor(status: number, retryAfterMs?: number) {
    super(`The provider answered ${status}`);
    this.name = 'ProviderHttpError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Parse Retry-After seconds or date, capped at one hour. */
export function retryAfterMs(header: string | null | undefined, now: Date): number | undefined {
  if (!header) return undefined;
  const value = header.trim();
  const ms = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now.getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, 3_600_000) : undefined;
}
