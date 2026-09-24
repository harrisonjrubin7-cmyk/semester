// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrityModePicker } from './ModePicker';

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
    const draft = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Draft');
    const hint = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Hint');
    expect(draft?.getAttribute('aria-disabled')).toBe('true');
    expect(hint?.getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).toContain('Course policy');
  });

  it('reports a permitted mode change', () => {
    const change = vi.fn();
    act(() =>
      root.render(
        <IntegrityModePicker requested="explain" policy={{ allowed: ['explain', 'practice'] }} onChange={change} />,
      ),
    );
    const practice = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Practice');
    act(() => practice?.click());
    expect(change).toHaveBeenCalledWith('practice');
  });
});
