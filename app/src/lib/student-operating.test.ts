import { describe, expect, it } from 'vitest';
import { activeManual, defaultManual, emptyEntry, emptyOperating, exportOperating, operatingCsv, operatingIcs, readOperating, visibleEntries, critic } from './student-operating';
import { reducer } from '../state/reducer';
import { DEFAULT_PERSISTED, initialEphemeral, pickPersisted } from '../state/shape';
import { backupOf, readBackup } from './export';

describe('private student operating workspace', () => {
  it('rejects corrupt data and inappropriate states', () => {
    expect(readOperating('{bad')).toEqual(emptyOperating());
    expect(readOperating(JSON.stringify({ version: 1, entries: [{ ...emptyEntry('plan'), status: 'at-risk' }] })).entries).toEqual([]);
  });
  it('structure changes density without altering data or deadlines', () => {
    const entries = [1,2,3,4].map(n => ({ ...emptyEntry('plan'), title: String(n), deadline: '2026-10-08' }));
    expect(visibleEntries(entries,'low')).toHaveLength(1);
    expect(visibleEntries(entries,'medium')).toHaveLength(3);
    expect(visibleEntries(entries,'high')).toHaveLength(4);
    expect(entries.every(e => e.deadline === '2026-10-08')).toBe(true);
  });
  it('expires optional preferences without deleting private plans', () => {
    const manual = { ...defaultManual(), expires: '2026-10-01' };
    expect(activeManual(manual,'2026-10-01')).toEqual(manual);
    expect(activeManual(manual,'2026-10-02')).toBeNull();
  });
  it('exports only explicit objects and never energy, scores or invented consent', () => {
    const workspace = { ...emptyOperating(), entries: [{ ...emptyEntry('decision'), reflection: 'Partly' }] };
    const result = exportOperating(workspace);
    expect(result.student_preferences).toBeNull();
    expect(result.shared_objects).toEqual([]);
    expect(result.consent).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/mastery|grades|energy|risk_score/);
    expect(readOperating(JSON.stringify(workspace))).toEqual(workspace);
  });
  it('guards spreadsheet formula injection and multiline cells', () => {
    const text = operatingCsv({ ...emptyOperating(), entries: [{ ...emptyEntry('plan'), title: '=HYPERLINK("x")', context: 'a,\nb' }] });
    expect(text).toContain('"\'=HYPERLINK(""x"")"');
    expect(text).toContain('"a,\nb"');
  });
  it('calendar export excludes private context and escapes injected fields', () => {
    const ics = operatingIcs('Plan\nBEGIN:VALARM', '2026-10-08T10:00', 10);
    expect(ics).toContain('SUMMARY:Plan\\nBEGIN:VALARM');
    expect(ics).not.toContain('\r\nBEGIN:VALARM');
    expect(ics).toContain('CLASS:PRIVATE');
    expect(() => operatingIcs('Plan','2026-02-30T10:00',10)).toThrow();
  });
  it('critic uses explicit omissions and dependencies only', () => {
    const entry = { ...emptyEntry('waiting'), status: 'waiting' as const, obstacle: 'No reply' };
    const suggestions = critic(entry);
    expect(suggestions.some(x => x.message.includes('owner'))).toBe(true);
    expect(suggestions.some(x => x.message.includes('if–then'))).toBe(true);
    expect(suggestions.every(x => x.because.length > 0)).toBe(true);
  });
  it('persists, backs up, restores and deletes through the account store', () => {
    const raw = JSON.stringify({ ...emptyOperating(), manual: defaultManual() });
    const state = reducer({ ...DEFAULT_PERSISTED, ...initialEphemeral() }, { type: 'setOperatingWorkspace', value: raw });
    expect(pickPersisted(state).operatingWorkspace).toBe(raw);
    expect(readBackup(JSON.stringify(backupOf(state))).data.operatingWorkspace).toBe(raw);
    expect(reducer(state,{ type: 'setOperatingWorkspace', value: null }).operatingWorkspace).toBeNull();
    expect(reducer(state,{ type: 'wipeLocalForAdopt' }).operatingWorkspace).toBeNull();
  });
});
