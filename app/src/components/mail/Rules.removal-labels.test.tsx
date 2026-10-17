// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Rule } from '../../lib/mailrules';
import { Rules } from './Rules';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rule = (id: string): Rule => ({
  id,
  name: 'Course updates',
  when: 'course:econ',
  folder: 'archive',
  created: 1,
});

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('distinguishes exact duplicate rules and removes only the represented rule', async () => {
  const rules = [rule('rule-one'), rule('rule-two')];
  const onDrop = vi.fn();

  await act(async () => {
    root.render(
      <Rules
        rules={rules}
        mails={[]}
        seed={null}
        onPut={vi.fn()}
        onDrop={onDrop}
        onClose={vi.fn()}
      />,
    );
  });

  const expected = [
    'Delete mail rule 1 of 2, Course updates: Mail matching course:econ will skip the inbox. · on',
    'Delete mail rule 2 of 2, Course updates: Mail matching course:econ will skip the inbox. · on',
  ];
  const labels = [...host.querySelectorAll<HTMLButtonElement>('button')]
    .map((button) => button.getAttribute('aria-label'))
    .filter((label): label is string => Boolean(label?.startsWith('Delete mail rule')));

  expect(labels).toEqual(expected);

  const second = host.querySelector<HTMLButtonElement>(`button[aria-label="${expected[1]}"]`);
  expect(second).not.toBeNull();

  await act(async () => second?.click());

  expect(onDrop).toHaveBeenCalledTimes(1);
  expect(onDrop).toHaveBeenCalledWith('rule-two');
});
