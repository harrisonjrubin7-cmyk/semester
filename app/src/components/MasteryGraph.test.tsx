// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { MasteryGraph } from './MasteryGraph';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('MasteryGraph', () => {
  let host: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    if (root) act(() => root!.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it('renders state, evidence count and next review as text, not only a visual meter', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root.render(
        <MasteryGraph
          concepts={[
            {
              id: 'elasticity',
              name: 'Elasticity',
              state: 'needs-review',
              confidence: 0.58,
              evidence: [{ kind: 'retrieval', label: '2 correct, 1 missed' }],
              nextReview: 'Sep 24',
            },
          ]}
        />,
      ),
    );
    expect(host.textContent).toContain('Needs review');
    expect(host.textContent).toContain('1 evidence record');
    expect(host.textContent).toContain('Next review Sep 24');
    expect(host.querySelector('[aria-label="Concept mastery evidence"]')).toBeTruthy();
    expect(host.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Elasticity: 58 percent evidence confidence',
    );
  });
});
