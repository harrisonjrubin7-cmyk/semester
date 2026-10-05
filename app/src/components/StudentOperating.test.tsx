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
  stored = { ...DEFAULT_PERSISTED, ...initialEphemeral(), operatingWorkspace: JSON.stringify({ ...emptyOperating(), entries: [1,2,3,4].map(n => ({ ...emptyEntry('plan'), title: `Outcome ${n}` })) }) };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<StudentOperating />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
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
    expect(readOperating(stored.operatingWorkspace).entries).toHaveLength(4);
    act(() => button('Confirm deletion').click());
    expect(stored.operatingWorkspace).toBeNull();
    expect(host.querySelectorAll('article')).toHaveLength(0);
  });
  it('makes human handoff a reviewed draft with no send capability', () => {
    act(() => button('Review blind spots and context').click());
    act(() => button('Prepare human handoff / follow-up draft').click());
    expect(host.textContent).toContain('Recipient: Not selected');
    expect(button('Export reviewed draft')).toBeDefined();
    expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Send')).toBe(false);
  });
});
