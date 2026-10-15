// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TRUST_GLYPH, TRUST_KINDS, TRUST_MEANING, TRUST_TEXT } from '../lib/source';
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
  for (const label of TRUST_KINDS) {
    act(() => root.render(<SourceBadge label={label} />));
    expect(host.textContent, label).toContain(TRUST_TEXT[label]);
    const hidden = host.querySelector('.sr-only');
    expect(hidden?.textContent, label).toBe(TRUST_MEANING[label]);
    expect(host.querySelector(`[data-source="${label}"]`), label).not.toBeNull();
  }
});

it('draws the glyph beside the word, hidden from a screen reader', () => {
  for (const label of TRUST_KINDS) {
    act(() => root.render(<SourceBadge label={label} />));
    const glyph = host.querySelector('[aria-hidden="true"]');
    expect(glyph?.textContent, label).toBe(TRUST_GLYPH[label]);
    expect(host.textContent, label).toContain(`${TRUST_GLYPH[label]}${TRUST_TEXT[label]}`);
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

it('says the time was not recorded only when asked, never "just now"', () => {
  const now = Date.UTC(2026, 8, 27, 12);
  act(() => root.render(<SourceBadge label="needs_review" now={now} />));
  expect(host.textContent).not.toContain('Update time not recorded');
  act(() => root.render(<SourceBadge label="needs_review" now={now} unknownAge />));
  expect(host.textContent).toContain('Update time not recorded');
  expect(host.textContent).not.toContain('just now');
  // A known time still wins over the note.
  act(() => root.render(<SourceBadge label="imported" at={now - 3_600_000} now={now} unknownAge />));
  expect(host.textContent).toContain('Updated 1 hour ago');
  expect(host.textContent).not.toContain('Update time not recorded');
});
