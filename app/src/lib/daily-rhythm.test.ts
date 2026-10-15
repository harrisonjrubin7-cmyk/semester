// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { AUDIT, RHYTHM_KEY, exportDay, helpDraft, newDay, readRhythm, saveDay, validDay } from './daily-rhythm';
import { restoreWorkspaces, workspaceBackup } from './workspace-backup';

beforeEach(() => localStorage.clear());
describe('student-owned daily plans', () => {
  it('rejects impossible dates and duplicate days without normalizing them silently', () => {
    expect(validDay('2026-02-30')).toBe(false);
    expect(validDay('2026-10-01')).toBe(true);
    expect(() => newDay('2026-02-30')).toThrow();
    expect(() => readRhythm({ version: 1, days: [newDay('2026-10-01'), newDay('2026-10-01')] })).toThrow();
  });
  it('rejects oversized text, unsupported states and invalid audit states', () => {
    const day = newDay('2026-10-01');
    for (const patch of [{ first: 'a'.repeat(2001) }, { minutes: 999 }, { status: 'at risk' }, { paused: 'false' }, { audit: { ...day.audit, goal: 100 } }]) {
      expect(() => readRhythm({ version: 1, days: [{ ...day, ...patch }] })).toThrow();
    }
  });
  it('keeps chosen goals and repairs, and never derives a student score', () => {
    const day = { ...newDay('2026-10-01'), outcome: 'Make an outline', first: 'Write three headings', obstacle: 'Time changes', response: 'Write one heading', status: 'Waiting' as const };
    const saved = saveDay({ version: 1, days: [] }, day);
    expect(readRhythm(saved).days[0]).toEqual(day);
    expect(Object.keys(day.audit)).toEqual(Object.keys(AUDIT));
    expect(exportDay(day)).toContain('Write one heading');
    expect(exportDay(day)).toContain('Status: Waiting');
    expect(day).not.toHaveProperty('score');
  });
  it('does not silently discard an old plan at capacity', () => {
    const days = Array.from({ length: 120 }, (_, n) => newDay(new Date(Date.UTC(2026, 0, n + 1)).toISOString().slice(0, 10)));
    expect(() => saveDay({ version: 1, days }, newDay('2026-10-01'))).toThrow(/Export or delete/);
    expect(days).toHaveLength(120);
  });
  it('drafts a help request using only student-selected text', () => {
    const day = { ...newDay('2026-10-01'), outcome: 'ECON outline', question: 'the rubric', tried: 'reading the prompt' };
    expect(helpDraft(day, 'clarify')).toContain('reading the prompt');
    expect(helpDraft(day, 'policy')).toContain('wait for clarification');
  });
  it('backs up only the selected account and restores under the receiving account', () => {
    const day = { ...newDay('2026-10-01'), outcome: 'My chosen goal', moved: 'Private reflection' };
    localStorage.setItem(`${RHYTHM_KEY}:alice`, JSON.stringify({ version: 1, days: [day] }));
    localStorage.setItem(`${RHYTHM_KEY}:bob`, JSON.stringify({ version: 1, days: [{ ...day, outcome: 'Other account secret' }] }));
    const backup = workspaceBackup('alice', localStorage);
    expect(JSON.stringify(backup)).not.toContain('Other account secret');
    expect(JSON.stringify(backup)).toContain('Private reflection');
    restoreWorkspaces(backup, 'carol', localStorage);
    expect(readRhythm(JSON.parse(localStorage.getItem(`${RHYTHM_KEY}:carol`)!)).days[0]).toEqual(day);
  });
});
