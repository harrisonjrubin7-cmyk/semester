import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./cloud', () => ({ cloud: () => Promise.resolve({ rpc: mock.rpc }) }));

it('declares the closed seven-field guardian calendar projection contract', async () => {
  const client = await import('./guardianprojection').catch(() => ({}));

  expect(client).toHaveProperty('GUARDIAN_CALENDAR_FIELDS', [
    'student_id',
    'item_id',
    'title',
    'starts_at',
    'status',
    'source_observed_at',
    'expires_at',
  ]);
});

const row = (over: Record<string, unknown> = {}) => ({
  student_id: 'student-1',
  item_id: 'calendar-1',
  title: 'Family conference',
  starts_at: '2026-10-12T15:00:00.000Z',
  status: 'scheduled',
  source_observed_at: '2026-10-10T10:00:00.000Z',
  expires_at: '2026-10-11T10:00:00.000Z',
  secret_note: 'must never cross the boundary',
  ...over,
});

beforeEach(() => {
  mock.rpc.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('guardian projection reader', () => {
  it('has no durable, offline, search, backup or analytics persistence path', () => {
    const sources = [
      readFileSync(new URL('./guardianprojection.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../components/GuardianProjection.tsx', import.meta.url), 'utf8'),
    ].join('\n');
    expect(sources).not.toMatch(/localStorage|sessionStorage|indexedDB|openDB|offline|vault|backup|searchIndex|analytics/i);
  });

  it('calls only the consent-bound reader for an already-known subject and returns exactly seven fields', async () => {
    const { readGuardianCalendarProjection } = await import('./guardianprojection');
    mock.rpc.mockResolvedValue({ data: [row()], error: null });

    const result = await readGuardianCalendarProjection('student-1');

    expect(mock.rpc).toHaveBeenCalledWith('read_guardian_calendar_projection', {
      wanted_student: 'student-1',
      wanted_purpose: 'guardian_portal',
    });
    expect(result.kind).toBe('ready');
    expect(Object.keys(result.items[0])).toEqual([
      'student_id', 'item_id', 'title', 'starts_at', 'status', 'source_observed_at', 'expires_at',
    ]);
    expect(JSON.stringify(result)).not.toContain('secret_note');
  });

  it.each([
    ['another subject', row({ student_id: 'student-2' })],
    ['unknown status', row({ status: 'hidden' })],
    ['missing expiry', row({ expires_at: null })],
    ['future source observation', row({ source_observed_at: '2027-01-01T00:00:00Z' })],
  ])('fails closed on %s', async (_name, unsafe) => {
    const { readGuardianCalendarProjection } = await import('./guardianprojection');
    mock.rpc.mockResolvedValue({ data: [unsafe], error: null });
    await expect(readGuardianCalendarProjection('student-1'))
      .resolves.toMatchObject({ kind: 'denied', items: [] });
  });

  it('treats empty authority and expired rows as non-content states', async () => {
    const { readGuardianCalendarProjection } = await import('./guardianprojection');
    mock.rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(readGuardianCalendarProjection('student-1'))
      .resolves.toEqual({ kind: 'denied', items: [] });

    mock.rpc.mockResolvedValueOnce({ data: [row({ expires_at: '2026-10-10T11:59:59Z' })], error: null });
    await expect(readGuardianCalendarProjection('student-1'))
      .resolves.toEqual({ kind: 'stale', items: [] });
  });

  it('validates freshness when the response arrives, so expiry in transit never renders', async () => {
    const { readGuardianCalendarProjection } = await import('./guardianprojection');
    let answer!: (value: unknown) => void;
    mock.rpc.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const reading = readGuardianCalendarProjection('student-1');

    vi.setSystemTime(new Date('2026-10-11T10:00:01Z'));
    answer({ data: [row()], error: null });

    await expect(reading).resolves.toEqual({ kind: 'stale', items: [] });
  });

  it('does not retry a read error because every retry is a new audited decision', async () => {
    const { readGuardianCalendarProjection } = await import('./guardianprojection');
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'network down', code: '503' } });
    await expect(readGuardianCalendarProjection('student-1')).rejects.toMatchObject({ message: 'network down' });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
});

describe('student access history', () => {
  it('uses the subject-scoped RPC with no lookup argument and caps content-free records at 200', async () => {
    const { readGuardianProjectionAccessHistory } = await import('./guardianprojection');
    mock.rpc.mockResolvedValue({
      data: Array.from({ length: 205 }, (_, i) => ({
        guardian_id: `guardian-${i}`,
        purpose: 'guardian_portal',
        decision: i % 2 ? 'deny' : 'allow',
        reason: i % 2 ? 'authority_missing_or_stale' : 'allowed',
        fields_returned: i % 2 ? [] : ['title', 'starts_at'],
        projection_count: i % 2 ? 0 : 1,
        read_at: `2026-10-10T10:${String(i % 60).padStart(2, '0')}:00Z`,
        title: 'must not appear',
      })),
      error: null,
    });

    const history = await readGuardianProjectionAccessHistory();

    expect(mock.rpc).toHaveBeenCalledWith('read_guardian_projection_access_history');
    expect(history).toHaveLength(200);
    expect(Object.keys(history[0])).toEqual([
      'guardian_id', 'purpose', 'decision', 'reason', 'fields_returned', 'projection_count', 'read_at',
    ]);
    expect(JSON.stringify(history)).not.toContain('must not appear');
  });

  it('drops the entire history response if it contains another shape', async () => {
    const { readGuardianProjectionAccessHistory } = await import('./guardianprojection');
    mock.rpc.mockResolvedValue({ data: [{ guardian_id: 'g', decision: 'allow', projection_count: -1 }], error: null });
    await expect(readGuardianProjectionAccessHistory()).resolves.toEqual([]);
  });

  it('rejects a contradictory allow/deny record rather than inventing a safe meaning', async () => {
    const { readGuardianProjectionAccessHistory } = await import('./guardianprojection');
    mock.rpc.mockResolvedValue({ data: [{
      guardian_id: 'g', purpose: 'guardian_portal', decision: 'allow',
      reason: 'authority_missing_or_stale', fields_returned: [], projection_count: 0,
      read_at: '2026-10-10T10:00:00Z',
    }], error: null });
    await expect(readGuardianProjectionAccessHistory()).resolves.toEqual([]);
  });
});
