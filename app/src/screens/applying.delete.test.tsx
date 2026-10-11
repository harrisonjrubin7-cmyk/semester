// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import type { Application } from '../lib/apply';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { Applying } from './Applying';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const application: Application = {
  id: 'application-1',
  org: 'Acme Analytics',
  role: 'Summer analyst',
  kind: 'internship',
  url: 'https://example.edu/opportunity',
  where: 'Nashville',
  due: '2026-10-20',
  rolling: false,
  stage: 'writing',
  next: 'Ask Priya for the referral',
  nextBy: '2026-10-12',
  note: 'Use the research project example.',
  created: Date.UTC(2026, 8, 1),
  moves: [{ stage: 'writing', at: Date.UTC(2026, 8, 2) }],
};

let host: HTMLDivElement;
let root: Root;

const press = async (label: string) => {
  const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.trim().startsWith(label));
  expect(button, `no button called ${label}; saw ${JSON.stringify([...host.querySelectorAll('button')].map((item) => item.textContent?.trim()))}`).toBeTruthy();
  await act(async () => button!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 9, 12));
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, applications: [application] }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<StoreProvider><Applying /></StoreProvider>));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

afterAll(() => vi.useRealTimers());

describe('application deletion', () => {
  it('previews the exact device-only loss and requires explicit confirmation', async () => {
    await press('Summer analyst at Acme Analytics');
    await press('Delete');

    const preview = host.querySelector('.action-preview')?.textContent ?? '';
    expect(preview).toContain('Summer analyst at Acme Analytics');
    expect(preview).toContain('application tracker record from this device');
    expect(preview).toContain('organisation, role, posting link, deadline, stage history, next action, dates, location, and private note');
    expect(preview).toContain('Other applications, downloaded exports, device workspace backups, and anything on the employer or careers site stay unchanged');
    expect(preview).toContain('This can’t be undone. Restore only from a device workspace backup or export created before deletion.');
    expect(host.textContent).toContain('Acme Analytics');

    await press('Cancel');
    expect(host.textContent).toContain('Acme Analytics');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).applications).toHaveLength(1);

    await press('Delete');
    await press('Delete application');
    expect(host.textContent).not.toContain('Acme Analytics');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).applications).toHaveLength(0);
  });
});
