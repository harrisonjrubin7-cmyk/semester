// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { School } from '../lib/school';

const duplicate = (id: string): School => ({
  id,
  name: 'Riverview College',
  verified: false,
  capabilities: { mealPlan: 'none', housing: false, campusMap: false },
  data: {},
});

const mock = vi.hoisted(() => ({
  dispatch: vi.fn(),
  schools: [] as School[],
}));

vi.mock('../state/store', () => ({
  useStore: () => ({
    state: {
      mySchools: mock.schools,
      schoolPack: null,
      schoolId: mock.schools[0]?.id ?? '',
    },
    dispatch: mock.dispatch,
    school: mock.schools[0],
    account: null,
  }),
}));

vi.mock('./SchoolPackDoor', () => ({ SchoolPackDoor: () => null }));

import { SchoolPicker } from './SchoolPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mock.dispatch.mockClear();
  mock.schools = [duplicate('riverview'), duplicate('riverview-2')];
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it('distinguishes duplicate custom profiles and forgets only the represented school', () => {
  act(() => root.render(<SchoolPicker />));

  const first = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Forget custom school 1 of 2, Riverview College · currently selected"]',
  );
  const second = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Forget custom school 2 of 2, Riverview College · not selected"]',
  );
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();

  act(() => second!.click());

  expect(mock.dispatch).toHaveBeenCalledTimes(1);
  expect(mock.dispatch).toHaveBeenCalledWith({ type: 'forgetSchool', id: 'riverview-2' });
});
