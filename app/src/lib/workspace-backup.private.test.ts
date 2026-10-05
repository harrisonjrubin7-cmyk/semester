// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CALM_KEY, EMPTY_CALM, readCalm } from './calm-controls';
import { RESET_KEY, readResets, type ResetLibrary } from './weekly-reset';
import { restoreWorkspaces, workspaceBackup } from './workspace-backup';

/**
 * The two stores with something private in them, through the real backup.
 *
 * Weekly Reset keeps reflection answers and the Guide's settings keep what the
 * assistant remembers. Both are the student's to read and to clear, and the
 * backup is the file people email themselves, so: it carries the picks and the
 * settings, never the answers or the memory, and a restore neither erases what
 * the device holds nor invents what the file never had.
 */

class Store implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

const ANSWER = 'the thing I wrote that nobody else should read';
const NOTE = 'prefers the evenings';

const resets = (answer: string): ResetLibrary => ({
  version: 1,
  resets: [
    { weekStart: '2026-09-27', step: 5, picks: { academic: 'ECON set', practical: 'laundry', support: 'office hours' }, skipped: false, help: null },
  ],
  reflections: [
    { weekStart: '2026-09-27', kind: 'week', answers: { finished: answer, harder: '', change: '', evidence: '', carry: '' }, private: true, shared: true },
  ],
});
const calm = (note: string) => ({ ...EMPTY_CALM, minimalMode: true, memory: note ? [{ id: 'm1', text: note, at: 1 }] : [] });

describe('weekly resets in a backup', () => {
  it('carries the picks and none of the answers, and un-shares what it keeps', () => {
    const s = new Store();
    s.setItem(RESET_KEY, JSON.stringify(resets(ANSWER)));
    const file = JSON.stringify(workspaceBackup('device', s));
    expect(file).toContain('ECON set');
    expect(file).not.toContain(ANSWER);
    const rec = workspaceBackup('device', s).records.find((r) => r.kind === 'weeklyReset')!.value as ResetLibrary;
    expect(rec.reflections.every((r) => r.shared === false && Object.values(r.answers).every((a) => a === ''))).toBe(true);
  });

  it('restores the picks and leaves the answers already on the device untouched', () => {
    const from = new Store();
    from.setItem(RESET_KEY, JSON.stringify(resets(ANSWER)));
    const backup = workspaceBackup('device', from);

    const onto = new Store();
    onto.setItem(RESET_KEY, JSON.stringify(resets('different, and this device’s own')));
    restoreWorkspaces(backup, 'device', onto);
    const after = readResets(JSON.parse(onto.getItem(RESET_KEY) as string));
    expect(after.resets[0].picks.academic).toBe('ECON set');
    expect(after.reflections[0].answers.finished).toBe('different, and this device’s own');
  });

  it('puts no reflection onto a device that had none', () => {
    const from = new Store();
    from.setItem(RESET_KEY, JSON.stringify(resets(ANSWER)));
    const fresh = new Store();
    restoreWorkspaces(workspaceBackup('device', from), 'device', fresh);
    expect(readResets(JSON.parse(fresh.getItem(RESET_KEY) as string)).reflections).toEqual([]);
  });
});

describe('guide settings in a backup', () => {
  it('carries the settings and not what the assistant remembers', () => {
    const s = new Store();
    s.setItem(CALM_KEY, JSON.stringify(calm(NOTE)));
    const file = JSON.stringify(workspaceBackup('device', s));
    expect(file).toContain('minimalMode');
    expect(file).not.toContain(NOTE);
  });

  it('restores the settings and keeps this device’s own memory', () => {
    const from = new Store();
    from.setItem(CALM_KEY, JSON.stringify(calm(NOTE)));
    const onto = new Store();
    onto.setItem(CALM_KEY, JSON.stringify({ ...calm('already here on this device'), minimalMode: false }));
    restoreWorkspaces(workspaceBackup('device', from), 'device', onto);
    const after = readCalm(JSON.parse(onto.getItem(CALM_KEY) as string));
    expect(after.minimalMode).toBe(true);
    expect(after.memory.map((m) => m.text)).toEqual(['already here on this device']);
  });

  it('gives a fresh device no memory it was never told', () => {
    const from = new Store();
    from.setItem(CALM_KEY, JSON.stringify(calm(NOTE)));
    const fresh = new Store();
    restoreWorkspaces(workspaceBackup('device', from), 'device', fresh);
    expect(readCalm(JSON.parse(fresh.getItem(CALM_KEY) as string)).memory).toEqual([]);
  });
});
