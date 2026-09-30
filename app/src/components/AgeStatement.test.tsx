// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AgeStatement } from './AgeStatement';
import type { AgeStatus, stateMyAge } from '../lib/cloud';

type State = typeof stateMyAge;

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

async function show(status: AgeStatus, state = vi.fn<State>(async () => 'adult')) {
  await act(async () => {
    root.render(<AgeStatement status={async () => status} state={state} />);
  });
  return state;
}

function type(el: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const input = () => host.querySelector('#age-born') as HTMLInputElement | null;
const save = () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Save') as HTMLButtonElement;

describe('the age statement', () => {
  it('shows nothing to an adult', async () => {
    await show('adult');
    expect(host.textContent).toBe('');
  });

  it('asks an account that never said, once, and says the date is not kept', async () => {
    await show('unknown');
    expect(input()).not.toBeNull();
    expect(host.textContent).toMatch(/The date itself is not kept, and it cannot be changed later/);
  });

  it('sends the date, and then shows the standing instead of the question', async () => {
    const state = vi.fn<State>(async () => 'minor');
    await show('unknown', state);
    type(input()!, '2011-03-04');
    await act(async () => save().click());
    expect(state).toHaveBeenCalledWith('2011-03-04');
    expect(input()).toBeNull();
    expect(host.textContent).toMatch(/stay off until your 18th birthday/);
  });

  it('refuses a date that is not one without sending it', async () => {
    const state = await show('unknown');
    type(input()!, '3000-01-01');
    await act(async () => save().click());
    expect(state).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/does not look right/);
  });

  it('tells a minor what stays theirs', async () => {
    await show('minor');
    expect(input()).toBeNull();
    expect(host.textContent).toMatch(/report anything and share with a parent or guardian/);
  });

  it('tells an account under 13 that nothing involving others is available', async () => {
    await show('under_minimum');
    expect(host.textContent).toMatch(/for people 13 and over/);
  });
});
