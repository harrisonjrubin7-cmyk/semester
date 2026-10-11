/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emptyUsage } from '../../../supabase/functions/_shared/aispend';
import {
  TOKEN_QUOTA_EXHAUSTED,
  TOKEN_QUOTA_MARK,
  UNLIMITED_WORDS,
  dailyTokenQuota,
  reserveTokens,
  tokenQuotaMessage,
  usageTokens,
} from '../../../supabase/functions/_shared/tokenquota';
import { TOKEN_QUOTA_MARK as CLIENT_MARK, explainAskError } from './claude';

/**
 * The daily token quota on the shared key, which ships with no quota.
 *
 * The one thing this file must never let drift is the default: the owner
 * asked for `TOKEN_QUOTA_DAILY` to exist and to mean *unlimited* until an
 * operator sets it. So the first tests are about what the function does with
 * nothing, the empty string a deploy writes, and the words an operator might
 * reach for to say "off" — every one of them must be no quota, and a number
 * must be exactly that number.
 */

const repo = join(process.cwd(), '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('dailyTokenQuota', () => {
  it('is no quota when nothing is set, which is the shipped default', () => {
    expect(dailyTokenQuota(undefined)).toBeNull();
  });

  it('is no quota for the empty string a deploy writes when the variable is not configured', () => {
    expect(dailyTokenQuota('')).toBeNull();
    expect(dailyTokenQuota('   ')).toBeNull();
  });

  it('treats 0 and the words for "off" as no quota, in any case', () => {
    for (const w of UNLIMITED_WORDS) {
      expect(dailyTokenQuota(w), w).toBeNull();
      expect(dailyTokenQuota(w.toUpperCase()), w.toUpperCase()).toBeNull();
      expect(dailyTokenQuota(` ${w} `), `padded ${w}`).toBeNull();
    }
  });

  it('is exactly the positive whole number it is given', () => {
    expect(dailyTokenQuota('250000')).toBe(250000);
    expect(dailyTokenQuota(' 1 ')).toBe(1);
    expect(dailyTokenQuota('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('falls back to no quota for anything that is not a positive whole number', () => {
    for (const bad of ['-1', '1.5', '1e6', '250_000', '250,000', 'sixty', 'NaN', 'Infinity', '9007199254740992']) {
      expect(dailyTokenQuota(bad), bad).toBeNull();
    }
  });
});

describe('the token meter', () => {
  const usage = (over: Partial<ReturnType<typeof emptyUsage>>) => ({ ...emptyUsage(), ...over });

  it('counts every token a call used, however it was billed', () => {
    expect(usageTokens(usage({ inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40, searches: 5 }))).toBe(100);
    expect(usageTokens(emptyUsage())).toBe(0);
  });

  it('reserves the counted input plus everything max_tokens allows out', () => {
    expect(reserveTokens(1200, 16000)).toBe(17200);
    expect(reserveTokens(0, 0)).toBe(0);
    // A negative count is a bug upstream, not a refund.
    expect(reserveTokens(-5, 10)).toBe(10);
  });

  it('never reserves less than an answer can use (property)', () => {
    let seed = 7;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % (n + 1);
    };
    for (let i = 0; i < 500; i++) {
      const input = rnd(50000);
      const max = rnd(16000);
      // What Anthropic reports: the input split however the cache fell, output within max_tokens.
      const cached = rnd(input);
      const written = rnd(input - cached);
      const u = usage({ inputTokens: input - cached - written, cacheReadTokens: cached, cacheWriteTokens: written, outputTokens: rnd(max) });
      expect(usageTokens(u)).toBeLessThanOrEqual(reserveTokens(input, max));
    }
  });
});

describe('the refusal', () => {
  it('carries the mark the client matches on, and a code', () => {
    const m = tokenQuotaMessage(250000);
    expect(m).toContain(TOKEN_QUOTA_MARK);
    expect(m).toContain('250,000');
    expect(m).toContain('midnight UTC');
    expect(TOKEN_QUOTA_EXHAUSTED).toBe('token_quota_exhausted');
  });

  it('is the same phrase in the browser, which cannot import the function', () => {
    expect(CLIENT_MARK).toBe(TOKEN_QUOTA_MARK);
  });

  it('is not told "wait a moment" by the app, because waiting a moment does not renew it', () => {
    const detail = tokenQuotaMessage(250000);
    expect(explainAskError('shared', 429, detail)).toBe(detail);
    // Control: a plain 429 without the mark still gets the rate-limit sentence.
    expect(explainAskError('shared', 429, 'Too many requests')).toContain('wait a moment');
  });
});

describe('the Edge Function', () => {
  const fn = read('supabase/functions/claude/index.ts');

  it('reads TOKEN_QUOTA_DAILY through dailyTokenQuota, so the default is the one tested above', () => {
    /*
     * A text probe, written out in full for the reason `allowance.test.ts`
     * gives: a regex that stops matching returns null, and a test that only
     * checked when it found something would pass silently for the rest of the
     * repository's life.
     */
    const line = fn.match(/const DAILY_TOKENS = dailyTokenQuota\(Deno\.env\.get\('TOKEN_QUOTA_DAILY'\)\)/);
    expect(line, 'could not find DAILY_TOKENS in the Edge Function — has it moved?').toBeTruthy();
  });

  it('writes nothing to the token meter while there is no quota', () => {
    // Every call to the meter is behind the null check; a bare call would charge every deployment's database for a quota nobody set.
    const calls = [...fn.matchAll(/add_tokens/g)].length;
    expect(calls).toBeGreaterThan(0);
    expect(fn).toContain('if (DAILY_TOKENS !== null) {');
    expect(fn).toContain('let tokensHeld = false;');
    // The reservation is the only call made with a cap, and it sits inside that guard.
    expect(fn).toMatch(/if \(DAILY_TOKENS !== null\) \{\s+const \{ data: have, error: tokenError \} = await tokens\(tokensReserved, DAILY_TOKENS\)/);
  });

  it('settles the day to what was used, and releases the reservation wherever the dollar one is released', () => {
    expect(fn).toContain('usageTokens(usage) - tokensReserved');
    expect(fn).toMatch(/if \(tokensHeld\)[\s\S]{0,200}-tokensReserved/);
  });
});
