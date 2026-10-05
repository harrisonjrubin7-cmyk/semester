// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { StoreProvider, useStore } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import type { MailDraft } from '../lib/mailbox';
import { Mail } from './Mail';

/**
 * The fifty-first conversation, on a phone.
 *
 * The mailbox shows fifty conversations a page at every width, and the only
 * way to the next fifty was a pair of arrows drawn in the wide toolbar. On a
 * phone the list was sliced and nothing moved the slice, so everything past
 * the first page of a folder could be found by searching for it and not by
 * looking — a capability the width took away, which is the one thing a
 * narrow layout is not allowed to do.
 *
 * Drafts rather than a connected account, because they are the one kind of
 * mail the app owns: sixty of them fill the Drafts folder with no network.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const DRAFTS: MailDraft[] = Array.from({ length: 60 }, (_, i) => ({
  id: `d${i}`,
  to: '',
  cc: '',
  bcc: '',
  subject: `Draft number ${i}`,
  body: '',
  courseId: '',
  purposeId: '',
  updated: 1_700_000_000_000 + i * 60_000,
  handed: null,
}));

/** The folder is not persisted, so the test opens it the way the rail does. */
function InDrafts() {
  const { dispatch } = useStore();
  useEffect(() => dispatch({ type: 'mailFolder', folder: 'drafts' }), [dispatch]);
  return <Mail />;
}

function narrow(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    // Every width query answers `wide`; nothing else in this screen asks.
    matches: wide && query.includes('min-width'),
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

const button = (label: string) =>
  host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, mailDrafts: DRAFTS }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

async function show() {
  await act(async () => {
    root.render(
      <StoreProvider>
        <InDrafts />
      </StoreProvider>,
    );
  });
}

describe('paging the mailbox', () => {
  it('reaches the second page on a phone', async () => {
    narrow(false);
    await show();
    expect(host.textContent).toContain('1–50 of 60');
    const older = button('Older');
    expect(older, 'no way to the next page on a phone').not.toBeNull();
    await act(async () => older!.click());
    expect(host.textContent).toContain('51–60 of 60');
    expect(button('Newer')!.disabled).toBe(false);
  });

  it('draws the same pager once on a wide window, not twice', async () => {
    narrow(true);
    await show();
    expect(host.querySelectorAll('button[aria-label="Older"]')).toHaveLength(1);
  });

  it('draws no paging row on a phone when there is one page', async () => {
    narrow(false);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 6, mailDrafts: DRAFTS.slice(0, 10) }),
    );
    await show();
    expect(button('Older')).toBeNull();
  });
});
