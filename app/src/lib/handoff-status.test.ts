import { describe as suite, expect, it } from 'vitest';
import {
  EXPIRY_DAYS,
  HANDOFF_STATUSES,
  MAX_HISTORY,
  STALE_DAYS,
  WORDS,
  describe,
  expired,
  fromHelpRequest,
  isStatus,
  readHandoff,
  report,
  stale,
  startHandoff,
} from './handoff-status';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 8, 1, 12);

suite('the handoff vocabulary', () => {
  it('has seven statuses and words for every one, in the student’s voice', () => {
    expect(HANDOFF_STATUSES).toHaveLength(7);
    for (const s of HANDOFF_STATUSES) {
      expect(WORDS[s].label.length, s).toBeGreaterThan(0);
      expect(WORDS[s].meaning, s).toMatch(/\b(I|me|my|they|the office|it)\b/i);
      expect(WORDS[s].next, s).not.toMatch(/wait for semester|semester will/i);
    }
  });

  it('never tells the student to wait on Semester, or claims to know the outcome', () => {
    for (const s of HANDOFF_STATUSES) {
      const d = describe({ ...startHandoff('registration', T0), status: s }, T0)!;
      expect(d.line).toMatch(/You marked this/);
      expect(d.line).toMatch(/cannot see the official system/);
      expect(d.line + d.next).not.toMatch(/\bwent through\b|\bwas approved\b|\byou are registered\b/i);
    }
  });

  it('reads a status only from the closed list', () => {
    expect(isStatus('submitted')).toBe(true);
    expect(isStatus('approved')).toBe(false);
    expect(isStatus(3)).toBe(false);
  });
});

suite('reporting a status', () => {
  it('starts at not started, with one event', () => {
    const h = startHandoff('registration', T0);
    expect(h.status).toBe('not_started');
    expect(h.history).toEqual([{ status: 'not_started', at: T0 }]);
  });

  it('records a change and when, and leaves the same status alone', () => {
    const h = report(startHandoff('registration', T0), 'submitted', T0 + DAY);
    expect(h.status).toBe('submitted');
    expect(h.updatedAt).toBe(T0 + DAY);
    expect(h.history.map((e) => e.status)).toEqual(['not_started', 'submitted']);
    expect(report(h, 'submitted', T0 + 2 * DAY)).toBe(h);
  });

  it('lets any status follow any other, because the student is reporting what they see', () => {
    let h = startHandoff('registration', T0);
    for (const s of ['completed', 'need_more_information', 'submitted', 'contact_office'] as const) h = report(h, s, h.updatedAt + 1);
    expect(h.status).toBe('contact_office');
  });

  it('caps the history so it cannot grow without end', () => {
    let h = startHandoff('registration', T0);
    for (let i = 0; i < 100; i++) h = report(h, i % 2 ? 'submitted' : 'received', T0 + i + 1);
    expect(h.history).toHaveLength(MAX_HISTORY);
    expect(h.history.at(-1)!.at).toBe(T0 + 100);
  });
});

suite('when a handoff stops being news', () => {
  const open = report(startHandoff('registration', T0), 'submitted', T0);

  it('is fresh for a week, then asks whether it moved', () => {
    expect(stale(open, T0 + (STALE_DAYS - 1) * DAY)).toBe(false);
    expect(stale(open, T0 + (STALE_DAYS + 1) * DAY)).toBe(true);
    expect(describe(open, T0 + (STALE_DAYS + 1) * DAY)!.next).toMatch(/Has it moved\?/);
  });

  it('does not ask about a finished handoff, or one not started', () => {
    expect(stale(report(open, 'completed', T0), T0 + 30 * DAY)).toBe(false);
    expect(stale(startHandoff('registration', T0), T0 + 30 * DAY)).toBe(false);
  });

  it('expires, and an expired handoff is not shown at all', () => {
    expect(expired(open, T0 + (EXPIRY_DAYS - 1) * DAY)).toBe(false);
    expect(expired(open, T0 + (EXPIRY_DAYS + 1) * DAY)).toBe(true);
    expect(describe(open, T0 + (EXPIRY_DAYS + 1) * DAY)).toBeNull();
    expect(stale(open, T0 + (EXPIRY_DAYS + 1) * DAY)).toBe(false);
  });

  it('says how long ago in words a student says', () => {
    expect(describe(open, T0)!.line).toMatch(/today\./);
    expect(describe(open, T0 + DAY)!.line).toMatch(/yesterday\./);
    expect(describe(open, T0 + 3 * DAY)!.line).toMatch(/3 days ago\./);
  });
});

suite('the help-request mapping', () => {
  it('puts every status help_requests has onto the vocabulary', () => {
    expect(['sent', 'acknowledged', 'scheduled', 'closed', 'withdrawn'].map(fromHelpRequest)).toEqual([
      'submitted', 'received', 'scheduled', 'completed', 'not_started',
    ]);
  });
  it('refuses a status it does not know rather than guessing', () => {
    expect(fromHelpRequest('approved')).toBeNull();
    expect(fromHelpRequest('')).toBeNull();
  });
});

suite('reading a stored handoff', () => {
  const good = report(startHandoff('registration', T0), 'submitted', T0 + 1);

  it('round-trips a handoff', () => {
    expect(readHandoff(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });

  it('is null, not an error, for anything that is not exactly a handoff', () => {
    for (const bad of [
      null, 'x', 3, [], {},
      { ...good, status: 'approved' },
      { ...good, destination: 'financial_aid' },
      { ...good, updatedAt: 'yesterday' },
      { ...good, updatedAt: -1 },
      { ...good, history: [] },
      { ...good, history: [{ status: 'nope', at: T0 }] },
      { ...good, history: [{ status: 'submitted', at: NaN }] },
    ]) expect(readHandoff(bad), JSON.stringify(bad)).toBeNull();
  });

  it('keeps nothing but the four fields, so free text cannot ride along', () => {
    const got = readHandoff({ ...good, reason: 'I owe the bursar', notes: 'call Dana' } as unknown);
    expect(Object.keys(got!).sort()).toEqual(['destination', 'history', 'status', 'updatedAt']);
    const withText = readHandoff({ ...good, history: [{ status: 'submitted', at: T0, note: 'my hold is for a fine' }] } as unknown);
    expect(Object.keys(withText!.history[0]).sort()).toEqual(['at', 'status']);
  });

  it('caps a stored history that is too long', () => {
    const long = { ...good, history: Array.from({ length: 50 }, (_, i) => ({ status: 'submitted', at: T0 + i + 1 })) };
    expect(readHandoff(long)!.history).toHaveLength(MAX_HISTORY);
  });
});
