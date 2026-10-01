// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Deadline } from '../lib/deadline-groups';
import { DeadlineHorizon } from './DeadlineHorizon';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 9, 1, 9, 0).getTime();
const H = 3_600_000;
const list: Deadline[] = [
  { id: 'a', title: 'Essay draft', due: NOW + 2 * H, label: 'institution_verified' },
  { id: 'b', title: 'Lab report', due: NOW + 30 * H, label: 'student_entered' },
  { id: 'c', title: 'Midterm', due: NOW + 4 * 24 * H, label: 'imported' },
  { id: 'd', title: 'Final paper', due: NOW + 30 * 24 * H, label: 'imported' },
  { id: 'e', title: 'Seminar response', due: null, label: 'needs_review' },
];
const html = () => renderToStaticMarkup(<DeadlineHorizon deadlines={list} now={NOW} />);
const section = (h: string, g: string) => new RegExp(`<details[^>]*data-group="${g}"([^>]*)>`).exec(h)!;

describe('DeadlineHorizon (static)', () => {
  it('draws five groups with only Today and Next 48 hours open', () => {
    const h = html();
    for (const t of ['Today', 'Next 48 hours', 'This week', 'Later this term', 'Needs confirmation']) expect(h).toContain(t);
    const open = (g: string) => /\bopen=""/.test(section(h, g)[0]);
    expect([open('today'), open('next48'), open('week'), open('later'), open('confirm')]).toEqual([true, true, false, false, false]);
  });

  it('shows title, status, source, confidence, action and the recovery options', () => {
    const h = html();
    for (const t of ['Essay draft', 'Due today', 'Institution verified', 'Plan time', 'Open official source', 'More options']) {
      expect(h).toContain(t);
    }
    for (const r of ['Reschedule', 'Break into steps', 'Contact course staff', 'Dismiss']) expect(h).toContain(r);
    expect(h).toContain('Needs review');
  });

  it('says so calmly when nothing is due', () => {
    expect(renderToStaticMarkup(<DeadlineHorizon deadlines={[]} now={NOW} />)).toContain('Nothing is due in this horizon.');
  });
});

describe('DeadlineHorizon (interaction)', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('calls onAction with the item and the option', async () => {
    const onAction = vi.fn();
    await act(async () => root.render(<DeadlineHorizon deadlines={list} now={NOW} onAction={onAction} />));
    const row = host.querySelector('[data-deadline="a"]')!;
    const btn = [...row.querySelectorAll('button')].find((b) => b.textContent === 'Reschedule')!;
    await act(async () => btn.click());
    expect(onAction).toHaveBeenCalledWith('a', 'Reschedule');
  });
});
