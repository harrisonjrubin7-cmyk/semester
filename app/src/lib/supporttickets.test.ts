import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_LABELS, CONTEXT_KEYS, CONTEXT_LABELS, availableContext, contextToSend, firstResponseHours, screenShape, supportNoticeFailure, supportNoticeResult, ticketReference, toTicket } from './supporttickets';

/**
 * The client half of support tickets, held to the migration it calls. The
 * database enforces every rule (`supabase/support-tickets.check.sql`); what
 * can drift here is vocabulary, and each list is read out of the SQL.
 */

const root = join(import.meta.dirname, '../../..');
const migration = readFileSync(join(root, 'supabase/migrations/20260928210000_support_tickets.sql'), 'utf8');
const client = readFileSync(join(import.meta.dirname, 'supporttickets.ts'), 'utf8');
const quoted = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe('support tickets, client and migration', () => {
  it('reads each list out of the SQL — the control for the comparisons below', () => {
    const cats = /category\s+text\s+not null check \(category in \(([\s\S]*?)\)\)/.exec(migration)?.[1] ?? '';
    const keys = /e\.key not in \(([^)]*)\)/.exec(migration)?.[1] ?? '';
    expect(quoted(cats)).toContain('accessibility');
    expect(quoted(keys)).toContain('sync_state');
    expect(quoted(keys)).not.toContain('accessibility');
  });

  it('offers exactly the categories the database accepts, each with words', () => {
    const cats = /category\s+text\s+not null check \(category in \(([\s\S]*?)\)\)/.exec(migration)![1];
    expect([...CATEGORIES].sort()).toEqual(quoted(cats).sort());
    for (const c of CATEGORIES) expect(CATEGORY_LABELS[c].length).toBeGreaterThan(0);
  });

  it('offers exactly the six context keys the database accepts', () => {
    const keys = /e\.key not in \(([^)]*)\)/.exec(migration)![1];
    expect([...CONTEXT_KEYS].sort()).toEqual(quoted(keys).sort());
    for (const k of CONTEXT_KEYS) expect(CONTEXT_LABELS[k].length).toBeGreaterThan(0);
  });

  it('promises the first-response hours the database computes', () => {
    const fn = /support_first_response_hours[\s\S]*?case want_category ([\s\S]*?) end/.exec(migration)![1];
    const specific = new Map([...fn.matchAll(/when '([a-z_]+)' then (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    const otherwise = Number(/else (\d+)/.exec(fn)![1]);
    for (const c of CATEGORIES) expect(firstResponseHours(c), c).toBe(specific.get(c) ?? otherwise);
  });

  it('never reads or writes a support table directly', () => {
    expect(client).not.toMatch(/\.from\('/);
  });

  it('keeps metadata and sensitive case reads on separate ticket-bound RPCs', () => {
    expect(client).toMatch(/rpc\('support_case_access', \{ want_ticket: ticketId \}\)/);
    expect(client).toMatch(/rpc\('read_support_case_signals', \{ want_ticket: ticketId \}\)/);
  });

  it('targets the exact outbox row returned by the reply RPC', () => {
    expect(client).toMatch(/const messageId = result\.message_id/);
    expect(client).toMatch(/body:\s*\{\s*message_id:\s*messageId\s*\}/);
    expect(client).not.toMatch(/body:\s*\{\s*ticket_id:\s*ticketId\s*\}/);
  });

  it('does not call a vanished or consent-cancelled notice queued', () => {
    expect(supportNoticeFailure({ context: { status: 409 } })).toBe('cancelled');
    expect(supportNoticeFailure({ context: { status: 503 } })).toBe('queued');
    expect(supportNoticeFailure(new Error('network unavailable'))).toBe('queued');
  });

  it('keeps an already-claimed notice distinct from cancellation', () => {
    expect(supportNoticeResult({ outcome: 'in_progress' }, null)).toBe('in_progress');
    expect(supportNoticeResult({ outcome: 'queued' }, null)).toBe('queued');
    expect(supportNoticeResult({ outcome: 'accepted' }, null)).toBe('accepted');
  });
});

describe('what goes with a ticket', () => {
  const all = { app_version: '2026.9.27', device_class: 'phone', screen: '#/drill', signed_in: 'yes', sync_state: 'synced', offline: 'no' };

  it('sends nothing the student did not tick', () => {
    expect(contextToSend(all, new Set())).toEqual({});
    expect(contextToSend(all, new Set(['screen', 'offline'] as const))).toEqual({ screen: '#/drill', offline: 'no' });
  });

  it('drops a ticked key with nothing in it rather than sending it empty', () => {
    expect(contextToSend({ app_version: '  ' }, new Set(['app_version'] as const))).toEqual({});
  });

  it('keeps a screen to its name, so no id or query rides along', () => {
    expect(screenShape('#/work/abc123?course=econ')).toBe('#/work');
    expect(screenShape('#/Drill')).toBe('#/drill');
    expect(screenShape('https://evil.example/#/work')).toBe('');
  });

  it('reads an unknown status or category conservatively', () => {
    const t = toTicket({ id: '1', category: 'grades', subject: 's', status: 'mystery', priority: 'urgent', created_at: 'x', first_response_due: 'y' });
    expect(t).toMatchObject({ category: 'other', status: 'open', priority: 'normal', firstRespondedAt: null });
  });

  it('makes a stable support reference without exposing anything about the student', () => {
    expect(ticketReference('123e4567-e89b-12d3-a456-426614174000')).toBe('SUP-123E-4567-E89B-12D3');
    expect(ticketReference('123e4567-ffff-12d3-a456-426614174000')).not.toBe(
      ticketReference('123e4567-e89b-12d3-a456-426614174000'),
    );
    expect(ticketReference('')).toBe('SUP-UNKNOWN');
  });

  it('offers only app facts, and shapes each one before the student sees it', () => {
    const got = availableContext({ build: 'abc123', width: 390, hash: '#/work/9f?c=1', signedIn: true, sync: 'synced', online: false });
    expect(got).toEqual({ app_version: 'abc123', device_class: 'phone', screen: '#/work', signed_in: 'yes', sync_state: 'synced', offline: 'yes' });
    expect(Object.keys(got).sort()).toEqual([...CONTEXT_KEYS].sort());
    expect(availableContext({ build: '', width: 1400, hash: '', signedIn: false, sync: '', online: true }))
      .toMatchObject({ app_version: 'dev', device_class: 'desktop', screen: 'unknown', offline: 'no' });
  });
});
