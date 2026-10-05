// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { SkillsGraph } from './SkillsGraph';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('SkillsGraph', () => {
  it('shows verification and linked evidence in text', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root.render(
        <SkillsGraph
          claims={[
            {
              id: 'skill-research',
              skill: 'Research',
              level: 'emerging',
              verification: 'suggested',
              freshness: 'current',
              evidence: [{ sourceId: 'econ-3010', sourceType: 'course', label: 'ECON 3010' }],
            },
          ]}
        />,
      ),
    );
    expect(host.textContent).toContain('Research');
    expect(host.textContent).toContain('Suggested');
    expect(host.textContent).toContain('ECON 3010');
    expect(host.querySelector('[data-source-id="econ-3010"]')).toBeTruthy();
  });
});
