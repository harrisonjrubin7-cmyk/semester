// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Drawing } from './Drawing';

const renders: Array<(value: { svg: string }) => void> = [];

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(
      () =>
        new Promise<{ svg: string }>((resolve) => {
          renders.push(resolve);
        }),
    ),
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  renders.length = 0;
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('a Mermaid drawing', () => {
  it('does not show the previous SVG while changed source is rendering', async () => {
    await act(async () => {
      root.render(<Drawing language="mermaid" code={'flowchart TD\nA --> B'} />);
    });
    await act(async () => {
      renders.shift()?.({ svg: '<svg><text>first</text></svg>' });
    });
    expect(host.textContent).toContain('first');

    await act(async () => {
      root.render(<Drawing language="mermaid" code={'flowchart TD\nA --> C'} />);
    });

    expect(host.querySelector('svg')).toBeNull();
    expect(host.textContent).toContain('Drawing…');
  });

  it('explains invalid Mermaid source without starting a render', async () => {
    await act(async () => {
      root.render(<Drawing language="mermaid" code="not a diagram" />);
    });

    expect(host.textContent).toContain('That did not come back as a diagram.');
    expect(renders).toHaveLength(0);
  });
});
