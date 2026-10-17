// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY, type State } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { People } from './People';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VISIT_AT = new Date(2026, 9, 15, 12).getTime();
const VISIT_DAY = new Date(VISIT_AT).toDateString().slice(4);

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

function button(name: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
}

function buttonContaining(name: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.includes(name),
  );
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    people: [
      {
        id: 'professor',
        name: 'Dr. Rivera',
        role: 'Professor',
        courseId: '',
        email: '',
        note: '',
        created: 1,
      },
    ],
    visits: [
      { id: 'visit-grant', personId: 'professor', at: VISIT_AT, what: 'Grant proposal', working: '' },
      { id: 'visit-thesis-one', personId: 'professor', at: VISIT_AT, what: 'Thesis outline', working: '' },
      { id: 'visit-thesis-two', personId: 'professor', at: VISIT_AT, what: 'Thesis outline', working: '' },
    ],
    letters: [
      {
        id: 'letter-october',
        personId: 'professor',
        forWhat: 'Research fellowship',
        due: '2027-10-15',
        stage: 'thinking',
        askedOn: '',
        sentMaterials: false,
        thanked: false,
        note: '',
      },
      {
        id: 'letter-november',
        personId: 'professor',
        forWhat: 'Research fellowship',
        due: '2027-11-15',
        stage: 'asked',
        askedOn: '2026-10-15',
        sentMaterials: false,
        thanked: false,
        note: '',
      },
      {
        id: 'letter-november-copy',
        personId: 'professor',
        forWhat: 'Research fellowship',
        due: '2027-11-15',
        stage: 'asked',
        askedOn: '2026-10-15',
        sentMaterials: false,
        thanked: false,
        note: '',
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
        <People />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

it('identifies exact-duplicate conversation removals by represented position', async () => {
  await act(async () => buttonContaining('Dr. Rivera')?.click());

  const grant = host.querySelector<HTMLButtonElement>(
    `button[aria-label="Remove conversation 1 of 3 with Dr. Rivera from ${VISIT_DAY}: Grant proposal"]`,
  );
  const firstThesis = host.querySelector<HTMLButtonElement>(
    `button[aria-label="Remove conversation 2 of 3 with Dr. Rivera from ${VISIT_DAY}: Thesis outline"]`,
  );
  const secondThesis = host.querySelector<HTMLButtonElement>(
    `button[aria-label="Remove conversation 3 of 3 with Dr. Rivera from ${VISIT_DAY}: Thesis outline"]`,
  );

  expect(grant).not.toBeNull();
  expect(firstThesis).not.toBeNull();
  expect(secondThesis).not.toBeNull();

  await act(async () => secondThesis?.click());

  expect(seen.visits.map((visit) => visit.id)).toEqual(['visit-grant', 'visit-thesis-one']);
  expect(seen.undone?.label).toBe('Conversation removed');
});

it('identifies exact-duplicate letter removals by represented position', async () => {
  await act(async () => button('Letters (3)')?.click());

  const thinking = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove letter 1 of 3, Research fellowship from Dr. Rivera: due 2027-10-15 · Thinking about it"]',
  );
  const firstAsked = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove letter 2 of 3, Research fellowship from Dr. Rivera: due 2027-11-15 · Asked"]',
  );
  const secondAsked = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove letter 3 of 3, Research fellowship from Dr. Rivera: due 2027-11-15 · Asked"]',
  );

  expect(thinking).not.toBeNull();
  expect(firstAsked).not.toBeNull();
  expect(secondAsked).not.toBeNull();

  await act(async () => secondAsked?.click());

  expect(seen.letters.map((letter) => letter.id)).toEqual(['letter-october', 'letter-november']);
  expect(seen.undone?.label).toBe('Letter removed');
});
