// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import type { MailDraft } from '../lib/mailbox';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Mail } from './Mail';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DRAFTS: MailDraft[] = [
  {
    id: 'draft-one',
    to: 'avery@example.edu',
    cc: '',
    bcc: '',
    subject: 'Office hours update',
    body: 'First draft.',
    courseId: '',
    purposeId: 'question',
    updated: new Date(2026, 9, 17, 9, 15).getTime(),
    handed: null,
  },
  {
    id: 'draft-two',
    to: 'blake@example.edu',
    cc: '',
    bcc: '',
    subject: 'Office hours update',
    body: 'Second draft.',
    courseId: '',
    purposeId: 'question',
    updated: new Date(2026, 9, 17, 9, 30).getTime(),
    handed: null,
  },
  {
    id: 'draft-three',
    to: 'casey@example.edu',
    cc: '',
    bcc: '',
    subject: 'Office hours update',
    body: 'Third draft.',
    courseId: '',
    purposeId: 'question',
    updated: new Date(2026, 9, 17, 9, 45).getTime(),
    handed: null,
  },
];

let host: HTMLDivElement;
let root: Root;

function InDrafts() {
  const { dispatch } = useStore();
  useEffect(() => dispatch({ type: 'mailFolder', folder: 'drafts' }), [dispatch]);
  return <Mail />;
}

function wide() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width'),
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

function buttonContaining(prefix: string, text: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => {
    const label = button.getAttribute('aria-label') ?? '';
    return label.startsWith(prefix) && label.includes(text);
  });
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  wide();
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

it('identifies the exact selected conversation positions in every bulk action', async () => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <InDrafts />
      </StoreProvider>,
    );
  });

  await act(async () => buttonContaining('Select conversation', 'casey@example.edu')?.click());
  await act(async () => buttonContaining('Select conversation', 'avery@example.edu')?.click());

  const target = '2 selected conversations, positions 1 and 3 of 3';
  expect(host.querySelector(`button[aria-label="Archive ${target} here"]`)).not.toBeNull();
  expect(host.querySelector(`button[aria-label="Move ${target} to trash here"]`)).not.toBeNull();
  expect(host.querySelector(`button[aria-label="Move ${target} to another folder"]`)).not.toBeNull();
  expect(host.querySelector(`button[aria-label="Snooze ${target}"]`)).not.toBeNull();
  expect(host.querySelector(`button[aria-label="Mark ${target} read"]`)).not.toBeNull();

  await act(async () => {
    host.querySelector<HTMLButtonElement>(`button[aria-label="Move ${target} to trash here"]`)?.click();
  });

  expect(buttonContaining('Open conversation', 'casey@example.edu')).toBeUndefined();
  expect(buttonContaining('Open conversation', 'avery@example.edu')).toBeUndefined();
  expect(buttonContaining('Open conversation', 'blake@example.edu')).toBeDefined();
});
