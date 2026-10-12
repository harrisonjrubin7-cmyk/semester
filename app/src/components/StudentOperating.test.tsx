// @vitest-environment jsdom
import { act, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reducer } from '../state/reducer';
import { DEFAULT_PERSISTED, initialEphemeral } from '../state/shape';
import { emptyEntry, emptyOperating, readOperating } from '../lib/student-operating';
import { StudentOperating } from './StudentOperating';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let stored = { ...DEFAULT_PERSISTED, ...initialEphemeral() };
vi.mock('../state/store', () => ({
  useNow: () => new Date('2026-10-03T12:00:00Z'),
  useStore: () => { const [state, dispatch] = useReducer(reducer, stored); stored = state; return { state, dispatch }; },
}));
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  stored = { ...DEFAULT_PERSISTED, ...initialEphemeral(), operatingWorkspace: JSON.stringify({ ...emptyOperating(), manual: { style: 'daily', minutes: 10, format: 'checklist', stuck: 'smaller_step', notifications: 'none', quiet: false, noOpportunities: true, noAnalytics: true, noStudyBlocks: true, planningTime: '18:00', breaks: 'After 25 minutes', expires: '2026-12-15' }, entries: [1,2,3,4].map(n => ({ ...emptyEntry('plan'), title: `Outcome ${n}` })) }) };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<StudentOperating />));
});
afterEach(() => { act(() => { root.unmount(); }); host.remove(); });
const button = (name: string) => [...host.querySelectorAll('button')].find(b => b.textContent === name)!;
describe('student-owned operating workflow', () => {
  it('changes density without persisting the energy choice', () => {
    act(() => button('low').click());
    expect(host.querySelectorAll('article')).toHaveLength(1);
    act(() => button('medium').click());
    expect(host.querySelectorAll('article')).toHaveLength(3);
    expect(readOperating(stored.operatingWorkspace).entries).toHaveLength(4);
    expect(stored.operatingWorkspace).not.toContain('structure');
  });
  it('requires review before calendar export', () => {
    expect(button('Export confirmed ICS').disabled).toBe(true);
    expect(host.textContent).toContain('No source text or private notes included.');
  });
  it('keeps deletion concrete and clears all planning content after confirmation', () => {
    act(() => button('Delete this planning workspace').click());
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.textContent).toContain('Deletes all saved operating preferences and 4 workflow items from your private Semester workspace.');
    expect(dialog!.textContent).toContain('It also clears this screen’s unsaved editor, review and handoff draft.');
    expect(dialog!.textContent).toContain('When account sync is enabled, that deletion is saved to your account too.');
    expect(dialog!.textContent).toContain('Downloaded exports, calendar entries you imported separately and official records stay where they are.');
    expect(dialog!.textContent).toContain('This can’t be undone. Export a backup before deleting if you need a copy.');
    expect(readOperating(stored.operatingWorkspace).entries).toHaveLength(4);
    act(() => button('Cancel').click());
    expect(readOperating(stored.operatingWorkspace).entries).toHaveLength(4);
    act(() => button('Delete this planning workspace').click());
    act(() => button('Delete workspace').click());
    expect(stored.operatingWorkspace).toBeNull();
    expect(host.querySelectorAll('article')).toHaveLength(0);
  });
  it('previews one saved item before deleting it', () => {
    act(() => button('Delete this item').click());
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.textContent).toContain('Outcome 1');
    expect(dialog!.textContent).toContain('Deletes this saved workflow item from your private Semester workspace.');
    expect(dialog!.textContent).toContain('Other workflow items, saved preferences, downloaded exports and official records do not change.');
    expect(dialog!.textContent).toContain('A Semester data backup made before deletion can restore the earlier workspace.');
    expect(readOperating(stored.operatingWorkspace).entries).toHaveLength(4);
    act(() => button('Cancel').click());
    expect(readOperating(stored.operatingWorkspace).entries).toHaveLength(4);
    act(() => button('Delete this item').click());
    act(() => button('Delete item').click());
    expect(readOperating(stored.operatingWorkspace).entries.map((entry) => entry.title)).toEqual([
      'Outcome 2',
      'Outcome 3',
      'Outcome 4',
    ]);
  });
  it('previews saved preferences before deleting only the manual', () => {
    act(() => button('Delete preferences').click());
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.textContent).toContain('Deletes your saved planning style, starter minutes, representation, help, reminder, planning-time and break preferences.');
    expect(dialog!.textContent).toContain('Your 4 saved workflow items, downloaded exports and official records do not change.');
    expect(dialog!.textContent).toContain('A Semester data backup made before deletion can restore the earlier workspace.');
    expect(readOperating(stored.operatingWorkspace).manual?.planningTime).toBe('18:00');
    act(() => button('Cancel').click());
    expect(readOperating(stored.operatingWorkspace).manual?.planningTime).toBe('18:00');
    act(() => button('Delete preferences').click());
    act(() => { button('Delete saved preferences').click(); });
    expect(readOperating(stored.operatingWorkspace).manual).toBeNull();
    expect(readOperating(stored.operatingWorkspace).entries).toHaveLength(4);
  });
  it('makes human handoff a reviewed draft with no send capability', () => {
    act(() => button('Review blind spots and context').click());
    act(() => button('Prepare human handoff / follow-up draft').click());
    expect(host.textContent).toContain('Recipient: Not selected');
    expect(button('Export reviewed draft')).toBeDefined();
    expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Send')).toBe(false);
  });
});
