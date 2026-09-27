// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SOURCE_LABELS, SOURCE_MEANING, SOURCE_TEXT } from '../lib/source';
import { SourceBadge } from './SourceBadge';

/**
 * The badge says its source in words — to the eye and to a screen reader —
 * and offers a way to report it only when the screen can take the report.
 */

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

it('says every label in text, with its meaning for assistive technology', () => {
  for (const label of SOURCE_LABELS) {
    act(() => root.render(<SourceBadge label={label} />));
    expect(host.textContent, label).toContain(SOURCE_TEXT[label]);
    const hidden = host.querySelector('.sr-only');
    expect(hidden?.textContent, label).toBe(SOURCE_MEANING[label]);
    expect(host.querySelector(`[data-source="${label}"]`), label).not.toBeNull();
  }
});

it('shows freshness only when the time is known', () => {
  const now = Date.UTC(2026, 8, 27, 12);
  act(() => root.render(<SourceBadge label="imported" at={now - 2 * 3_600_000} now={now} />));
  expect(host.textContent).toContain('Updated 2 hours ago');
  act(() => root.render(<SourceBadge label="imported" now={now} />));
  expect(host.textContent).not.toContain('Updated');
});

it('offers a report control only when the screen can take the report', () => {
  act(() => root.render(<SourceBadge label="estimated" />));
  expect(host.querySelector('button')).toBeNull();

  const onReport = vi.fn();
  act(() => root.render(<SourceBadge label="estimated" onReport={onReport} />));
  const button = host.querySelector('button');
  expect(button?.textContent).toBe('Report incorrect information');
  act(() => button?.click());
  expect(onReport).toHaveBeenCalledOnce();
});
