// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { Connect } from './Connect';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  sessionStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    term: '2026FA',
    feeds: [
      {
        id: 'course-dates-import',
        kind: 'ics',
        name: 'Course dates',
        url: '',
        added: 1,
        synced: 2,
        status: '2 events read',
        count: 2,
      },
      {
        id: 'course-dates-subscription',
        kind: 'ics',
        name: 'Course dates',
        url: 'https://calendar.example.edu/private.ics',
        added: 3,
        synced: 4,
        status: '1 event read',
        count: 1,
      },
    ],
    feedEvents: [
      {
        id: 'import-event',
        sourceId: 'course-dates-import',
        title: 'Midterm',
        date: '2026-10-20',
        at: 540,
        time: '9:00 AM',
        where: 'Calhoun 101',
        note: '',
        courseId: null,
      },
      {
        id: 'subscription-event',
        sourceId: 'course-dates-subscription',
        title: 'Study group',
        date: '2026-10-22',
        at: 1080,
        time: '6:00 PM',
        where: 'Commons',
        note: '',
        courseId: null,
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
        <Connect />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  sessionStorage.clear();
});

it('identifies duplicate calendar-source removals and removes only the represented source', async () => {
  const imported = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove connected source 1 of 2, Course dates: one-time calendar import · 2 events · 2 events read"]',
  );
  const subscribed = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove connected source 2 of 2, Course dates: calendar subscription · 1 event · 1 event read"]',
  );

  expect(imported).not.toBeNull();
  expect(subscribed).not.toBeNull();

  await act(async () => subscribed?.click());

  expect(seen.feeds.map((feed) => feed.id)).toEqual(['course-dates-import']);
  expect(seen.feedEvents.map((event) => event.id)).toEqual(['import-event']);
  expect(seen.undone?.label).toBe('Calendar and its events removed');
});
