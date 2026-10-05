// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RECORD_FACTS, RECORD_KINDS } from '../lib/record-kinds';
import { RecordLabel } from './RecordLabel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const terms = () => [...host.querySelectorAll('dt')].map((t) => t.textContent);
const value = (term: string) => {
  const dt = [...host.querySelectorAll('dt')].find((t) => t.textContent === term)!;
  return dt.nextElementSibling!.textContent;
};

describe('the record label', () => {
  it('shows the same seven rows, in the same order, for every kind', () => {
    for (const kind of RECORD_KINDS) {
      act(() => root.render(<RecordLabel kind={kind} />));
      expect(terms(), kind).toEqual([
        'Record type', 'Authority', 'Source', 'Last verified', 'Semester can', 'Semester cannot', 'Official next step',
      ]);
      expect(value('Record type'), kind).toBe(RECORD_FACTS[kind].type);
      expect(value('Authority'), kind).toBe(RECORD_FACTS[kind].authority);
      expect(value('Official next step'), kind).toBe(RECORD_FACTS[kind].next);
    }
  });

  it('says in words when the owner has never verified it', () => {
    act(() => root.render(<RecordLabel kind="degree_audit" />));
    expect(value('Last verified')).toBe('Not verified by the record’s owner');
  });

  it('shows the date the owner last confirmed it, when there is one', () => {
    act(() => root.render(<RecordLabel kind="transcript" verifiedAt={new Date(2026, 8, 14, 12).getTime()} now={new Date(2026, 8, 20, 12).getTime()} />));
    expect(value('Last verified')).toBe('Sep 14, 2026');
  });

  it('uses the source badge, and lets a screen name a better source than the default', () => {
    act(() => root.render(<RecordLabel kind="plan" />));
    expect(host.querySelector('[data-source="student_entered"]')).not.toBeNull();
    act(() => root.render(<RecordLabel kind="plan" source="imported" />));
    expect(host.querySelector('[data-source="imported"]')).not.toBeNull();
  });

  it('is named for a screen reader, by the kind of record it is about', () => {
    act(() => root.render(<RecordLabel kind="degree_audit" />));
    expect(host.querySelector('dl')!.getAttribute('aria-label')).toBe('About this record: Degree audit');
  });

  it('is a description list, so a reader hears each term with its value', () => {
    act(() => root.render(<RecordLabel kind="plan" />));
    expect(host.querySelectorAll('dl > div > dt')).toHaveLength(7);
    expect(host.querySelectorAll('dl > div > dd')).toHaveLength(7);
  });
});
