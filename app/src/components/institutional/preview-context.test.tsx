// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstitutionalPreviewBar } from '../InstitutionalPreviewBar';
import { InstitutionalPreviewProvider, useInstitutionalPreview } from './PreviewContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function ContextReading() {
  const { institution, person } = useInstitutionalPreview();
  return <output aria-label="Active institutional context">{institution.id}|{person.id}</output>;
}

describe('institutional preview context', () => {
  it('moves the bar and every consumer to the selected institution and its first persona', async () => {
    await act(async () => {
      root.render(
        <InstitutionalPreviewProvider>
          <InstitutionalPreviewBar />
          <ContextReading />
        </InstitutionalPreviewProvider>,
      );
    });

    expect(host.querySelector('output')?.textContent).toBe('northstar|northstar-student');

    const institution = host.querySelectorAll<HTMLSelectElement>('select')[0];
    await act(async () => {
      institution.value = 'cedar-coast';
      institution.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(host.querySelector('output')?.textContent).toBe('cedar-coast|cedar-coast-student');
  });

  it('fails clearly when a preview consumer is mounted outside the provider', () => {
    expect(() => {
      act(() => root.render(<ContextReading />));
    }).toThrow('Institutional preview context is unavailable');
  });
});
