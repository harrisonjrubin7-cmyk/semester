// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IntelligenceResponse } from './contracts';
import { IntelligenceDisclosure } from './Disclosure';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const responseFixture = (): IntelligenceResponse => ({
  text: 'Start with elasticity.',
  evidence: [
    {
      id: 'e1',
      sourceId: 'syllabus',
      origin: 'course',
      title: 'Syllabus',
      locator: 'p. 4',
      excerpt: 'Elasticity is on the midterm.',
      verifiedAt: '2026-09-23T12:00:00.000Z',
      authority: 'authoritative',
      scope: { tenantId: 'northstar', role: 'student', personId: 'nora' },
    },
  ],
  informationUsed: ['Current course', 'Midterm date'],
  origins: ['course'],
  mode: 'hint',
  actions: [],
});

describe('IntelligenceDisclosure', () => {
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

  it('shows exact source locators, information used, origin and mode', () => {
    act(() => root.render(<IntelligenceDisclosure response={responseFixture()} />));
    expect(host.textContent).toContain('Syllabus · p. 4');
    expect(host.textContent).toContain('Course material');
    expect(host.textContent).toContain('Information Semester used');
    expect(host.textContent).toContain('Hint mode');
    expect(host.querySelector('details')?.hasAttribute('open')).toBe(false);
    expect(host.querySelector('summary')?.getAttribute('tabindex')).toBe('0');
  });

  it('renders citations as application-owned controls keyed by evidence id', () => {
    act(() => root.render(<IntelligenceDisclosure response={responseFixture()} />));
    expect(host.querySelector('[data-evidence-id="e1"]')).toBeInstanceOf(HTMLDetailsElement);
    expect(host.querySelector('[data-evidence-id="e1"]')?.textContent).toContain('Elasticity is on the midterm');
  });
});
