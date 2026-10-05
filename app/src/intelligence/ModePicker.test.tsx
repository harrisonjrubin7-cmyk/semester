// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrityModePicker, MODE_HELP } from './ModePicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('IntegrityModePicker', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const radio = (value: string) =>
    host.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`);

  it('does not allow a restricted mode to remain effective', () => {
    const change = vi.fn();
    act(() =>
      root.render(
        <IntegrityModePicker
          requested="draft"
          policy={{ allowed: ['hint'], reason: 'Course policy' }}
          onChange={change}
        />,
      ),
    );
    expect(radio('draft')?.disabled).toBe(true);
    expect(radio('draft')?.checked).toBe(false);
    expect(radio('hint')?.checked).toBe(true);
    expect(host.textContent).toContain('Course policy');
  });

  it('reports a permitted mode change', () => {
    const change = vi.fn();
    act(() =>
      root.render(
        <IntegrityModePicker requested="explain" policy={{ allowed: ['explain', 'practice'] }} onChange={change} />,
      ),
    );
    act(() => radio('practice')?.click());
    expect(change).toHaveBeenCalledWith('practice');
  });

  /*
   * One choice, named, with its meaning on screen.
   *
   * The old picker was five `aria-pressed` buttons in a group — five switches
   * to a screen reader, and a one-word name each. This holds the three things
   * that replaced it: a fieldset whose legend asks the question, radios that
   * share one name so the arrow keys move between them, and the chosen mode's
   * description tied to the group by `aria-describedby`.
   */
  it('is one labelled radio group that says what the chosen mode does', () => {
    act(() =>
      root.render(
        <IntegrityModePicker requested="draft" policy={{ allowed: ['explain', 'draft'] }} onChange={() => {}} />,
      ),
    );
    const group = host.querySelector('fieldset');
    expect(group?.querySelector('legend')?.textContent).toBe('How it helps');
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios).toHaveLength(5);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(host.querySelectorAll('[aria-pressed]')).toHaveLength(0);
    const help = document.getElementById(group?.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toBe(MODE_HELP.draft.help);
    expect(help?.textContent).toMatch(/never writes or sends/);
  });
});
