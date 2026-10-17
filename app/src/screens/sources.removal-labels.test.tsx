// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Sources } from './Sources';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SHARED_PREFIX = 'Rivera, Amara. (2026). Institutional memory and equitable student support';

let host: HTMLDivElement;
let root: Root;
let seen: State;

function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = state;
  });
  return null;
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    sources: [
      {
        id: 'source-advising',
        raw: `${SHARED_PREFIX}: advising practice. https://example.edu/advising`,
        author: 'Rivera, Amara',
        year: '2026',
        title: 'Institutional memory and equitable student support',
        container: '',
        url: 'https://example.edu/advising',
        role: 'Evidence for the advising section',
        courseId: null,
        project: 'Student support paper',
        created: 1,
      },
      {
        id: 'source-financial-aid',
        raw: `${SHARED_PREFIX}: financial-aid practice. https://example.edu/aid`,
        author: 'Rivera, Amara',
        year: '2026',
        title: 'Institutional memory and equitable student support',
        container: '',
        url: 'https://example.edu/aid',
        role: 'Evidence for the financial-aid section',
        courseId: null,
        project: 'Student support paper',
        created: 2,
      },
    ],
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        <Sources />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('identifies source removals by the complete student-entered citation', async () => {
  const removals = [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove source: "]')];

  expect(removals.map((button) => button.ariaLabel).sort()).toEqual([
    `Remove source: ${SHARED_PREFIX}: advising practice. https://example.edu/advising`,
    `Remove source: ${SHARED_PREFIX}: financial-aid practice. https://example.edu/aid`,
  ].sort());
  expect(new Set(removals.map((button) => button.ariaLabel)).size).toBe(2);

  const advising = removals.find((button) => button.ariaLabel?.includes('advising practice'));
  await act(async () => advising?.click());

  expect(seen.sources.map((source) => source.id)).toEqual(['source-financial-aid']);
  expect(seen.undone?.label).toBe('Source removed');
});
