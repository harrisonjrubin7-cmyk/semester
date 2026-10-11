/**
 * A daily token quota per account on the shared key — off unless set.
 *
 * The shared key already has two meters: sixty calls a month (`count_call`)
 * and a dollar allowance per plan (`add_spend`, `aispend.ts`). This is a
 * third, in *tokens per account per UTC day*, and it differs from the other
 * two in one way that matters: **its default is no quota at all.** The owner
 * asked for the setting to exist and to ship unlimited; an operator who later
 * wants a ceiling sets `TOKEN_QUOTA_DAILY` on the `claude` function and the
 * meter starts counting on the next request. Until then this module writes
 * nothing to the database, so the default path costs nothing.
 *
 * The meter follows the dollar meter's shape exactly: reserve the worst case
 * (counted input plus the whole `max_tokens`) before the call is forwarded,
 * settle to the usage Anthropic reports when the answer ends, and leave the
 * reservation standing when nothing can be read. `add_tokens` does the
 * arithmetic in one statement under the row lock, for the reason `add_spend`
 * and `count_call` do (`supabase/migrations/20261011210000_daily_token_quota.sql`).
 */

import type { Usage } from './aispend.ts';

/**
 * Read `TOKEN_QUOTA_DAILY`. `null` means *no quota*, and it is the answer for
 * everything but a positive whole number: unset, the empty string a deploy
 * writes when nothing is configured, `0`, and the words below. A value that is
 * not a number is also no quota rather than a guess — the default is
 * unlimited, so an unreadable setting falls back to the default, which is
 * what every other optional setting here does.
 */
export const UNLIMITED_WORDS: readonly string[] = ['0', 'unlimited', 'none', 'off', 'max'];

export function dailyTokenQuota(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.trim().toLowerCase();
  if (s === '' || UNLIMITED_WORDS.includes(s)) return null;
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Every token a finished call used, whichever way it was billed. */
export function usageTokens(u: Usage): number {
  return u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens;
}

/**
 * The most tokens a call can use: what was counted going in plus everything
 * `max_tokens` allows out. Thinking tokens count toward `max_tokens`, so the
 * ceiling covers them; `usageTokens(actual) <= reserveTokens(...)` for any
 * usage the request can produce, and `tokenquota.test.ts` holds that.
 */
export function reserveTokens(inputTokens: number, maxTokens: number): number {
  return Math.max(0, inputTokens) + Math.max(0, maxTokens);
}

/** `error.code` of a refusal because the day's token quota is spent. */
export const TOKEN_QUOTA_EXHAUSTED = 'token_quota_exhausted';

/**
 * Appears in the refusal so a client that only sees text can tell a spent
 * quota from rate limiting, which the app answers with "wait a moment". Same
 * device as `ALLOWANCE_MARK`; `app/src/lib/claude.ts` holds its copy.
 */
export const TOKEN_QUOTA_MARK = "today's shared AI token quota";

export function tokenQuotaMessage(cap: number): string {
  return (
    `You have used ${TOKEN_QUOTA_MARK} (${cap.toLocaleString('en-US')} tokens per account per UTC day). ` +
    `Add your own key under Ask Claude → Settings to carry on — it bypasses this limit — or it renews at midnight UTC.`
  );
}
