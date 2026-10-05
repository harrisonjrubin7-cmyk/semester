// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, expect, it } from 'vitest';
import { InstitutionalPackage } from './InstitutionalPackage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const host = document.createElement('div');
document.body.append(host);
const root = createRoot(host);

afterAll(() => {
  act(() => root.unmount());
  host.remove();
});

it('shows one package, the governed operating-layer outcome and every gated phase', () => {
  act(() => root.render(<InstitutionalPackage />));
  expect(host.textContent).toContain('Semester Institutional');
  expect(host.textContent).toContain('without replacing systems of record');
  expect(host.textContent).not.toContain('Replace the LMS and gradebook');
  expect(host.textContent).toContain('OneRoster remains planned, not included today');
  for (const phase of ['Agree', 'Pilot', 'Integrate', 'Run in parallel', 'Migrate', 'Cut over', 'Expand']) {
    expect(host.textContent).toContain(phase);
  }
  expect(host.textContent).toContain('simplifies buying, not governance');
});
