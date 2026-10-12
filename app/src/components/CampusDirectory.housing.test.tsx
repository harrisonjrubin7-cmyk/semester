// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_HOUSING, housingPlanKey } from '../lib/portal-storage';
import { HousingPlanner } from './CampusDirectory';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TERM = '2026FA';
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const render = (accountId: string | null) =>
  act(async () => root.render(<HousingPlanner choice="" term={TERM} accountId={accountId} />));

const residence = () =>
  [...host.querySelectorAll('label')]
    .find((label) => label.textContent?.startsWith('Preferred residence'))!
    .querySelector('input') as HTMLInputElement;

const type = (input: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

describe('housing application-plan account isolation', () => {
  it('never adopts the ambiguous legacy term-only draft or another account draft', async () => {
    const legacy = { ...EMPTY_HOUSING, residence: 'Legacy Hall', roommate: 'Legacy roommate' };
    const mine = { ...EMPTY_HOUSING, residence: 'Account A Hall' };
    localStorage.setItem(`semester.housing-plan.${TERM}`, JSON.stringify(legacy));
    localStorage.setItem(housingPlanKey('account-a', TERM), JSON.stringify(mine));

    await render('account-b');
    expect(residence().value).toBe('');
    expect(host.textContent).toContain('Changes save for this account on this device');

    await type(residence(), 'Account B Hall');
    expect(JSON.parse(localStorage.getItem(housingPlanKey('account-b', TERM))!).residence).toBe('Account B Hall');
    expect(JSON.parse(localStorage.getItem(housingPlanKey('account-a', TERM))!).residence).toBe('Account A Hall');
    expect(JSON.parse(localStorage.getItem(`semester.housing-plan.${TERM}`)!).residence).toBe('Legacy Hall');

    await render('account-a');
    expect(residence().value).toBe('Account A Hall');
  });
});
