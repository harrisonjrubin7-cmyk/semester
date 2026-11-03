// @vitest-environment jsdom
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { explainAccess } from '../lib/access-details';
import { AccessDetailsPanel } from './AccessDetails';

const course = { kind: 'course', id: 'bio-101' };

describe('AccessDetailsPanel', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const render = (node: ReactElement) => act(() => root.render(node));

  it('shows the grant that opens the place, and the limits, in a closed disclosure', () => {
    render(<AccessDetailsPanel details={explainAccess([{ capability: 'grades:enter', scopeKind: 'course', scopeId: 'bio-101' }], 'grades:enter', course)} />);
    const details = host.querySelector('details.access-details') as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent).toBe('Access details');
    expect(details.textContent).toContain('You hold grades:enter for course bio-101.');
    expect(details.textContent).toContain('does not give you access');
  });

  it('says what is missing and who decides when the place is closed, without naming its contents', () => {
    render(<AccessDetailsPanel details={explainAccess([], 'grades:enter', course)} owner="the course owner" />);
    const text = host.textContent ?? '';
    expect(text).toContain('You do not hold grades:enter for this course.');
    expect(text).toContain('Ask the course owner for access.');
    expect(text).not.toContain('bio-101');
  });

  it('notes other places where the capability is held without opening this one', () => {
    render(<AccessDetailsPanel details={explainAccess([{ capability: 'grades:enter', scopeKind: 'course', scopeId: 'bio-9' }], 'grades:enter', course)} />);
    expect(host.textContent).toContain('You hold grades:enter at other places. Those do not open this one.');
    expect(host.textContent).toContain('You do not hold grades:enter for this course.');
  });
});
