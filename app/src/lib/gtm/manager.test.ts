import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canMove } from './campaign';
import { NEXT, campaignApi, campaignsAllowed, failureText } from './manager';

const sql = readFileSync(resolve(__dirname, '../../../../supabase/migrations/20260928090000_gtm_foundation.sql'), 'utf8');

describe('the release checklist, in words', () => {
  it('has a sentence for every code gtm_activation_failures can return', () => {
    const fn = sql.slice(sql.indexOf('function public.gtm_activation_failures'), sql.indexOf('revoke all on function public.gtm_activation_failures'));
    const codes = [...fn.matchAll(/out := out \|\| '([a-z_]+)'(?:::text)?;/g)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(10); // the probe found them
    for (const c of [...codes, 'not_found']) {
      expect(failureText(c), c).not.toBe(c);
      expect(failureText(c).length, c).toBeGreaterThan(20);
    }
    expect(failureText('status:draft')).toMatch(/draft/);
    expect(failureText('review:accessibility,brand')).toMatch(/accessibility, brand review/);
    expect(failureText('something_new')).toBe('something_new'); // the control: an unknown code is shown, not hidden
  });
});

describe('who sees the Campaigns tab', () => {
  it('is anyone holding a campaign capability at the school, and nobody else', () => {
    for (const c of ['campaign:manage', 'campaign:review', 'campaign:report']) expect(campaignsAllowed([c]), c).toBe(true);
    expect(campaignsAllowed([])).toBe(false);
    expect(campaignsAllowed(['integration:view', 'tenant:configure', 'sponsor:review'])).toBe(false);
    expect(campaignsAllowed(['campaign:anything-else'])).toBe(false);
  });
});

describe('the moves the screen offers', () => {
  it('are canMove plus activation, and nothing else', () => {
    expect(NEXT.approved).toContain('active');
    expect(NEXT.draft).not.toContain('active');
    expect(NEXT.retired).toEqual([]);
    for (const [from, tos] of Object.entries(NEXT)) {
      for (const to of tos) expect(canMove(from as never, to) || (from === 'approved' && to === 'active'), `${from}→${to}`).toBe(true);
    }
  });
});

describe('the campaign client', () => {
  function db(result: { data: unknown; error: { message: string } | null }) {
    const chain: Record<string, unknown> = {};
    for (const m of ['from', 'update', 'eq', 'select', 'insert', 'order', 'single']) chain[m] = () => chain;
    chain.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
    chain.rpc = () => Promise.resolve(result);
    return chain as never;
  }

  it('reads a move that matched no row as a refusal, not a success', async () => {
    await expect(campaignApi(db({ data: [], error: null })).move('c1', 'active')).rejects.toThrow(/cannot move/);
  });

  it('turns the trigger’s refusal into its own sentence', async () => {
    const api = campaignApi(db({ data: null, error: { message: 'This campaign cannot activate: flag, approver' } }));
    await expect(api.move('c1', 'active')).rejects.toThrow('Cannot activate yet: flag, approver');
  });

  it('says a permission refusal plainly', async () => {
    const api = campaignApi(db({ data: null, error: { message: 'new row violates row-level security policy for table "gtm_campaigns"' } }));
    await expect(api.save('c1', { name: 'x' })).rejects.toThrow('Your account cannot do that at this school.');
  });
});
