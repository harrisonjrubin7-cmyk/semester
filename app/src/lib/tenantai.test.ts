import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MEMBERSHIP_UNREADABLE_MESSAGE,
  TENANT_MANAGED_MESSAGE,
  schoolOf,
  sharedKeyAudience,
  type ProfileReader,
} from '../../../supabase/functions/_shared/tenantai';

/**
 * The shared key is for individual accounts with no school. `claude/index.ts` said so in a comment
 * ("the shared key serves individual accounts with no school, so only the global row can stop it")
 * and nothing enforced it: an account that belonged to a school was served like any other, and the
 * school's AI decision was never read. These hold the decision, and then hold the function to asking
 * it before it spends anything. See `docs/decisions/proposed/0005-*.md` and risk RISK-008.
 */

const reader = (result: { data: unknown; error: unknown } | 'throws'): ProfileReader => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => {
          if (result === 'throws') throw new Error('network');
          return result;
        },
      }),
    }),
  }),
});

describe('who the shared key serves', () => {
  it('serves an account with no school', () => {
    expect(sharedKeyAudience({ school: null, failed: false })).toEqual({ serve: true });
  });

  it('does not serve an account that belongs to a school, whatever the school decided', () => {
    expect(sharedKeyAudience({ school: 'northstar', failed: false })).toEqual({ serve: false, reason: 'tenant-managed' });
  });

  it('does not serve anyone whose membership could not be read: unknown is not "no school"', () => {
    expect(sharedKeyAudience({ school: null, failed: true })).toEqual({ serve: false, reason: 'membership-unreadable' });
    // A failed read wins over whatever the lookup returned alongside it.
    expect(sharedKeyAudience({ school: 'northstar', failed: true })).toEqual({ serve: false, reason: 'membership-unreadable' });
  });

  it('says what happened without blaming anyone or promising a way round', () => {
    for (const m of [TENANT_MANAGED_MESSAGE, MEMBERSHIP_UNREADABLE_MESSAGE]) {
      expect(m.length).toBeGreaterThan(20);
      expect(m).not.toMatch(/own key|bypass|workaround/i);
    }
  });
});

describe('reading which school an account belongs to', () => {
  it('reads no school as no school', async () => {
    expect(await schoolOf(reader({ data: null, error: null }), 'u1')).toEqual({ school: null, failed: false });
    expect(await schoolOf(reader({ data: { school_id: null }, error: null }), 'u1')).toEqual({ school: null, failed: false });
  });

  it('reads a school', async () => {
    expect(await schoolOf(reader({ data: { school_id: 'northstar' }, error: null }), 'u1')).toEqual({ school: 'northstar', failed: false });
  });

  it('treats an error, a throw, and a shape it does not know as a failed read, never as no school', async () => {
    expect((await schoolOf(reader({ data: null, error: { message: 'boom' } }), 'u1')).failed).toBe(true);
    expect((await schoolOf(reader('throws'), 'u1')).failed).toBe(true);
    expect((await schoolOf(reader({ data: { school_id: 42 }, error: null }), 'u1')).failed).toBe(true);
    expect((await schoolOf(reader({ data: { school_id: '' }, error: null }), 'u1')).failed).toBe(true);
  });
});

describe('the shared-key function asks before it spends anything', () => {
  const source = readFileSync(new URL('../../../supabase/functions/claude/index.ts', import.meta.url), 'utf8');
  const at = (needle: string) => {
    const i = source.indexOf(needle);
    expect(i, `claude/index.ts does not contain ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it('reads the membership and asks the decision', () => {
    at('schoolOf(admin, userId)');
    at('sharedKeyAudience(');
  });

  it('refuses a school account with 403 and an unreadable membership with 503', () => {
    const decision = source.slice(at('sharedKeyAudience('), at('clampRequest('));
    expect(decision).toMatch(/TENANT_MANAGED_MESSAGE[\s\S]{0,200}403/);
    expect(decision).toMatch(/MEMBERSHIP_UNREADABLE_MESSAGE[\s\S]{0,200}503/);
  });

  it('asks before the plan is read, the body is clamped, a dollar is reserved or a call is counted', () => {
    const ask = at('sharedKeyAudience(');
    for (const later of ["from('billing_accounts')", 'clampRequest(', "rpc('add_spend'", "rpc('count_call'", 'fetch(ANTHROPIC']) {
      expect(ask, `the audience is asked after ${later}`).toBeLessThan(at(later));
    }
  });
});
